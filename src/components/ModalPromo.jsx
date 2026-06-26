import { useEffect, useState } from 'react';
import { PLANES, RD, planInfo } from '../constants';
import { Icon } from '../icons';

    /* ============================================================
       MODAL: APLICAR / EDITAR PROMO TEMPORAL
       Una promo temporal cambia al cliente a un plan/precio promocional
       hasta `fin`. Al vencer, la sección de Alarmas avisa que hay que
       regresarlo a su `planOriginal`.
    ============================================================ */
    function ModalPromo({ target, onSave, onClear, onClose }) {
      const today = new Date().toISOString().slice(0, 10);
      const planOriginal = target.planOriginal || "Conectao'";
      const [planPromo, setPlanPromo] = useState(target.planPromo || planOriginal);
      const [precioPromo, setPrecioPromo] = useState(
        target.precioPromo != null ? String(target.precioPromo) : ''
      );
      const [fin, setFin] = useState(target.fin || '');
      const [nota, setNota] = useState(target.nota || '');

      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [onClose]);

      const handlePlanChange = (nombre) => {
        setPlanPromo(nombre);
        const p = planInfo(nombre);
        if (p) setPrecioPromo(String(p.precio));
      };

      const guardar = () => {
        if (!fin) return;
        onSave(target.id, {
          planOriginal,
          planPromo,
          precioPromo: Number(precioPromo) || 0,
          inicio: target.inicio || today,
          fin,
          nota: nota.trim(),
        });
        onClose();
      };

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
          <div role="dialog" aria-modal="true" aria-label="Promo temporal"
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon.Percent className="h-4 w-4 text-violet-500" />
                <h2 className="font-bold text-slate-800">Promo temporal</h2>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <Icon.X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-1 truncate text-sm font-semibold text-slate-600">{target.nombre}</p>
            <p className="mb-4 text-xs text-slate-400">
              Plan original: <span className="font-semibold text-slate-600">{planOriginal}</span>
              <span className="block">Al vencer, la alarma recordará regresarlo a este plan.</span>
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Plan de la promo</label>
                <select value={planPromo} onChange={e => handlePlanChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                  {PLANES.map(p => <option key={p.nombre} value={p.nombre}>{p.nombre} — {RD(p.precio)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Precio promo <span className="font-normal text-slate-400">(RD$/mes)</span>
                </label>
                <input type="number" min="0" value={precioPromo} onChange={e => setPrecioPromo(e.target.value)}
                  placeholder="999"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Vence el</label>
                <input type="date" value={fin} min={today} onChange={e => setFin(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Nota <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <input type="text" value={nota} onChange={e => setNota(e.target.value)}
                  placeholder="Ej: cortesía por reclamo, retención…"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button onClick={guardar} disabled={!fin}
                  className="flex-1 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40">
                  Guardar promo
                </button>
                {target.fin && onClear && (
                  <button onClick={() => { onClear(target.id); onClose(); }}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50">
                    Quitar
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

export { ModalPromo };
