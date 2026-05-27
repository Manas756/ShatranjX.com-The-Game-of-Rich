export class DragDrop {
  constructor(boardEl, { onMoveIntent, getColor, isLegal }) {
    this.boardEl = boardEl;
    this.onMoveIntent = onMoveIntent;
    this.getColor = getColor;
    this.isLegal = isLegal;
    this.draggedFrom = null;
    this._onPointerDown = this._handleDown.bind(this);
    this._onPointerUp = this._handleUp.bind(this);
    boardEl.addEventListener('mousedown', this._onPointerDown);
    boardEl.addEventListener('touchstart', this._onPointerDown, { passive: false });
    document.addEventListener('mouseup', this._onPointerUp);
    document.addEventListener('touchend', this._onPointerUp);
  }

  _squareFromTarget(target) {
    return target.closest('[data-square]')?.dataset.square || null;
  }

  _handleDown(e) {
    const sq = this._squareFromTarget(e.target);
    if (!sq) return;
    const piece = e.target.closest('.piece');
    if (!piece) return;
    const myColor = this.getColor();
    if (!myColor) return;
    const isWhite = piece.classList.contains('white');
    if ((myColor === 'w' && !isWhite) || (myColor === 'b' && isWhite)) return;
    this.draggedFrom = sq;
    piece.classList.add('dragging');
    e.preventDefault();
  }

  _handleUp(e) {
    if (!this.draggedFrom) return;

    // ✅ Fix: touch events store coordinates in changedTouches, not e.clientX/Y
    let clientX, clientY;
    if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const target = document.elementFromPoint(clientX, clientY) || e.target;
    const to = this._squareFromTarget(target);
    const from = this.draggedFrom;
    this.boardEl.querySelector('.dragging')?.classList.remove('dragging');
    this.draggedFrom = null;
    if (to && to !== from) this.onMoveIntent(from, to);
  }

  destroy() {
    this.boardEl.removeEventListener('mousedown', this._onPointerDown);
    this.boardEl.removeEventListener('touchstart', this._onPointerDown);
    document.removeEventListener('mouseup', this._onPointerUp);
    document.removeEventListener('touchend', this._onPointerUp);
  }
}