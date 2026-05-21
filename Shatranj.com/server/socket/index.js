const { Server } = require('socket.io');
const authMiddleware = require('./middleware/authMiddleware');
const { RateLimiter } = require('./middleware/rateLimiter');
const registerRoomHandlers = require('./handlers/roomHandler');
const registerGameHandlers = require('./handlers/gameHandler');
const { registerTimerHandlers, startTimerBroadcast } = require('./handlers/timerHandler');
const registerMatchmakingHandlers = require('./handlers/matchmakingHandler');
const MatchmakingQueue = require('../game/MatchmakingQueue');
const logger = require('../utils/logger');

function initSocket(httpServer, config, services) {
  if (!services.matchmakingQueue) {
    services.matchmakingQueue = new MatchmakingQueue();
  }
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: config.isProduction ? ['websocket'] : ['websocket', 'polling'],
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  const rateLimiter = new RateLimiter();
  let stopTimerBroadcast = null;

  io.use(authMiddleware);

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id, playerId: socket.data.playerId });

    socket.join('lobby');
    socket.emit('session:ready', {
      playerId: socket.data.playerId,
      username: socket.data.username,
    });
    io.to('lobby').emit('lobby:stats', {
      playersOnline: services.roomManager.getOnlinePlayerCount() + io.engine.clientsCount,
      gamesInProgress: services.gameManager.getActiveCount(),
    });

    registerRoomHandlers(io, socket, { ...services, rateLimiter });
    registerGameHandlers(io, socket, { ...services, rateLimiter });
    registerTimerHandlers(io, socket, services);
    registerMatchmakingHandlers(io, socket, services);

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { socketId: socket.id, reason });
      rateLimiter.clearSocket(socket.id);

      const roomId = socket.data.roomId;
      if (roomId && !socket.data.isSpectator) {
        const game = services.gameManager.getByRoomId(roomId);
        if (game && !game.isOver()) {
          game.markDisconnected(socket.data.playerId);
          socket.to(roomId).emit('room:opponent:left', { reason: 'disconnect' });
        }
      }

      services.roomManager.markSocketDisconnected(socket.id);
    });
  });

  stopTimerBroadcast = startTimerBroadcast(io, services.gameManager);

  return {
    io,
    destroy: () => {
      if (stopTimerBroadcast) stopTimerBroadcast();
      io.close();
    },
  };
}

module.exports = { initSocket };
