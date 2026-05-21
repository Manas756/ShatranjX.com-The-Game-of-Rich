/* eslint-disable no-undef */
importScripts('https://cdn.jsdelivr.net/npm/stockfish@16.0.0/src/stockfish.js');

let engine = typeof STOCKFISH === 'function' ? STOCKFISH() : null;

self.onmessage = (e) => {
  const { type, id, fen, depth, moveTime, skillLevel } = e.data;

  if (type === 'init') {
    if (!engine) {
      self.postMessage({ type: 'error', id, message: 'Stockfish failed to load' });
      return;
    }
    engine.onmessage = (line) => {
      if (typeof line === 'string' && line.includes('readyok')) {
        self.postMessage({ type: 'ready', id });
      }
      if (typeof line === 'string' && line.startsWith('bestmove')) {
        const parts = line.split(' ');
        self.postMessage({ type: 'bestmove', id, move: parts[1], ponder: parts[3] });
      }
    };
    engine.postMessage('uci');
    engine.postMessage('isready');
    return;
  }

  if (type === 'go' && engine) {
    engine.postMessage('position fen ' + fen);
    if (skillLevel != null) engine.postMessage(`setoption name Skill Level value ${skillLevel}`);
    if (moveTime) engine.postMessage(`go movetime ${moveTime}`);
    else engine.postMessage(`go depth ${depth || 8}`);
  }

  if (type === 'stop' && engine) {
    engine.postMessage('stop');
  }
};
