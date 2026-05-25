const logger = require('../../utils/logger');

function registerGameHandlers(io, socket, { gameManager, roomManager, rateLimiter }) {
  const getGame = () => {
    const roomId = socket.data.roomId;
    if (!roomId) return null;
    return gameManager.getByRoomId(roomId);
  };

  socket.on('game:move', (payload = {}) => {
    try {
      if (rateLimiter) {
        const rl = rateLimiter.check(socket.id, 'GAME_MOVE');
        if (!rl.allowed) {
          socket.emit('game:invalid', { reason: 'rate_limit' });
          return;
        }
      }

      const game = getGame();
      if (!game) {
        socket.emit('game:invalid', { reason: 'no_game' });
        return;
      }

      const { from, to, promotion } = payload;
      const result = game.makeMove(socket.data.playerId, from, to, promotion);

      if (!result.success) {
        if (result.requiresPromotion) {
          socket.emit('game:invalid', { reason: 'promotion_required', from, to });
          return;
        }
        socket.emit('game:invalid', { reason: result.reason });
        return;
      }

      const roomId = socket.data.roomId;
      const broadcast = {
        move: result.move,
        fen: game.getFEN(),
        pgn: game.getPGN(),
        capturedPiece: result.capturedPiece,
        isCheck: result.isCheck,
      };

      if (result.gameOver?.isOver) {
        broadcast.gameOver = result.gameOver;
      }

      io.to(roomId).emit('game:move', broadcast);

      if (result.gameOver?.isOver) {
        io.to(roomId).emit('game:over', {
          reason: result.gameOver.reason,
          winner: result.gameOver.winner,
          pgn: game.getPGN(),
          finalFen: game.getFEN(),
        });
        gameManager.scheduleDestroy(game.gameId);
      }
    } catch (err) {
      logger.error('game:move failed', { err: err.message });
      socket.emit('game:invalid', { reason: 'server_error' });
    }
  });

  socket.on('game:resign', () => {
    try {
      const game = getGame();
      if (!game) return;

      const result = game.resign(socket.data.playerId);
      if (!result.success) {
        socket.emit('game:invalid', { reason: result.reason });
        return;
      }

      const color = game.getPlayerColor(socket.data.playerId);
      io.to(socket.data.roomId).emit('game:resign:received', {
        loser: color,
        winner: result.gameOver.winner,
      });
      io.to(socket.data.roomId).emit('game:over', {
        reason: result.gameOver.reason,
        winner: result.gameOver.winner,
        pgn: game.getPGN(),
        finalFen: game.getFEN(),
      });
      gameManager.scheduleDestroy(game.gameId);
    } catch (err) {
      logger.error('game:resign failed', { err: err.message });
    }
  });

  socket.on('game:draw:offer', () => {
    try {
      const game = getGame();
      if (!game) return;

      const result = game.offerDraw(socket.data.playerId);
      if (!result.success) {
        socket.emit('game:invalid', { reason: result.reason });
        return;
      }

      socket.to(socket.data.roomId).emit('game:draw:offered', { by: socket.data.playerId });
    } catch (err) {
      logger.error('game:draw:offer failed', { err: err.message });
    }
  });

  socket.on('game:draw:respond', (payload = {}) => {
    try {
      const game = getGame();
      if (!game) return;

      const { accept } = payload;
      const result = game.respondDraw(socket.data.playerId, Boolean(accept));

      if (!result.success) {
        socket.emit('game:invalid', { reason: result.reason });
        return;
      }

      if (result.declined) {
        io.to(socket.data.roomId).emit('game:draw:declined', {});
        return;
      }

      if (result.accepted) {
        io.to(socket.data.roomId).emit('game:draw:accepted', {});
        io.to(socket.data.roomId).emit('game:over', {
          reason: result.gameOver.reason,
          winner: null,
          pgn: game.getPGN(),
          finalFen: game.getFEN(),
        });
        gameManager.scheduleDestroy(game.gameId);
      }
    } catch (err) {
      logger.error('game:draw:respond failed', { err: err.message });
    }
  });

  socket.on('game:rematch:request', () => {
    try {
      const game = getGame();
      if (!game) return;

      const result = game.requestRematch(socket.data.playerId);
      if (result.success) {
        socket.to(socket.data.roomId).emit('game:rematch:requested', { by: socket.data.playerId });
      }
    } catch (err) {
      logger.error('game:rematch:request failed', { err: err.message });
    }
  });

  socket.on('game:rematch:accept', () => {
    try {
      const game = getGame();
      if (!game) return;

      const result = game.acceptRematch(socket.data.playerId);
      if (!result.ready) return;

      const room = roomManager.get(socket.data.roomId);
      if (!room) return;

      const newRoom = roomManager.create({
        timeControl: room.timeControl,
        hostId: room.players.white?.id,
      });

      roomManager.join(newRoom.roomId, room.playerSlots.white, room.players.white.id, room.players.white.username, 'w');
      roomManager.join(newRoom.roomId, room.playerSlots.black, room.players.black.id, room.players.black.username, 'b');

      const newGame = gameManager.create(
        newRoom.roomId,
        { white: room.players.white, black: room.players.black },
        room.timeControl
      );
      newRoom.setGameId(newGame.gameId);
      gameManager.startGame(newGame.gameId);

      io.to(socket.data.roomId).emit('game:rematch:accepted', { newRoomId: newRoom.roomId });
    } catch (err) {
      logger.error('game:rematch:accept failed', { err: err.message });
    }
  });
}

module.exports = registerGameHandlers;
