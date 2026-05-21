const VALUE = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const ORDER = ['q', 'r', 'b', 'n', 'p'];

export class CapturedPieces {
  constructor(whiteEl, blackEl, advantageEl) {
    this.whiteEl = whiteEl;
    this.blackEl = blackEl;
    this.advantageEl = advantageEl;
    this.captured = { w: [], b: [] };
  }

  reset() {
    this.captured = { w: [], b: [] };
    this.render();
  }

  add(piece, capturedBy) {
    if (!piece) return;
    const color = capturedBy === 'w' ? 'b' : 'w';
    this.captured[color].push(piece);
    this.render();
  }

  render() {
    const renderSide = (el, pieces, color) => {
      if (!el) return;
      el.innerHTML = '';
      const sorted = [...pieces].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      for (const p of sorted) {
        const span = document.createElement('span');
        span.className = `captured-piece ${color}`;
        span.textContent = { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }[p] || p;
        el.appendChild(span);
      }
    };
    renderSide(this.whiteEl, this.captured.w, 'white');
    renderSide(this.blackEl, this.captured.b, 'black');
    if (this.advantageEl) {
      const w = this.captured.w.reduce((s, p) => s + VALUE[p], 0);
      const b = this.captured.b.reduce((s, p) => s + VALUE[p], 0);
      const diff = w - b;
      this.advantageEl.textContent = diff === 0 ? '' : diff > 0 ? `+${diff}` : `${diff}`;
    }
  }
}
