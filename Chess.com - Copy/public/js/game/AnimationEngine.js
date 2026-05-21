export class AnimationEngine {
  constructor(boardRenderer) {
    this.board = boardRenderer;
  }

  playMove(from, to, move, chess, onDone) {
    const piece = chess.get(from);
    if (move?.flags?.includes('c') && move.flags.includes('e')) {
      const epSquare = move.to[0] + move.from[1];
      this.board._squares.get(epSquare)?.querySelector('.piece')?.remove();
    }
    if (move?.flags?.includes('k') || move?.flags?.includes('q')) {
      this.board.animateMove(from, to, piece, () => {
        chess.load(chess.fen());
        onDone?.();
      });
      return;
    }
    this.board.animateMove(from, to, piece, onDone);
  }
}
