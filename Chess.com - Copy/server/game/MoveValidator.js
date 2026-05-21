const { MIN_MOVE_INTERVAL_MS, GAME_STATUS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Server-side move validation — never mutates game state.
 * GameInstance applies moves only after validation passes.
 */
function validateMove(gameInstance, playerId, from, to, promotion) {
  if (!from || !to) {
    return { valid: false, reason: 'invalid_squares' };
  }

  if (gameInstance.isOver()) {
    return { valid: false, reason: 'game_over' };
  }

  if (gameInstance.status !== GAME_STATUS.ACTIVE) {
    return { valid: false, reason: 'game_not_active' };
  }

  if (!gameInstance.isPlayersTurn(playerId)) {
    return { valid: false, reason: 'not_your_turn' };
  }

  const color = gameInstance.getPlayerColor(playerId);
  if (gameInstance.isTimedOut(color)) {
    return { valid: false, reason: 'timeout' };
  }

  const lastMoveAt = gameInstance.lastMoveAt;
  if (lastMoveAt && Date.now() - lastMoveAt < MIN_MOVE_INTERVAL_MS) {
    logger.warn('Suspiciously fast move', {
      gameId: gameInstance.gameId,
      playerId,
      deltaMs: Date.now() - lastMoveAt,
    });
  }

  if (gameInstance.isPromotion(from, to) && !promotion) {
    return { valid: false, requiresPromotion: true, reason: 'promotion_required' };
  }

  const legal = gameInstance.isLegalMove(from, to, promotion);
  if (!legal) {
    return { valid: false, reason: 'illegal_move' };
  }

  return { valid: true };
}

module.exports = {
  validateMove,
};
