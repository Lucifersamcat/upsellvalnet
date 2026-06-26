import { useMemo, useState } from 'react';
import { ModalPromo } from './ModalPromo';
import { RD } from '../constants';
import { Icon } from '../icons';
import { diasHasta, esVencido, fechaCorta, fechaHora } from '../utils';

    /* ============================================================
       SECCIÓN: ALARMAS
       Agrupa los clientes que requieren atención:
       1. Promos vencidas  → regresar al plan original
       2. Promos por vencer (próximos 7 días)
       3. Recordatorios vencidos
       4. Callbacks vencidos
    ============================================================ */

    // Texto relativo a partir de los días que faltan para una fecha.
    function textoDias(fechaStr) {
      const d = diasHasta(fechaStr);
      if (d == null) return '';
      if (d === 0) return 'hoy';
      if (d === 1) return 'mañana';
      if (d > 1) return `en ${d} días`;
      if (d === -1) return 'hace 1 día';
      return `hace ${Math.abs(d)} días`;
    }

    // Clases explícitas por tono (no concatenadas dinámicamente) para que
    // Tailwind las detecte y genere en el build.
    const TONOS = {
      rose:   { card: 'border-rose-200 bg-rose-50',     head: 'border-rose-200 bg-rose-100/60',     title: 'text-rose-900',   badge: 'bg-rose-500',   icon: 'text-rose-600',   divide: 'divide-rose-100' },
      violet: { card: 'border-violet-200 bg-violet-50', head: 'border-violet-200 bg-violet-100/60', title: 'text-violet-900', badge: 'bg-violet-500', icon: 'text-violet-600', divide: 'divide-violet-100' },
      amber:  { card: 'border-amber-200 bg-amber-50',   head: 'border-amber-200 bg-amber-100/60',   title: 'text-amber-900',  badge: 'bg-amber-500',  icon: 'text-amber-600',  divide: 'divide-amber-100' },
      sky:    { card: 'border-sky-200 bg-sky-50',       head: 'border-sky-200 bg-sky-100/60',       title: 'text-sky-900',    badge: 'bg-sky-500',    icon: 'text-sky-600',    divide: 'divide-sky-100' },
    };

    function Seccion({ icon: I, titulo, tono, count, children }) {
      const t = TONOS[tono];
      return (
        <div className={'overflow-hidden rounded-2xl border shadow-sm ' + t.card}>
          <div className={'flex items-center gap-2 border-b px-4 py-2.5 ' + t.head}>
            <I className={'h-4 w-4 ' + t.icon} />
            <span className={'text-sm font-bold ' + t.title}>{titulo}</span>
            <span className={'ml-1 rounded-full px-2 py-0.5 text-xs font-bold text-white ' + t.badge}>{count}</span>
          </div>
          <div className={'divide-y bg-white/40 ' + t.divide}>{children}</div>
        </div>
      );
    }

    function AlarmasView({ clients, onOpen, onRegresarPlan, onClearPromo, onSetPromo, onClearRecordatorio }) {
      const [promoTarget, setPromoTarget] = useState(null);

      const promosVencidas = useMemo(() =>
        clients.filter(c => c.promo && esVencido(c.promo.fin))
          .sort((a, b) => a.promo.fin.localeCompare(b.promo.fin)),
      [clients]);

      const promosPorVencer = useMemo(() =>
        clients.filter(c => c.promo && !esVencido(c.promo.fin) && diasHasta(c.promo.fin) <= 7)
          .sort((a, b) => a.promo.fin.localeCompare(b.promo.fin)),
      [clients]);

      const recordatoriosVencidos = useMemo(() =>
        clients.filter(c => c.recordatorio && esVencido(c.recordatorio.fecha))
          .sort((a, b) => a.recordatorio.fecha.localeCompare(b.recordatorio.fecha)),
      [clients]);

      const callbacksVencidos = useMemo(() => {
        const ahora = Date.now();
        return clients.filter(c => c.estado === 'callback' && c.callbackAt && new Date(c.callbackAt).getTime() <= ahora)
          .sort((a, b) => new Date(a.callbackAt) - new Date(b.callbackAt));
      }, [clients]);

      const total = promosVencidas.length + promosPorVencer.length + recordatoriosVencidos.length + callbacksVencidos.length;

      const editarPromo = (c) => setPromoTarget({
        id: c.id, nombre: c.nombre,
        planOriginal: c.promo.planOriginal,
        planPromo: c.promo.planPromo,
        precioPromo: c.promo.precioPromo,
        inicio: c.promo.inicio,
        fin: c.promo.fin,
        nota: c.promo.nota,
      });

      return (
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          {promoTarget && (
            <ModalPromo target={promoTarget} onSave={onSetPromo} onClear={onClearPromo}
              onClose={() => setPromoTarget(null)} />
          )}

          <div className="mb-5 flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <Icon.Alarm className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight text-slate-900">Alarmas</h1>
              <p className="text-xs text-slate-500">Clientes que requieren atención</p>
            </div>
          </div>

          {total === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-12 text-center">
              <Icon.Check className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
              <p className="text-sm font-semibold text-emerald-800">Todo al día</p>
              <p className="text-xs text-emerald-600">No hay alarmas pendientes en este momento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {promosVencidas.length > 0 && (
                <Seccion icon={Icon.Percent} titulo="Promos vencidas — regresar al plan original" tono="rose" count={promosVencidas.length}>
                  {promosVencidas.map(c => (
                    <div key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">{c.nombre}</div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          Regresar del plan <span className="font-semibold">{c.promo.planPromo}</span> a su plan original{' '}
                          <span className="font-semibold text-rose-700">{c.promo.planOriginal}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold text-rose-600">
                          Promo venció {textoDias(c.promo.fin)} · {fechaCorta(c.promo.fin)}
                          {c.promo.nota && <span className="font-normal text-rose-500"> · {c.promo.nota}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <button onClick={() => onRegresarPlan(c.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">
                          <Icon.Undo className="h-3.5 w-3.5" /> Regresar a {c.promo.planOriginal}
                        </button>
                        <button onClick={() => editarPromo(c)} title="Editar / posponer promo"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          Posponer
                        </button>
                        <button onClick={() => onOpen(c.id)}
                          className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                          Llamar
                        </button>
                      </div>
                    </div>
                  ))}
                </Seccion>
              )}

              {promosPorVencer.length > 0 && (
                <Seccion icon={Icon.Clock} titulo="Promos por vencer (próximos 7 días)" tono="violet" count={promosPorVencer.length}>
                  {promosPorVencer.map(c => (
                    <div key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">{c.nombre}</div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          Promo <span className="font-semibold">{c.promo.planPromo}</span>
                          {c.promo.precioPromo ? <span> · {RD(c.promo.precioPromo)}</span> : null}
                          {' '}→ regresará a <span className="font-semibold">{c.promo.planOriginal}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold text-violet-600">
                          Vence {textoDias(c.promo.fin)} · {fechaCorta(c.promo.fin)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <button onClick={() => editarPromo(c)} title="Editar promo"
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          Editar
                        </button>
                        <button onClick={() => onOpen(c.id)}
                          className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                          Llamar
                        </button>
                      </div>
                    </div>
                  ))}
                </Seccion>
              )}

              {recordatoriosVencidos.length > 0 && (
                <Seccion icon={Icon.Bell} titulo="Recordatorios vencidos" tono="amber" count={recordatoriosVencidos.length}>
                  {recordatoriosVencidos.map(c => (
                    <div key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">{c.nombre}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-amber-600">
                          {fechaCorta(c.recordatorio.fecha)} · {textoDias(c.recordatorio.fecha)}
                          {c.recordatorio.nota && <span className="font-normal text-amber-500"> · {c.recordatorio.nota}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <button onClick={() => onOpen(c.id)}
                          className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                          Llamar
                        </button>
                        {onClearRecordatorio && (
                          <button onClick={() => onClearRecordatorio(c.id)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            Listo
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </Seccion>
              )}

              {callbacksVencidos.length > 0 && (
                <Seccion icon={Icon.Clock} titulo="Callbacks vencidos" tono="sky" count={callbacksVencidos.length}>
                  {callbacksVencidos.map(c => (
                    <div key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-slate-800">{c.nombre}</div>
                        <div className="mt-0.5 text-[11px] font-semibold text-sky-600">
                          Programado para {fechaHora(c.callbackAt)} · {textoDias(c.callbackAt.slice(0, 10))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => onOpen(c.id)}
                          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                          Llamar
                        </button>
                      </div>
                    </div>
                  ))}
                </Seccion>
              )}
            </div>
          )}
        </div>
      );
    }

export { AlarmasView };
