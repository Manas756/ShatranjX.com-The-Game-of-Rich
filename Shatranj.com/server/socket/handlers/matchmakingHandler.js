const { TIME_CONTROLS } = require('../../config/constants');
const logger = require('../../utils/logger');

function registerMatchmakingHandlers(io, socket, { matchmakingQueue, roomManager, gameManager }) {
  socket.on('matchmaking:join', (payload = {}) => {
    try {
      const { timeControl = 'blitz5', username } = payload;
      if (!TIME_CONTROLS[timeControl]) {
        socket.emit('room:error', { message: 'Invalid time control' });
        return;
      }
      if (username) socket.data.username = username;

      const result = matchmakingQueue.enqueue(
        socket.id,
        socket.data.playerId,
        socket.data.username,
        timeControl,
        socket
      );

      if (!result.matched) {
        socket.emit('matchmaking:waiting', {
          position: result.position,
          estimatedWait: result.estimatedWait,
        });
        return;
      }

      const room = roomManager.create({ timeControl });
      const whiteFirst = Math.random() < 0.5;

      const p1 = { socket: socket, color: whiteFirst ? 'w' : 'b' };
      const p2 = { socket: result.opponent.socket, color: whiteFirst ? 'b' : 'w' };

      [p1, p2].forEach(({ socket: s, color }) => {
        roomManager.join(room.roomId, s.id, s.data.playerId, s.data.username, color);
        s.join(room.roomId);
        s.data.roomId = room.roomId;
      });

      const game = gameManager.create(
        room.roomId,
        { white: room.players.white, black: room.players.black },
        timeControl,
        {
          onTimeout: (g, loser, winner) => {
            io.to(room.roomId).emit('game:timer:timeout', { loser, winner });
            io.to(room.roomId).emit('game:over', { reason: 'timeout', winner, pgn: g.getPGN(), finalFen: g.getFEN() });
            gameManager.scheduleDestroy(g.gameId);
          },
        }
      );
      room.setGameId(game.gameId);
      gameManager.startGame(game.gameId);

      [p1, p2].forEach(({ socket: s, color }) => {
        const opponent = color === 'w' ? room.players.black : room.players.white;
        s.emit('matchmaking:found', {
          roomId: room.roomId,
          opponentName: opponent.username,
          color,
          timeControl,
        });
        s.emit('game:start', {
          fen: game.getFEN(),
          color,
          whitePlayer: room.players.white,
          blackPlayer: room.players.black,
          timeControl,
        });
      });
    } catch (err) {
      logger.error('matchmaking:join failed', { err: err.message });
    }
  });

  socket.on('matchmaking:cancel', () => {
    matchmakingQueue.dequeue(socket.id);
    socket.emit('matchmaking:cancelled', {});
  });
}

module.exports = registerMatchmakingHandlers;
