const { TIME_CONTROLS } = require('../../config/constants');
const logger = require('../../utils/logger');

function registerRoomHandlers(io, socket, { roomManager, gameManager }) {
  const emitError = (message) => socket.emit('room:error', { message });

  const joinSocketRoom = (roomId) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
  };

  socket.on('room:create', (payload = {}, ack) => {
    try {
      const { timeControl = 'blitz5', isPrivate = false, username } = payload;

      if (!TIME_CONTROLS[timeControl]) {
        emitError('Invalid time control');
        return ack?.({ success: false });
      }

      if (username) socket.data.username = username;

      const room = roomManager.create({
        timeControl,
        isPrivate,
        hostId: socket.data.playerId,
      });

      const joinResult = roomManager.join(
        room.roomId,
        socket.id,
        socket.data.playerId,
        socket.data.username,
        'w'
      );

      joinSocketRoom(room.roomId);

      const response = {
        roomId: room.roomId,
        gameId: null,
        color: joinResult.color,
        timeControl,
        inviteCode: room.inviteCode,
      };

      socket.emit('room:created', response);
      ack?.({ success: true, ...response });
    } catch (err) {
      logger.error('room:create failed', { err: err.message });
      emitError(err.message);
      ack?.({ success: false });
    }
  });

  socket.on('room:join', (payload = {}, ack) => {
    try {
      const { roomId, username } = payload;
      if (!roomId) {
        emitError('Room ID required');
        return ack?.({ success: false });
      }

      if (username) socket.data.username = username;

      const room = roomManager.get(roomId) || roomManager.getByInviteCode(roomId);
      if (!room) {
        emitError('Room not found');
        return ack?.({ success: false, message: 'Room not found' });
      }

      const joinResult = roomManager.join(
        room.roomId,
        socket.id,
        socket.data.playerId,
        socket.data.username
      );

      if (!joinResult.success) {
        const msg = joinResult.reason === 'room_not_found' ? 'Room not found' : joinResult.reason === 'room_full' ? 'Room is full' : joinResult.reason;
        emitError(msg);
        return ack?.({ success: false, message: msg });
      }

      joinSocketRoom(room.roomId);
      socket.data.isSpectator = false;

      let game = gameManager.getByRoomId(room.roomId);
      let gameId = game?.gameId || null;

      if (joinResult.reconnected && game) {
        game.markReconnected(socket.data.playerId);
        const payloadReconnect = game.getReconnectPayload(socket.data.playerId);
        socket.emit('game:reconnected', payloadReconnect);
        ack?.({ success: true, reconnected: true, color: joinResult.color, ...payloadReconnect });
        return;
      }

      if (joinResult.reconnected && !game) {
        socket.emit('room:joined', {
          roomId: room.roomId,
          gameId: null,
          color: joinResult.color,
          opponentName: (joinResult.color === 'w' ? room.players.black : room.players.white)?.username || null,
          timeControl: room.timeControl,
        });
        ack?.({ success: true, roomId: room.roomId, color: joinResult.color, reconnected: true });
        return;
      }

      if (room.isFull() && !game) {
        game = gameManager.create(
          room.roomId,
          { white: room.players.white, black: room.players.black },
          room.timeControl,
          {
            onTimeout: (gameInst, loserColor, winner) => {
              io.to(room.roomId).emit('game:timer:timeout', { loser: loserColor, winner });
              io.to(room.roomId).emit('game:over', {
                reason: gameInst.gameOver.reason,
                winner,
                pgn: gameInst.getPGN(),
                finalFen: gameInst.getFEN(),
              });
              gameManager.scheduleDestroy(gameInst.gameId);
            },
            onAbandonment: (gameInst, loserColor, winner) => {
              io.to(room.roomId).emit('game:over', {
                reason: gameInst.gameOver.reason,
                winner,
                pgn: gameInst.getPGN(),
                finalFen: gameInst.getFEN(),
              });
              gameManager.scheduleDestroy(gameInst.gameId);
            },
          }
        );
        room.setGameId(game.gameId);
        gameManager.startGame(game.gameId);

        const baseStart = {
          fen: game.getFEN(),
          whitePlayer: room.players.white,
          blackPlayer: room.players.black,
          timeControl: room.timeControl,
        };

        if (room.players.white?.socketId) {
          io.to(room.players.white.socketId).emit('game:start', { ...baseStart, color: 'w' });
        }
        if (room.players.black?.socketId) {
          io.to(room.players.black.socketId).emit('game:start', { ...baseStart, color: 'b' });
        }
        gameId = game.gameId;
      }

      const opponent =
        joinResult.color === 'w' ? room.players.black : room.players.white;

      socket.emit('room:joined', {
        roomId: room.roomId,
        gameId,
        color: joinResult.color,
        opponentName: opponent?.username || null,
        timeControl: room.timeControl,
      });

      if (opponent && !joinResult.reconnected) {
        socket.to(room.roomId).emit('room:opponent:joined', {
          opponentName: socket.data.username,
          opponentId: socket.data.playerId,
        });
      }

      ack?.({ success: true, roomId: room.roomId, color: joinResult.color });
    } catch (err) {
      logger.error('room:join failed', { err: err.message });
      emitError(err.message);
      ack?.({ success: false });
    }
  });

  socket.on('room:spectate', (payload = {}) => {
    try {
      const { roomId } = payload;
      const room = roomManager.get(roomId);
      if (!room) {
        emitError('Room not found');
        return;
      }

      const result = roomManager.spectate(roomId, socket.id, {
        username: socket.data.username,
      });

      if (!result.success) {
        emitError(result.reason);
        return;
      }

      joinSocketRoom(room.roomId);
      socket.data.isSpectator = true;

      const game = gameManager.getByRoomId(room.roomId);
      socket.emit('room:spectating', {
        roomId: room.roomId,
        gameState: game?.getState() || null,
        players: room.getState().players,
      });
    } catch (err) {
      logger.error('room:spectate failed', { err: err.message });
      emitError(err.message);
    }
  });

  socket.on('room:leave', () => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const game = gameManager.getByRoomId(roomId);
      if (game && !socket.data.isSpectator) {
        game.markDisconnected(socket.data.playerId);
        socket.to(roomId).emit('room:opponent:left', { reason: 'disconnect' });
      }

      roomManager.leave(socket.id);
      socket.leave(roomId);
      socket.data.roomId = null;
      socket.data.isSpectator = false;
    } catch (err) {
      logger.error('room:leave failed', { err: err.message });
    }
  });
}

module.exports = registerRoomHandlers;
