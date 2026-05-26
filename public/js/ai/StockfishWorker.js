export class StockfishWorker {

  constructor() {
    this.engine = null;
  }

  async init() {
    this.engine = new Worker('/stockfish.js');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Stockfish init timed out'));
      }, 10000);

      this.engine.onmessage = (e) => {
        const line = e.data;

        if (line === 'uciok') {
          this.engine.postMessage('isready');
        }

        if (line === 'readyok') {
          clearTimeout(timeout);
          this.engine.onmessage = null;
          resolve();
        }
      };

      this.engine.onerror = (e) => {
        clearTimeout(timeout);
        reject(e);
      };

      this.engine.postMessage('uci');
    });
  }

  setDifficulty(level) {
    const skill = Math.max(0, Math.min(20, level * 2));
    this.engine.postMessage(`setoption name Skill Level value ${skill}`);
  }

  getBestMove(fen) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.engine.onmessage = null;
        reject(new Error('Stockfish timed out'));
      }, 15000);

      this.engine.onmessage = (e) => {
        const line = e.data;

        if (typeof line === 'string' && line.startsWith('bestmove')) {
          clearTimeout(timeout);
          this.engine.onmessage = null;
          resolve(line.split(' ')[1] || null);
        }
      };

      this.engine.postMessage(`position fen ${fen}`);
      this.engine.postMessage('go movetime 1000');
    });
  }

  destroy() {
    if (this.engine) {
      this.engine.terminate();
      this.engine = null;
    }
  }
}