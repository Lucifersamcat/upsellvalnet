import { RD } from '../constants';
import { Icon } from '../icons';

    /* ============================================================
       HEADER
    ============================================================ */
    function Header({ stats, vista, setVista, onExport, onReset, onImport, session, onLogout, onAdmin, campaigns, campania, onSelectCampania, recordatoriosCount }) {
      return (
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-sky-400 text-white shadow-sm">
                <Icon.Signal className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="text-[15px] font-extrabold tracking-tight text-slate-900">ValNet Wireless</div>
                <div className="text-xs font-medium text-slate-500">
                  {campania ? campania.nombre : 'Sin campaña activa'}
                </div>
              </div>
            </div>

            <nav className="order-3 flex w-full gap-1 rounded-xl bg-slate-100 p-1 sm:order-2 sm:ml-4 sm:w-auto">
              {[['lista','Clientes', Icon.Users], ['dashboard','Dashboard', Icon.Chart]].map(([id, label, I]) => (
                <button key={id} onClick={() => setVista(id)}
                  className={'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition sm:flex-none ' +
                    (vista === id ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                  <I className="h-4 w-4" />{label}
                </button>
              ))}
            </nav>

            <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
              <select
                value={campania ? campania.id : ''}
                onChange={e => onSelectCampania(e.target.value ? Number(e.target.value) : null)}
                aria-label="Seleccionar campaña"
                className="max-w-[10rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500">
                <option value="">Sin campaña</option>
                {(campaigns || []).map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              {recordatoriosCount > 0 && (
                <div className="relative flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-600">
                  <Icon.Bell className="h-4 w-4" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
                    {recordatoriosCount}
                  </span>
                </div>
              )}
              <span className="hidden text-xs font-semibold text-slate-500 sm:inline">Hola, {session.nombre}</span>
              {session.isAdmin && (
                <button onClick={onAdmin}
                  className={'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ' +
                    (vista === 'admin' ? 'bg-brand-100 text-brand-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                  Admin
                </button>
              )}
              <button onClick={onLogout}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">
                Salir
              </button>
              <div className="hidden items-center gap-4 rounded-xl bg-slate-50 px-4 py-1.5 ring-1 ring-slate-200 md:flex">
                <div className="text-center">
                  <div className="text-base font-bold leading-none text-emerald-600">{stats.convertidos}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Convertidos</div>
                </div>
                <div className="h-7 w-px bg-slate-200"></div>
                <div className="text-center">
                  <div className="text-base font-bold leading-none text-brand-700">{RD(stats.ingreso)}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Extra/mes</div>
                </div>
              </div>
              {onImport && (
                <button onClick={onImport}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                  <Icon.Upload className="h-3.5 w-3.5" /> Importar CSV
                </button>
              )}
              <button onClick={onExport}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
                <Icon.Download className="h-4 w-4" /><span className="hidden sm:inline">Exportar CSV</span>
              </button>
              {/* Divider isolates the destructive reset from the safe export/import actions */}
              <div className="mx-1 h-7 w-px bg-slate-200" aria-hidden="true"></div>
              <button onClick={onReset} title="Reiniciar campaña" aria-label="Reiniciar campaña"
                className="rounded-xl border border-slate-200 px-2.5 py-2 text-slate-400 transition hover:border-rose-200 hover:text-rose-600">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            </div>
          </div>
        </header>
      );
    }

export { Header };
