# DockPulse

**DockPulse** is a small **port traffic simulator** with a live web dashboard. It mimics ships moving toward berths, queues, and congestion—then shows everything on a map and in panels (ships, berths, and a simple “decision engine”).  
Data is **in memory** while the server runs; **Redis** is used to pass events between parts of the app (and you can plug in more listeners later).

<img width="2940" height="944" alt="CleanShot 2026-04-20 at 22 10 17@2x" src="https://github.com/user-attachments/assets/6344f624-f6b0-4195-b67f-034343eb71d9" />

<img width="2938" height="1682" alt="CleanShot 2026-04-20 at 22 10 34@2x" src="https://github.com/user-attachments/assets/cc0bfff0-d1dc-4ea6-8684-9a37b673719e" />

<img width="2940" height="1546" alt="CleanShot 2026-04-20 at 22 10 57@2x" src="https://github.com/user-attachments/assets/c8520af9-b1a6-4d99-ab9b-b127860eaf6f" />

---

## What you get

| Piece | Purpose |
|--------|--------|
| **Backend** | Node.js + Express: health check, suggestions API, what-if scenario API, Socket.io for live updates |
| **Simulation** | Timer-based loop: spawns ships, updates ETAs, assigns berths, publishes events |
| **React “twin”** (optional) | Vite + React + Leaflet map + Tailwind UI — best for development |

---

## What you need installed

- **Node.js 18+**
- **Redis** running locally (default URL below) or reachable from your machine

---

## Quick start

1. **Clone** the repository and open the folder:

   ```bash
   git clone https://github.com/ProAtharva/DOCKPULSE.git
   cd DOCKPULSE
   ```

2. **Install server dependencies** (from the project root):

   ```bash
   npm install
   ```

3. **Install client dependencies** (for the React dashboard):

   ```bash
   npm install --prefix client
   ```

4. **Environment file**  
   Copy `.env.example` to `.env` and change values only if you need to:

   - `PORT` — HTTP port (default `3000`)
   - `REDIS_URL` — Redis connection string
   - `REDIS_EVENTS_CHANNEL` — channel name for simulation events

5. **Start Redis** (example with Docker):

   ```bash
   docker run -d --name dockpulse-redis -p 6379:6379 redis:alpine
   ```

6. **Run two terminals** during development:

   - **Terminal A — API + simulation**

     ```bash
     npm start
     ```

   - **Terminal B — React dev server** (hot reload; proxies `/api` and socket to port 3000 if you use Vite’s config)

     ```bash
     npm run client
     ```

   Open the UI at **http://localhost:5173** (Vite). The API listens on **http://localhost:3000**.

7. **Production-style run (single command for HTML)**  
   Build the client, then start the server only:

   ```bash
   npm run client:build
   npm start
   ```

   If `client/dist` exists, the server serves the built React app; otherwise it falls back to `public/`.

---

## Scripts (root `package.json`)

| Command | What it does |
|---------|----------------|
| `npm start` | Starts `src/server.js` (API, Socket.io, simulation) |
| `npm run dev` | Same server with `--watch` (restarts on file changes) |
| `npm run client` | Starts Vite dev server for `client/` |
| `npm run client:build` | Builds the React app into `client/dist` |

---

## How the pieces fit together (simple picture)

1. **`portState`** holds ships, berths, and container count in RAM.
2. **`simulationService`** runs on an interval (about every 2 seconds): moves ships, may add new ones, talks to **`berthService`** for queues and assignments.
3. **Events** go through **Redis pub/sub** (`eventService`) so other services could subscribe; the HTTP server also pushes updates over **Socket.io** (`port:state`, `port:event`).
4. The **React app** opens a Socket.io connection, receives full snapshots and events, and updates the map and lists.
5. **`POST /api/simulate-scenario`** runs a **15-minute what-if** in a **separate sandbox** (it does **not** change live traffic). The UI shows congestion curves for different disruption modes.

There is **no login or roles** in this repo: anyone who can reach the server can use the API and WebSockets. Add your own auth if you expose this on the internet.

---

## Useful HTTP routes

- `GET /health` — service health  
- `GET /api/suggestions` — congestion + suggested actions (read-only)  
- `POST /api/simulate-scenario` — body: `numberOfShips`, `delayFactor`, `disruptionType` (`none` \| `weather` \| `crane_failure`)

---

## Folder map (short)

```
src/           # Server: Express entry, simulation, berths, scenarios, WebSockets
client/src/    # React UI: map, metrics, scenario panel, ship list, etc.
public/        # Static fallback if the React build is missing
```

---

## Troubleshooting

- **Redis connection errors** — make sure Redis is up and `REDIS_URL` in `.env` is correct.
- **Empty or static UI** — confirm Vite is running on 5173 for dev, or run `npm run client:build` and use `npm start` only.
- **State resets** — restarting Node clears in-memory port state (by design in this demo).

---
