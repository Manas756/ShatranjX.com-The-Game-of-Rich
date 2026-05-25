/**
 * Central game configuration — timers, limits, and socket tuning.
 * Kept separate from environment.js so unit tests can import constants without env.
 */

const TIME_CONTROLS = {
  bullet1: { initial: 60000, increment: 0, label: '1+0' },
  bullet2: { initial: 120000, increment: 1000, label: '2+1' },
  blitz3: { initial: 180000, increment: 0, label: '3+0' },
  blitz5: { initial: 300000, increment: 0, label: '5+0' },
  blitz5_3: { initial: 300000, increment: 3000, label: '5+3' },
  rapid10: { initial: 600000, increment: 0, label: '10+0' },
  rapid15: { initial: 900000, increment: 10000, label: '15+10' },
  classical: { initial: 1800000, increment: 0, label: '30+0' },
};

const GAME_END_REASONS = {
  CHECKMATE: 'checkmate',
  STALEMATE: 'stalemate',
  INSUFFICIENT_MATERIAL: 'insufficient_material',
  THREEFOLD_REPETITION: 'threefold_repetition',
  FIFTY_MOVE_RULE: 'fifty_move_rule',
  TIMEOUT: 'timeout',
  RESIGNATION: 'resignation',
  DRAW_AGREEMENT: 'draw_agreement',
  ABANDONMENT: 'abandonment',
};

const PLAYER_COLORS = {
  WHITE: 'w',
  BLACK: 'b',
};

const GAME_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  PAUSED: 'paused',
  OVER: 'over',
};

const ROOM_STATUS = {
  OPEN: 'open',
  FULL: 'full',
  IN_GAME: 'in_game',
  CLOSED: 'closed',
};

const RECONNECT_GRACE_MS = 30_000;
const ROOM_INACTIVITY_MS = 60 * 60 * 1000;
const GAME_DESTROY_DELAY_MS = 30_000;
const MAX_SPECTATORS_PER_ROOM = 50;
const MIN_MOVE_INTERVAL_MS = 50;

const TIMER_TICK_MS = 100;
const TIMER_SYNC_INTERVAL_MS = 1000;

const RATE_LIMITS = {
  GAME_MOVE: { max: 30, windowMs: 60_000 },
  ROOM_CREATE: { max: 5, windowMs: 10 * 60_000 },
  ROOM_JOIN: { max: 10, windowMs: 60_000 },
};

const MATCHMAKING_ACCEPT_MS = 5000;

const PROMOTION_PIECES = ['q', 'r', 'b', 'n'];
const DEFAULT_PROMOTION = 'q';

module.exports = {
  TIME_CONTROLS,
  GAME_END_REASONS,
  PLAYER_COLORS,
  GAME_STATUS,
  ROOM_STATUS,
  RECONNECT_GRACE_MS,
  ROOM_INACTIVITY_MS,
  GAME_DESTROY_DELAY_MS,
  MAX_SPECTATORS_PER_ROOM,
  MIN_MOVE_INTERVAL_MS,
  TIMER_TICK_MS,
  TIMER_SYNC_INTERVAL_MS,
  RATE_LIMITS,
  MATCHMAKING_ACCEPT_MS,
  PROMOTION_PIECES,
  DEFAULT_PROMOTION,
};
