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
