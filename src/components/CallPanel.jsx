import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from './Badge';
import { RD } from '../constants';
import { OBJECIONES, makeGuion } from '../guion';
import { Icon } from '../icons';
import { antiguedad, fechaCorta, fechaMasNMeses, telLink } from '../utils';

    /* ============================================================
       PANEL DE LLAMADA ACTIVA
    ============================================================ */
    function ObjecionItem({ obj, abierto, onToggle }) {
      return (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <button onClick={onToggle}
            className={'flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left text-sm font-semibold transition ' +
              (abierto ? 'bg-amber-50 text-amber-900' : 'bg-white text-slate-700 hover:bg-slate-50')}>
            <span>{obj.q}</span>
            <Icon.ChevronDown className={'h-4 w-4 flex-shrink-0 transition ' + (abierto ? 'rotate-180' : '')} />
          </button>
          {abierto && (
            <div className="border-t border-amber-100 bg-amber-50/50 px-3.5 py-3 text-sm text-slate-700">
              <span className="font-semibold text-amber-700">Respuesta: </span>{obj.a}
            </div>
          )}
        </div>
      );
    }

    function CallPanel({ cliente, onResult, onNota, onBack, hayNext, campania, onSetRecordatorio }) {
      const [paso, setPaso] = useState(0);
      const [nota, setNota] = useState(cliente.notas || '');
      const [objAbierta, setObjAbierta] = useState(null);
      const [showCallback, setShowCallback] = useState(false);
      const [callbackVal, setCallbackVal] = useState(() => {
        const d = new Date(); d.setDate(d.getDate()+1); d.setHours(15,0,0,0);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0,16);
      });
      const [showReminderSuggest, setShowReminderSuggest] = useState(false);
      const [reminderFecha, setReminderFecha] = useState('');
      const [reminderNota, setReminderNota] = useState('');
      const notaRef = useRef(null);

      const guion = useMemo(() => makeGuion(campania), [campania]);

      // Reset al cambiar de cliente
      useEffect(() => {
        setPaso(0); setNota(cliente.notas || ''); setObjAbierta(null); setShowCallback(false);
        setShowReminderSuggest(false);
      }, [cliente.id]);

      const guardarNota = useCallback(() => {
        if (nota !== cliente.notas) onNota(cliente.id, nota);
      }, [nota, cliente, onNota]);

      const registrar = (resultado, callbackAt) => {
        if (nota !== cliente.notas) onNota(cliente.id, nota);
        onResult(cliente.id, resultado, callbackAt);
        if (resultado === 'convertido' && campania && campania.mesesPromo > 0 && onSetRecordatorio) {
          setReminderFecha(fechaMasNMeses(campania.mesesPromo));
          setReminderNota(`Verificar si mantiene plan ${campania.planNuevo}`);
          setShowReminderSuggest(true);
        }
      };

      // Atajos de teclado
      useEffect(() => {
        const h = (e) => {
          if (document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) return;
          const k = e.key.toLowerCase();
          if (k === 'escape') { onBack(); }
          else if (k === 'c') { registrar('convertido'); }
          else if (k === 'n') { registrar('no_interesado'); }
          else if (k === 'x') { registrar('llamado'); }
          else if (k === 'b') { setShowCallback(s => !s); }
          else if (k === 'arrowright') { setPaso(p => Math.min(guion.length-1, p+1)); }
          else if (k === 'arrowleft') { setPaso(p => Math.max(0, p-1)); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
      });

      const g = guion[paso];

      return (
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          {/* Barra superior */}
          <div className="mb-4 flex items-center justify-between">
            <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow">
              <Icon.Arrow className="h-4 w-4" /> Volver a la lista
            </button>
            <span className="hidden text-xs text-slate-400 sm:block">Atajos: <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">C</kbd> convertir · <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">N</kbd> no · <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">B</kbd> callback · <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">X</kbd> no contestó</span>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Columna izquierda: datos del cliente + notas */}
            <div className="space-y-4 lg:col-span-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold leading-tight text-slate-900">{cliente.nombre}</h2>
                    <div className="mt-0.5"><Badge estado={cliente.estado} /></div>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon.Users className="h-5 w-5" />
                  </div>
                </div>

                <a href={telLink(cliente.telefono)}
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-lg font-bold text-white transition hover:bg-slate-800">
                  <Icon.Phone className="h-5 w-5" /> {cliente.telefono}
                </a>

                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex gap-2.5">
                    <Icon.Pin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                    <dd className="text-slate-600">{cliente.direccion}</dd>
                  </div>
                  <div className="flex gap-2.5">
                    <Icon.Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                    <dd className="text-slate-600">Cliente desde <strong className="text-slate-800">{fechaCorta(cliente.inicio)}</strong> · {antiguedad(cliente.inicio)}</dd>
                  </div>
                </dl>

                {campania ? (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs ring-1 ring-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Plan actual</span>
                      <span className="font-semibold text-slate-700">{campania.planActual} · {RD(campania.precioActual)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-slate-500">Oferta</span>
                      <span className="font-semibold text-brand-700">{campania.planNuevo} · {RD(campania.precioPromo)} × {campania.mesesPromo}m</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs ring-1 ring-amber-100">
                    <span className="font-semibold text-amber-700">Sin campaña activa</span>
                    <span className="text-amber-600"> — selecciona una en el encabezado.</span>
                  </div>
                )}
              </div>

              {/* Notas */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <label className="mb-2 block text-sm font-bold text-slate-900">Notas de la llamada</label>
                <textarea ref={notaRef} value={nota} onChange={e => setNota(e.target.value)} onBlur={guardarNota}
                  rows="4" placeholder="Anota detalles, dudas, mejor horario para volver a llamar…"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
              </div>
            </div>

            {/* Columna derecha: guión + objeciones */}
            <div className="space-y-4 lg:col-span-8">
              {/* Guión */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Guión de llamada</h3>
                  <span className="text-xs font-semibold text-slate-400">Paso {paso+1} de {guion.length}</span>
                </div>

                {/* Stepper */}
                <div className="mb-4 flex gap-2">
                  {guion.map((s, i) => (
                    <button key={s.paso} onClick={() => setPaso(i)}
                      className={'flex flex-1 flex-col items-start rounded-xl border px-3 py-2 text-left transition ' +
                        (i === paso ? 'border-brand-600 bg-brand-50' : i < paso ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
                      <span className={'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ' +
                        (i === paso ? 'bg-brand-600 text-white' : i < paso ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500')}>
                        {i < paso ? '✓' : s.paso}
                      </span>
                      <span className={'mt-1.5 text-xs font-semibold ' + (i === paso ? 'text-brand-700' : 'text-slate-500')}>{s.titulo}</span>
                    </button>
                  ))}
                </div>

                {/* Texto del paso actual */}
                <div className="rounded-xl bg-gradient-to-br from-slate-50 to-brand-50/40 p-5 ring-1 ring-slate-100">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-brand-600">Paso {g.paso} · {g.titulo}</div>
                  <p className="mt-2 text-lg font-medium leading-relaxed text-slate-800">“{g.texto}”</p>
                  {g.nota && <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">⚠ {g.nota}</p>}
                </div>

                <div className="mt-4 flex justify-between">
                  <button onClick={() => setPaso(p => Math.max(0, p-1))} disabled={paso === 0}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-30">← Anterior</button>
                  <button onClick={() => setPaso(p => Math.min(guion.length-1, p+1))} disabled={paso === guion.length-1}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-30">Siguiente →</button>
                </div>
              </div>

              {/* Objeciones */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-slate-900">Manejo de objeciones</h3>
                <div className="space-y-2">
                  {OBJECIONES.map((o, i) => (
                    <ObjecionItem key={i} obj={o} abierto={objAbierta === i} onToggle={() => setObjAbierta(a => a === i ? null : i)} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Programar callback (inline) */}
          {showCallback && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <Icon.Clock className="h-4 w-4" /> ¿Cuándo volver a llamar?
                </div>
                <div className="flex items-center gap-2">
                  <input type="datetime-local" value={callbackVal} onChange={e => setCallbackVal(e.target.value)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-200" />
                  <button onClick={() => registrar('callback', new Date(callbackVal).toISOString())}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600">Confirmar callback</button>
                  <button onClick={() => setShowCallback(false)} aria-label="Cancelar callback" className="rounded-lg px-2 py-2 text-amber-700 hover:bg-amber-100"><Icon.X className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          )}

          {showReminderSuggest && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Icon.Bell className="h-4 w-4" /> ¿Agregar recordatorio de seguimiento?
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input type="date" value={reminderFecha} onChange={e => setReminderFecha(e.target.value)}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200" />
                <input type="text" value={reminderNota} onChange={e => setReminderNota(e.target.value)}
                  className="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Nota del recordatorio" />
                <div className="flex gap-2">
                  <button
                    onClick={() => { onSetRecordatorio(cliente.id, reminderFecha, reminderNota); setShowReminderSuggest(false); }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                    Guardar
                  </button>
                  <button onClick={() => setShowReminderSuggest(false)}
                    className="rounded-lg px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100">
                    Saltar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Barra de resultados (sticky) */}
          <div className="sticky bottom-0 z-20 mt-4 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:mr-2">Registrar resultado:</span>
              <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                <button onClick={() => registrar('convertido')}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-emerald-700">
                  <Icon.Check className="h-5 w-5" /> Convertido
                </button>
                <button onClick={() => setShowCallback(s => !s)}
                  className={'flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold shadow-sm transition ' +
                    (showCallback ? 'bg-amber-600 text-white' : 'bg-amber-500 text-white hover:bg-amber-600')}>
                  <Icon.Clock className="h-5 w-5" /> Callback
                </button>
                <button onClick={() => registrar('no_interesado')}
                  className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-rose-700">
                  <Icon.X className="h-5 w-5" /> No interesado
                </button>
                <button onClick={() => registrar('llamado')}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-600 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-slate-700">
                  <Icon.PhoneOff className="h-5 w-5" /> No contestó
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

export { ObjecionItem, CallPanel };
