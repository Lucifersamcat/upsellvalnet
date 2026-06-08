const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4321;
const DATA_FILE = path.join(__dirname, 'data.json');
const ACTIVE_TIER = '999';

app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = { version: 1, clients: [], log: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const AGENTS_FILE = path.join(__dirname, 'agents.json');

function readAgents() {
  if (!fs.existsSync(AGENTS_FILE)) {
    const seed = { agents: [] };
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
}

function writeAgents(data) {
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(data, null, 2));
}

function requireAdmin(req, res) {
  const agentId = Number(req.headers['x-agent-id']);
  const data = readAgents();
  const agent = data.agents.find(a => a.id === agentId);
  if (!agent || !agent.isAdmin) {
    res.status(403).json({ error: 'Acceso denegado' });
    return null;
  }
  return agent;
}

// POST /api/login — verify credentials
app.post('/api/login', (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  const data = readAgents();
  const agent = data.agents.find(
    a => a.nombre.toLowerCase() === nombre.toLowerCase() && a.password === password
  );
  if (!agent) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  res.json({ id: agent.id, nombre: agent.nombre, isAdmin: agent.isAdmin });
});

// GET /api/agents — list agents (admin only), passwords excluded
app.get('/api/agents', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readAgents();
  const agents = data.agents.map(({ id, nombre, isAdmin }) => ({ id, nombre, isAdmin }));
  res.json({ agents });
});

// POST /api/agents — add agent (admin only)
app.post('/api/agents', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { nombre, password, isAdmin } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  const data = readAgents();
  const exists = data.agents.some(a => a.nombre.toLowerCase() === nombre.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'Ya existe un agente con ese nombre' });
  }
  const nextId = data.agents.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  const newAgent = { id: nextId, nombre, password, isAdmin: !!isAdmin };
  data.agents.push(newAgent);
  writeAgents(data);
  res.json({ agent: { id: newAgent.id, nombre: newAgent.nombre, isAdmin: newAgent.isAdmin } });
});

// DELETE /api/agents/:id — remove agent (admin only, cannot remove self)
app.delete('/api/agents/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const targetId = Number(req.params.id);
  if (targetId === admin.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }
  const data = readAgents();
  const before = data.agents.length;
  data.agents = data.agents.filter(a => a.id !== targetId);
  if (data.agents.length === before) {
    return res.status(404).json({ error: 'Agente no encontrado' });
  }
  writeAgents(data);
  res.json({ ok: true });
});

// GET /api/state — returns tier-999 clients + log, with ETag support
app.get('/api/state', (req, res) => {
  const data = readData();
  const etag = `"v${data.version}"`;

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const clients = data.clients.filter(c => c.tier === ACTIVE_TIER);
  res.setHeader('ETag', etag);
  res.json({ version: data.version, clients, log: data.log });
});

// POST /api/state — save tier-999 changes, preserve other tiers
app.post('/api/state', (req, res) => {
  const { clients, log } = req.body;
  const data = readData();

  const otherClients = data.clients.filter(c => c.tier !== ACTIVE_TIER);
  data.clients = [...otherClients, ...clients];
  data.log = log;
  data.version += 1;

  writeData(data);
  res.json({ version: data.version });
});

// POST /api/import — bulk import clients; skips duplicates by id
app.post('/api/import', (req, res) => {
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

  res.json({ added: toAdd.length, skipped: incoming.length - toAdd.length });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ValNet Upsell  →  http://localhost:${PORT}`);
  console.log(`Red local      →  http://[IP-de-esta-PC]:${PORT}`);
});
