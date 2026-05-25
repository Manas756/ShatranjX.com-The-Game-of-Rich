const DIFFICULTY = {
  1: { depth: 1, skillLevel: 0, moveTime: 100 },
  3: { depth: 3, skillLevel: 3, moveTime: 300 },
  5: { depth: 8, skillLevel: 10, moveTime: 500 },
  7: { depth: 12, skillLevel: 15, moveTime: 1000 },
  10: { depth: 20, skillLevel: 20, moveTime: 2000 },
};

export class StockfishWorker {
  constructor() {
    this.worker = null;
    this._pending = new Map();
    this._id = 0;
    this._difficulty = DIFFICULTY[5];
  }

  async init() {
    this.worker = new Worker('/js/ai/stockfish-worker.js');
    this.worker.onmessage = (e) => this._handleMessage(e.data);
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      const t = setTimeout(() => reject(new Error('Stockfish init timeout')), 15000);
      this._pending.set(id, {
        resolve: () => { clearTimeout(t); resolve(); },
        reject,
      });
      this.worker.postMessage({ type: 'init', id });
    });
  }

  _nextId() {
    return ++this._id;
  }

  _handleMessage(data) {
    const pending = this._pending.get(data.id);
    if (data.type === 'ready' && pending) {
      this._pending.delete(data.id);
      pending.resolve();
    }
    if (data.type === 'bestmove' && pending) {
      this._pending.delete(data.id);
      pending.resolve(data.move);
    }
    if (data.type === 'error' && pending) {
      this._pending.delete(data.id);
      pending.reject(new Error(data.message));
    }
  }

  setDifficulty(level) {
    this._difficulty = DIFFICULTY[level] || DIFFICULTY[5];
  }

  getBestMove(fen, depth, time) {
    const cfg = this._difficulty;
    return new Promise((resolve, reject) => {
      const id = this._nextId();
      const t = setTimeout(() => reject(new Error('Move timeout')), 30000);
      this._pending.set(id, {
        resolve: (move) => { clearTimeout(t); resolve(move); },
        reject,
      });
      this.worker.postMessage({
        type: 'go',
        id,
        fen,
        depth: depth ?? cfg.depth,
        moveTime: time ?? cfg.moveTime,
        skillLevel: cfg.skillLevel,
      });
    });
  }

  destroy() {
    this.worker?.terminate();
    this._pending.clear();
  }
}
