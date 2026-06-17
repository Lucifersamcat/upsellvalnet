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
