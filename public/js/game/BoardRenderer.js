const PIECE_UNICODE = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

const FILES = 'abcdefgh';

export class BoardRenderer {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.flipped = options.flipped ?? false;
    this.theme = options.theme ?? 'classic';
    this.showCoordinates = options.showCoordinates ?? true;
    this.animationSpeed = options.animationSpeed ?? 200;
    this.container.classList.add('board-renderer', `theme-${this.theme}`);
    if (this.flipped) this.container.classList.add('flipped');
    this._squares = new Map();
    this._buildBoard();
  }

  _buildBoard() {
    this.container.innerHTML = '';
    this.container.classList.add('chessboard-grid');
    const order = this._rankFileOrder();
    for (const { rank, file } of order) {
      const sq = `${file}${rank}`;
      const el = document.createElement('div');
      el.className = `square ${(rank.charCodeAt(0) - 49 + FILES.indexOf(file)) % 2 === 0 ? 'light' : 'dark'}`;
      el.dataset.square = sq;
      if (this.showCoordinates) {
        if (file === (this.flipped ? 'h' : 'a')) {
          const coord = document.createElement('span');
          coord.className = 'coord rank-coord';
          coord.textContent = rank;
          el.appendChild(coord);
        }
        if (rank === (this.flipped ? '8' : '1')) {
          const coord = document.createElement('span');
          coord.className = 'coord file-coord';
          coord.textContent = file;
          el.appendChild(coord);
        }
      }
      this.container.appendChild(el);
      this._squares.set(sq, el);
    }
  }

  _rankFileOrder() {
    const ranks = this.flipped ? '12345678' : '87654321';
    const files = this.flipped ? 'hgfedcba' : 'abcdefgh';
    const order = [];
    for (const rank of ranks) {
      for (const file of files) order.push({ rank, file });
    }
    return order;
  }

  render(fen, chess) {
    const board = chess.board();
    const order = [];
    for (let rank = 8; rank >= 1; rank--) {
    for (const file of FILES) {
    order.push({ rank: String(rank), file });
    }
   }
    let idx = 0;
    for (const row of board) {
      for (const piece of row) {
        const { rank, file } = order[idx++];
        const sq = `${file}${rank}`;
        const el = this._squares.get(sq);
        const existing = el.querySelector('.piece');
        if (existing) existing.remove();
        if (piece) {
          const p = document.createElement('div');
          const key = `${piece.color}${piece.type}`;
          p.className = `piece ${piece.color === 'w' ? 'white' : 'black'}`;
          p.textContent = PIECE_UNICODE[key];
          p.dataset.piece = key;
          el.appendChild(p);
        }
      }
    }
  }

  animateMove(from, to, piece, onComplete) {
    const fromEl = this._squares.get(from)?.querySelector('.piece');
    const toEl = this._squares.get(to);
    if (!fromEl || !toEl) {
      onComplete?.();
      return;
    }
    const clone = fromEl.cloneNode(true);
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();
    clone.style.position = 'fixed';
    clone.style.left = `${fromRect.left}px`;
    clone.style.top = `${fromRect.top}px`;
    clone.style.width = `${fromRect.width}px`;
    clone.style.height = `${fromRect.height}px`;
    clone.style.zIndex = '100';
    clone.style.transition = `transform ${this.animationSpeed}ms ease`;
    clone.style.willChange = 'transform';
    document.body.appendChild(clone);
    fromEl.style.opacity = '0';
    requestAnimationFrame(() => {
      clone.style.transform = `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px)`;
    });
    setTimeout(() => {
      clone.remove();
      fromEl.style.opacity = '';
      onComplete?.();
    }, this.animationSpeed);
  }

  flipBoard() {
    this.flipped = !this.flipped;
    this.container.classList.toggle('flipped', this.flipped);
    this._buildBoard();
  }

  setTheme(theme) {
    this.container.classList.remove(`theme-${this.theme}`);
    this.theme = theme;
    this.container.classList.add(`theme-${theme}`);
  }

  highlightSquare(square, type) {
    this._squares.get(square)?.classList.add(`highlight-${type}`);
  }

  clearHighlights(type) {
    this._squares.forEach((el) => {
      if (type) el.classList.remove(`highlight-${type}`);
      else el.className = el.className.replace(/highlight-\S+/g, '').trim();
    });
  }

   setshowCoordinates(show) {
    this.showCoordinates = show;
  }

  destroy() {
    this._squares.clear();
    this.container.innerHTML = '';
  }
}

