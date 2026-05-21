import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js';
import { StockfishWorker } from './StockfishWorker.js';

const TIME_PRESETS = {
  bullet1: 60000, blitz5: 300000, rapid10: 600000, classical: 1800000,
};

export class AIGame {
  constructor(playerColor, difficulty = 5, timeControl = 'blitz5') {
    this.chess = new Chess();
    this.playerColor = playerColor;
    this.aiColor = playerColor === 'w' ? 'b' : 'w';
    this.difficulty = difficulty;
    this.initialTime = TIME_PRESETS[timeControl] || 300000;
    this.timers = { white: this.initialTime, black: this.initialTime, activeColor: 'w' };
    this.stockfish = new StockfishWorker();
    this.thinking = false;
    this.onUpdate = null;
    this.onGameOver = null;
    this._timerInterval = null;
  }

  async start() {
    await this.stockfish.init();
    this.stockfish.setDifficulty(this.difficulty);
    this._startClock();
    if (this.aiColor === 'w') await this.requestAIMove();
    this.onUpdate?.(this.getState());
  }

  _startClock() {
    this._lastTick = Date.now();
    this._timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - this._lastTick;
      this._lastTick = now;
      const key = this.timers.activeColor === 'w' ? 'white' : 'black';
      this.timers[key] = Math.max(0, this.timers[key] - elapsed);
      if (this.timers[key] <= 0) {
        this.onGameOver?.({ reason: 'timeout', winner: this.timers.activeColor === 'w' ? 'b' : 'w' });
        this.destroy();
      }
      this.onUpdate?.(this.getState());
    }, 100);
  }

  makePlayerMove(from, to, promotion = 'q') {
    if (this.thinking || this.chess.turn() !== this.playerColor) return { success: false };
    try {
      const move = this.chess.move({ from, to, promotion });
      if (!move) return { success: false, reason: 'illegal' };
      this._switchClock();
      const over = this._checkOver();
      this.onUpdate?.(this.getState());
      if (!over) setTimeout(() => this.requestAIMove(), 50);
      return { success: true, move, gameOver: over };
    } catch {
      return { success: false, reason: 'illegal' };
    }
  }

  async requestAIMove() {
    if (this.chess.isGameOver()) return;
    this.thinking = true;
    this.onUpdate?.(this.getState());
    const start = Date.now();
    const fen = this.chess.fen();
    let uci;
    try {
      uci = await this.stockfish.getBestMove(fen);
    } catch {
      const moves = this.chess.moves({ verbose: true });
      uci = moves[0] ? moves[0].from + moves[0].to : null;
    }
    const elapsed = Date.now() - start;
    if (elapsed < 500) await new Promise((r) => setTimeout(r, 500 - elapsed));
    if (uci && uci.length >= 4) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      this.chess.move({ from, to, promotion });
      this._switchClock();
      this._checkOver();
    }
    this.thinking = false;
    this.onUpdate?.(this.getState());
  }

  _switchClock() {
    const inc = 0;
    const finished = this.timers.activeColor;
    this.timers[finished === 'w' ? 'white' : 'black'] += inc;
    this.timers.activeColor = finished === 'w' ? 'b' : 'w';
    this._lastTick = Date.now();
  }

  _checkOver() {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? 'b' : 'w';
      this.onGameOver?.({ reason: 'checkmate', winner });
      return true;
    }
    if (this.chess.isDraw()) {
      this.onGameOver?.({ reason: 'draw', winner: null });
      return true;
    }
    return false;
  }

  getState() {
    return {
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      turn: this.chess.turn(),
      timers: { ...this.timers },
      thinking: this.thinking,
      isCheck: this.chess.inCheck(),
    };
  }

  destroy() {
    clearInterval(this._timerInterval);
    this.stockfish.destroy();
  }
}
