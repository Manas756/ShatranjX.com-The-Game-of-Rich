const { Chess } = require('chess.js');
const TimerManager = require('./TimerManager');
const { validateMove } = require('./MoveValidator');
const {
  GAME_END_REASONS,
  GAME_STATUS,
  PLAYER_COLORS,
  RECONNECT_GRACE_MS,
  DEFAULT_PROMOTION,
} = require('../config/constants');
const { generateGameId } = require('../utils/idGenerator');
const logger = require('../utils/logger');

/**
 * Authoritative state for a single chess game.
 * Chess.js is private — all access goes through this class.
 */
class GameInstance {
  constructor(roomId, players, timeControl, options = {}) {
    this.gameId = options.gameId || generateGameId();
    this.roomId = roomId;
    this.timeControl = timeControl;

    this.players = {
      w: players.white || null,
      b: players.black || null,
    };

    this._chess = new Chess();
    this.timer = new TimerManager(timeControl);
    this.status = GAME_STATUS.WAITING;
    this.gameOver = { isOver: false, reason: null, winner: null };
    this.drawOffer = null;
    this.rematchRequests = new Set();
    this.moveHistory = [];
    this.lastMove = null;
    this.lastMoveAt = null;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();

    this.disconnectState = {
      w: { disconnected: false, graceTimer: null, disconnectedAt: null },
      b: { disconnected: false, graceTimer: null, disconnectedAt: null },
    };

    this._reconnectGraceMs = options.reconnectGraceMs ?? RECONNECT_GRACE_MS;
    this._onTimeout = options.onTimeout || null;
    this._onAbandonment = options.onAbandonment || null;

    this.timer.onTimeout((color) => this.handleTimeout(color));
  }

  // --- Player / turn helpers ---

  getPlayerColor(playerId) {
    if (this.players.w?.id === playerId) return PLAYER_COLORS.WHITE;
    if (this.players.b?.id === playerId) return PLAYER_COLORS.BLACK;
    return null;
  }

  getOpponentColor(color) {
    return color === PLAYER_COLORS.WHITE ? PLAYER_COLORS.BLACK : PLAYER_COLORS.WHITE;
  }

  getPlayerByColor(color) {
    return this.players[color] || null;
  }

  isPlayersTurn(playerId) {
    const color = this.getPlayerColor(playerId);
    if (!color) return false;
    return this._chess.turn() === color && !this.isOver();
  }

  isOver() {
    return this.gameOver.isOver;
  }

  isTimedOut(color) {
    return this.timer.isTimedOut(color);
  }

  // --- Chess.js encapsulation ---

  isLegalMove(from, to, promotion) {
    const moves = this._chess.moves({ square: from, verbose: true });
    return moves.some(
      (m) =>
        m.from === from &&
        m.to === to &&
        (!m.promotion || (promotion && m.promotion === promotion))
    );
  }

  isPromotion(from, to) {
    const piece = this._chess.get(from);
    if (!piece || piece.type !== 'p') return false;
    const rank = to.charAt(1);
    return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
  }

  getCastlingRights() {
    const fen = this._chess.fen().split(' ');
    return fen[2] || '-';
  }

  getEnPassantSquare() {
    const fen = this._chess.fen().split(' ');
    const ep = fen[3];
    return ep === '-' ? null : ep;
  }

  getFEN() {
    return this._chess.fen();
  }

  getPGN() {
    return this._chess.pgn();
  }

  // --- Game lifecycle ---

  start() {
    if (this.status === GAME_STATUS.ACTIVE) return;
    this.status = GAME_STATUS.ACTIVE;
    this.timer.start(PLAYER_COLORS.WHITE);
    this.lastActivityAt = Date.now();
  }

  makeMove(playerId, from, to, promotion) {
    this.lastActivityAt = Date.now();

    const validation = validateMove(this, playerId, from, to, promotion);
    if (!validation.valid) {
      if (validation.requiresPromotion) {
        return { success: false, requiresPromotion: true, reason: validation.reason };
      }
      return { success: false, reason: validation.reason };
    }

    let moveResult;
    try {
      moveResult = this._chess.move({
        from,
        to,
        promotion: promotion || DEFAULT_PROMOTION,
      });
    } catch (err) {
      logger.debug('Chess.js rejected move', { from, to, err: err.message });
      return { success: false, reason: 'illegal_move' };
    }

    if (!moveResult) {
      return { success: false, reason: 'illegal_move' };
    }

    this.moveHistory.push(moveResult);
    this.lastMove = moveResult;
    this.lastMoveAt = Date.now();
    this.drawOffer = null;

    this.timer.switch();

    const gameState = this.getState();
    const over = this.checkGameOver();

    return {
      success: true,
      move: this._serializeMove(moveResult),
      gameState,
      gameOver: over.isOver ? over : undefined,
      capturedPiece: moveResult.captured || null,
      isCheck: this._chess.inCheck(),
    };
  }

  checkGameOver() {
    if (this.gameOver.isOver) {
      return this.gameOver;
    }

    if (this._chess.isCheckmate()) {
      const winner = this.getOpponentColor(this._chess.turn());
      return this._setGameOver(GAME_END_REASONS.CHECKMATE, winner);
    }

    if (this._chess.isStalemate()) {
      return this._setGameOver(GAME_END_REASONS.STALEMATE, null);
    }

    if (this._chess.isInsufficientMaterial()) {
      return this._setGameOver(GAME_END_REASONS.INSUFFICIENT_MATERIAL, null);
    }

    if (this._chess.isThreefoldRepetition()) {
      return this._setGameOver(GAME_END_REASONS.THREEFOLD_REPETITION, null);
    }

    if (this._chess.isDrawByFiftyMoves()) {
      return this._setGameOver(GAME_END_REASONS.FIFTY_MOVE_RULE, null);
    }

    return { isOver: false, reason: null, winner: null };
  }

  _setGameOver(reason, winner) {
    this.gameOver = { isOver: true, reason, winner };
    this.status = GAME_STATUS.OVER;
    this.timer.pause();
    this.timer.destroy();
    return this.gameOver;
  }

  // --- Timer delegation ---

  startTimer() {
    this.timer.start(this._chess.turn());
  }

  pauseTimer() {
    this.timer.pause();
    if (this.status === GAME_STATUS.ACTIVE) {
      this.status = GAME_STATUS.PAUSED;
    }
  }

  switchTimer() {
    this.timer.switch();
  }

  getTimeRemaining(color) {
    const state = this.timer.getState();
    if (color) {
      return color === 'w' ? state.white : state.black;
    }
    return { white: state.white, black: state.black };
  }

  handleTimeout(color) {
    if (this.isOver()) return this.gameOver;

    const winner = this.getOpponentColor(color);
    this._setGameOver(GAME_END_REASONS.TIMEOUT, winner);

    if (this._onTimeout) {
      this._onTimeout(this, color, winner);
    }

    return this.gameOver;
  }

  // --- Draw ---

  offerDraw(playerId) {
    if (this.isOver()) return { success: false, reason: 'game_over' };
    const color = this.getPlayerColor(playerId);
    if (!color) return { success: false, reason: 'not_a_player' };

    this.drawOffer = { from: playerId, color, at: Date.now() };
    this.lastActivityAt = Date.now();
    return { success: true, drawOffer: this.drawOffer };
  }

  respondDraw(playerId, accept) {
    if (!this.drawOffer) return { success: false, reason: 'no_draw_offer' };
    if (this.drawOffer.from === playerId) {
      return { success: false, reason: 'cannot_accept_own_offer' };
    }

    if (!accept) {
      this.drawOffer = null;
      return { success: true, declined: true };
    }

    this._setGameOver(GAME_END_REASONS.DRAW_AGREEMENT, null);
    return { success: true, accepted: true, gameOver: this.gameOver };
  }

  // --- Resign / rematch ---

  resign(playerId) {
    if (this.isOver()) return { success: false, reason: 'game_over' };

    const color = this.getPlayerColor(playerId);
    if (!color) return { success: false, reason: 'not_a_player' };

    const winner = this.getOpponentColor(color);
    this._setGameOver(GAME_END_REASONS.RESIGNATION, winner);
    this.lastActivityAt = Date.now();

    return { success: true, gameOver: this.gameOver };
  }

  requestRematch(playerId) {
    if (!this.isOver()) return { success: false, reason: 'game_not_over' };
    this.rematchRequests.add(playerId);
    return { success: true, pending: this.rematchRequests.size < 2 };
  }

  acceptRematch(playerId) {
    this.rematchRequests.add(playerId);
    if (this.rematchRequests.size < 2) {
      return { success: true, ready: false };
    }
    return { success: true, ready: true };
  }

  clearRematch() {
    this.rematchRequests.clear();
  }

  // --- Disconnect / reconnect ---

  markDisconnected(playerId) {
    const color = this.getPlayerColor(playerId);
    if (!color || this.isOver()) return null;

    const state = this.disconnectState[color];
    if (state.disconnected) return state;

    state.disconnected = true;
    state.disconnectedAt = Date.now();
    this.pauseTimer();

    state.graceTimer = setTimeout(() => {
      if (!state.disconnected || this.isOver()) return;
      const winner = this.getOpponentColor(color);
      this._setGameOver(GAME_END_REASONS.ABANDONMENT, winner);
      if (this._onAbandonment) {
        this._onAbandonment(this, color, winner);
      }
    }, this._reconnectGraceMs);

    return state;
  }

  markReconnected(playerId) {
    const color = this.getPlayerColor(playerId);
    if (!color) return false;

    const state = this.disconnectState[color];
    if (!state.disconnected) return true;

    state.disconnected = false;
    state.disconnectedAt = null;
    if (state.graceTimer) {
      clearTimeout(state.graceTimer);
      state.graceTimer = null;
    }

    if (this.status === GAME_STATUS.PAUSED && !this.isOver()) {
      this.status = GAME_STATUS.ACTIVE;
      this.timer.resume();
    }

    return true;
  }

  getReconnectPayload(playerId) {
    const color = this.getPlayerColor(playerId);
    const timers = this.timer.getState();

    return {
      gameId: this.gameId,
      roomId: this.roomId,
      fen: this.getFEN(),
      pgn: this.getPGN(),
      color,
      timers: { white: timers.white, black: timers.black, activeColor: timers.activeColor },
      moveHistory: this.moveHistory.map((m) => this._serializeMove(m)),
      gameOver: this.gameOver,
      status: this.status,
    };
  }

  // --- Serializable state ---

  getState() {
    const timers = this.timer.getState();
    return {
      gameId: this.gameId,
      roomId: this.roomId,
      fen: this.getFEN(),
      pgn: this.getPGN(),
      turn: this._chess.turn(),
      status: this.status,
      gameOver: this.gameOver,
      players: {
        white: this.players.w,
        black: this.players.b,
      },
      timers: {
        white: timers.white,
        black: timers.black,
        activeColor: timers.activeColor,
        running: timers.running,
      },
      lastMove: this.lastMove ? this._serializeMove(this.lastMove) : null,
      moveCount: this.moveHistory.length,
      drawOffer: this.drawOffer,
      castlingRights: this.getCastlingRights(),
      enPassantSquare: this.getEnPassantSquare(),
      isCheck: this._chess.inCheck(),
      timeControl: this.timeControl,
    };
  }

  _serializeMove(move) {
    return {
      from: move.from,
      to: move.to,
      san: move.san,
      color: move.color,
      piece: move.piece,
      captured: move.captured || null,
      promotion: move.promotion || null,
      flags: move.flags,
    };
  }

  destroy() {
    for (const color of ['w', 'b']) {
      const state = this.disconnectState[color];
      if (state.graceTimer) {
        clearTimeout(state.graceTimer);
        state.graceTimer = null;
      }
    }
    this.timer.destroy();
    this.rematchRequests.clear();
  }
}

module.exports = GameInstance;
