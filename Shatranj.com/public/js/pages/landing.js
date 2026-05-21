import { getSocket, whenSocketReady, persistSession } from '../core/socket.js';
import { eventBus } from '../core/eventBus.js';
import { Modal } from '../ui/Modal.js';
import { toast } from '../ui/Toast.js';

const socket = getSocket();
const createModal = new Modal('create-room-modal');
const joinModal = new Modal('join-room-modal');

const TIME_CONTROLS = [
  { id: 'bullet1', label: 'Bullet', sub: '1+0' },
  { id: 'blitz5', label: 'Blitz', sub: '5+0' },
  { id: 'rapid10', label: 'Rapid', sub: '10+0' },
  { id: 'classical', label: 'Classical', sub: '30+0' },
];

function setupReveal() {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('revealed')),
    { threshold: 0.15 }
  );
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

function renderTimeOptions(modal, onSelect) {
  const grid = modal.query('.time-control-grid');
  if (!grid) {
    console.error('Time control grid not found in modal');
    return;
  }
  grid.innerHTML = TIME_CONTROLS.map(
    (tc) => `<button type="button" class="time-option" data-tc="${tc.id}"><strong>${tc.label}</strong><span>${tc.sub}</span></button>`
  ).join('');
  grid.querySelectorAll('.time-option').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.tc));
  });
}

function getUsername() {
  return document.getElementById('username-input')?.value?.trim() || `Player_${Math.random().toString(36).slice(2, 6)}`;
}

function copyText(text) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success('Code copied!'),
    () => toast.info(`Code: ${text}`)
  );
}

function showRoomCodeModal(roomId, tc) {
  createModal.setContent(`
    <h3 class="modal-title">Your Room Code</h3>
    <p class="modal-sub">Share this 6-character code with your friend</p>
    <span class="room-code-big" id="room-code-big">${roomId}</span>
    <button type="button" class="btn-primary" id="btn-copy-room-code" style="width:100%;margin-top:0.5rem">Copy Code</button>
    <button type="button" class="btn-secondary" id="btn-go-game" style="width:100%;margin-top:0.5rem">Enter Game</button>
  `);
  createModal.show();
  createModal.query('#btn-copy-room-code')?.addEventListener('click', () => copyText(roomId));
  createModal.query('#btn-go-game')?.addEventListener('click', () => {
    window.location.href = `/game?mode=online&room=${roomId}&tc=${tc}`;
  });
}

function createRoom(tc) {
  const name = getUsername();
  sessionStorage.setItem('username', name);
  let handled = false;

  const finish = (roomId) => {
    if (handled || !roomId) return;
    handled = true;
    persistSession({ roomId, username: name });
    showRoomCodeModal(roomId, tc);
  };

  const onCreated = (data) => finish(data?.roomId);
  eventBus.once('room:created', onCreated);

  socket.emit('room:create', { timeControl: tc, isPrivate: true, username: name }, (res) => {
    if (res?.success) {
      finish(res.roomId);
    } else if (!handled) {
      toast.error(res?.message || 'Could not create room');
    }
  });
}

document.getElementById('btn-play-online')?.addEventListener('click', () => {
  sessionStorage.setItem('username', getUsername());
  window.location.href = '/game?mode=online&tc=blitz5';
});

document.getElementById('btn-play-ai')?.addEventListener('click', () => {
  sessionStorage.setItem('username', getUsername());
  window.location.href = '/game?mode=ai&tc=blitz5&difficulty=5&color=w';
});

document.getElementById('btn-create-room')?.addEventListener('click', async () => {
  createModal.setContent(`
    <h3 class="modal-title">Create Private Room</h3>
    <p class="modal-sub">Select time control</p>
    <div class="time-control-grid"></div>
    <p class="modal-sub" style="margin-top:1rem">Creating room…</p>`);
  createModal.show();

  try {
    await whenSocketReady(socket);
    createModal.setContent(`
      <h3 class="modal-title">Create Private Room</h3>
      <p class="modal-sub">Select time control</p>
      <div class="time-control-grid"></div>`);
    renderTimeOptions(createModal, (tc) => createRoom(tc));
  } catch {
    createModal.hide();
    toast.error('Connection failed. Is the server running?');
  }
});

document.getElementById('btn-join-room')?.addEventListener('click', () => {
  joinModal.setContent(`
    <h3 class="modal-title">Join Room</h3>
    <p class="modal-sub">Enter the 6-character room code</p>
    <input id="room-code-input" class="room-code-input" maxlength="6" placeholder="ABC123" autocomplete="off" />
    <button type="button" id="join-room-submit" class="btn-primary" style="margin-top:1rem;width:100%">Join</button>`);
  joinModal.show();
  const input = joinModal.query('#room-code-input');
  input?.focus();
  input?.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  joinModal.query('#join-room-submit')?.addEventListener('click', () => {
    const code = input?.value?.trim();
    if (!code || code.length < 6) {
      toast.error('Enter a 6-character code');
      return;
    }
    sessionStorage.setItem('username', getUsername());
    persistSession({ roomId: code });
    window.location.href = `/game?mode=online&room=${code}`;
  });
});

document.querySelectorAll('[data-match-tc]').forEach((card) => {
  card.addEventListener('click', () => {
    sessionStorage.setItem('username', getUsername());
    window.location.href = `/game?mode=online&tc=${card.dataset.matchTc}`;
  });
});

eventBus.on('lobby:stats', ({ playersOnline, gamesInProgress }) => {
  const el = document.getElementById('live-stats');
  if (el) el.textContent = `${playersOnline.toLocaleString()} players online • ${gamesInProgress.toLocaleString()} games in progress`;
});

eventBus.on('room:error', ({ message }) => toast.error(message));

setupReveal();

