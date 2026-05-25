export class TimerUI {
  constructor(whiteEl, blackEl) {
    this.whiteEl = whiteEl;
    this.blackEl = blackEl;
    this.display = { white: 0, black: 0, activeColor: 'w' };
    this._target = { white: 0, black: 0 };
    this._lastSync = Date.now();
    this._raf = null;
    this._lowTimePlayed = false;
  }

  sync({ white, black, activeColor }) {
    this._target = { white, black };
    this.display = { white, black, activeColor };
    this._lastSync = Date.now();
    this._render();
    this._startInterpolation();
  }

  _startInterpolation() {
    if (this._raf) cancelAnimationFrame(this._raf);
    const tick = () => {
      const elapsed = Date.now() - this._lastSync;
      let { white, black } = this._target;
      if (this.display.activeColor === 'w') white = Math.max(0, white - elapsed);
      else black = Math.max(0, black - elapsed);
      this._updateEl(this.whiteEl, white, 'w');
      this._updateEl(this.blackEl, black, 'b');
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _updateEl(el, ms, color) {
    if (!el) return;
    const secs = ms / 1000;
    if (secs <= 10) {
      el.textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}:${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`;
      el.classList.add('timer-low');
    } else {
      el.textContent = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
      el.classList.remove('timer-low');
    }
    if (secs <= 30) el.classList.add('timer-warn');
    else el.classList.remove('timer-warn');
    if (this.display.activeColor === color) el.classList.add('timer-active');
    else el.classList.remove('timer-active');
    if (secs <= 10 && !this._lowTimePlayed) {
      this._lowTimePlayed = true;
      el.dispatchEvent(new CustomEvent('timer:low'));
    }
  }

  _render() {
    this._updateEl(this.whiteEl, this.display.white, 'w');
    this._updateEl(this.blackEl, this.display.black, 'b');
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}
