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
