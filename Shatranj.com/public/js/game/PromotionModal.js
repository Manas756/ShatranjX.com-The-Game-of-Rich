const PIECES = [
  { code: 'q', label: 'Queen', white: '♕', black: '♛' },
  { code: 'r', label: 'Rook', white: '♖', black: '♜' },
  { code: 'b', label: 'Bishop', white: '♗', black: '♝' },
  { code: 'n', label: 'Knight', white: '♘', black: '♞' },
];

export class PromotionModal {
  constructor(overlayEl, { onSelect }) {
    this.overlay = overlayEl;
    this.onSelect = onSelect;
    this._countdown = null;
    this._from = null;
    this._to = null;
    this._color = 'w';
    overlayEl?.addEventListener('click', (e) => {
      if (e.target === overlayEl) this.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (!this.overlay?.classList.contains('visible')) return;
      const map = { q: 'q', r: 'r', b: 'b', n: 'n' };
      if (map[e.key.toLowerCase()]) this._pick(map[e.key.toLowerCase()]);
    });
  }

  show(from, to, color) {
    this._from = from;
    this._to = to;
    this._color = color;
    const grid = this.overlay.querySelector('.promotion-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const p of PIECES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'promotion-option';
      btn.innerHTML = `<span class="promotion-piece">${color === 'w' ? p.white : p.black}</span><span>${p.label}</span>`;
      btn.addEventListener('click', () => this._pick(p.code));
      grid.appendChild(btn);
    }
    this.overlay.classList.add('visible');
    let sec = 5;
    const timerEl = this.overlay.querySelector('.promotion-timer');
    if (timerEl) timerEl.textContent = sec;
    clearInterval(this._countdown);
    this._countdown = setInterval(() => {
      sec--;
      if (timerEl) timerEl.textContent = sec;
      if (sec <= 0) this._pick('q');
    }, 1000);
  }

  _pick(promotion) {
    clearInterval(this._countdown);
    this.hide();
    this.onSelect?.({ from: this._from, to: this._to, promotion });
  }

  hide() {
    clearInterval(this._countdown);
    this.overlay?.classList.remove('visible');
  }
}
