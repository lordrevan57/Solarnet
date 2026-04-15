// ═══════════════════════════════════════════════════════
// SOLARNET SERVER — Express + SQLite scaffold
// ═══════════════════════════════════════════════════════
// Dependencies (run first):
//   npm install express better-sqlite3 bcrypt express-session cors
//
// Start:
//   node solarnet_server.js
//
// Default port: 3001
// ═══════════════════════════════════════════════════════

const express    = require('express');
const Database   = require('better-sqlite3');
const bcrypt     = require('bcrypt');
const session    = require('express-session');
const cors       = require('cors');
const path       = require('path');

const app  = express();
const db   = new Database('solarnet.db');
const PORT = process.env.PORT || 3001;

// ═══════════════════════════════════════════════════════
// DATABASE SETUP
// Run once on startup — creates tables if they don't exist
// ═══════════════════════════════════════════════════════

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL,
    domain      TEXT    NOT NULL,
    password    TEXT    NOT NULL,
    faction     TEXT    DEFAULT 'none',
    faction_used INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now')),
    UNIQUE(username, domain)
  );

  CREATE TABLE IF NOT EXISTS bulletin (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    author      TEXT    NOT NULL,
    tag         TEXT    NOT NULL,
    body        TEXT    NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  );
`);

// ═══════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════

app.use(cors({
  origin: true,         // tighten this to your domain in production
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: 'KPOP-SOLARNET-SECRET-CHANGE-IN-PRODUCTION',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,      // set true when running HTTPS in production
    maxAge: 1000 * 60 * 60 * 24 * 7  // 7 days
  }
}));

// Serve static HTML files from /public
// Put home.html, inbox.html, helena.html etc. in a /public folder
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════
// AUTH HELPER
// ═══════════════════════════════════════════════════════

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  next();
}

// ═══════════════════════════════════════════════════════
// ROUTES — AUTH
// ═══════════════════════════════════════════════════════

// POST /api/register
// Body: { username, domain, password }
// Domain options: conf, cons, tech, mars, rim, geneva, unit
app.post('/api/register', async (req, res) => {
  const { username, domain, password } = req.body;

  if (!username || !domain || !password) {
    return res.status(400).json({ error: 'Username, domain, and password required.' });
  }

  // Validate domain
  const validDomains = ['conf', 'cons', 'tech', 'mars', 'rim', 'geneva', 'unit'];
  if (!validDomains.includes(domain)) {
    return res.status(400).json({ error: 'Invalid domain suffix.' });
  }

  // Basic username rules: alphanumeric, dots, hyphens only
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return res.status(400).json({ error: 'Username may only contain lowercase letters, numbers, dots, and hyphens.' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const stmt = db.prepare('INSERT INTO users (username, domain, password) VALUES (?, ?, ?)');
    stmt.run(username, domain, hash);

    const addr = `${username}@solarmail.${domain}`;
    req.session.user = { username, domain, addr, faction: 'none' };

    return res.json({ success: true, addr });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'That address is already registered.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

// POST /api/login
// Body: { username, domain, password }
app.post('/api/login', async (req, res) => {
  const { username, domain, password } = req.body;

  if (!username || !domain || !password) {
    return res.status(400).json({ error: 'Username, domain, and password required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND domain = ?').get(username, domain);

  if (!user) {
    return res.status(401).json({ error: 'Address not found.' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const addr = `${user.username}@solarmail.${user.domain}`;
  req.session.user = {
    id:           user.id,
    username:     user.username,
    domain:       user.domain,
    addr,
    faction:      user.faction,
    faction_used: user.faction_used
  };

  return res.json({ success: true, addr, faction: user.faction, faction_used: user.faction_used });
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// GET /api/me
// Returns current session user — used by pages on load to restore state
app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ authenticated: false });
  }
  return res.json({ authenticated: true, ...req.session.user });
});

// ═══════════════════════════════════════════════════════
// ROUTES — FACTION
// ═══════════════════════════════════════════════════════

// POST /api/faction
// Body: { faction }  ('prot', 'cons', 'tech', 'none')
// Can only be changed once (faction_used flag)
app.post('/api/faction', requireAuth, (req, res) => {
  const { faction } = req.body;
  const validFactions = ['prot', 'cons', 'tech', 'none'];

  if (!validFactions.includes(faction)) {
    return res.status(400).json({ error: 'Invalid faction.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);

  if (user.faction_used && user.faction !== 'none') {
    return res.status(403).json({ error: 'Faction already set. You may only change once.' });
  }

  db.prepare('UPDATE users SET faction = ?, faction_used = 1 WHERE id = ?')
    .run(faction, req.session.user.id);

  req.session.user.faction      = faction;
  req.session.user.faction_used = 1;

  return res.json({ success: true, faction });
});

// ═══════════════════════════════════════════════════════
// ROUTES — BULLETIN BOARD
// ═══════════════════════════════════════════════════════

// GET /api/bulletin
// Returns last 50 posts, newest first
app.get('/api/bulletin', (req, res) => {
  const posts = db.prepare(
    'SELECT id, author, tag, body, created_at FROM bulletin ORDER BY id DESC LIMIT 50'
  ).all();
  return res.json(posts);
});

// POST /api/bulletin
// Body: { tag, body }
// Requires auth
app.post('/api/bulletin', requireAuth, (req, res) => {
  const { tag, body } = req.body;

  const validTags = ['CREW LISTING', 'TRADE', 'MISSING', 'NOTICE', 'GENERAL'];

  if (!tag || !body) {
    return res.status(400).json({ error: 'Tag and body required.' });
  }
  if (!validTags.includes(tag.toUpperCase())) {
    return res.status(400).json({ error: `Tag must be one of: ${validTags.join(', ')}` });
  }
  if (body.length > 500) {
    return res.status(400).json({ error: 'Post body must be 500 characters or fewer.' });
  }

  const author = req.session.user.addr;
  db.prepare('INSERT INTO bulletin (author, tag, body) VALUES (?, ?, ?)')
    .run(author, tag.toUpperCase(), body);

  return res.json({ success: true });
});

// DELETE /api/bulletin/:id
// Only the post author can delete their own post
app.delete('/api/bulletin/:id', requireAuth, (req, res) => {
  const post = db.prepare('SELECT * FROM bulletin WHERE id = ?').get(req.params.id);

  if (!post) {
    return res.status(404).json({ error: 'Post not found.' });
  }
  if (post.author !== req.session.user.addr) {
    return res.status(403).json({ error: 'You can only delete your own posts.' });
  }

  db.prepare('DELETE FROM bulletin WHERE id = ?').run(req.params.id);
  return res.json({ success: true });
});

// ═══════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`✴ Solarnet server running on port ${PORT}`);
  console.log(`  Database: solarnet.db`);
  console.log(`  Static files: /public`);
});
