export class MoveHighlighter {
  constructor(boardRenderer, chess) {
    this.board = boardRenderer;
    this.chess = chess;
    this.selected = null;
  }

  select(square) {
    this.clear();
    this.selected = square;
    this.board.highlightSquare(square, 'selected');
    const moves = this.chess.moves({ square, verbose: true });
    for (const m of moves) {
      const type = m.captured ? 'capture' : 'legal';
      this.board.highlightSquare(m.to, type);
    }
  }

  showLastMove(from, to) {
    this.board.clearHighlights('lastMove');
    if (from) this.board.highlightSquare(from, 'lastMove');
    if (to) this.board.highlightSquare(to, 'lastMove');
  }

  showCheck() {
    this.board.clearHighlights('check');
    if (!this.chess.inCheck()) return;
    const board = this.chess.board();
    const turn = this.chess.turn();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p?.type === 'k' && p.color === turn) {
          const file = 'abcdefgh'[f];
          const rank = 8 - r;
          this.board.highlightSquare(`${file}${rank}`, 'check');
        }
      }
    }
  }

  clear() {
    this.selected = null;
    this.board.clearHighlights();
  }
}
