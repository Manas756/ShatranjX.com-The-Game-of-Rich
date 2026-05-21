const { TIMER_TICK_MS } = require('../config/constants');

/**
 * Server-authoritative chess clock.
 * Composed into GameInstance — never owns game rules, only time.
 */
class TimerManager {
  constructor(timeControl) {
    const preset =
      typeof timeControl === 'string'
        ? require('../config/constants').TIME_CONTROLS[timeControl]
        : timeControl;

    if (!preset) {
      throw new Error(`Unknown time control: ${timeControl}`);
    }

    this.initial = preset.initial;
    this.increment = preset.increment ?? 0;
    this.white = preset.initial;
    this.black = preset.initial;
    this.activeColor = null;
    this.running = false;
    this.paused = false;
    this.lastTickAt = null;
    this.lastSyncAt = Date.now();
    this._tickInterval = null;
    this._timeoutCallback = null;
    this._timedOutColor = null;
  }

  start(activeColor = 'w') {
    this.activeColor = activeColor;
    this.running = true;
    this.paused = false;
    this.lastTickAt = Date.now();
    this._startTicking();
  }

  switch() {
    if (!this.activeColor) return;

    const now = Date.now();
    this._deductElapsed(now);

    const finished = this.activeColor;
    this[finished === 'w' ? 'white' : 'black'] += this.increment;

    this.activeColor = finished === 'w' ? 'b' : 'w';
    this.lastTickAt = now;
    this.lastSyncAt = now;
  }

  pause() {
    if (!this.running || this.paused) return;
    this._deductElapsed(Date.now());
    this.paused = true;
    this.running = false;
    this._stopTicking();
  }

  resume() {
    if (!this.paused || !this.activeColor) return;
    this.paused = false;
    this.running = true;
    this.lastTickAt = Date.now();
    this._startTicking();
  }

  _deductElapsed(now) {
    if (!this.activeColor || !this.lastTickAt) return;

    const elapsed = now - this.lastTickAt;
    const key = this.activeColor === 'w' ? 'white' : 'black';
    this[key] = Math.max(0, this[key] - elapsed);
    this.lastTickAt = now;
    this.lastSyncAt = now;

    if (this[key] <= 0) {
      this._handleTimeout(this.activeColor);
    }
  }

  getState() {
    const now = Date.now();
    let white = this.white;
    let black = this.black;

    if (this.running && !this.paused && this.activeColor && this.lastTickAt) {
      const elapsed = now - this.lastTickAt;
      if (this.activeColor === 'w') {
        white = Math.max(0, white - elapsed);
      } else {
        black = Math.max(0, black - elapsed);
      }
    }

    return {
      white: Math.round(white),
      black: Math.round(black),
      activeColor: this.activeColor,
      running: this.running && !this.paused,
      paused: this.paused,
      lastSyncAt: this.lastSyncAt,
    };
  }

  getTimeRemaining(color) {
    const state = this.getState();
    return {
      white: state.white,
      black: state.black,
      [color === 'w' ? 'white' : 'black']: state[color === 'w' ? 'white' : 'black'],
    };
  }

  isTimedOut(color) {
    const state = this.getState();
    const ms = color === 'w' ? state.white : state.black;
    return ms <= 0;
  }

  handleTick() {
    if (!this.running || this.paused || !this.activeColor) return;

    const now = Date.now();
    const key = this.activeColor === 'w' ? 'white' : 'black';
    const elapsed = now - (this.lastTickAt || now);
    this[key] = Math.max(0, this[key] - elapsed);
    this.lastTickAt = now;

    if (this[key] <= 0) {
      this._handleTimeout(this.activeColor);
    }
  }

  _handleTimeout(color) {
    if (this._timedOutColor) return;
    this._timedOutColor = color;
    this.running = false;
    this._stopTicking();
    if (this._timeoutCallback) {
      this._timeoutCallback(color);
    }
  }

  handleTimeout(color) {
    this._handleTimeout(color);
  }

  onTimeout(callback) {
    this._timeoutCallback = callback;
  }

  _startTicking() {
    if (this._tickInterval) return;
    this._tickInterval = setInterval(() => this.handleTick(), TIMER_TICK_MS);
  }

  _stopTicking() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  destroy() {
    this._stopTicking();
    this._timeoutCallback = null;
    this.running = false;
  }
}

module.exports = TimerManager;
