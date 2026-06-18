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

module.exports = { TIPO_MIKROWISP, DEFAULT_TIMEOUT, buildRequest, mapMikrowispClient, upsertClients, fetchMikrowispClients, runSyncTool, parseToolBody, publicTool };
