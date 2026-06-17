import { useEffect, useState } from 'react';
import { PLANES } from '../constants';

    /* ============================================================
       MODAL: AGREGAR CLIENTE
    ============================================================ */
    function ModalAgregar({ open, onClose, onSave, campania }) {
      // When a campaign is active, default the plan to its planActual so the new
      // client lands inside that campaign (membership is derived from plan; see
      // matchesCampania in utils.js). Otherwise fall back to the entry plan.
      const planPorDefecto = campania?.planActual || "Conectao'";
      const [f, setF] = useState({ nombre:'', telefono:'', direccion:'', inicio:'', plan: planPorDefecto });
      useEffect(() => { if (open) setF({ nombre:'', telefono:'', direccion:'', inicio:'', plan: planPorDefecto }); }, [open, planPorDefecto]);
      useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [open, onClose]);
      if (!open) return null;
      const valido = f.nombre.trim() && f.telefono.trim();
      const campo = (k, label, type='text', ph='') => (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
          <input type={type} value={f[k]} placeholder={ph}
            onChange={e => setF({ ...f, [k]: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        </label>
      );
      return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={onClose}>
          <div role="dialog" aria-modal="true" aria-label="Agregar cliente"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-bold text-slate-900">Agregar cliente</h3>
            <div className="space-y-3">
              {campo('nombre','Nombre completo','text','Ej: Ana María Reyes')}
              {campo('telefono','Teléfono','text','809-000-0000')}
              {campo('direccion','Dirección','text','Calle, sector')}
              {campo('inicio','Fecha de inicio del contrato','date')}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Plan actual del cliente</span>
                <select value={f.plan} onChange={e => setF({ ...f, plan: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                  {PLANES.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </label>
            </div>
            {campania && (
              <div className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800 ring-1 ring-brand-100">
                Se agregará a la campaña: <span className="font-semibold">{campania.nombre}</span>
                {campania.filtroZona && (
                  <span className="mt-1 block text-brand-700">
                    Esta campaña filtra por zona “{campania.filtroZona}”. Incluye esa zona en la dirección para que el cliente aparezca en la lista.
                  </span>
                )}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">Cancelar</button>
              <button disabled={!valido} onClick={() => onSave({ ...f, inicio: f.inicio || new Date().toISOString().slice(0,10) })}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-40">
                Agregar
              </button>
            </div>
          </div>
        </div>
      );
    }

export { ModalAgregar };
