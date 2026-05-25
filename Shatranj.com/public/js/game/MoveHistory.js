export class MoveHistory {
  constructor(container, chess, onJump) {
    this.container = container;
    this.chess = chess;
    this.onJump = onJump;
    this.moves = [];
    this.currentIndex = -1;
  }

  setPgn(pgn) {
    this.moves = [];
    if (!pgn) {
      this.render();
      return;
    }
    const temp = new window.Chess();
    temp.loadPgn(pgn);
    const history = temp.history({ verbose: true });
    this.moves = history;
    this.currentIndex = history.length - 1;
    this.render();
  }

  addMove(move, index) {
    if (index !== undefined) {
      this.moves[index] = move;
    } else {
      this.moves.push(move);
    }
    this.currentIndex = this.moves.length - 1;
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'move-table';
    let row;
    for (let i = 0; i < this.moves.length; i++) {
      if (i % 2 === 0) {
        row = document.createElement('tr');
        const num = document.createElement('td');
        num.className = 'move-num';
        num.textContent = `${Math.floor(i / 2) + 1}.`;
        row.appendChild(num);
        table.appendChild(row);
      }
      const cell = document.createElement('td');
      const m = this.moves[i];
      cell.textContent = m.san || m;
      cell.className = 'move-cell' + (i === this.currentIndex ? ' move-current' : '');
      cell.addEventListener('click', () => this.onJump?.(i));
      row.appendChild(cell);
    }
    this.container.appendChild(table);
    this.container.scrollTop = this.container.scrollHeight;
  }

  exportPgn() {
    return this.chess.pgn();
  }
}
