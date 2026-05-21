const { MATCHMAKING_ACCEPT_MS } = require('../config/constants');

class MatchmakingQueue {
  constructor() {
    this._queues = new Map();
  }

  _getQueue(timeControl) {
    if (!this._queues.has(timeControl)) {
      this._queues.set(timeControl, []);
    }
    return this._queues.get(timeControl);
  }

  enqueue(socketId, playerId, username, timeControl, socket) {
    this.dequeue(socketId);
    const entry = { socketId, playerId, username, timeControl, socket, joinedAt: Date.now() };
    const queue = this._getQueue(timeControl);
    queue.push(entry);

    const opponent = queue.find((e) => e.socketId !== socketId);
    if (opponent) {
      this.dequeue(socketId);
      this.dequeue(opponent.socketId);
      return { matched: true, opponent };
    }

    return {
      matched: false,
      position: queue.length,
      estimatedWait: Math.max(5, queue.length * 3),
    };
  }

  dequeue(socketId) {
    for (const [, queue] of this._queues) {
      const idx = queue.findIndex((e) => e.socketId === socketId);
      if (idx >= 0) queue.splice(idx, 1);
    }
  }

  getQueueStatus(timeControl, socketId) {
    const queue = this._getQueue(timeControl);
    const idx = queue.findIndex((e) => e.socketId === socketId);
    return {
      position: idx + 1,
      playersWaiting: queue.length,
      estimatedWait: Math.max(5, queue.length * 3),
    };
  }
}

module.exports = MatchmakingQueue;
