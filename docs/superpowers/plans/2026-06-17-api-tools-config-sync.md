# Configurador de APIs (admin) + Sync de clientes MikroWisp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una página admin para configurar "herramientas" API (estilo captura) y un motor en el servidor que sincroniza (upsert por cédula) los clientes de MikroWisp a la lista de llamadas: al arrancar, cada 24 h y con botón manual.

**Architecture:** Funciones puras de sync en `sync.js` (testeables con `node --test`), endpoints CRUD + runner + triggers en `server.js` (mismo patrón JSON-file/`requireAdmin` que agentes/campañas), y una pestaña "API" en `AdminView` con un componente `ApiToolsTab.jsx` que replica la captura. Secreto (`auth.valor`) nunca sale al cliente.

**Tech Stack:** Node 20 (Express 5, `fetch` global, `node:test`), React 18 + Tailwind (Vite).

**Spec:** `docs/superpowers/specs/2026-06-17-api-tools-config-sync-design.md`

---

## File Structure

- **Create `sync.js`** (raíz, junto a `server.js`): motor de sync. Exporta funciones puras
  (`buildRequest`, `mapMikrowispClient`, `upsertClients`, `parseToolBody`, `publicTool`) y el runner
  impuro (`fetchMikrowispClients`, `runSyncTool`). Una sola responsabilidad: traducir config↔HTTP↔upsert.
- **Create `sync.test.js`** (raíz): pruebas `node --test` de las funciones puras y del runner con `fetch` mockeado.
- **Modify `server.js`**: helpers `apitools.json`, endpoints CRUD + `/run`, triggers (arranque + 24 h), lock.
- **Create `src/components/ApiToolsTab.jsx`**: UI del configurador (lista + editor), replica la captura.
- **Modify `src/components/AdminView.jsx`**: agrega la pestaña "API" que monta `ApiToolsTab`.
- **Modify `README.md`** y `.env.example`: nota de la nueva funcionalidad.

`node --test` descubre `*.test.js`. Mantén `sync.js` enfocado; no metas Express ahí.

---

## Task 1: `buildRequest` — arma el HTTP request según el modo de auth

**Files:**
- Create: `sync.js`
- Test: `sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
// sync.test.js
const test = require('node:test');
const assert = require('node:assert');
const { buildRequest } = require('./sync');

const base = { endpoint: 'https://x/api', metodo: 'POST', parametros: [], timeoutMs: 15000 };

test('buildRequest: modo none → sin headers de auth, body = params', () => {
  const r = buildRequest({ ...base, auth: { modo: 'none' } }, { limit: 50 });
  assert.strictEqual(r.url, 'https://x/api');
  assert.strictEqual(r.method, 'POST');
  assert.deepStrictEqual(r.body, { limit: 50 });
  assert.strictEqual(r.headers.Authorization, undefined);
});

test('buildRequest: modo bearer → header Authorization', () => {
  const r = buildRequest({ ...base, auth: { modo: 'bearer', valor: 'TKN' } }, {});
  assert.strictEqual(r.headers.Authorization, 'Bearer TKN');
});

test('buildRequest: modo apikey → header con nombre de campo', () => {
  const r = buildRequest({ ...base, auth: { modo: 'apikey', campo: 'X-Api-Key', valor: 'K' } }, {});
  assert.strictEqual(r.headers['X-Api-Key'], 'K');
});

test('buildRequest: modo body → token en el body bajo el campo', () => {
  const r = buildRequest({ ...base, auth: { modo: 'body', campo: 'token', valor: 'SECRET' } }, { cedula: '1' });
  assert.deepStrictEqual(r.body, { cedula: '1', token: 'SECRET' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sync.test.js`
Expected: FAIL — `Cannot find module './sync'`.

- [ ] **Step 3: Write minimal implementation**

```js
// sync.js — Motor de sync de clientes MikroWisp. Funciones puras + runner impuro.
'use strict';

const TIPO_MIKROWISP = 'mikrowisp-clientes';
const DEFAULT_TIMEOUT = 15000;

// Arma { url, method, headers, body } para una herramienta, aplicando su auth.
// `params` son los valores de body adicionales (vacío para listar todo).
function buildRequest(tool, params = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const body = { ...params };
  const auth = tool.auth || { modo: 'none' };
  if (auth.modo === 'bearer' && auth.valor) {
    headers['Authorization'] = `Bearer ${auth.valor}`;
  } else if (auth.modo === 'apikey' && auth.campo) {
    headers[auth.campo] = auth.valor || '';
  } else if (auth.modo === 'body' && auth.campo) {
    body[auth.campo] = auth.valor || '';
  }
  return { url: tool.endpoint, method: tool.metodo || 'POST', headers, body };
}

module.exports = { TIPO_MIKROWISP, DEFAULT_TIMEOUT, buildRequest };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sync.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add sync.js sync.test.js
git commit -m "feat(sync): buildRequest aplica modos de auth"
```

---

## Task 2: `mapMikrowispClient` — mapea la respuesta real al esquema de cliente

**Files:**
- Modify: `sync.js`
- Test: `sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
// sync.test.js — añadir
const { mapMikrowispClient } = require('./sync');

const rawReal = {
  id: 8553, nombre: 'JANIO ELIAS CASASNOVAS JORGE', estado: 'ACTIVO',
  telefono: '8297676179', movil: '8297676179', cedula: '02301485955',
  direccion_principal: 'C/ HATUEY #90 PLACER BONITO', Plan: '1 GB-Fibra Optica',
  servicios: [{ instalado: '2026-05-13', perfil: '1 GB-Fibra Optica' }],
};

test('mapMikrowispClient: usa cédula como id y mapea campos reales', () => {
  const c = mapMikrowispClient(rawReal);
  assert.strictEqual(c.id, '02301485955');
  assert.strictEqual(c.nombre, 'JANIO ELIAS CASASNOVAS JORGE');
  assert.strictEqual(c.telefono, '8297676179');
  assert.strictEqual(c.direccion, 'C/ HATUEY #90 PLACER BONITO');
  assert.strictEqual(c.inicio, '2026-05-13');
  assert.strictEqual(c.plan, '1 GB-Fibra Optica');
  assert.strictEqual(c.idMikrowisp, 8553);
});

test('mapMikrowispClient: sin cédula → id fallback mw-<id>', () => {
  const c = mapMikrowispClient({ id: 42, nombre: 'X', cedula: '' });
  assert.strictEqual(c.id, 'mw-42');
});

test('mapMikrowispClient: telefono cae a movil si telefono vacío', () => {
  const c = mapMikrowispClient({ id: 1, cedula: '9', telefono: '', movil: '809' });
  assert.strictEqual(c.telefono, '809');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sync.test.js`
Expected: FAIL — `mapMikrowispClient is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// sync.js — añadir antes de module.exports
function mapMikrowispClient(raw) {
  const cedula = raw.cedula ? String(raw.cedula).trim() : '';
  const servicio = Array.isArray(raw.servicios) && raw.servicios[0] ? raw.servicios[0] : {};
  return {
    id: cedula || `mw-${raw.id}`,
    nombre: raw.nombre || '',
    telefono: raw.telefono || raw.movil || '',
    direccion: raw.direccion_principal || '',
    inicio: servicio.instalado || '',
    plan: raw.Plan || servicio.perfil || '',
    idMikrowisp: raw.id,
  };
}
```

Añade `mapMikrowispClient` a `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sync.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add sync.js sync.test.js
git commit -m "feat(sync): mapMikrowispClient mapea respuesta real a cliente"
```

---

## Task 3: `upsertClients` — crea nuevos, actualiza existentes, preserva trabajo del agente

**Files:**
- Modify: `sync.js`
- Test: `sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
// sync.test.js — añadir
const { upsertClients } = require('./sync');

test('upsertClients: cliente nuevo se crea con esquema completo', () => {
  const data = { version: 1, clients: [], log: [] };
  const r = upsertClients(data, [{ id: '999', nombre: 'Ana', telefono: '809', direccion: 'Calle', inicio: '2026-01-01', plan: 'Fibra', idMikrowisp: 5 }]);
  assert.strictEqual(r.creados, 1);
  const c = data.clients[0];
  assert.strictEqual(c.id, '999');
  assert.strictEqual(c.tier, '999');
  assert.strictEqual(c.estado, 'pendiente');
  assert.strictEqual(c.rev, 1);
  assert.strictEqual(c.notas, '');
});

test('upsertClients: existente actualiza datos de origen y PRESERVA estado/notas', () => {
  const data = { version: 3, clients: [{
    id: '999', nombre: 'Ana V', telefono: 'viejo', direccion: 'vieja', plan: 'A',
    tier: '999', estado: 'convertido', notas: 'cliente top', recordatorio: { fecha: 'x' }, rev: 4,
  }], log: [] };
  const r = upsertClients(data, [{ id: '999', nombre: 'Ana Nueva', telefono: '8290000000', direccion: 'nueva', plan: 'B' }]);
  assert.strictEqual(r.actualizados, 1);
  const c = data.clients[0];
  assert.strictEqual(c.nombre, 'Ana Nueva');
  assert.strictEqual(c.telefono, '8290000000');
  assert.strictEqual(c.estado, 'convertido');        // preservado
  assert.strictEqual(c.notas, 'cliente top');        // preservado
  assert.deepStrictEqual(c.recordatorio, { fecha: 'x' }); // preservado
  assert.strictEqual(c.rev, 5);                      // subió para ganar el merge
});

test('upsertClients: sin cambios no toca rev ni cuenta como actualizado', () => {
  const data = { version: 1, clients: [{ id: '1', nombre: 'Z', telefono: '1', direccion: 'd', plan: 'p', estado: 'pendiente', rev: 2 }], log: [] };
  const r = upsertClients(data, [{ id: '1', nombre: 'Z', telefono: '1', direccion: 'd', plan: 'p' }]);
  assert.strictEqual(r.actualizados, 0);
  assert.strictEqual(r.sinCambios, 1);
  assert.strictEqual(data.clients[0].rev, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sync.test.js`
Expected: FAIL — `upsertClients is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// sync.js — añadir
const SOURCE_FIELDS = ['nombre', 'telefono', 'direccion', 'plan'];

// Muta `data.clients` in-place. Devuelve conteos. NO incrementa data.version
// (eso lo decide el caller para escribir el archivo solo si hubo cambios).
function upsertClients(data, incoming) {
  const byId = new Map(data.clients.map(c => [String(c.id), c]));
  let creados = 0, actualizados = 0, sinCambios = 0;
  for (const m of incoming) {
    const key = String(m.id);
    const existing = byId.get(key);
    if (!existing) {
      const nuevo = {
        id: m.id, nombre: m.nombre || '', telefono: m.telefono || '',
        direccion: m.direccion || '', inicio: m.inicio || '', plan: m.plan || '',
        idMikrowisp: m.idMikrowisp, tier: '999', estado: 'pendiente', notas: '',
        callbackAt: null, lastContact: null, recordatorio: null, rev: 1,
      };
      data.clients.push(nuevo);
      byId.set(key, nuevo);
      creados++;
    } else {
      let changed = false;
      for (const f of SOURCE_FIELDS) {
        if (m[f] !== undefined && m[f] !== '' && existing[f] !== m[f]) {
          existing[f] = m[f];
          changed = true;
        }
      }
      if (m.idMikrowisp !== undefined && existing.idMikrowisp !== m.idMikrowisp) {
        existing.idMikrowisp = m.idMikrowisp;
        changed = true;
      }
      if (changed) { existing.rev = (existing.rev || 0) + 1; actualizados++; }
      else sinCambios++;
    }
  }
  return { creados, actualizados, sinCambios };
}
```

Añade `upsertClients` a `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sync.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add sync.js sync.test.js
git commit -m "feat(sync): upsertClients preserva estado/notas y sube rev en cambios"
```

---

## Task 4: `fetchMikrowispClients` + `runSyncTool` — runner con fetch mockeado

**Files:**
- Modify: `sync.js`
- Test: `sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
// sync.test.js — añadir
const { runSyncTool } = require('./sync');

const tool = { endpoint: 'https://x', metodo: 'POST', timeoutMs: 5000, auth: { modo: 'body', campo: 'token', valor: 'T' } };

function fakeFetch(payload, ok = true, status = 200) {
  return async () => ({ ok, status, json: async () => payload });
}

test('runSyncTool: éxito → upsert + version sube si hubo cambios', async () => {
  let stored = { version: 1, clients: [], log: [] };
  const read = () => stored;
  const write = (d) => { stored = d; };
  const payload = { estado: 'exito', datos: [{ id: 1, cedula: '5', nombre: 'A' }] };
  const r = await runSyncTool(tool, read, write, fakeFetch(payload));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.creados, 1);
  assert.strictEqual(stored.version, 2);
  assert.strictEqual(stored.clients.length, 1);
});

test('runSyncTool: estado != exito → lanza error', async () => {
  const read = () => ({ version: 1, clients: [], log: [] });
  const write = () => {};
  await assert.rejects(
    () => runSyncTool(tool, read, write, fakeFetch({ estado: 'error', mensaje: 'token malo' })),
    /Respuesta inesperada/
  );
});

test('runSyncTool: HTTP no-ok → lanza error', async () => {
  const read = () => ({ version: 1, clients: [], log: [] });
  await assert.rejects(
    () => runSyncTool(tool, read, () => {}, fakeFetch({}, false, 405)),
    /HTTP 405/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sync.test.js`
Expected: FAIL — `runSyncTool is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// sync.js — añadir
async function fetchMikrowispClients(tool, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const { url, method, headers, body } = buildRequest(tool, {});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), tool.timeoutMs || DEFAULT_TIMEOUT);
  let res;
  try {
    res = await doFetch(url, { method, headers, body: JSON.stringify(body), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.estado !== 'exito' || !Array.isArray(json.datos)) {
    throw new Error(`Respuesta inesperada: estado=${json.estado}`);
  }
  return json.datos;
}

// Orquesta: fetch → map → upsert → persistir (solo si hubo cambios).
async function runSyncTool(tool, readData, writeData, fetchImpl) {
  const datos = await fetchMikrowispClients(tool, fetchImpl);
  const incoming = datos.map(mapMikrowispClient);
  const data = readData();
  const { creados, actualizados, sinCambios } = upsertClients(data, incoming);
  if (creados > 0 || actualizados > 0) {
    data.version += 1;
    writeData(data);
  }
  return { ok: true, total: incoming.length, creados, actualizados, sinCambios };
}
```

Añade `fetchMikrowispClients` y `runSyncTool` a `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sync.test.js`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add sync.js sync.test.js
git commit -m "feat(sync): runSyncTool con fetch+timeout, valida envoltura {estado,datos}"
```

---

## Task 5: `parseToolBody` + `publicTool` — validación y ocultar secreto

**Files:**
- Modify: `sync.js`
- Test: `sync.test.js`

- [ ] **Step 1: Write the failing test**

```js
// sync.test.js — añadir
const { parseToolBody, publicTool } = require('./sync');

test('parseToolBody: rechaza endpoint no-URL', () => {
  const r = parseToolBody({ nombre: 'X', endpoint: 'no-url' }, null);
  assert.ok(r.error);
});

test('parseToolBody: normaliza método/tipo/params y defaults', () => {
  const r = parseToolBody({
    nombre: ' Buscar ', endpoint: 'https://x/api', metodo: 'PATCH', tipo: 'mikrowisp-clientes',
    parametros: [{ nombre: 'cedula', tipo: 'string', descripcion: 'd', requerido: true }, { nombre: '' }],
    auth: { modo: 'body', campo: 'token', valor: 'SEC' },
  }, null);
  assert.strictEqual(r.value.nombre, 'Buscar');
  assert.strictEqual(r.value.metodo, 'POST');        // PATCH no permitido → POST
  assert.strictEqual(r.value.tipo, 'mikrowisp-clientes');
  assert.strictEqual(r.value.parametros.length, 1);  // el de nombre vacío se descarta
  assert.strictEqual(r.value.timeoutMs, 15000);
  assert.strictEqual(r.value.auth.valor, 'SEC');
});

test('parseToolBody: valor vacío al editar conserva el anterior', () => {
  const existing = { auth: { modo: 'body', campo: 'token', valor: 'PREV' } };
  const r = parseToolBody({ nombre: 'X', endpoint: 'https://x', auth: { modo: 'body', campo: 'token', valor: '' } }, existing);
  assert.strictEqual(r.value.auth.valor, 'PREV');
});

test('publicTool: oculta el secreto y expone tieneValor', () => {
  const pub = publicTool({ id: 1, nombre: 'X', auth: { modo: 'body', campo: 'token', valor: 'SEC' } });
  assert.strictEqual(pub.auth.valor, undefined);
  assert.strictEqual(pub.auth.tieneValor, true);
  assert.strictEqual(pub.auth.campo, 'token');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sync.test.js`
Expected: FAIL — `parseToolBody is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// sync.js — añadir
const METODOS = ['GET', 'POST', 'PUT', 'DELETE'];
const TIPOS = ['ninguno', 'mikrowisp-clientes'];
const MODOS_AUTH = ['none', 'bearer', 'apikey', 'body'];
const TIPOS_PARAM = ['string', 'number', 'boolean'];

// Valida/normaliza el body de una herramienta. `existing` = tool previa (al editar)
// para conservar el secreto cuando llega vacío. Devuelve { error } o { value }.
function parseToolBody(body, existing) {
  const nombre = String(body.nombre || '').trim();
  const endpoint = String(body.endpoint || '').trim();
  if (!nombre) return { error: 'Nombre requerido' };
  if (!/^https?:\/\//i.test(endpoint)) return { error: 'Endpoint debe ser una URL http(s)' };
  const metodo = METODOS.includes(body.metodo) ? body.metodo : 'POST';
  const tipo = TIPOS.includes(body.tipo) ? body.tipo : 'ninguno';
  const parametros = (Array.isArray(body.parametros) ? body.parametros : [])
    .map(p => ({
      nombre: String(p.nombre || '').trim(),
      tipo: TIPOS_PARAM.includes(p.tipo) ? p.tipo : 'string',
      descripcion: String(p.descripcion || '').trim(),
      requerido: !!p.requerido,
    }))
    .filter(p => p.nombre);
  const am = body.auth || {};
  const modo = MODOS_AUTH.includes(am.modo) ? am.modo : 'none';
  let valor = typeof am.valor === 'string' ? am.valor : '';
  if (valor === '' && existing && existing.auth) valor = existing.auth.valor || '';
  const auth = { modo, campo: String(am.campo || '').trim(), valor };
  const timeoutMs = Number(body.timeoutMs) > 0 ? Number(body.timeoutMs) : DEFAULT_TIMEOUT;
  const cacheTtl = Number(body.cacheTtl) >= 0 ? Number(body.cacheTtl) : 0;
  const activa = body.activa !== false;
  return { value: { nombre, descripcion: String(body.descripcion || '').trim(), tipo, endpoint, metodo, parametros, auth, timeoutMs, cacheTtl, activa } };
}

// Versión segura para el cliente: sin auth.valor, con tieneValor.
function publicTool(t) {
  const auth = t.auth || { modo: 'none', campo: '' };
  return {
    ...t,
    auth: { modo: auth.modo, campo: auth.campo, tieneValor: !!(auth.valor && auth.valor.length) },
  };
}
```

Añade `parseToolBody` y `publicTool` a `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sync.test.js`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add sync.js sync.test.js
git commit -m "feat(sync): parseToolBody valida config y publicTool oculta el secreto"
```

---

## Task 6: Endpoints CRUD + runner + triggers en `server.js`

**Files:**
- Modify: `server.js` (helpers tras línea 77; endpoints tras el bloque de campañas ~línea 349; triggers en el bloque `require.main` ~línea 446)

- [ ] **Step 1: Añadir el archivo de datos y los helpers**

En `server.js`, tras la línea 13 (`const CAMPAIGNS_FILE = ...`):

```js
const APITOOLS_FILE = path.join(DATA_DIR, 'apitools.json');
```

Tras la línea 77 (`const writeCampaigns = ...`):

```js
const readApiTools  = () => readJsonFile(APITOOLS_FILE, { tools: [] });
const writeApiTools = (d) => writeJsonFile(APITOOLS_FILE, d);
```

Tras la línea 6 (requires), añade:

```js
const { runSyncTool, parseToolBody, publicTool, TIPO_MIKROWISP } = require('./sync');
```

- [ ] **Step 2: Añadir los endpoints CRUD (admin)**

Tras el endpoint `DELETE /api/campaigns/:id` (≈ línea 349), pega:

```js
/* ----------------------------------------------------------------
   API Tools (configurador de integraciones) — admin only
---------------------------------------------------------------- */
const syncing = new Set(); // ids en ejecución (evita runs solapados)

app.get('/api/apitools', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readApiTools();
  res.json({ tools: data.tools.map(publicTool) });
});

app.post('/api/apitools', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const parsed = parseToolBody(req.body, null);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const data = readApiTools();
  const nextId = data.tools.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  const tool = { id: nextId, ...parsed.value, ultimoRun: null };
  data.tools.push(tool);
  writeApiTools(data);
  log(`APITOOL_CREATE by=${admin.nombre} id=${nextId} nombre=${tool.nombre}`);
  res.json({ tool: publicTool(tool) });
});

app.put('/api/apitools/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  const data = readApiTools();
  const idx = data.tools.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Herramienta no encontrada' });
  const parsed = parseToolBody(req.body, data.tools[idx]);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  data.tools[idx] = { ...data.tools[idx], id, ...parsed.value };
  writeApiTools(data);
  log(`APITOOL_UPDATE by=${admin.nombre} id=${id}`);
  res.json({ tool: publicTool(data.tools[idx]) });
});

app.delete('/api/apitools/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  const data = readApiTools();
  const before = data.tools.length;
  data.tools = data.tools.filter(t => t.id !== id);
  if (data.tools.length === before) return res.status(404).json({ error: 'Herramienta no encontrada' });
  writeApiTools(data);
  log(`APITOOL_DELETE by=${admin.nombre} id=${id}`);
  res.json({ ok: true });
});
```

- [ ] **Step 3: Añadir el runner y el endpoint `/run`**

Justo después del `DELETE /api/apitools/:id`:

```js
// Ejecuta una herramienta por id, guarda ultimoRun. Reutilizable por triggers.
async function ejecutarHerramienta(id) {
  if (syncing.has(id)) return { ok: false, mensaje: 'Ya se está sincronizando' };
  syncing.add(id);
  try {
    const data = readApiTools();
    const tool = data.tools.find(t => t.id === id);
    if (!tool) return { ok: false, mensaje: 'Herramienta no encontrada' };
    let run;
    try {
      const r = await runSyncTool(tool, readData, writeData);
      run = { at: new Date().toISOString(), ok: true, creados: r.creados, actualizados: r.actualizados, sinCambios: r.sinCambios, errores: 0, mensaje: `OK (${r.total} clientes)` };
    } catch (err) {
      run = { at: new Date().toISOString(), ok: false, creados: 0, actualizados: 0, sinCambios: 0, errores: 1, mensaje: String(err && err.message ? err.message : err) };
    }
    tool.ultimoRun = run;
    writeApiTools(data);
    log(`APITOOL_RUN id=${id} ok=${run.ok} ${run.mensaje}`);
    return run;
  } finally {
    syncing.delete(id);
  }
}

app.post('/api/apitools/:id/run', async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
  const run = await ejecutarHerramienta(id);
  res.json({ ultimoRun: run });
});

// Corre todas las herramientas activas de tipo MikroWisp (arranque + 24 h).
async function syncTodasActivas() {
  const data = readApiTools();
  for (const t of data.tools) {
    if (t.activa && t.tipo === TIPO_MIKROWISP) {
      await ejecutarHerramienta(t.id);
    }
  }
}
```

- [ ] **Step 4: Disparar el sync al arrancar y cada 24 h**

Dentro del bloque `if (require.main === module) {` (≈ línea 446), tras `app.listen(...)`, añade al final del callback de `listen`:

```js
    // Sync de clientes: al arrancar + cada 24 h. No-fatal.
    syncTodasActivas().catch(err => console.error('sync arranque falló:', err));
    setInterval(() => {
      syncTodasActivas().catch(err => console.error('sync 24h falló:', err));
    }, 24 * 60 * 60 * 1000).unref();
```

- [ ] **Step 5: Verificar que el servidor arranca y los endpoints responden**

Run (en una terminal):
```bash
node server.js
```
Expected: imprime `ValNet Upsell → http://localhost:4321` sin errores (con `apitools.json` ausente, `syncTodasActivas` no hace nada).

Run (otra terminal) — sin token debe dar 401:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/api/apitools
```
Expected: `401`.

Detén el servidor (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat(api): endpoints CRUD de apitools + runner + triggers (arranque/24h)"
```

---

## Task 7: Pestaña "API" en AdminView + componente `ApiToolsTab`

**Files:**
- Create: `src/components/ApiToolsTab.jsx`
- Modify: `src/components/AdminView.jsx` (línea 3 import; línea 131 tabs; render del tab tras el bloque `promos`)

- [ ] **Step 1: Crear el componente `ApiToolsTab.jsx`**

```jsx
// src/components/ApiToolsTab.jsx
import { useEffect, useState } from 'react';

const EMPTY = {
  nombre: '', descripcion: '', tipo: 'mikrowisp-clientes', endpoint: '', metodo: 'POST',
  parametros: [], auth: { modo: 'body', campo: '', valor: '' }, timeoutMs: 15000, cacheTtl: 0, activa: true,
};
const MODOS = [['none', 'Sin auth'], ['bearer', 'Bearer token'], ['apikey', 'API key header'], ['body', 'Token en body']];

function ApiToolsTab({ session }) {
  const headers = { 'Content-Type': 'application/json', 'X-Auth-Token': session.token || '' };
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);   // null | id | 'new'
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/apitools', { headers: { 'X-Auth-Token': session.token || '' } });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al cargar'); return; }
      setTools(data.tools || []);
    } catch { setError('Error de red'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing('new'); setError(''); };
  const openEdit = (t) => {
    setForm({ ...EMPTY, ...t, auth: { modo: t.auth.modo, campo: t.auth.campo || '', valor: '' } });
    setEditing(t.id); setError('');
  };

  const setF = (patch) => setForm(f => ({ ...f, ...patch }));
  const setAuth = (patch) => setForm(f => ({ ...f, auth: { ...f.auth, ...patch } }));

  const addParam = () => setF({ parametros: [...form.parametros, { nombre: '', tipo: 'string', descripcion: '', requerido: false }] });
  const setParam = (i, patch) => setF({ parametros: form.parametros.map((p, j) => j === i ? { ...p, ...patch } : p) });
  const delParam = (i) => setF({ parametros: form.parametros.filter((_, j) => j !== i) });

  const save = async () => {
    setSaving(true); setError('');
    try {
      const isNew = editing === 'new';
      const url = isNew ? '/api/apitools' : `/api/apitools/${editing}`;
      const res = await fetch(url, { method: isNew ? 'POST' : 'PUT', headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
      setEditing(null); await load();
    } catch { setError('Error de red'); } finally { setSaving(false); }
  };

  const del = async (t) => {
    if (!window.confirm(`¿Eliminar la herramienta "${t.nombre}"?`)) return;
    try {
      const res = await fetch(`/api/apitools/${t.id}`, { method: 'DELETE', headers: { 'X-Auth-Token': session.token || '' } });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Error al eliminar'); return; }
      await load();
    } catch { setError('Error de red'); }
  };

  const run = async (t) => {
    setRunningId(t.id);
    try {
      const res = await fetch(`/api/apitools/${t.id}/run`, { method: 'POST', headers: { 'X-Auth-Token': session.token || '' } });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Error al sincronizar');
      await load();
    } catch { setError('Error de red'); } finally { setRunningId(null); }
  };

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';

  if (editing !== null) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-bold text-slate-900">{editing === 'new' ? 'Nueva herramienta' : `Editar · ${form.nombre}`}</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Nombre</span>
              <input className={inputCls} value={form.nombre} onChange={e => setF({ nombre: e.target.value })} placeholder="Buscar cliente (MikroWisp)" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Tipo</span>
              <select className={inputCls} value={form.tipo} onChange={e => setF({ tipo: e.target.value })}>
                <option value="mikrowisp-clientes">Sincronizar clientes (MikroWisp)</option>
                <option value="ninguno">Ninguno (solo guardar)</option>
              </select></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Cuándo usar / descripción</span>
            <input className={inputCls} value={form.descripcion} onChange={e => setF({ descripcion: e.target.value })} /></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="block sm:col-span-3"><span className="mb-1 block text-xs font-semibold text-slate-600">Endpoint URL</span>
              <input className={inputCls} value={form.endpoint} onChange={e => setF({ endpoint: e.target.value })} placeholder="https://proxy.valnetrd.com/api/v1/GetClientsDetails" /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Método</span>
              <select className={inputCls} value={form.metodo} onChange={e => setF({ metodo: e.target.value })}>
                {['GET', 'POST', 'PUT', 'DELETE'].map(m => <option key={m}>{m}</option>)}
              </select></label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Parámetros ({form.parametros.length})</span>
              <button onClick={addParam} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">+ Agregar</button>
            </div>
            <div className="space-y-3">
              {form.parametros.map((p, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex gap-2">
                    <input className={inputCls} value={p.nombre} onChange={e => setParam(i, { nombre: e.target.value })} placeholder="nombre" />
                    <select className={inputCls + ' max-w-[140px]'} value={p.tipo} onChange={e => setParam(i, { tipo: e.target.value })}>
                      {['string', 'number', 'boolean'].map(t => <option key={t}>{t}</option>)}
                    </select>
                    <button onClick={() => delParam(i)} aria-label="Quitar parámetro" className="rounded-lg border border-rose-200 px-2.5 text-rose-600 hover:bg-rose-50">✕</button>
                  </div>
                  <input className={inputCls + ' mt-2'} value={p.descripcion} onChange={e => setParam(i, { descripcion: e.target.value })} placeholder="Descripción" />
                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={p.requerido} onChange={e => setParam(i, { requerido: e.target.checked })} /> Requerido</label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold text-slate-600">Autenticación</span>
            <div className="mb-3 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 w-fit">
              {MODOS.map(([id, label]) => (
                <button key={id} onClick={() => setAuth({ modo: id })}
                  className={'rounded-lg px-3 py-1.5 text-sm font-semibold transition ' + (form.auth.modo === id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                  {label}
                </button>
              ))}
            </div>
            {form.auth.modo !== 'none' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {form.auth.modo !== 'bearer' && (
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{form.auth.modo === 'apikey' ? 'Nombre del header' : 'Campo del body'}</span>
                    <input className={inputCls} value={form.auth.campo} onChange={e => setAuth({ campo: e.target.value })} /></label>
                )}
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Valor <span className="font-normal text-slate-400">(vacío = no cambiar)</span></span>
                  <input type="password" className={inputCls} value={form.auth.valor} onChange={e => setAuth({ valor: e.target.value })} placeholder="••••••••" /></label>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Timeout (ms)</span>
              <input type="number" className={inputCls} value={form.timeoutMs} onChange={e => setF({ timeoutMs: Number(e.target.value) })} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Cache TTL (s, opcional)</span>
              <input type="number" className={inputCls} value={form.cacheTtl} onChange={e => setF({ cacheTtl: Number(e.target.value) })} /></label>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700"><input type="checkbox" checked={form.activa} onChange={e => setF({ activa: e.target.checked })} /> Activa</label>
          </div>

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar'}</button>
            <button onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <p className="px-4 py-8 text-center text-sm text-slate-400">Cargando…</p> : (
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Último sync</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {tools.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{t.nombre}</td>
                  <td className="px-4 py-3">{t.activa ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">Activa</span> : <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">Inactiva</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{t.ultimoRun ? `${t.ultimoRun.ok ? '✓' : '✕'} ${t.ultimoRun.mensaje}` : <span className="text-slate-300">Nunca</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => run(t)} disabled={runningId === t.id} className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40">{runningId === t.id ? 'Sincronizando…' : 'Sincronizar'}</button>
                      <button onClick={() => openEdit(t)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Editar</button>
                      <button onClick={() => del(t)} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {tools.length === 0 && <tr><td colSpan="4" className="px-4 py-8 text-center text-sm text-slate-400">No hay herramientas. Crea una nueva.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {error && <p className="mb-3 text-xs font-semibold text-rose-600">{error}</p>}
      <button onClick={openNew} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700">+ Nueva herramienta</button>
    </div>
  );
}

export { ApiToolsTab };
```

- [ ] **Step 2: Montar la pestaña en `AdminView.jsx`**

En `src/components/AdminView.jsx`, línea 3, añade el import:
```jsx
import { ApiToolsTab } from './ApiToolsTab';
```

Línea 131, cambia el arreglo de tabs para incluir "API":
```jsx
        {[['agentes','Agentes'],['promos','Campañas'],['api','API']].map(([id,label]) => (
```

Tras el bloque `{tab === 'promos' && ( ... )}` (≈ línea 256, antes del `</div>` final del return), añade:
```jsx
      {tab === 'api' && <ApiToolsTab session={session} />}
```

- [ ] **Step 3: Verificar build y UI**

Run:
```bash
npm run build
```
Expected: build OK sin errores.

Verificación manual (con `preview_*`): arranca el server (`node server.js`) + `npm run dev`, entra como admin, abre la pestaña **API**, crea una herramienta con el endpoint/método/auth de la captura, guarda, y pulsa **Sincronizar**. Confirma que la fila muestra "Último sync" con el resultado y que la lista de clientes refleja los importados. Verifica en `GET /api/apitools` (DevTools → Network) que **no** aparece `auth.valor`, solo `tieneValor`.

- [ ] **Step 4: Commit**

```bash
git add src/components/ApiToolsTab.jsx src/components/AdminView.jsx
git commit -m "feat(ui): pestaña API en admin con configurador de herramientas y botón sync"
```

---

## Task 8: Ignorar datos sensibles + docs

**Files:**
- Modify: `.gitignore`, `README.md`, `.env.example`

- [ ] **Step 1: Ignorar `apitools.json`** (contiene el token)

En `.gitignore`, junto a `data.json`/`agents.json`/`campaigns.json`, añade:
```
apitools.json
```

- [ ] **Step 2: Documentar en README**

En `README.md`, en "Funcionalidades", añade:
```
- **Configurador de API** — herramientas API configurables (endpoint, método, auth) y sync automático de clientes desde MikroWisp: al arrancar, cada 24 h y con botón manual (admin)
```
En "Seguridad", añade `apitools.json` a la lista de datos sensibles ignorados.

- [ ] **Step 3: Nota en `.env.example`**

En `.env.example`, bajo la sección MikroWisp, añade:
```
# La integración MikroWisp ahora se configura desde la app (Admin → API).
# apitools.json guarda endpoint/auth/token; estas variables quedan como referencia.
```

- [ ] **Step 4: Verificar suite completa**

Run:
```bash
node --test
```
Expected: PASS (17 tests de `sync.test.js`).

- [ ] **Step 5: Commit**

```bash
git add .gitignore README.md .env.example
git commit -m "chore: ignorar apitools.json y documentar configurador de API"
```

---

## Self-Review

- **Spec coverage:** apitools.json (T6) · CRUD admin + secreto oculto (T5,T6) · buildRequest/auth (T1) · mapMikrowispClient real (T2) · upsert preservando estado (T3) · runner+envoltura {estado,datos} (T4) · triggers arranque/24h + botón (T6,T7) · UI tipo captura (T7) · errores no-fatales en ultimoRun (T6) · audit log (T6) · pruebas node:test (T1-T5) · `.gitignore` (T8). Cubierto.
- **Pendiente del spec (paginación):** la estrategia es "una llamada sin filtro" (T4/T6). Si en la verificación manual (T7-Step3) MikroWisp pagina, añadir un bucle `limit`/`offset` en `fetchMikrowispClients` — único ajuste posible posterior.
- **Type consistency:** `runSyncTool(tool, readData, writeData, fetchImpl)` y su retorno `{ok,total,creados,actualizados,sinCambios}` se usan igual en `ejecutarHerramienta` (T6). `publicTool`/`parseToolBody` firmas consistentes T5↔T6. `auth.{modo,campo,valor}` y `tieneValor` consistentes backend↔UI.
- **Placeholders:** ninguno; todo el código está completo.
