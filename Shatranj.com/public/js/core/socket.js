import { eventBus } from './eventBus.js';

let socketInstance = null;

const SERVER_EVENTS = [
  'session:ready',
  'room:created', 'room:joined', 'room:spectating', 'room:error',
  'room:opponent:joined', 'room:opponent:left',
  'matchmaking:waiting', 'matchmaking:found', 'matchmaking:cancelled',
  'game:start', 'game:move', 'game:invalid', 'game:over',
  'game:timer:update', 'game:timer:timeout',
  'game:draw:offered', 'game:draw:declined', 'game:draw:accepted',
  'game:resign:received', 'game:rematch:requested', 'game:rematch:accepted', 'game:rematch:declined',
  'game:reconnected', 'spectator:update', 'lobby:stats',
];

export function getSocket(options = {}) {
  if (socketInstance?.connected) return socketInstance;

  const stored = {
    playerId: sessionStorage.getItem('playerId'),
    roomId: sessionStorage.getItem('roomId'),
    username: sessionStorage.getItem('username'),
  };

  socketInstance = io({
    transports: ['websocket', 'polling'],
    auth: {
      username: options.username || stored.username || `Player_${Math.random().toString(36).slice(2, 7)}`,
      playerId: stored.playerId || undefined,
    },
  });

  socketInstance.on('connect', () => {
    eventBus.emit('socket:connected', { id: socketInstance.id });
  });

  socketInstance.on('session:ready', ({ playerId, username }) => {
    persistSession({ playerId, username });
    eventBus.emit('session:ready', { playerId, username });
  });

  socketInstance.on('disconnect', (reason) => {
    eventBus.emit('socket:disconnected', { reason });
  });

  SERVER_EVENTS.forEach((ev) => {
    if (ev === 'session:ready') return;
    socketInstance.on(ev, (data) => eventBus.emit(ev, data));
  });

  socketInstance.on('connect_error', (err) => eventBus.emit('socket:error', { message: err.message }));

  return socketInstance;
}

export function whenSocketReady(socket, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (socket.connected && sessionStorage.getItem('playerId')) {
      resolve(socket);
      return;
    }
    const timer = setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve(socket);
    };
    socket.once('session:ready', done);
    if (!socket.connected) socket.once('connect', () => {});
  });
}

export function persistSession({ playerId, roomId, username }) {
  if (playerId) sessionStorage.setItem('playerId', playerId);
  if (roomId) sessionStorage.setItem('roomId', roomId);
  if (username) sessionStorage.setItem('username', username);
}

export function clearSession() {
  sessionStorage.removeItem('roomId');
}

export default { getSocket, whenSocketReady, persistSession, clearSession };
