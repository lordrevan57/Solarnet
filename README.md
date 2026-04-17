# ✴ Solarnet Server

A lightweight Express + SQLite backend for the Solarnet community wiki and messaging site. Handles user registration/login, session auth, faction assignment, and the bulletin board.

---

## Requirements

- **Node.js v18 or newer** — [Download here](https://nodejs.org/)
- npm (comes bundled with Node)

To check your versions:

```bash
node -v
npm -v
```

---

## Installation

1. **Navigate into the solarnet directory** (where `solarnet_server.js` lives):

```bash
cd solarnet
```

2. **Install dependencies:**

```bash
npm install
```

This will install:
- `express` — web server framework
- `better-sqlite3` — fast, synchronous SQLite database
- `bcrypt` — password hashing
- `express-session` — session management
- `cors` — cross-origin request support

> ⚠️ **Note on `better-sqlite3`:** This package compiles native bindings during install. If you get a build error, make sure you have build tools installed:
> - **Windows:** Run `npm install --global windows-build-tools` (as admin), or install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
> - **macOS:** Run `xcode-select --install`
> - **Linux:** Run `sudo apt install build-essential` (Debian/Ubuntu) or equivalent

---

## Running the Server

```bash
npm start
```

Or to run with auto-restart on file changes (Node 18+):

```bash
npm run dev
```

The server starts on **port 3001** by default. Open your browser to:

```
http://localhost:3001
```

To use a different port, set the `PORT` environment variable:

```bash
PORT=8080 npm start
```

---

## File Structure

```
solarnet/
├── solarnet_server.js   # Main server — all routes and DB setup
├── package.json         # Dependencies and scripts
├── solarnet.db          # SQLite database (auto-created on first run)
└── public/              # Static HTML pages served at /
    ├── index.html
    ├── solarnet_home.html
    ├── solarnet_inbox.html
    └── ... (all other pages)
```

The `solarnet.db` file is created automatically the first time the server runs. You don't need to set anything up manually.

---

## API Overview

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/register` | Register a new user (`username`, `domain`, `password`) |
| POST | `/api/login` | Log in (`username`, `domain`, `password`) |
| POST | `/api/logout` | End the current session |
| GET | `/api/me` | Get current session info |
| POST | `/api/faction` | Set your faction (one-time change) |
| GET | `/api/bulletin` | Get the last 50 bulletin posts |
| POST | `/api/bulletin` | Post to the bulletin board (auth required) |
| DELETE | `/api/bulletin/:id` | Delete your own bulletin post (auth required) |

**Valid domains:** `conf`, `cons`, `tech`, `mars`, `rim`, `geneva`, `unit`

**Valid factions:** `prot`, `cons`, `tech`, `none`

**Valid bulletin tags:** `CREW LISTING`, `TRADE`, `MISSING`, `NOTICE`, `GENERAL`

---

## Production Notes

Before deploying publicly, update these values in `solarnet_server.js`:

- **Session secret** — change `'KPOP-SOLARNET-SECRET-CHANGE-IN-PRODUCTION'` to a long random string
- **Cookie security** — set `secure: true` if running behind HTTPS
- **CORS origin** — replace `origin: true` with your actual domain (e.g. `origin: 'https://yourdomain.com'`)

---

## Troubleshooting

**Port already in use:**
```bash
PORT=3002 npm start
```

**`better-sqlite3` fails to install:**
Make sure you have a C++ compiler available (see installation note above). Node version must also match what the native module was compiled for — if you switched Node versions, run `npm rebuild`.

**Database locked or corrupted:**
Delete `solarnet.db` and restart — the server will recreate it fresh (you'll lose any existing users/posts).
