const { ROOM_STATUS, MAX_SPECTATORS_PER_ROOM } = require('../config/constants');

/**
 * A lobby container — holds player slots, spectators, and links to a game.
 */
class RoomInstance {
  constructor(roomId, options = {}) {
    this.roomId = roomId;
    this.inviteCode = options.inviteCode || roomId;
    this.isPrivate = options.isPrivate ?? false;
    this.timeControl = options.timeControl;
    this.status = ROOM_STATUS.OPEN;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();

    this.hostId = options.hostId || null;
    this.players = {
      white: null,
      black: null,
    };
    this.playerSlots = {
      white: null,
      black: null,
    };

    this.spectators = new Map();
    this.gameId = null;
    this.maxSpectators = options.maxSpectators ?? MAX_SPECTATORS_PER_ROOM;
  }

  touch() {
    this.lastActivityAt = Date.now();
  }

  assignPlayer(socketId, playerId, username, preferredColor = null) {
    this.touch();

    const entry = { id: playerId, socketId, username };

    if (preferredColor === 'w' && !this.players.white) {
      this.players.white = entry;
      this.playerSlots.white = socketId;
      return { color: 'w', player: entry };
    }

    if (preferredColor === 'b' && !this.players.black) {
      this.players.black = entry;
      this.playerSlots.black = socketId;
      return { color: 'b', player: entry };
    }

    if (!this.players.white) {
      this.players.white = entry;
      this.playerSlots.white = socketId;
      return { color: 'w', player: entry };
    }

    if (!this.players.black) {
      this.players.black = entry;
      this.playerSlots.black = socketId;
      return { color: 'b', player: entry };
    }

    return null;
  }

  getPlayerBySocketId(socketId) {
    if (this.playerSlots.white === socketId) return { ...this.players.white, color: 'w' };
    if (this.playerSlots.black === socketId) return { ...this.players.black, color: 'b' };
    return null;
  }

  getPlayerById(playerId) {
    if (this.players.white?.id === playerId) return { ...this.players.white, color: 'w' };
    if (this.players.black?.id === playerId) return { ...this.players.black, color: 'b' };
    return null;
  }

  removePlayer(socketId) {
    this.touch();
    if (this.playerSlots.white === socketId) {
      this.players.white = null;
      this.playerSlots.white = null;
      return 'w';
    }
    if (this.playerSlots.black === socketId) {
      this.players.black = null;
      this.playerSlots.black = null;
      return 'b';
    }
    return null;
  }

  addSpectator(socketId, meta = {}) {
    if (this.spectators.size >= this.maxSpectators) {
      return { success: false, reason: 'spectator_limit' };
    }
    this.spectators.set(socketId, { socketId, joinedAt: Date.now(), ...meta });
    this.touch();
    return { success: true };
  }

  removeSpectator(socketId) {
    this.spectators.delete(socketId);
    this.touch();
  }

  isFull() {
    return Boolean(this.players.white && this.players.black);
  }

  isEmpty() {
    return !this.players.white && !this.players.black && this.spectators.size === 0;
  }

  setGameId(gameId) {
    this.gameId = gameId;
    this.status = ROOM_STATUS.IN_GAME;
    this.touch();
  }

  updateStatus() {
    if (this.isFull()) {
      this.status = ROOM_STATUS.FULL;
    } else if (this.players.white || this.players.black) {
      this.status = ROOM_STATUS.OPEN;
    }
  }

  getState() {
    return {
      roomId: this.roomId,
      inviteCode: this.inviteCode,
      isPrivate: this.isPrivate,
      timeControl: this.timeControl,
      status: this.status,
      gameId: this.gameId,
      players: {
        white: this.players.white,
        black: this.players.black,
      },
      spectatorCount: this.spectators.size,
      isFull: this.isFull(),
    };
  }

  destroy() {
    this.spectators.clear();
    this.players.white = null;
    this.players.black = null;
    this.playerSlots.white = null;
    this.playerSlots.black = null;
    this.status = ROOM_STATUS.CLOSED;
  }
}

module.exports = RoomInstance;
