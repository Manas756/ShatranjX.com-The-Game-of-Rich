const path = require('path');
const express = require('express');
const http = require('http');
const { getConfig } = require('./config/environment');
const GameManager = require('./game/GameManager');
const RoomManager = require('./room/RoomManager');
const { initSocket } = require('./socket');
const logger = require('./utils/logger');

const config = getConfig();
const app = express();
const server = http.createServer(app);

const gameManager = new GameManager();
const roomManager = new RoomManager({ maxRooms: config.maxRooms });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    games: gameManager.getActiveCount(),
    rooms: roomManager.getCount(),
    players: roomManager.getOnlinePlayerCount(),
  });
});

app.get('/', (req, res) => {
  res.render('pages/landing', { title: 'Shatranj.com' });
});

app.get('/game', (req, res) => {
  res.render('pages/game', { title: 'Play — Shatranj.com' });
});

app.get('/play', (req, res) => {
  res.render('index', { title: 'Chess Game (Legacy)' });
});

// Leaderboard removed

const socketApi = initSocket(server, config, { gameManager, roomManager });

server.listen(config.port, () => {
  logger.info('Server listening', { port: config.port, env: config.nodeEnv });
});

process.on('SIGTERM', () => {
  socketApi.destroy();
  gameManager.destroy();
  roomManager.destroy();
  server.close();
});

module.exports = { app, server, gameManager, roomManager };
