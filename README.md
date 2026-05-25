# ShatranjX.com

![Shatranj hero](public\images\Screenshot 2026-05-22 003640.png)

Production-oriented real-time chess platform (ShatranjX.com) with server-authoritative game logic, matchmaking, AI (Stockfish), and a premium dark UI.

## Stack

- **Server:** Node.js, Express, Socket.io, Chess.js
- **Client:** Vanilla ES modules, Chess.js (CDN), Stockfish (Web Worker)
- **UI:** Custom CSS + optional Tailwind build

## Quick Start

```bash
npm install
npm start
```

- Landing: http://localhost:3000
- Play (new): http://localhost:3000/game?mode=online
- AI game: http://localhost:3000/game?mode=ai&difficulty=5&color=w
- Legacy board: http://localhost:3000/play
- Health: http://localhost:3000/health

## Environment

Copy `.env.example` to `.env` and set `SESSION_SECRET` for production.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server |
| `npm run build:css` | Build Tailwind (requires devDependencies) |
| `npm run dev:all` | Server + CSS watch (with concurrently) |

## Architecture

```
server/game/     — GameInstance, timers, validation (no sockets)
server/room/     — Room lifecycle
server/socket/   — Thin event handlers
public/js/core/  — Socket singleton, event bus, state
public/js/game/  — Board, drag-drop, sounds, timers
```

## Socket Events

Client → Server: `room:create`, `room:join`, `matchmaking:join`, `game:move`, `game:resign`, etc.

Server → Client: `game:start`, `game:move`, `game:over`, `game:timer:update`, etc.

## Deploy (Render)

- Build: `npm run build:css` (optional)
- Start: `node server/index.js`
- Set `NODE_ENV=production`, `PORT`, `CLIENT_URL`, `CORS_ORIGINS`
- Enable WebSocket support
