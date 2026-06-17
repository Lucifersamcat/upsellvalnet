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
