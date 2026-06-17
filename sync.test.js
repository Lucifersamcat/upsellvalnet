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

// Task 2: mapMikrowispClient
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

// Task 3: upsertClients
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

// Task 4: runSyncTool
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

// Task 5: parseToolBody + publicTool
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
