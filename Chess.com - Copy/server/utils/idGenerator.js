const crypto = require('crypto');

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 6;

/**
 * Cryptographically random room codes — avoids sequential enumeration.
 */
function generateRoomId() {
  const bytes = crypto.randomBytes(ROOM_ID_LENGTH);
  let id = '';
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_CHARS[bytes[i] % ROOM_ID_CHARS.length];
  }
  return id;
}

function generateGameId() {
  return crypto.randomUUID();
}

module.exports = {
  generateRoomId,
  generateGameId,
};
