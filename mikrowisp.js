// mikrowisp.js — Lookup puntual de un cliente en MikroWisp por cédula.
//
// El token de la API solo permite consultar un cliente a la vez (no listar toda
// la cartera), así que esto NO sincroniza en masa: refresca los datos de un
// cliente que ya existe en la lista (sembrado vía import CSV). Funciones puras
// + una impura (`lookupClient`) para poder testear el mapeo sin red.
'use strict';

const DEFAULT_TIMEOUT = 15000;
const LOOKUP_PATH = '/GetClientsDetails';

// Lee la config de integración del entorno. `enabled` = hay URL + token.
function mikrowispConfig(env = process.env) {
  const baseUrl = String(env.MIKROWISP_API_URL || '').trim().replace(/\/+$/, '');
  const token = String(env.MIKROWISP_TOKEN || '').trim();
  return { baseUrl, token, enabled: !!(baseUrl && token) };
}

// Arma { url, headers, body } para el lookup por cédula. El token viaja en el
// body (modo de auth de MikroWisp) y nunca se devuelve al cliente.
function buildLookupRequest(cfg, cedula) {
  return {
    url: `${cfg.baseUrl}${LOOKUP_PATH}`,
    headers: { 'Content-Type': 'application/json' },
    body: { token: cfg.token, cedula: String(cedula) },
  };
}

// Mapea la respuesta cruda de MikroWisp al subconjunto de campos de ORIGEN que
// la app refresca. A propósito NO incluye `id` (la identidad del cliente no
// cambia) ni campos de trabajo del agente (estado, notas, recordatorio).
function mapMikrowispClient(raw) {
  const servicio = Array.isArray(raw.servicios) && raw.servicios[0] ? raw.servicios[0] : {};
  return {
    nombre: raw.nombre || '',
    telefono: raw.telefono || raw.movil || '',
    direccion: raw.direccion_principal || '',
    inicio: servicio.instalado || '',
    plan: raw.Plan || servicio.perfil || '',
    idMikrowisp: raw.id,
  };
}

// Valida la envoltura { estado:'exito', datos:[...] }. Devuelve:
//   { cliente }       → encontrado
//   { cliente: null } → la API respondió bien pero sin coincidencias
//   { error }         → forma inesperada
function parseLookupResponse(json) {
  if (!json || json.estado !== 'exito' || !Array.isArray(json.datos)) {
    return { error: 'respuesta inesperada' };
  }
  if (json.datos.length === 0) return { cliente: null };
  return { cliente: mapMikrowispClient(json.datos[0]) };
}

// Impuro: hace el POST con timeout vía AbortController. Captura red/timeout y
// devuelve siempre una de las formas de `parseLookupResponse` (o { error }).
async function lookupClient(cfg, cedula, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const { url, headers, body } = buildLookupRequest(cfg, cedula);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  let res;
  try {
    res = await doFetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    return { error: err && err.name === 'AbortError' ? 'tiempo de espera agotado' : 'error de red' };
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return { error: `HTTP ${res.status}` };
  let json;
  try { json = await res.json(); } catch { return { error: 'respuesta no es JSON' }; }
  return parseLookupResponse(json);
}

module.exports = {
  DEFAULT_TIMEOUT,
  mikrowispConfig,
  buildLookupRequest,
  mapMikrowispClient,
  parseLookupResponse,
  lookupClient,
};
