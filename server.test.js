const { test } = require('node:test');
const assert = require('node:assert');
const { mergeClients, mergeLog } = require('./server');

/* mergeClients — per-client revision merge (concurrent-edit protection) */

test('two agents editing different clients do not clobber each other', () => {
  // Server already has agent B's edit to client 2 (rev 1).
  const stored = [
    { id: 1, nombre: 'A', rev: 0 },
    { id: 2, nombre: 'B', estado: 'convertido', rev: 1 },
  ];
  // Agent A posts a stale list: their fresh edit to client 1 (rev 1) plus a
  // stale copy of client 2 (rev 0, before B's change).
  const incoming = [
    { id: 1, nombre: 'A', estado: 'callback', rev: 1 },
    { id: 2, nombre: 'B', estado: 'pendiente', rev: 0 },
  ];
  const merged = mergeClients(stored, incoming, []);
  const c1 = merged.find(c => c.id === 1);
  const c2 = merged.find(c => c.id === 2);
  assert.equal(c1.estado, 'callback', 'A\'s own edit is saved');
  assert.equal(c2.estado, 'convertido', 'B\'s edit is NOT clobbered by A\'s stale copy');
});

test('same-client edit: higher rev wins (last write wins)', () => {
  const stored = [{ id: 1, estado: 'pendiente', rev: 2 }];
  const incoming = [{ id: 1, estado: 'convertido', rev: 3 }];
  const merged = mergeClients(stored, incoming, []);
  assert.equal(merged.find(c => c.id === 1).estado, 'convertido');
});

test('client added concurrently by another agent is preserved when sender omits it', () => {
  const stored = [
    { id: 1, rev: 0 },
    { id: 99, nombre: 'New from other agent', rev: 1 },
  ];
  const incoming = [{ id: 1, rev: 1 }]; // sender never saw client 99
  const merged = mergeClients(stored, incoming, []);
  assert.ok(merged.find(c => c.id === 99), 'concurrently-added client survives');
  assert.equal(merged.length, 2);
});

test('brand-new client from sender is added', () => {
  const stored = [{ id: 1, rev: 0 }];
  const incoming = [{ id: 1, rev: 0 }, { id: 2, nombre: 'Nuevo', rev: 1 }];
  const merged = mergeClients(stored, incoming, []);
  assert.ok(merged.find(c => c.id === 2));
});

test('deletedIds removes a client', () => {
  const stored = [{ id: 1, rev: 0 }, { id: 2, rev: 0 }];
  const incoming = [{ id: 1, rev: 0 }];
  const merged = mergeClients(stored, incoming, [2]);
  assert.equal(merged.length, 1);
  assert.ok(!merged.find(c => c.id === 2));
});

test('mixed id types (numeric vs cédula string) merge by string key', () => {
  const stored = [{ id: '001-1234567-8', nombre: 'Cedula', rev: 0 }];
  const incoming = [{ id: '001-1234567-8', nombre: 'Cedula', estado: 'convertido', rev: 1 }];
  const merged = mergeClients(stored, incoming, []);
  assert.equal(merged.length, 1, 'no duplicate from type mismatch');
  assert.equal(merged[0].estado, 'convertido');
});

/* mergeLog — union vs force-replace */

test('mergeLog unions entries from both agents without duplicates', () => {
  const existing = [{ id: 2, at: '2026-06-15T10:00:00Z', resultado: 'convertido' }];
  const incoming = [
    { id: 2, at: '2026-06-15T10:00:00Z', resultado: 'convertido' }, // dup
    { id: 1, at: '2026-06-15T11:00:00Z', resultado: 'callback' },   // new
  ];
  const log = mergeLog(existing, incoming, false);
  assert.equal(log.length, 2, 'duplicate collapsed, new entry kept');
  assert.equal(log[0].id, 1, 'sorted newest-first');
});

test('mergeLog force-replaces on campaign reset', () => {
  const existing = [{ id: 1, at: '2026-06-15T10:00:00Z' }];
  const log = mergeLog(existing, [], true);
  assert.deepEqual(log, [], 'reset wipes the log');
});
