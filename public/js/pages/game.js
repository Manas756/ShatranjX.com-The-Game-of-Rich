import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js';
import { getSocket, whenSocketReady, persistSession } from '../core/socket.js';
import { eventBus } from '../core/eventBus.js';
import { stateManager } from '../core/stateManager.js';
import { BoardRenderer } from '../game/BoardRenderer.js';
import { MoveHighlighter } from '../game/MoveHighlighter.js';
import { DragDrop } from '../game/DragDrop.js';
import { SoundEngine } from '../game/SoundEngine.js';
import { TimerUI } from '../game/TimerUI.js';
import { MoveHistory } from '../game/MoveHistory.js';
import { CapturedPieces } from '../game/CapturedPieces.js';
import { PromotionModal } from '../game/PromotionModal.js';
import { GameControls } from '../game/GameControls.js';
import { AIGame } from '../ai/AIGame.js';
import { toast } from '../ui/Toast.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'online';
const roomCode = params.get('room');
const timeControl = params.get('tc') || 'blitz5';
const aiColor = params.get('color') || 'w';
const difficulty = Number.parseInt(params.get('difficulty') || '5', 10);

const chess = new Chess();
let socket = null;
let aiGame = null;
let board = null;
let highlighter = null;
let sounds = null;
let timerUI = null;
let moveHistory = null;
let captured = null;
let promotionModal = null;
let dragDrop = null;
let myColor = null;

function displayRoomCode(code) {
  const id = (code || roomCode || sessionStorage.getItem('roomId') || '').toUpperCase();
  if (!id || mode === 'ai') return;
  const banner = document.getElementById('room-code-banner');
  const valueEl = document.getElementById('room-code-value');
  if (!banner || !valueEl) return;
  valueEl.textContent = id;
  banner.classList.remove('hidden');
  const copyBtn = document.getElementById('btn-copy-room');
  if (copyBtn && !copyBtn.dataset.bound) {
    copyBtn.dataset.bound = '1';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard?.writeText(id).then(
        () => toast.success('Room code copied'),
        () => toast.info(`Room code: ${id}`)
      );
    });
  }
}

function initUI() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;


  const username = sessionStorage.getItem('username');
  const playerNameEl = document.getElementById('player-name');

  if (playerNameEl && username) {
  playerNameEl.textContent = username;
 }

  myColor = stateManager.getState().color || (mode === 'ai' ? aiColor : null);
  board = new BoardRenderer(boardEl, { flipped: myColor === 'b', theme: 'classic' });
  board.render(chess.fen(), chess);
  highlighter = new MoveHighlighter(board, chess);
  sounds = new SoundEngine();
  timerUI = new TimerUI(document.getElementById('timer-white'), document.getElementById('timer-black'));
  moveHistory = new MoveHistory(document.getElementById('move-history'), chess);
  captured = new CapturedPieces(
    document.getElementById('captured-white'),
    document.getElementById('captured-black'),
    document.getElementById('material-advantage')
  );
  promotionModal = new PromotionModal(document.getElementById('promotion-modal'), {
    onSelect: ({ from, to, promotion }) => submitMove(from, to, promotion),
  });

  boardEl.addEventListener('click', (e) => {
    const sq = e.target.closest('[data-square]')?.dataset.square;
    if (!sq || mode === 'spectator') return;
    if (highlighter.selected) {
      submitMove(highlighter.selected, sq);
      highlighter.clear();
    } else if (e.target.closest('.piece')) {
      highlighter.select(sq);
    }
  });

  dragDrop = new DragDrop(boardEl, {
    getColor: () => myColor,
    onMoveIntent: (from, to) => submitMove(from, to),
  });

  new GameControls({
    onResign: () => socket?.emit('game:resign'),
    onDrawOffer: () => socket?.emit('game:draw:offer'),
    onDrawRespond: (accept) => socket?.emit('game:draw:respond', { accept }),
    onRematch: () => socket?.emit('game:rematch:request'),
  });
}


function submitMove(from, to, promotion) {
  if (mode === 'ai' && aiGame?.thinking) {
  return;
}
  if (mode === 'ai' && aiGame) {
    if (needsPromotion(from, to)) {
      promotionModal.show(from, to, myColor);
      return;
    }
    const r = aiGame.makePlayerMove(from, to, promotion);
    if (!r.success) toast.error('Illegal move');
    else applyLocalState(aiGame.getState(), r.move);
    return;
  }
  if (!socket) return;
  if (needsPromotion(from, to) && !promotion) {
    promotionModal.show(from, to, myColor);
    return;
  }
  socket.emit('game:move', { from, to, promotion });
}

function needsPromotion(from, to) {
  const p = chess.get(from);
  if (!p || p.type !== 'p') return false;
  const rank = to[1];
  return (p.color === 'w' && rank === '8') || (p.color === 'b' && rank === '1');
}

function applyServerMove({ move, fen, pgn, capturedPiece, isCheck, gameOver }) {
  chess.load(fen);
  board.render(fen, chess);
  if (move) {
    highlighter.showLastMove(move.from, move.to);
    if (capturedPiece) captured.add(capturedPiece, move.color);
    if (move.flags?.includes('k') || move.flags?.includes('q')) sounds.playCastle();
    else if (capturedPiece) sounds.playCapture();
    else sounds.playMove();
    if (isCheck) sounds.playCheck();
    moveHistory.addMove(move);
  }
  if (isCheck) highlighter.showCheck();
  if (gameOver) handleGameOver(gameOver);
}

function applyLocalState(state, move) {
  chess.load(state.fen);
  board.render(state.fen, chess);
  timerUI.sync({ white: state.timers.white, black: state.timers.black, activeColor: state.timers.activeColor });
  if (move) {
    highlighter.showLastMove(move.from, move.to);
    moveHistory.addMove(move);
    sounds.playMove();
  }
  if (state.thinking) document.getElementById('ai-thinking')?.classList.remove('hidden');
  else document.getElementById('ai-thinking')?.classList.add('hidden');
}

function handleGameOver(over) {
  const msg = over.winner === myColor ? 'You won!' : over.winner ? 'You lost' : 'Draw';
  toast.info(`${msg} (${over.reason})`);
  sounds.playGameEnd();
  document.getElementById('rematch-panel')?.classList.remove('hidden');
}

async function joinRoom() {
  const username = sessionStorage.getItem('username');
  const code = (roomCode || sessionStorage.getItem('roomId') || '').toUpperCase();
  if (!code) return;

  await whenSocketReady(socket);
  return new Promise((resolve) => {
    socket.emit('room:join', { roomId: code, username }, (res) => {
      if (!res?.success) {
        toast.error(res?.message || 'Could not join room');
        resolve(false);
        return;
      }
      persistSession({ roomId: code });
      resolve(true);
    });
  });
}

function wireSocket() {
  socket = getSocket({ username: sessionStorage.getItem('username') });

  eventBus.on('game:start', (data) => {
    myColor = data.color;
    chess.load(data.fen);
    stateManager.setState({ color: myColor, fen: data.fen, status: 'active', opponent: data.color === 'w' ? data.blackPlayer : data.whitePlayer });
    board.flipped = myColor === 'b';
    board._buildBoard();
    board.render(data.fen, chess);
    sounds.playGameStart();
    document.getElementById('room-code-banner')?.classList.add('hidden');
    document.getElementById('opponent-name').textContent = stateManager.getState().opponent?.username || 'Opponent';
    timerUI.sync({ white: 300000, black: 300000, activeColor: 'w' });
  });

  eventBus.on('game:move', applyServerMove);
  eventBus.on('game:invalid', ({ reason }) => toast.error(reason));
  eventBus.on('game:over', (data) => handleGameOver(data));
  eventBus.on('game:draw:offered', () => document.getElementById('draw-offer-panel')?.classList.remove('hidden'));
  eventBus.on('game:draw:declined', () => document.getElementById('draw-offer-panel')?.classList.add('hidden'));
  eventBus.on('game:timer:update', (t) => timerUI.sync(t));
  eventBus.on('game:reconnected', (data) => {
    myColor = data.color;
    chess.load(data.fen);
    board.flipped = myColor === 'b';
    board._buildBoard();
    board.render(data.fen, chess);
    timerUI.sync(data.timers);
    document.getElementById('opponent-name').textContent = 'Opponent';
    toast.success('Reconnected to game');
  });

  eventBus.on('matchmaking:found', (data) => {
    persistSession({ roomId: data.roomId });
    myColor = data.color;
    document.getElementById('opponent-name').textContent = data.opponentName || 'Opponent';
  });
  eventBus.on('room:joined', (d) => {
    persistSession({ roomId: d.roomId });
    stateManager.setState({ roomId: d.roomId, color: d.color });
    myColor = d.color;
    board.flipped = myColor === 'b';
    board._buildBoard();
    board.render(chess.fen(), chess);
    displayRoomCode(d.roomId);
    document.getElementById('opponent-name').textContent =
      d.opponentName || 'Waiting for opponent...';
  });

  eventBus.on('room:created', (d) => {
    persistSession({ roomId: d.roomId });
    myColor = d.color;
    stateManager.setState({ roomId: d.roomId, color: d.color });
    displayRoomCode(d.roomId);
    document.getElementById('opponent-name').textContent = 'Waiting for opponent...';
  });

  eventBus.on('room:opponent:joined', ({ opponentName }) => {
    document.getElementById('opponent-name').textContent = opponentName || 'Opponent';
    toast.info('Opponent joined');
  });

  eventBus.on('room:error', ({ message }) => toast.error(message));
}

async function connectOnline() {
  wireSocket();
  await whenSocketReady(socket);

  if (roomCode || sessionStorage.getItem('roomId')) {
    await joinRoom();
  } else {
    socket.emit('matchmaking:join', {
      timeControl,
      username: sessionStorage.getItem('username'),
    });
  }
}

async function startAI() {
  stateManager.setState({ mode: 'ai', color: aiColor });
  myColor = aiColor;
  aiGame = new AIGame(aiColor, difficulty, timeControl);
  aiGame.onUpdate = (s) => applyLocalState(s);
  aiGame.onGameOver = handleGameOver;
  await aiGame.start();
  document.getElementById('opponent-name').textContent = `Stockfish (Lv ${difficulty})`;
  document.getElementById('ai-thinking')?.classList.add('hidden');
}

async function init() {
  initUI();
  displayRoomCode();
  if (mode === 'ai') await startAI();
  else await connectOnline();
}

init();
