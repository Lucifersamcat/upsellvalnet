require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 4321;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const ACTIVE_TIER = '999';
const SALT_ROUNDS = 10;
const MIN_PASSWORD_LEN = 6;
const SESSION_TTL = 5_400_000; // 90 min
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 min

app.use(express.json({ limit: '10mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "font-src fonts.gstatic.com; " +
    "style-src 'self' fonts.googleapis.com; " +
    "script-src 'self'; " +
    "connect-src 'self'; " +
    "img-src 'self' data:"
  );
  next();
});

// Serve the Vite production build from dist/ (run `npm run build` first).
const DIST_DIR = path.join(__dirname, 'dist');
app.use(express.static(DIST_DIR));

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

app.get('/', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

/* ----------------------------------------------------------------
   Generic JSON file helpers — DRY + crash-safe JSON.parse
---------------------------------------------------------------- */
function readJsonFile(filePath, seed) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.writeFileSync(filePath, JSON.stringify(seed, null, 2));
    } else {
      console.error(`JSON corrupto en ${filePath}, usando semilla`);
    }
    return seed;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const readData      = () => readJsonFile(DATA_FILE,      { version: 1, clients: [], log: [] });
const writeData     = (d) => writeJsonFile(DATA_FILE, d);
const readAgents    = () => readJsonFile(AGENTS_FILE,    { agents: [] });
const writeAgents   = (d) => writeJsonFile(AGENTS_FILE, d);
const readCampaigns = () => readJsonFile(CAMPAIGNS_FILE, { campaigns: [] });
const writeCampaigns = (d) => writeJsonFile(CAMPAIGNS_FILE, d);

/* ----------------------------------------------------------------
   In-memory session store  { token → { agentId, nombre, isAdmin, expiresAt } }
   Login rate limiter      { ip → { attempts, resetAt } }
---------------------------------------------------------------- */
const sessions = new Map();
const loginAttempts = new Map();

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [token, s] of sessions) {
    if (now > s.expiresAt) sessions.delete(token);
  }
}

// Sweep expired loginAttempts entries every 30 minutes so the Map
// doesn't grow unboundedly from locked-out IPs that never retry.
setInterval(() => {
  const now = Date.now();
  for (const [ip, r] of loginAttempts) {
    if (now >= r.resetAt) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000).unref();

/* ----------------------------------------------------------------
   Auth helpers
---------------------------------------------------------------- */
function requireAuth(req, res) {
  const token = req.headers['x-auth-token'];
  if (!token) {
    res.status(401).json({ error: 'No autenticado' });
    return null;
  }
  purgeExpiredSessions();
  const session = sessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL; // renew on activity
  return session;
}

function requireAdmin(req, res) {
  const session = requireAuth(req, res);
  if (!session) return null;
  if (!session.isAdmin) {
    res.status(403).json({ error: 'Acceso denegado' });
    return null;
  }
  return session;
}

/* ----------------------------------------------------------------
   POST /api/login — verify credentials, return session token
---------------------------------------------------------------- */
app.post('/api/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Rate limit: max LOGIN_MAX_ATTEMPTS failed attempts per LOGIN_LOCKOUT_MS window
  const record = loginAttempts.get(ip);
  if (record) {
    if (now < record.resetAt && record.attempts >= LOGIN_MAX_ATTEMPTS) {
      const waitMin = Math.ceil((record.resetAt - now) / 60000);
      return res.status(429).json({ error: `Demasiados intentos. Intenta en ${waitMin} minutos.` });
    }
    if (now >= record.resetAt) loginAttempts.delete(ip);
  }

  const { nombre, password } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  const data = readAgents();
  const agent = data.agents.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());

  const recordFail = () => {
    const r = loginAttempts.get(ip) || { attempts: 0, resetAt: now + LOGIN_LOCKOUT_MS };
    r.attempts += 1;
    loginAttempts.set(ip, r);
  };

  if (!agent) { recordFail(); return res.status(401).json({ error: 'Credenciales incorrectas' }); }

  const isHashed = /^\$2[ab]\$/.test(agent.password);
  let match;
  if (isHashed) {
    match = await bcrypt.compare(password, agent.password);
  } else {
    // Legacy plain-text: compare and auto-upgrade on success
    match = password === agent.password;
    if (match) {
      agent.password = await bcrypt.hash(password, SALT_ROUNDS);
      writeAgents(data);
    }
  }

  if (!match) { recordFail(); return res.status(401).json({ error: 'Credenciales incorrectas' }); }

  loginAttempts.delete(ip); // clear on success
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    agentId: agent.id,
    nombre: agent.nombre,
    isAdmin: agent.isAdmin,
    expiresAt: Date.now() + SESSION_TTL,
  });
  log(`LOGIN  ${agent.nombre} (id=${agent.id}) from ${ip}`);
  res.json({ id: agent.id, nombre: agent.nombre, isAdmin: agent.isAdmin, token });
});

/* ----------------------------------------------------------------
   POST /api/logout — invalidate session token
---------------------------------------------------------------- */
app.post('/api/logout', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token) {
    const s = sessions.get(token);
    if (s) log(`LOGOUT ${s.nombre} (id=${s.agentId})`);
    sessions.delete(token);
  }
  res.json({ ok: true });
});

/* ----------------------------------------------------------------
   GET /api/agents — list agents (admin only)
---------------------------------------------------------------- */
app.get('/api/agents', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readAgents();
  const agents = data.agents.map(({ id, nombre, isAdmin }) => ({ id, nombre, isAdmin }));
  res.json({ agents });
});

/* ----------------------------------------------------------------
   POST /api/agents — add agent (admin only)
---------------------------------------------------------------- */
app.post('/api/agents', async (req, res) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { nombre, password, isAdmin } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  if (String(password).length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres` });
  }
  const data = readAgents();
  if (data.agents.some(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
    return res.status(400).json({ error: 'Ya existe un agente con ese nombre' });
  }
  const nextId = data.agents.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  const hashedPassword = await bcrypt.hash(String(password), SALT_ROUNDS);
  const newAgent = { id: nextId, nombre, password: hashedPassword, isAdmin: !!isAdmin };
  data.agents.push(newAgent);
  writeAgents(data);
  log(`AGENT_CREATE  by=${session.nombre} new=${nombre} isAdmin=${!!isAdmin}`);
  res.json({ agent: { id: newAgent.id, nombre: newAgent.nombre, isAdmin: newAgent.isAdmin } });
});

/* ----------------------------------------------------------------
   DELETE /api/agents/:id — remove agent (admin only)
---------------------------------------------------------------- */
app.delete('/api/agents/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const targetId = Number(req.params.id);
  if (Number.isNaN(targetId)) return res.status(400).json({ error: 'ID inválido' });
  if (targetId === admin.agentId) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }
  const data = readAgents();
  const before = data.agents.length;
  const target = data.agents.find(a => a.id === targetId);
  data.agents = data.agents.filter(a => a.id !== targetId);
  if (data.agents.length === before) {
    return res.status(404).json({ error: 'Agente no encontrado' });
  }
  writeAgents(data);
  log(`AGENT_DELETE  by=${admin.nombre} deleted=${target?.nombre} (id=${targetId})`);
  res.json({ ok: true });
});

/* ----------------------------------------------------------------
   GET /api/campaigns — any authenticated agent
---------------------------------------------------------------- */
app.get('/api/campaigns', (req, res) => {
  if (!requireAuth(req, res)) return;
  const data = readCampaigns();
  res.json({ campaigns: data.campaigns });
});

/* ----------------------------------------------------------------
   Shared campaign field parser + validator
---------------------------------------------------------------- */
function parseCampaignBody(body, res) {
  const { nombre, planActual, planNuevo, precioActual, precioNuevo, precioPromo, mesesPromo, filtroZona } = body;
  if (!nombre || !planActual || !planNuevo) {
    res.status(400).json({ error: 'Nombre, planActual y planNuevo son requeridos' });
    return null;
  }
  if (planActual === planNuevo) {
    res.status(400).json({ error: 'El plan actual y el plan nuevo deben ser diferentes' });
    return null;
  }
  const prices = {
    precioActual: Number(precioActual),
    precioNuevo:  Number(precioNuevo),
    precioPromo:  Number(precioPromo),
    mesesPromo:   Number(mesesPromo),
  };
  for (const [key, val] of Object.entries(prices)) {
    if (!Number.isFinite(val) || val < 0) {
      res.status(400).json({ error: `El campo ${key} debe ser un número no negativo` });
      return null;
    }
  }
  return { nombre: String(nombre).trim(), planActual, planNuevo, ...prices, filtroZona: filtroZona || null };
}

/* ----------------------------------------------------------------
   POST /api/campaigns — admin only
---------------------------------------------------------------- */
app.post('/api/campaigns', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const fields = parseCampaignBody(req.body, res);
  if (!fields) return;
  const data = readCampaigns();
  if (data.campaigns.some(c => c.nombre.toLowerCase() === fields.nombre.toLowerCase())) {
    return res.status(400).json({ error: 'Ya existe una campaña con ese nombre' });
  }
  const nextId = data.campaigns.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  const newC = { id: nextId, ...fields };
  data.campaigns.push(newC);
  writeCampaigns(data);
  res.json({ campaign: newC });
});

/* ----------------------------------------------------------------
   PUT /api/campaigns/:id — admin only
---------------------------------------------------------------- */
app.put('/api/campaigns/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  const fields = parseCampaignBody(req.body, res);
  if (!fields) return;
  const data = readCampaigns();
  const idx = data.campaigns.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Campaña no encontrada' });
  data.campaigns[idx] = { ...data.campaigns[idx], id, ...fields };
  writeCampaigns(data);
  res.json({ campaign: data.campaigns[idx] });
});

/* ----------------------------------------------------------------
   DELETE /api/campaigns/:id — admin only
---------------------------------------------------------------- */
app.delete('/api/campaigns/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  const data = readCampaigns();
  const before = data.campaigns.length;
  data.campaigns = data.campaigns.filter(c => c.id !== id);
  if (data.campaigns.length === before) {
    return res.status(404).json({ error: 'Campaña no encontrada' });
  }
  writeCampaigns(data);
  res.json({ ok: true });
});

/* ----------------------------------------------------------------
   GET /api/state — returns tier-999 clients + log, ETag support
---------------------------------------------------------------- */
app.get('/api/state', (req, res) => {
  if (!requireAuth(req, res)) return;
  const data = readData();
  const etag = `"v${data.version}"`;
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  const clients = data.clients.filter(c => c.tier === ACTIVE_TIER);
  res.setHeader('ETag', etag);
  res.json({ version: data.version, clients, log: data.log });
});

/* ----------------------------------------------------------------
   POST /api/state — save tier-999 changes, preserve other tiers
---------------------------------------------------------------- */
/* ----------------------------------------------------------------
   Per-client merge: keep whichever copy has the higher `rev`. A stale list
   from another agent can't clobber edits it never saw, and clients the sender
   doesn't know about (added concurrently) are preserved. Pure + exported so
   the no-clobber property can be unit-tested without a live session.
---------------------------------------------------------------- */
function mergeClients(stored, incoming, deletedIds) {
  const delSet = new Set((Array.isArray(deletedIds) ? deletedIds : []).map(String));
  const incomingById = new Map(incoming.map(c => [String(c.id), c]));
  const seen = new Set();
  const merged = [];
  for (const s of stored) {
    const sid = String(s.id);
    seen.add(sid);
    if (delSet.has(sid)) continue; // explicitly deleted by sender
    const inc = incomingById.get(sid);
    if (inc) merged.push((inc.rev || 0) >= (s.rev || 0) ? inc : s);
    else merged.push(s); // omitted from payload (stale) → keep server copy
  }
  for (const inc of incoming) {
    const iid = String(inc.id);
    if (!seen.has(iid) && !delSet.has(iid)) merged.push(inc); // brand-new
  }
  return merged;
}

// Campaign reset force-replaces the log; otherwise union by (id|at) so two
// agents logging calls concurrently don't drop each other's entries.
function mergeLog(existing, incoming, replaceLog) {
  if (replaceLog) return incoming;
  const key = (e) => `${e.id}|${e.at}`;
  const byKey = new Map();
  for (const e of [...(existing || []), ...incoming]) byKey.set(key(e), e);
  return [...byKey.values()].sort((a, b) => new Date(b.at) - new Date(a.at));
}

app.post('/api/state', (req, res) => {
  if (!requireAuth(req, res)) return;
  const { clients, log, deletedIds, replaceLog } = req.body;
  if (!Array.isArray(clients) || !Array.isArray(log)) {
    return res.status(400).json({ error: 'clients y log deben ser arreglos' });
  }
  const data = readData();
  const otherClients = data.clients.filter(c => c.tier !== ACTIVE_TIER);
  const stored = data.clients.filter(c => c.tier === ACTIVE_TIER);

  data.clients = [...otherClients, ...mergeClients(stored, clients, deletedIds)];
  data.log = mergeLog(data.log, log, replaceLog);
  data.version += 1;
  writeData(data);
  res.json({ version: data.version });
});

/* ----------------------------------------------------------------
   POST /api/import — bulk import; skips duplicates by id
---------------------------------------------------------------- */
app.post('/api/import', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Body must be an array of clients' });
  }
  const data = readData();
  const existingIds = new Set(data.clients.map(c => String(c.id)));
  const toAdd = incoming.filter(c => !existingIds.has(String(c.id)));
  data.clients = [...data.clients, ...toAdd];
  data.version += 1;
  writeData(data);
  log(`IMPORT  by=${admin.nombre} added=${toAdd.length} skipped=${incoming.length - toAdd.length}`);
  res.json({ added: toAdd.length, skipped: incoming.length - toAdd.length });
});

// Only start the HTTP server when run directly (`node server.js`), so the
// pure merge helpers can be required from a test without binding the port.
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ValNet Upsell  →  http://localhost:${PORT}`);
    console.log(`Red local      →  http://[IP-de-esta-PC]:${PORT}`);
  });
}

module.exports = { app, mergeClients, mergeLog };
