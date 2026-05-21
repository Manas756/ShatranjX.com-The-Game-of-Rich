const LEADERBOARD = [
  { rank: 1, name: 'Grandmaster_X', elo: 2847, winRate: 72, avatar: '♚' },
  { rank: 2, name: 'TacticalTitan', elo: 2791, winRate: 68, avatar: '♛' },
  { rank: 3, name: 'EndgameEcho', elo: 2756, winRate: 65, avatar: '♜' },
  { rank: 4, name: 'BlitzBishop', elo: 2712, winRate: 61, avatar: '♝' },
  { rank: 5, name: 'KnightRider', elo: 2689, winRate: 59, avatar: '♞' },
];

function render() {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  tbody.innerHTML = LEADERBOARD.map(
    (p) => `<tr class="reveal"><td>${p.rank}</td><td><span class="avatar">${p.avatar}</span> ${p.name}</td><td>${p.elo}</td><td>${p.winRate}%</td></tr>`
  ).join('');
}

render();
