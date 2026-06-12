import { useEffect, useState } from 'react';

    /* ============================================================
       MODAL: AGREGAR CLIENTE
    ============================================================ */
    function ModalAgregar({ open, onClose, onSave }) {
      const [f, setF] = useState({ nombre:'', telefono:'', direccion:'', inicio:'' });
      useEffect(() => { if (open) setF({ nombre:'', telefono:'', direccion:'', inicio:'' }); }, [open]);
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
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-bold text-slate-900">Agregar cliente</h3>
            <div className="space-y-3">
              {campo('nombre','Nombre completo','text','Ej: Ana María Reyes')}
              {campo('telefono','Teléfono','text','809-000-0000')}
              {campo('direccion','Dirección','text','Calle, sector')}
              {campo('inicio','Fecha de inicio del contrato','date')}
            </div>
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
