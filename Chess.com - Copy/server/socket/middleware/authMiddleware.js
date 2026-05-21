/**
 * Socket auth placeholder — validates session/token when auth is added.
 * Currently attaches anonymous player id from handshake for development.
 */
const { randomUUID } = require('crypto');

function authMiddleware(socket, next) {
  try {
    const { username, playerId } = socket.handshake.auth || {};

    socket.data.playerId = playerId || socket.handshake.sessionID || randomUUID();
    socket.data.username = username || `Guest_${socket.data.playerId.slice(0, 6)}`;
    socket.data.roomId = null;
    socket.data.isSpectator = false;

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
