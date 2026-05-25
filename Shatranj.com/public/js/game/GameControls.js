export class GameControls {
  constructor({ onResign, onDrawOffer, onDrawRespond, onRematch }) {
    this.onResign = onResign;
    this.onDrawOffer = onDrawOffer;
    this.onDrawRespond = onDrawRespond;
    this.onRematch = onRematch;
    document.getElementById('btn-resign')?.addEventListener('click', () => {
      if (confirm('Resign this game?')) this.onResign?.();
    });
    document.getElementById('btn-draw')?.addEventListener('click', () => this.onDrawOffer?.());
    document.getElementById('btn-rematch')?.addEventListener('click', () => this.onRematch?.());
    document.getElementById('btn-accept-draw')?.addEventListener('click', () => {
      this.onDrawRespond?.(true);
    });
    document.getElementById('btn-decline-draw')?.addEventListener('click', () => {
      this.onDrawRespond?.(false);
    });
  }

  setDrawOffered(offered) {
    document.getElementById('draw-offer-panel')?.classList.toggle('hidden', !offered);
  }

  setGameOver(over) {
    document.getElementById('rematch-panel')?.classList.toggle('hidden', !over);
  }
}
