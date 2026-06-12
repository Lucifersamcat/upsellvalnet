import { useMemo } from 'react';
import { Badge } from './Badge';
import { ESTADOS, NOW, ORDEN_ESTADOS, RD } from '../constants';
import { Icon } from '../icons';
import { fechaCorta, fechaHora } from '../utils';

    /* ============================================================
       DASHBOARD
    ============================================================ */
    function StatCard({ icon: I, label, value, sub, tone }) {
      const tones = {
        brand: 'from-brand-500 to-sky-400', emerald: 'from-emerald-500 to-teal-400',
        amber: 'from-amber-500 to-orange-400', slate: 'from-slate-600 to-slate-400',
      };
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{label}</span>
            <span className={'grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white ' + tones[tone]}>
              <I className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div>
          {sub && <div className="mt-1 text-xs font-medium text-slate-400">{sub}</div>}
        </div>
      );
    }

    function Dashboard({ clients, log, stats, campania }) {
      const conteo = useMemo(() => {
        const o = {}; ORDEN_ESTADOS.forEach(e => o[e] = 0);
        clients.forEach(c => o[c.estado] = (o[c.estado]||0) + 1);
        return o;
      }, [clients]);

      const trabajados = clients.length - conteo.pendiente;
      const progreso = clients.length ? Math.round(trabajados / clients.length * 100) : 0;

      return (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Resumen de la campaña</h2>
          <p className="mb-5 text-sm text-slate-500">
            {campania
              ? `${campania.nombre} · primeros ${campania.mesesPromo} meses a ${RD(campania.precioPromo)}, luego ${RD(campania.precioNuevo)}.`
              : 'Sin campaña activa — selecciona una desde el encabezado.'}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Icon.Users} label="Clientes en lista" value={clients.length}
              sub={campania ? `Plan ${campania.planActual} · ${RD(campania.precioActual)}` : 'Todos los planes'}
              tone="brand" />
            <StatCard icon={Icon.Phone} label="Llamadas hoy" value={stats.llamadasHoy} sub={fechaCorta(NOW())} tone="slate" />
            <StatCard icon={Icon.Check} label="Convertidos" value={stats.convertidos} sub={stats.tasa + '% de conversión'} tone="emerald" />
            <StatCard icon={Icon.Clock} label="Callbacks pendientes" value={conteo.callback} sub="Por volver a llamar" tone="amber" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Ingreso proyectado */}
            <div className="rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 p-6 text-white shadow-sm lg:col-span-1">
              <div className="flex items-center gap-2 text-sm font-medium text-brand-100">
                <Icon.Money className="h-4 w-4" /> Ingreso adicional proyectado
              </div>
              <div className="mt-3 text-4xl font-extrabold tracking-tight">{RD(stats.ingreso)}<span className="text-lg font-semibold text-brand-100">/mes</span></div>
              <div className="mt-2 text-sm text-brand-100">
                {campania
                  ? `${stats.convertidos} convertidos × ${RD(campania.precioNuevo - campania.precioActual)} (mes ${campania.mesesPromo + 1} en adelante)`
                  : `${stats.convertidos} convertidos`}
              </div>
              <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs text-brand-50">
                Proyección anualizada: <strong>{RD(stats.ingreso * 12)}</strong> en ingresos recurrentes.
              </div>
            </div>

            {/* Progreso + desglose */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Avance de la lista</h3>
                <span className="text-sm font-semibold text-slate-500">{trabajados}/{clients.length} gestionados · {progreso}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-sky-400 transition-all" style={{ width: progreso + '%' }}></div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {ORDEN_ESTADOS.map(e => (
                  <div key={e} className="rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                    <div className="text-2xl font-extrabold text-slate-900">{conteo[e]}</div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500">
                      <span className={'h-1.5 w-1.5 rounded-full ' + ESTADOS[e].dot}></span>{ESTADOS[e].label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Registro reciente */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Actividad reciente</h3>
            {log.length === 0 ? (
              <p className="text-sm text-slate-400">Aún no hay llamadas registradas.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {log.slice(0, 8).map((l, i) => (
                  <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <Badge estado={l.resultado} />
                      <span className="font-medium text-slate-700">{l.nombre}</span>
                    </div>
                    <span className="text-xs text-slate-400">{fechaHora(l.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      );
    }

export { StatCard, Dashboard };
