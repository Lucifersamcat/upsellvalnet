require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
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

app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ----------------------------------------------------------------
   Generic JSON file helpers — DRY + crash-safe JSON.parse
---------------------------------------------------------------- */
function readJsonFile(filePath, seed) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(seed, null, 2));
    return seed;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    console.error(`JSON corrupto en ${filePath}, usando semilla`);
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
   Auth helpers
---------------------------------------------------------------- */
function requireAdmin(req, res) {
  const agentId = Number(req.headers['x-agent-id']);
  if (Number.isNaN(agentId)) {
    res.status(403).json({ error: 'Acceso denegado' });
    return null;
  }
  const data = readAgents();
  const agent = data.agents.find(a => a.id === agentId);
  if (!agent || !agent.isAdmin) {
    res.status(403).json({ error: 'Acceso denegado' });
    return null;
  }
  return agent;
}

/* ----------------------------------------------------------------
   POST /api/login — verify credentials
---------------------------------------------------------------- */
app.post('/api/login', (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  const data = readAgents();
  const agent = data.agents.find(a => a.nombre.toLowerCase() === nombre.toLowerCase());
  if (!agent) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const isHashed = /^\$2[ab]\$/.test(agent.password);
  let match;
  if (isHashed) {
    match = bcrypt.compareSync(password, agent.password);
  } else {
    // Legacy plain-text password: compare and auto-upgrade on success
    match = password === agent.password;
    if (match) {
      agent.password = bcrypt.hashSync(password, SALT_ROUNDS);
      writeAgents(data);
    }
  }

  if (!match) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  res.json({ id: agent.id, nombre: agent.nombre, isAdmin: agent.isAdmin });
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
app.post('/api/agents', (req, res) => {
  if (!requireAdmin(req, res)) return;
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
  const hashedPassword = bcrypt.hashSync(String(password), SALT_ROUNDS);
  const newAgent = { id: nextId, nombre, password: hashedPassword, isAdmin: !!isAdmin };
  data.agents.push(newAgent);
  writeAgents(data);
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

/* ----------------------------------------------------------------
   GET /api/campaigns — all agents can read
---------------------------------------------------------------- */
app.get('/api/campaigns', (_req, res) => {
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
    precioActual: Number(precioActual) || 0,
    precioNuevo:  Number(precioNuevo)  || 0,
    precioPromo:  Number(precioPromo)  || 0,
    mesesPromo:   Number(mesesPromo)   || 0,
  };
  for (const [key, val] of Object.entries(prices)) {
    if (val < 0) {
      res.status(400).json({ error: `El campo ${key} no puede ser negativo` });
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

/* ----------------------------------------------------------------
   POST /api/import — bulk import; skips duplicates by id
---------------------------------------------------------------- */
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
