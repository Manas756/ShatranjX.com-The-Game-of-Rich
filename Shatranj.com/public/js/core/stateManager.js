import { eventBus } from './eventBus.js';

const initialState = {
  roomId: null,
  gameId: null,
  color: null,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn: '',
  status: 'idle',
  opponent: null,
  timeControl: 'blitz5',
  timers: { white: 300000, black: 300000, activeColor: 'w' },
  isCheck: false,
  gameOver: null,
  mode: 'idle',
  difficulty: 5,
};

class StateManager {
  constructor() {
    this._state = { ...initialState };
    this._listeners = new Set();
  }

  getState() {
    return { ...this._state };
  }

  setState(partial) {
    this._state = { ...this._state, ...partial };
    this._listeners.forEach((fn) => fn(this._state));
    eventBus.emit('state:changed', this._state);
  }

  subscribe(fn) {
    this._listeners.add(fn);
    fn(this._state);
    return () => this._listeners.delete(fn);
  }

  reset() {
    this._state = { ...initialState };
    eventBus.emit('state:changed', this._state);
  }
}

export const stateManager = new StateManager();
export default stateManager;
