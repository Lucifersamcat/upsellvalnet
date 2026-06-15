import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AdminView } from './components/AdminView';
import { CallPanel } from './components/CallPanel';
import { ClientList } from './components/ClientList';
import { Dashboard } from './components/Dashboard';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { Toast } from './components/Toast';
import { ESTADOS, PLANES } from './constants';
import { init, reducer } from './reducer';
import { SESSION_KEY, loadSession, setCampaniaSession, touchSession } from './session';
import { antiguedad, esHoy, esVencido, fechaCorta, fechaHora } from './utils';

    /* ============================================================
       APP PRINCIPAL
    ============================================================ */
    function App() {
      const [state, dispatch] = useReducer(reducer, undefined, init);
      const [vista, setVista] = useState('lista');     // lista | dashboard | llamada
      const [activeId, setActiveId] = useState(null);
      const [toast, setToast] = useState(null);
      const toastTimer = useRef(null);
      const showToastRef = useRef(null);
      const logoutRef = useRef(null);

      const [session, setSession] = useState(() => loadSession());
      const sessionRef = useRef(session);
      sessionRef.current = session;
      const [campaigns, setCampaigns] = useState([]);
      const [campaniaId, setCampaniaId] = useState(() => loadSession()?.campaniaId ?? null);
      const [dataReady, setDataReady] = useState(false);
      const setDataReadyRef = useRef(setDataReady);
      setDataReadyRef.current = setDataReady;

      const campania = campaigns.find(c => c.id === campaniaId) || null;

      // Renew session activity on any user interaction
      useEffect(() => {
        const handler = () => touchSession();
        document.addEventListener('click', handler);
        document.addEventListener('keydown', handler);
        return () => {
          document.removeEventListener('click', handler);
          document.removeEventListener('keydown', handler);
        };
      }, []);

      const handleLogin = (s) => setSession(s);

      const handleLogout = async () => {
        const token = sessionRef.current?.token;
        if (token) {
          try { await fetch('/api/logout', { method: 'POST', headers: { 'X-Auth-Token': token } }); } catch {}
        }
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
      };

      const etagRef = useRef(null);
      const isLoadingRef = useRef(false);
      const hasLoadedRef = useRef(false);
      const postInFlightRef = useRef(false);
      const replaceLogRef = useRef(false);
      const vistaRef = useRef(vista);
      vistaRef.current = vista;

      const fetchState = useCallback(async () => {
        const token = sessionRef.current?.token;
        try {
          const headers = { 'X-Auth-Token': token || '', ...(etagRef.current ? { 'If-None-Match': etagRef.current } : {}) };
          const res = await fetch('/api/state', { headers });
          if (res.status === 304) { setDataReadyRef.current(true); return; }
          if (res.status === 401) { logoutRef.current?.(); return; }
          if (!res.ok) {
            showToastRef.current?.('Error al cargar datos del servidor', 'err');
            setDataReadyRef.current(true);
            return;
          }
          const data = await res.json();
          etagRef.current = res.headers.get('ETag');
          isLoadingRef.current = true;
          hasLoadedRef.current = true;
          dispatch({ type: 'LOAD', payload: data });
          setDataReadyRef.current(true);
        } catch {
          showToastRef.current?.('Sin conexión al servidor', 'err');
          setDataReadyRef.current(true);
        }
      }, []);

      const postState = useCallback(async (s) => {
        const token = sessionRef.current?.token;
        const replaceLog = replaceLogRef.current;
        replaceLogRef.current = false;
        postInFlightRef.current = true;
        try {
          const res = await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Auth-Token': token || '' },
            body: JSON.stringify({ clients: s.clients, log: s.log, deletedIds: s.deletedIds || [], replaceLog }),
          });
          if (res.status === 401) { logoutRef.current?.(); return; }
          if (res.ok) {
            const { version } = await res.json();
            etagRef.current = `"v${version}"`;
          } else {
            showToastRef.current?.('Error al guardar cambios', 'err');
          }
        } catch {
          showToastRef.current?.('Sin conexión — cambios no guardados', 'err');
        } finally {
          postInFlightRef.current = false;
        }
      }, []);

      const fetchCampaigns = useCallback(async () => {
        const token = sessionRef.current?.token;
        try {
          const res = await fetch('/api/campaigns', { headers: { 'X-Auth-Token': token || '' } });
          if (res.status === 401) { logoutRef.current?.(); return; }
          if (res.ok) {
            const data = await res.json();
            setCampaigns(data.campaigns || []);
          }
        } catch {
          showToastRef.current?.('No se pudieron cargar las campañas', 'err');
        }
      }, []);

      // Load after a valid session is available; re-fires if session token changes
      useEffect(() => {
        if (!session) { setDataReady(false); return; }
        fetchState();
        fetchCampaigns();
      }, [session?.token]);

      // Auto-save on mutation (skip when state was set by LOAD or before first server load)
      useEffect(() => {
        if (isLoadingRef.current) { isLoadingRef.current = false; return; }
        if (!hasLoadedRef.current) return;
        postState(state);
      }, [state]);

      // Live refresh: poll the server so agents see each other's changes
      // without navigating. ETag makes unchanged polls a cheap 304. Skip while
      // a save is in flight (avoids clobbering the just-dispatched change) and
      // during an active call (don't yank data out from under the agent).
      useEffect(() => {
        if (!session || !dataReady) return;
        const id = setInterval(() => {
          if (postInFlightRef.current) return;
          if (vistaRef.current === 'llamada') return;
          fetchState();
        }, 12000);
        return () => clearInterval(id);
      }, [session?.token, dataReady, fetchState]);

      const showToast = (msg, tone='ok') => {
        setToast({ msg, tone });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 2600);
      };
      showToastRef.current = showToast;
      logoutRef.current = handleLogout;

      const stats = useMemo(() => {
        const convertidos = state.clients.filter(c => c.estado === 'convertido').length;
        const total = state.clients.length;
        const llamadasHoy = state.log.filter(l => esHoy(l.at)).length;
        const uplift = campania ? Math.max(0, campania.precioNuevo - campania.precioActual) : 0;
        return {
          convertidos,
          tasa: total ? Math.round(convertidos/total*100) : 0,
          ingreso: convertidos * uplift,
          llamadasHoy,
        };
      }, [state, campania]);

      const recordatoriosCount = useMemo(() =>
        state.clients.filter(c => c.recordatorio && esVencido(c.recordatorio.fecha)).length,
      [state.clients]);

      const activeCliente = state.clients.find(c => c.id === activeId);

      const abrirCliente = (id) => { setActiveId(id); setVista('llamada'); };

      const ordenLlamada = useMemo(() =>
        [...state.clients].sort((a,b) => new Date(a.inicio) - new Date(b.inicio)),
        [state.clients]);

      const siguientePendiente = (desdeId) => {
        const idx = ordenLlamada.findIndex(c => c.id === desdeId);
        if (idx === -1) return null;
        for (let i = idx+1; i < ordenLlamada.length; i++) {
          if (ordenLlamada[i].estado === 'pendiente' || ordenLlamada[i].estado === 'llamado') return ordenLlamada[i].id;
        }
        return null;
      };

      const onResult = (id, resultado, callbackAt) => {
        dispatch({ type: 'RESULTADO', id, resultado, callbackAt });
        const msgs = { convertido: '✅ Cliente convertido', no_interesado: 'Registrado: no interesado', callback: 'Callback agendado', llamado: 'Marcado: no contestó' };
        showToast(msgs[resultado] || 'Resultado guardado', resultado === 'convertido' ? 'ok' : 'neutral');
      };

      const onEliminar = (id, nombre) => {
        if (!window.confirm(`¿Eliminar a "${nombre}" de la lista? Esta acción no se puede deshacer.`)) return;
        dispatch({ type: 'ELIMINAR_CLIENTE', id });
        showToast('Cliente eliminado');
      };

      const onRevertir = (id) => {
        dispatch({ type: 'REVERTIR_ESTADO', id });
        showToast('Estado revertido a pendiente');
      };

      const onSetRecordatorio = (id, fecha, nota) => {
        dispatch({ type: 'SET_RECORDATORIO', id, fecha, nota });
        showToast('Recordatorio guardado 🔔');
      };

      const onClearRecordatorio = (id) => {
        dispatch({ type: 'CLEAR_RECORDATORIO', id });
        showToast('Recordatorio eliminado');
      };

      const onSelectCampania = (id) => {
        setCampaniaId(id);
        setCampaniaSession(id);
      };

      const onNota = (id, notas) => dispatch({ type: 'NOTA', id, notas });

      const onTomar = (clientId) => {
        const cliente = state.clients.find(c => c.id === clientId);
        if (!cliente) return;
        if (cliente.agentId && cliente.agentId !== session.id) {
          const confirmar = window.confirm(
            `Este cliente ya lo tiene ${cliente.agentNombre}. ¿Deseas tomarlo igualmente?`
          );
          if (!confirmar) return;
        }
        dispatch({ type: 'TOMAR_CLIENTE', clientId, agentId: session.id, agentNombre: session.nombre });
        showToast('Cliente asignado a ti');
      };

      const onAdd = (cliente) => { dispatch({ type: 'AGREGAR', cliente }); showToast('Cliente agregado a la lista'); };

      const onAdmin = () => { setVista('admin'); setActiveId(null); };

      const onReset = () => {
        if (window.confirm('¿Reiniciar la campaña? Esto pondrá a todos los clientes como "pendiente" y borrará notas, resultados y el registro de llamadas. Esta acción no se puede deshacer.')) {
          replaceLogRef.current = true; // force-replace the log server-side (don't union-merge old entries back)
          dispatch({ type: 'LIMPIAR' });
          setVista('lista'); setActiveId(null);
          showToast('Campaña reiniciada', 'warn');
        }
      };

      const exportarCSV = () => {
        const headers = ['Nombre','Teléfono','Dirección','Fecha inicio','Antigüedad','Estado','Fecha callback','Último contacto','Notas'];
        const filas = state.clients.map(c => [
          c.nombre, c.telefono, c.direccion, fechaCorta(c.inicio), antiguedad(c.inicio),
          ESTADOS[c.estado].label,
          c.callbackAt ? fechaHora(c.callbackAt) : '',
          c.lastContact ? fechaHora(c.lastContact) : '',
          (c.notas || '').replace(/\s+/g,' ').trim(),
        ]);
        const esc = (v) => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
        const csv = '﻿' + [headers, ...filas].map(r => r.map(esc).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'valnet_upsell_' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('CSV exportado (' + state.clients.length + ' clientes)');
      };

      const importarCSV = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const text = await file.text();

          // Parse a single CSV line respecting quoted fields (handles commas inside quotes)
          const parseCSVLine = (line) => {
            const fields = [];
            let cur = '', inQuote = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (ch === '"') {
                if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
                else inQuote = !inQuote;
              } else if (ch === ',' && !inQuote) {
                fields.push(cur.trim()); cur = '';
              } else {
                cur += ch;
              }
            }
            fields.push(cur.trim());
            return fields;
          };

          const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
          if (lines.length < 2) { showToast('CSV vacío o inválido', 'warn'); return; }

          const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase());

          // Resolve a field trying multiple possible header names
          const col = (row, ...names) => {
            for (const n of names) {
              const i = rawHeaders.indexOf(n.toLowerCase());
              if (i >= 0 && row[i]) return row[i].trim();
            }
            return '';
          };

          let maxId = state.clients.reduce((m, c) => Math.max(m, Number(c.id) || 0), 0);

          const parsed = lines.slice(1).map(line => {
            const row = parseCSVLine(line);
            maxId += 1;
            const cedula = col(row, 'cedula', 'id', 'codigo');
            const telefono = col(row, 'movil', 'telefono', 'celular', 'telefono1');
            const tier = col(row, 'tier', 'plan_tier') || '999';
            const planFromCSV = col(row, 'plan', 'servicio', 'paquete', 'descripcion');
            const planDerived = planFromCSV || (() => {
              const p = PLANES.find(pl => pl.precio === Number(tier));
              return p ? p.nombre : "Conectao'";
            })();
            return {
              id: cedula || maxId,
              nombre: col(row, 'nombre', 'name', 'cliente'),
              telefono,
              direccion: col(row, 'zona', 'direccion', 'address', 'sector'),
              inicio: col(row, 'inicio', 'fecha') || new Date().toISOString().slice(0, 10),
              tier,
              plan: planDerived,
              estado: 'pendiente',
              notas: '',
              callbackAt: null,
              lastContact: null,
              agentId: null,
              agentNombre: null,
              recordatorio: null,
            };
          }).filter(c => c.nombre);

          if (!parsed.length) { showToast('No se encontraron clientes válidos', 'warn'); return; }
          try {
            const res = await fetch('/api/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Auth-Token': sessionRef.current?.token || '' },
              body: JSON.stringify(parsed),
            });
            if (res.status === 401) { logoutRef.current?.(); return; }
            if (!res.ok) { showToast('Error al importar CSV', 'err'); return; }
            const { added, skipped } = await res.json();
            await fetchState();
            showToast(`Importados: ${added} clientes${skipped ? ` (${skipped} duplicados omitidos)` : ''}`);
          } catch (err) {
            showToast('Error al importar CSV', 'warn');
          }
        };
        input.click();
      };

      if (!session) return <LoginPage onLogin={handleLogin} />;

      if (!dataReady) return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm font-medium text-slate-500">Cargando datos…</p>
        </div>
      );

      return (
        <div className="min-h-screen pb-10">
          <Header stats={stats} vista={vista === 'llamada' ? 'lista' : vista}
            setVista={(v) => { setVista(v); setActiveId(null); fetchState(); touchSession(); }}
            onExport={exportarCSV} onReset={onReset} onImport={session.isAdmin ? importarCSV : undefined}
            session={session} onLogout={handleLogout} onAdmin={onAdmin}
            campaigns={campaigns} campania={campania} onSelectCampania={onSelectCampania} recordatoriosCount={recordatoriosCount} />

          {vista === 'dashboard' && <Dashboard clients={state.clients} log={state.log} stats={stats} campania={campania} />}
          {vista === 'lista' && <ClientList clients={state.clients} onOpen={abrirCliente} onAdd={onAdd} onTomar={onTomar} onEliminar={onEliminar} onRevertir={onRevertir} session={session} campania={campania} onClearRecordatorio={onClearRecordatorio} onSetRecordatorio={onSetRecordatorio} />}
          {vista === 'admin' && session.isAdmin && <AdminView session={session} onCampaignsChange={fetchCampaigns} />}
          {vista === 'llamada' && activeCliente && (
            <CallPanel cliente={activeCliente} onResult={onResult} onNota={onNota}
              onBack={() => { setVista('lista'); setActiveId(null); }}
              hayNext={!!siguientePendiente(activeCliente.id)}
              onNext={() => { const n = siguientePendiente(activeCliente.id); if (n) setActiveId(n); }}
              campania={campania} onSetRecordatorio={onSetRecordatorio} />
          )}

          <Toast toast={toast} />
        </div>
      );
    }

export { App };
