const GameInstance = require('./GameInstance');
const { GAME_DESTROY_DELAY_MS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * In-memory registry of all live games — single source of truth on this process.
 */
class GameManager {
  constructor() {
    this._games = new Map();
    this._byRoom = new Map();
    this._destroyTimers = new Map();
  }

  create(roomId, players, timeControl, options = {}) {
    if (this._byRoom.has(roomId)) {
      const existing = this.getByRoomId(roomId);
      if (existing && !existing.isOver()) {
        throw new Error(`Game already exists for room ${roomId}`);
      }
      this.remove(existing.gameId);
    }

    const game = new GameInstance(roomId, players, timeControl, options);
    this._games.set(game.gameId, game);
    this._byRoom.set(roomId, game.gameId);
    logger.info('Game created', { gameId: game.gameId, roomId });
    return game;
  }

  get(gameId) {
    return this._games.get(gameId) || null;
  }

  getByRoomId(roomId) {
    const gameId = this._byRoom.get(roomId);
    return gameId ? this._games.get(gameId) : null;
  }

  startGame(gameId) {
    const game = this.get(gameId);
    if (!game) return null;
    game.start();
    this._clearDestroyTimer(gameId);
    return game;
  }

  scheduleDestroy(gameId, delayMs = GAME_DESTROY_DELAY_MS) {
    this._clearDestroyTimer(gameId);
    const timer = setTimeout(() => {
      this.remove(gameId);
    }, delayMs);
    this._destroyTimers.set(gameId, timer);
  }

  _clearDestroyTimer(gameId) {
    const timer = this._destroyTimers.get(gameId);
    if (timer) {
      clearTimeout(timer);
      this._destroyTimers.delete(gameId);
    }
  }

  remove(gameId) {
    const game = this._games.get(gameId);
    if (!game) return false;

    game.destroy();
    this._games.delete(gameId);
    this._byRoom.delete(game.roomId);
    this._clearDestroyTimer(gameId);
    logger.info('Game removed', { gameId });
    return true;
  }

  getActiveCount() {
    let count = 0;
    for (const game of this._games.values()) {
      if (!game.isOver()) count++;
    }
    return count;
  }

  getAll() {
    return Array.from(this._games.values());
  }

  destroy() {
    for (const gameId of [...this._games.keys()]) {
      this.remove(gameId);
    }
  }
}

module.exports = GameManager;
