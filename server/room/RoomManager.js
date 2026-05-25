const RoomInstance = require('./RoomInstance');
const { ROOM_INACTIVITY_MS, ROOM_STATUS } = require('../config/constants');
const { generateRoomId } = require('../utils/idGenerator');
const logger = require('../utils/logger');

/**
 * Room lifecycle — creation, lookup, cleanup. Decoupled from Socket.io.
 */
class RoomManager {
  constructor(options = {}) {
    this._rooms = new Map();
    this._byInvite = new Map();
    this._maxRooms = options.maxRooms ?? 10_000;
    this._cleanupInterval = setInterval(() => this._cleanupStale(), 5 * 60_000);
  }

  create(options = {}) {
    if (this._rooms.size >= this._maxRooms) {
      throw new Error('Maximum room capacity reached');
    }

    let roomId = options.roomId;
    if (!roomId) {
      do {
        roomId = generateRoomId();
      } while (this._rooms.has(roomId));
    }

    const inviteCode = options.inviteCode || roomId;
    const room = new RoomInstance(roomId, { ...options, inviteCode });
    this._rooms.set(roomId, room);
    this._byInvite.set(inviteCode.toUpperCase(), roomId);
    logger.info('Room created', { roomId, timeControl: options.timeControl });
    return room;
  }

  get(roomId) {
    return this._rooms.get(roomId?.toUpperCase?.() || roomId) || null;
  }

  getByInviteCode(code) {
    const roomId = this._byInvite.get((code || '').toUpperCase());
    return roomId ? this._rooms.get(roomId) : null;
  }

  join(roomId, socketId, playerId, username, preferredColor) {
    const room = this.get(roomId);
    if (!room) return { success: false, reason: 'room_not_found' };

    const existing = room.getPlayerById(playerId);
    if (existing) {
      if (existing.color === 'w') {
        room.players.white.socketId = socketId;
        room.playerSlots.white = socketId;
      } else {
        room.players.black.socketId = socketId;
        room.playerSlots.black = socketId;
      }
      room.touch();
      return { success: true, room, color: existing.color, reconnected: true };
    }

    const assignment = room.assignPlayer(socketId, playerId, username, preferredColor);
    if (!assignment) {
      return { success: false, reason: 'room_full' };
    }

    room.updateStatus();
    return { success: true, room, color: assignment.color, reconnected: false };
  }

  spectate(roomId, socketId, meta) {
    const room = this.get(roomId);
    if (!room) return { success: false, reason: 'room_not_found' };
    return room.addSpectator(socketId, meta);
  }

  /**
   * Page navigation drops the socket — keep the seat so the same playerId can rejoin.
   */
  markSocketDisconnected(socketId) {
    for (const room of this._rooms.values()) {
      if (room.playerSlots.white === socketId) {
        room.playerSlots.white = null;
        room.touch();
        return { room, color: 'w' };
      }
      if (room.playerSlots.black === socketId) {
        room.playerSlots.black = null;
        room.touch();
        return { room, color: 'b' };
      }
      if (room.spectators.has(socketId)) {
        room.spectators.delete(socketId);
        room.touch();
        return { room, role: 'spectator' };
      }
    }
    return null;
  }

  leave(socketId) {
    for (const room of this._rooms.values()) {
      const removedColor = room.removePlayer(socketId);
      if (removedColor) {
        room.updateStatus();
        if (room.isEmpty()) {
          this.remove(room.roomId);
        }
        return { room, role: 'player', color: removedColor };
      }

      if (room.spectators.has(socketId)) {
        room.removeSpectator(socketId);
        if (room.isEmpty()) {
          this.remove(room.roomId);
        }
        return { room, role: 'spectator' };
      }
    }
    return null;
  }

  remove(roomId) {
    const room = this._rooms.get(roomId);
    if (!room) return false;

    room.destroy();
    this._rooms.delete(roomId);
    this._byInvite.delete(room.inviteCode.toUpperCase());
    logger.info('Room removed', { roomId });
    return true;
  }

  _cleanupStale() {
    const now = Date.now();
    for (const [roomId, room] of this._rooms.entries()) {
      if (now - room.lastActivityAt > ROOM_INACTIVITY_MS) {
        logger.info('Removing inactive room', { roomId });
        this.remove(roomId);
      }
    }
  }

  getCount() {
    return this._rooms.size;
  }

  getOnlinePlayerCount() {
    let count = 0;
    for (const room of this._rooms.values()) {
      if (room.players.white) count++;
      if (room.players.black) count++;
      count += room.spectators.size;
    }
    return count;
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    for (const roomId of [...this._rooms.keys()]) {
      this.remove(roomId);
    }
  }
}

module.exports = RoomManager;
