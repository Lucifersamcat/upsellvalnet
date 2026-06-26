// mikrowisp.test.js — lookup puntual por cédula (token-only).
const test = require('node:test');
const assert = require('node:assert');
const {
  mikrowispConfig,
  buildLookupRequest,
  mapMikrowispClient,
  parseLookupResponse,
  lookupClient,
} = require('./mikrowisp');

/* mikrowispConfig — enabled solo con URL + token; recorta la barra final */

test('mikrowispConfig: enabled cuando hay URL y token', () => {
  const c = mikrowispConfig({ MIKROWISP_API_URL: 'https://x/api/v1/', MIKROWISP_TOKEN: 'T' });
  assert.strictEqual(c.enabled, true);
  assert.strictEqual(c.baseUrl, 'https://x/api/v1', 'recorta la barra final');
  assert.strictEqual(c.token, 'T');
});

test('mikrowispConfig: disabled si falta el token', () => {
  assert.strictEqual(mikrowispConfig({ MIKROWISP_API_URL: 'https://x' }).enabled, false);
  assert.strictEqual(mikrowispConfig({ MIKROWISP_TOKEN: 'T' }).enabled, false);
  assert.strictEqual(mikrowispConfig({}).enabled, false);
});

/* buildLookupRequest — token en el body, no en headers */

test('buildLookupRequest: arma url + token + cédula en el body', () => {
  const cfg = { baseUrl: 'https://proxy.valnetrd.com/api/v1', token: 'SECRET' };
  const r = buildLookupRequest(cfg, '02301485955');
  assert.strictEqual(r.url, 'https://proxy.valnetrd.com/api/v1/GetClientsDetails');
  assert.deepStrictEqual(r.body, { token: 'SECRET', cedula: '02301485955' });
  assert.strictEqual(r.headers.Authorization, undefined, 'el token nunca va en headers');
});

/* mapMikrowispClient — respuesta real de producción, sin id ni campos de agente */

const rawReal = {
  id: 8553, nombre: 'JANIO ELIAS CASASNOVAS JORGE', estado: 'ACTIVO',
  telefono: '8297676179', movil: '8297676179', cedula: '02301485955',
  direccion_principal: 'C/ HATUEY #90 PLACER BONITO', Plan: '1 GB-Fibra Optica',
  servicios: [{ instalado: '2026-05-13', perfil: '1 GB-Fibra Optica' }],
};

test('mapMikrowispClient: mapea campos de origen y NO incluye id', () => {
  const c = mapMikrowispClient(rawReal);
  assert.strictEqual(c.nombre, 'JANIO ELIAS CASASNOVAS JORGE');
  assert.strictEqual(c.telefono, '8297676179');
  assert.strictEqual(c.direccion, 'C/ HATUEY #90 PLACER BONITO');
  assert.strictEqual(c.inicio, '2026-05-13');
  assert.strictEqual(c.plan, '1 GB-Fibra Optica');
  assert.strictEqual(c.idMikrowisp, 8553);
  assert.ok(!('id' in c), 'no devuelve id: la identidad del cliente no cambia');
  assert.ok(!('estado' in c), 'no pisa el estado de llamada del agente');
});

test('mapMikrowispClient: telefono cae a movil si telefono vacío', () => {
  const c = mapMikrowispClient({ id: 1, telefono: '', movil: '809', servicios: [] });
  assert.strictEqual(c.telefono, '809');
});

/* parseLookupResponse — encontrado / no encontrado / forma inválida */

test('parseLookupResponse: éxito con un cliente', () => {
  const r = parseLookupResponse({ estado: 'exito', datos: [rawReal] });
  assert.strictEqual(r.cliente.nombre, 'JANIO ELIAS CASASNOVAS JORGE');
});

test('parseLookupResponse: éxito sin coincidencias → cliente null', () => {
  const r = parseLookupResponse({ estado: 'exito', datos: [] });
  assert.deepStrictEqual(r, { cliente: null });
});

test('parseLookupResponse: estado distinto de exito → error', () => {
  assert.ok(parseLookupResponse({ estado: 'error', mensaje: 'token inválido' }).error);
  assert.ok(parseLookupResponse(null).error);
});

/* lookupClient — fetch mockeado: éxito, no encontrado, HTTP, red */

const cfg = { baseUrl: 'https://x/api/v1', token: 'T' };

test('lookupClient: éxito devuelve el cliente mapeado', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ estado: 'exito', datos: [rawReal] }) });
  const r = await lookupClient(cfg, '02301485955', fakeFetch);
  assert.strictEqual(r.cliente.nombre, 'JANIO ELIAS CASASNOVAS JORGE');
});

test('lookupClient: cédula sin coincidencia → cliente null', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => ({ estado: 'exito', datos: [] }) });
  const r = await lookupClient(cfg, '000', fakeFetch);
  assert.deepStrictEqual(r, { cliente: null });
});

test('lookupClient: HTTP no-2xx → error', async () => {
  const fakeFetch = async () => ({ ok: false, status: 500 });
  const r = await lookupClient(cfg, '1', fakeFetch);
  assert.strictEqual(r.error, 'HTTP 500');
});

test('lookupClient: fallo de red → error de red', async () => {
  const fakeFetch = async () => { throw new Error('ECONNREFUSED'); };
  const r = await lookupClient(cfg, '1', fakeFetch);
  assert.strictEqual(r.error, 'error de red');
});
