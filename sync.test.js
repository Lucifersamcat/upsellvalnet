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
