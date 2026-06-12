import { useEffect, useState } from 'react';
import { PLANES, RD, planInfo } from '../constants';
import { Icon } from '../icons';

    /* ============================================================
       ADMIN VIEW
    ============================================================ */
    function AdminView({ session, onCampaignsChange }) {
  const [tab, setTab] = useState('agentes');

  // ---- Agents ----
  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentForm, setAgentForm] = useState({ nombre: '', password: '', isAdmin: false });
  const [agentFormError, setAgentFormError] = useState('');
  const [agentSaving, setAgentSaving] = useState(false);
  const agentHeaders = { 'Content-Type': 'application/json', 'X-Auth-Token': session.token || '' };

  const loadAgents = async () => {
    setAgentsLoading(true);
    try {
      const res = await fetch('/api/agents', { headers: { 'X-Auth-Token': session.token || '' } });
      const data = await res.json();
      if (!res.ok) { setAgentFormError(data.error || 'Error al cargar agentes'); return; }
      setAgents(data.agents || []);
    } catch { setAgentFormError('Error de red'); } finally { setAgentsLoading(false); }
  };
  useEffect(() => { loadAgents(); }, []);

  const handleAddAgent = async (e) => {
    e.preventDefault();
    setAgentFormError('');
    if (!agentForm.nombre.trim() || !agentForm.password.trim()) { setAgentFormError('Nombre y contraseña requeridos'); return; }
    setAgentSaving(true);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST', headers: agentHeaders,
        body: JSON.stringify({ nombre: agentForm.nombre.trim(), password: agentForm.password.trim(), isAdmin: agentForm.isAdmin }),
      });
      const data = await res.json();
      if (!res.ok) { setAgentFormError(data.error || 'Error al agregar'); return; }
      setAgentForm({ nombre: '', password: '', isAdmin: false });
      await loadAgents();
    } catch { setAgentFormError('Error de red'); } finally { setAgentSaving(false); }
  };

  const handleDeleteAgent = async (agent) => {
    if (!window.confirm(`¿Eliminar al agente "${agent.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE', headers: { 'X-Auth-Token': session.token || '' } });
      if (!res.ok) { const d = await res.json(); setAgentFormError(d.error || 'Error al eliminar'); return; }
      await loadAgents();
    } catch { setAgentFormError('Error de red al eliminar'); }
  };

  // ---- Campaigns ----
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const emptyCForm = { nombre: '', planActual: '', planNuevo: '', precioActual: '', precioNuevo: '', precioPromo: '', mesesPromo: '', filtroZona: '' };
  const [cForm, setCForm] = useState(emptyCForm);
  const [cFormError, setCFormError] = useState('');
  const [cSaving, setCampaignSaving] = useState(false);

  const loadCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch('/api/campaigns', { headers: { 'X-Auth-Token': session.token || '' } });
      const data = await res.json();
      if (!res.ok) { setCFormError(data.error || 'Error al cargar campañas'); return; }
      setCampaigns(data.campaigns || []);
    } catch { setCFormError('Error de red'); } finally { setCampaignsLoading(false); }
  };
  useEffect(() => { loadCampaigns(); }, []);

  const handlePlanActualChange = (nombre) => {
    const p = planInfo(nombre);
    setCForm(f => ({ ...f, planActual: nombre, precioActual: p ? String(p.precio) : f.precioActual, precioPromo: p ? String(p.precio) : f.precioPromo }));
  };

  const handlePlanNuevoChange = (nombre) => {
    const p = planInfo(nombre);
    setCForm(f => ({ ...f, planNuevo: nombre, precioNuevo: p ? String(p.precio) : f.precioNuevo }));
  };

  const openNew = () => { setEditingId(null); setCForm(emptyCForm); setCFormError(''); setShowForm(true); };

  const openEdit = (c) => {
    setEditingId(c.id);
    setCForm({ nombre: c.nombre, planActual: c.planActual, planNuevo: c.planNuevo, precioActual: String(c.precioActual), precioNuevo: String(c.precioNuevo), precioPromo: String(c.precioPromo), mesesPromo: String(c.mesesPromo), filtroZona: c.filtroZona || '' });
    setCFormError('');
    setShowForm(true);
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    setCFormError('');
    if (!cForm.nombre.trim() || !cForm.planActual || !cForm.planNuevo) { setCFormError('Nombre, plan actual y plan nuevo son requeridos'); return; }
    if (cForm.planActual === cForm.planNuevo) { setCFormError('El plan actual y el plan nuevo deben ser diferentes'); return; }
    setCampaignSaving(true);
    const body = { nombre: cForm.nombre.trim(), planActual: cForm.planActual, planNuevo: cForm.planNuevo, precioActual: Number(cForm.precioActual) || 0, precioNuevo: Number(cForm.precioNuevo) || 0, precioPromo: Number(cForm.precioPromo) || 0, mesesPromo: Number(cForm.mesesPromo) || 0, filtroZona: cForm.filtroZona.trim() || null };
    try {
      const url = editingId != null ? `/api/campaigns/${editingId}` : '/api/campaigns';
      const method = editingId != null ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: agentHeaders, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setCFormError(data.error || 'Error al guardar'); return; }
      setShowForm(false);
      await loadCampaigns();
      if (onCampaignsChange) onCampaignsChange();
    } catch { setCFormError('Error de red'); } finally { setCampaignSaving(false); }
  };

  const handleDeleteCampaign = async (c) => {
    if (!window.confirm(`¿Eliminar campaña '${c.nombre}'?`)) return;
    try {
      const res = await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE', headers: { 'X-Auth-Token': session.token || '' } });
      if (!res.ok) { const d = await res.json(); setCFormError(d.error || 'Error al eliminar'); return; }
      await loadCampaigns();
      if (onCampaignsChange) onCampaignsChange();
    } catch { setCFormError('Error de red al eliminar'); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h2 className="mb-1 text-lg font-bold text-slate-900">Administración</h2>
      <p className="mb-4 text-sm text-slate-500">Gestiona agentes y campañas.</p>

      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {[['agentes','Agentes'],['promos','Campañas']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={'rounded-lg px-5 py-1.5 text-sm font-semibold transition ' + (tab === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'agentes' && (
        <div>
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {agentsLoading ? <p className="px-4 py-8 text-center text-sm text-slate-400">Cargando…</p> : (
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.map(a => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium text-slate-800">{a.nombre}{a.id === session.id && <span className="ml-2 text-xs text-slate-400">(tú)</span>}</td>
                      <td className="px-4 py-3">{a.isAdmin ? <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">Admin</span> : <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">Agente</span>}</td>
                      <td className="px-4 py-3 text-right"><button disabled={a.id === session.id} onClick={() => handleDeleteAgent(a)} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30">Eliminar</button></td>
                    </tr>
                  ))}
                  {agents.length === 0 && <tr><td colSpan="3" className="px-4 py-8 text-center text-sm text-slate-400">No hay agentes.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-900">Agregar agente</h3>
            <form onSubmit={handleAddAgent} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Nombre</span>
                  <input type="text" value={agentForm.nombre} onChange={e => setAgentForm(f => ({ ...f, nombre: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="Nombre del agente" /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Contraseña <span className="font-normal text-slate-400">(mín. 6 caracteres)</span></span>
                  <input type="password" value={agentForm.password} onChange={e => setAgentForm(f => ({ ...f, password: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="••••••••" /></label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={agentForm.isAdmin} onChange={e => setAgentForm(f => ({ ...f, isAdmin: e.target.checked }))} className="rounded" /> Rol Admin</label>
              {agentFormError && <p className="text-xs font-semibold text-rose-600">{agentFormError}</p>}
              <button type="submit" disabled={agentSaving || !agentForm.nombre.trim() || agentForm.password.length < 6} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40">{agentSaving ? 'Guardando…' : 'Agregar agente'}</button>
            </form>
          </div>
        </div>
      )}

      {tab === 'promos' && (
        <div>
          <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {campaignsLoading ? <p className="px-4 py-8 text-center text-sm text-slate-400">Cargando…</p> : (
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Plan actual</th>
                  <th className="px-4 py-3">Plan nuevo</th>
                  <th className="px-4 py-3">Precio promo</th>
                  <th className="px-4 py-3">Meses</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map(c => (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                      <td className="px-4 py-3 text-slate-600">{c.planActual}</td>
                      <td className="px-4 py-3 text-slate-600">{c.planNuevo}</td>
                      <td className="px-4 py-3 text-slate-600">{RD(c.precioPromo)}</td>
                      <td className="px-4 py-3 text-slate-600">{c.mesesPromo}</td>
                      <td className="px-4 py-3 text-slate-500">{c.filtroZona || <span className="text-slate-300">Todas</span>}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEdit(c)} aria-label="Editar campaña" title="Editar" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"><Icon.Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDeleteCampaign(c)} aria-label="Eliminar campaña" title="Eliminar" className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-sm text-slate-400">No hay campañas. Crea una nueva.</td></tr>}
                </tbody>
              </table>
            )}
          </div>

          <button onClick={openNew} className="mb-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700">
            <Icon.Plus className="h-4 w-4" /> Nueva campaña
          </button>

          {showForm && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-slate-900">{editingId != null ? 'Editar campaña' : 'Nueva campaña'}</h3>
              <form onSubmit={handleSaveCampaign} className="space-y-3">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Nombre de la campaña</span>
                  <input type="text" value={cForm.nombre} onChange={e => setCForm(f => ({ ...f, nombre: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="Ej: Upsell Conectao' a Doméstico" /></label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Plan actual (cliente tiene)</span>
                    <select value={cForm.planActual} onChange={e => handlePlanActualChange(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                      <option value="">Seleccionar…</option>
                      {PLANES.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre} — {RD(p.precio)}</option>)}
                    </select></label>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Plan nuevo (oferta)</span>
                    <select value={cForm.planNuevo} onChange={e => handlePlanNuevoChange(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500">
                      <option value="">Seleccionar…</option>
                      {PLANES.filter(p => p.nombre !== cForm.planActual).map(p => <option key={p.nombre} value={p.nombre}>{p.nombre} — {RD(p.precio)}</option>)}
                    </select></label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Precio promo (RD$)</span>
                    <input type="number" value={cForm.precioPromo} onChange={e => setCForm(f => ({ ...f, precioPromo: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" placeholder="999" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Meses promo</span>
                    <input type="number" min="1" value={cForm.mesesPromo} onChange={e => setCForm(f => ({ ...f, mesesPromo: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" placeholder="3" /></label>
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Filtro zona (opcional)</span>
                    <input type="text" value={cForm.filtroZona} onChange={e => setCForm(f => ({ ...f, filtroZona: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" placeholder="Vacío = todas" /></label>
                </div>

                {cFormError && <p className="text-xs font-semibold text-rose-600">{cFormError}</p>}
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={cSaving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40">{cSaving ? 'Guardando…' : (editingId != null ? 'Guardar cambios' : 'Crear campaña')}</button>
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { AdminView };
