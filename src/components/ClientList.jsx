import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { ModalAgregar } from './ModalAgregar';
import { ESTADOS, ORDEN_ESTADOS } from '../constants';
import { Icon } from '../icons';
import { antiguedad, esVencido, fechaCorta, fechaHora, matchesCampania } from '../utils';

    /* ============================================================
       MODAL RECORDATORIO
    ============================================================ */
    function ModalRecordatorio({ target, onSave, onClear, onClose }) {
      const [fecha, setFecha] = useState(target.fecha || '');
      const [nota, setNota] = useState(target.nota || '');
      const today = new Date().toISOString().slice(0, 10);

      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
          <div role="dialog" aria-modal="true" aria-label="Recordatorio"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon.Bell className="h-4 w-4 text-amber-500" />
                <h2 className="font-bold text-slate-800">Recordatorio</h2>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <Icon.X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 truncate text-sm font-semibold text-slate-600">{target.nombre}</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Fecha</label>
                <input type="date" value={fecha} min={today} onChange={e => setFecha(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Nota <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input type="text" value={nota} onChange={e => setNota(e.target.value)}
                  placeholder="Ej: Revertir velocidad a 20/20, arreglar facturación…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => { if (fecha) { onSave(target.id, fecha, nota); onClose(); } }}
                  disabled={!fecha}
                  className="flex-1 rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
                  Guardar
                </button>
                {target.fecha && (
                  <button onClick={() => { onClear(target.id); onClose(); }}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50">
                    Eliminar
                  </button>
                )}
                <button onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    /* ============================================================
       LISTA DE CLIENTES
    ============================================================ */
    const POR_PAGINA = 50;

    function ClientList({ clients, onOpen, onAdd, onTomar, onEliminar, onRevertir, session, campania, onClearRecordatorio, onSetRecordatorio }) {
      const [filtro, setFiltro] = useState('todos');
      const [orden, setOrden] = useState('antiguos'); // antiguos | nuevos
      const [busqueda, setBusqueda] = useState('');
      const [modal, setModal] = useState(false);
      const [pagina, setPagina] = useState(1);
      const [reminderTarget, setReminderTarget] = useState(null); // { id, nombre, fecha, nota }

      // Reset to page 1 when filters or search change
      useEffect(() => { setPagina(1); }, [filtro, busqueda, orden]);

      const openReminder = (e, c) => {
        e.stopPropagation();
        setReminderTarget({ id: c.id, nombre: c.nombre, fecha: c.recordatorio?.fecha || '', nota: c.recordatorio?.nota || '' });
      };

      const clientesFiltradosCampania = useMemo(() =>
        campania ? clients.filter(c => matchesCampania(c, campania)) : clients,
      [clients, campania]);

      const recordatoriosVencidos = useMemo(() =>
        clients.filter(c => c.recordatorio && esVencido(c.recordatorio.fecha))
          .sort((a, b) => a.recordatorio.fecha.localeCompare(b.recordatorio.fecha)),
      [clients]);

      const conteo = useMemo(() => {
        const o = { todos: clientesFiltradosCampania.length };
        ORDEN_ESTADOS.forEach(e => o[e] = 0);
        clientesFiltradosCampania.forEach(c => o[c.estado] = (o[c.estado]||0) + 1);
        return o;
      }, [clientesFiltradosCampania]);

      const visibles = useMemo(() => {
        let r = filtro === 'todos'
          ? clientesFiltradosCampania
          : clientesFiltradosCampania.filter(c => c.estado === filtro);
        if (busqueda.trim()) {
          const q = busqueda.toLowerCase();
          r = r.filter(c => c.nombre.toLowerCase().includes(q) || c.telefono.includes(q));
        }
        return [...r].sort((a, b) =>
          orden === 'antiguos'
            ? new Date(a.inicio) - new Date(b.inicio)
            : new Date(b.inicio) - new Date(a.inicio)
        );
      }, [clientesFiltradosCampania, filtro, busqueda, orden]);

      const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA));
      const paginados = useMemo(() =>
        visibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
        [visibles, pagina]);

      const chips = [['todos','Todos'], ...ORDEN_ESTADOS.map(e => [e, ESTADOS[e].label])];

      return (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <ModalAgregar open={modal} onClose={() => setModal(false)} campania={campania} onSave={(c) => { onAdd(c); setModal(false); }} />

          {reminderTarget && onSetRecordatorio && (
            <ModalRecordatorio
              target={reminderTarget}
              onSave={onSetRecordatorio}
              onClear={onClearRecordatorio}
              onClose={() => setReminderTarget(null)}
            />
          )}

          {recordatoriosVencidos.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
              <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100/60 px-4 py-2.5">
                <Icon.Bell className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-900">Recordatorios pendientes</span>
                <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{recordatoriosVencidos.length}</span>
              </div>
              <div className="divide-y divide-amber-100">
                {recordatoriosVencidos.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-800">{c.nombre}</div>
                      <button
                        onClick={e => openReminder(e, c)}
                        className="mt-0.5 text-left text-xs text-amber-700 hover:underline">
                        <span className="font-semibold">{c.recordatorio.fecha}</span>
                        {c.recordatorio.nota && <span> · {c.recordatorio.nota}</span>}
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button onClick={() => onOpen(c.id)}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                        Llamar
                      </button>
                      {onClearRecordatorio && (
                        <button onClick={() => onClearRecordatorio(c.id)} title="Limpiar recordatorio" aria-label="Limpiar recordatorio"
                          className="rounded-lg border border-amber-200 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controles */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {chips.map(([id, label]) => (
                <button key={id} onClick={() => setFiltro(id)}
                  className={'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ' +
                    (filtro === id ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}>
                  {label}<span className={'rounded-full px-1.5 ' + (filtro === id ? 'bg-white/20' : 'bg-slate-100')}>{conteo[id]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Icon.Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar nombre o teléfono…"
                  className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-56" />
              </div>
              <button onClick={() => setOrden(o => o === 'antiguos' ? 'nuevos' : 'antiguos')}
                title="Ordenar por antigüedad"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <Icon.Sort className="h-4 w-4" />{orden === 'antiguos' ? 'Más antiguos' : 'Más nuevos'}
              </button>
              <button onClick={() => setModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <Icon.Plus className="h-4 w-4" /><span className="hidden sm:inline">Agregar</span>
              </button>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="no-scrollbar overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Teléfono</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Dirección</th>
                    <th className="px-4 py-3 whitespace-nowrap">Cliente desde</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Agente</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginados.map(c => (
                    <tr key={c.id} className="group cursor-pointer transition hover:bg-brand-50/40" onClick={() => onOpen(c.id)}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{c.nombre}</div>
                        {c.notas && <div className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{c.notas}</div>}
                        {c.recordatorio && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            🔔 {c.recordatorio.fecha}
                            {c.recordatorio.nota && <span className="font-normal text-amber-500"> · {c.recordatorio.nota}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600">{c.telefono}</td>
                      <td className="hidden max-w-xs px-4 py-3 text-slate-500 lg:table-cell"><div className="truncate">{c.direccion}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-700">{fechaCorta(c.inicio)}</div>
                        <div className="text-xs text-slate-400">{antiguedad(c.inicio)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge estado={c.estado} />
                        {c.estado === 'callback' && c.callbackAt && (
                          <div className="mt-1 text-[11px] font-medium text-amber-600">↻ {fechaHora(c.callbackAt)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        {c.agentId === session.id ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">Tú</span>
                        ) : c.agentId ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-600">{c.agentNombre}</span>
                            <button onClick={() => onTomar(c.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                              Tomar
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => onTomar(c.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                            Tomar
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5 opacity-0 transition group-hover:opacity-100">
                          {onSetRecordatorio && (
                            <button onClick={e => openReminder(e, c)}
                              title={c.recordatorio ? 'Editar recordatorio' : 'Agregar recordatorio'}
                              aria-label={c.recordatorio ? 'Editar recordatorio' : 'Agregar recordatorio'}
                              className={'rounded-lg border px-2 py-1 text-xs font-semibold transition ' +
                                (c.recordatorio
                                  ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100'
                                  : 'border-slate-200 text-slate-400 hover:bg-slate-50')}>
                              🔔
                            </button>
                          )}
                          {c.estado !== 'pendiente' && (
                            <button onClick={() => onRevertir(c.id)} title="Revertir a pendiente" aria-label="Revertir a pendiente"
                              className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50">
                              ↺
                            </button>
                          )}
                          {session.isAdmin && (
                            <button onClick={() => onEliminar(c.id, c.nombre)} title="Eliminar cliente" aria-label="Eliminar cliente"
                              className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50">
                              ✕
                            </button>
                          )}
                          <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                            onClick={() => onOpen(c.id)}>
                            <Icon.Phone className="h-3.5 w-3.5" /> Llamar
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paginados.length === 0 && (
                    <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-400">No hay clientes que coincidan con el filtro.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {visibles.length > POR_PAGINA
                ? `Mostrando ${(pagina-1)*POR_PAGINA+1}–${Math.min(pagina*POR_PAGINA, visibles.length)} de ${visibles.length}`
                : `Mostrando ${visibles.length}`} clientes
              {campania ? ` · ${campania.nombre}` : ` (${clients.length} total)`}
            </p>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{pagina} / {totalPaginas}</span>
                <div className="flex gap-1">
                  <button disabled={pagina === 1} onClick={() => setPagina(p => p-1)}
                    aria-label="Página anterior"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                    ← Ant.
                  </button>
                  <button disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p+1)}
                    aria-label="Página siguiente"
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                    Sig. →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

export { POR_PAGINA, ClientList };
