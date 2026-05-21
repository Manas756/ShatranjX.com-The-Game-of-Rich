const { TIMER_SYNC_INTERVAL_MS } = require('../../config/constants');
const logger = require('../../utils/logger');

/**
 * Broadcasts authoritative timer state to game rooms on an interval.
 */
function startTimerBroadcast(io, gameManager) {
  const interval = setInterval(() => {
    for (const game of gameManager.getAll()) {
      if (game.isOver() || game.status !== 'active') continue;

      const timers = game.timer.getState();
      io.to(game.roomId).emit('game:timer:update', {
        white: timers.white,
        black: timers.black,
        activeColor: timers.activeColor,
      });

    }
  }, TIMER_SYNC_INTERVAL_MS);

  return () => clearInterval(interval);
}

function registerTimerHandlers(io, socket, { gameManager }) {
  socket.on('game:timer:sync', () => {
    try {
      const game = gameManager.getByRoomId(socket.data.roomId);
      if (!game) return;

      const timers = game.timer.getState();
      socket.emit('game:timer:update', {
        white: timers.white,
        black: timers.black,
        activeColor: timers.activeColor,
      });
    } catch (err) {
      logger.error('game:timer:sync failed', { err: err.message });
    }
  });
}

module.exports = {
  registerTimerHandlers,
  startTimerBroadcast,
};
