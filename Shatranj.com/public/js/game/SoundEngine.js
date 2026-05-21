const SOUNDS = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  castle: '/sounds/castle.mp3',
  promote: '/sounds/promote.mp3',
  gameStart: '/sounds/game-start.mp3',
  gameEnd: '/sounds/game-end.mp3',
};

export class SoundEngine {
  constructor() {
    this.volume = 0.7;
    this.muted = false;
    this.buffers = new Map();
    this.ctx = null;
    this._init();
  }

  async _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      await Promise.all(
        Object.entries(SOUNDS).map(async ([key, url]) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return;
            const buf = await res.arrayBuffer();
            this.buffers.set(key, await this.ctx.decodeAudioData(buf));
          } catch { /* optional assets */ }
        })
      );
    } catch { /* Web Audio unavailable */ }
  }

  _play(key) {
    if (this.muted || !this.ctx) return;
    const buffer = this.buffers.get(key);
    if (!buffer) return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = this.volume;
    src.buffer = buffer;
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(0);
  }

  playMove() { this._play('move'); }
  playCapture() { this._play('capture'); }
  playCheck() { this._play('check'); }
  playCastle() { this._play('castle'); }
  playPromotion() { this._play('promote'); }
  playGameStart() { this._play('gameStart'); }
  playGameEnd() { this._play('gameEnd'); }
  playLowTime() { this._play('check'); }

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); }
  mute() { this.muted = true; }
  unmute() { this.muted = false; }
}
