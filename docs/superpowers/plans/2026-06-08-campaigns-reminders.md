# Campaigns & Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded campaign constants with a multi-profile campaign system; add follow-up reminders for converted clients.

**Architecture:** `campaigns.json` on the server (same pattern as `agents.json`) holds campaign profiles with plan pairs, promo pricing, and optional zone filters. The frontend fetches campaigns on login, lets each agent pick an active campaign that filters the client list, and passes campaign data into the call panel and dashboard instead of hardcoded constants. Reminders are stored on client objects via the existing `POST /api/state`; a bell badge and collapsible section surface overdue ones.

**Tech Stack:** Node.js 24 + Express 5, React 18 (Babel CDN), Tailwind CDN, `data.json` + `campaigns.json` flat-file storage.

---

## File Map

| File | Change |
|------|--------|
| `server.js` | Add `campaigns.json` helpers + 4 new endpoints |
| `index.html` | Replace hardcoded constants; add `PLANES`; add `plan` field to clients; campaign state + selector in Header; filtering in ClientList; AdminView Promos tab; dynamic CallPanel + GUION; reducer SET_RECORDATORIO / CLEAR_RECORDATORIO; reminders UI |
| `.gitignore` | Add `campaigns.json` |

---

## Task 1: Backend — campaigns.json + CRUD API

**Files:**
- Modify: `server.js`
- Modify: `.gitignore`

- [ ] **Step 1: Add campaigns.json helpers to server.js**

  Open `server.js`. After the `writeAgents` function (around line 42), insert:

  ```js
  const CAMPAIGNS_FILE = path.join(__dirname, 'campaigns.json');

  function readCampaigns() {
    if (!fs.existsSync(CAMPAIGNS_FILE)) {
      const seed = { campaigns: [] };
      fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(seed, null, 2));
      return seed;
    }
    return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
  }

  function writeCampaigns(data) {
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(data, null, 2));
  }
  ```

- [ ] **Step 2: Add GET /api/campaigns endpoint**

  After the `DELETE /api/agents/:id` handler, insert:

  ```js
  // GET /api/campaigns — all agents can read
  app.get('/api/campaigns', (_req, res) => {
    const data = readCampaigns();
    res.json({ campaigns: data.campaigns });
  });
  ```

- [ ] **Step 3: Add POST /api/campaigns endpoint**

  ```js
  // POST /api/campaigns — admin only
  app.post('/api/campaigns', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { nombre, planActual, planNuevo, precioActual, precioNuevo, precioPromo, mesesPromo, filtroZona } = req.body;
    if (!nombre || !planActual || !planNuevo) {
      return res.status(400).json({ error: 'Nombre, planActual y planNuevo son requeridos' });
    }
    const data = readCampaigns();
    if (data.campaigns.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
      return res.status(400).json({ error: 'Ya existe una campaña con ese nombre' });
    }
    const nextId = data.campaigns.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    const newC = {
      id: nextId,
      nombre,
      planActual,
      planNuevo,
      precioActual: Number(precioActual) || 0,
      precioNuevo: Number(precioNuevo) || 0,
      precioPromo: Number(precioPromo) || 0,
      mesesPromo: Number(mesesPromo) || 0,
      filtroZona: filtroZona || null,
    };
    data.campaigns.push(newC);
    writeCampaigns(data);
    res.json({ campaign: newC });
  });
  ```

- [ ] **Step 4: Add PUT /api/campaigns/:id endpoint**

  ```js
  // PUT /api/campaigns/:id — admin only
  app.put('/api/campaigns/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    const { nombre, planActual, planNuevo, precioActual, precioNuevo, precioPromo, mesesPromo, filtroZona } = req.body;
    if (!nombre || !planActual || !planNuevo) {
      return res.status(400).json({ error: 'Nombre, planActual y planNuevo son requeridos' });
    }
    const data = readCampaigns();
    const idx = data.campaigns.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Campaña no encontrada' });
    data.campaigns[idx] = {
      id,
      nombre,
      planActual,
      planNuevo,
      precioActual: Number(precioActual) || 0,
      precioNuevo: Number(precioNuevo) || 0,
      precioPromo: Number(precioPromo) || 0,
      mesesPromo: Number(mesesPromo) || 0,
      filtroZona: filtroZona || null,
    };
    writeCampaigns(data);
    res.json({ campaign: data.campaigns[idx] });
  });
  ```

- [ ] **Step 5: Add DELETE /api/campaigns/:id endpoint**

  ```js
  // DELETE /api/campaigns/:id — admin only
  app.delete('/api/campaigns/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    const data = readCampaigns();
    const before = data.campaigns.length;
    data.campaigns = data.campaigns.filter(c => c.id !== id);
    if (data.campaigns.length === before) {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    writeCampaigns(data);
    res.json({ ok: true });
  });
  ```

- [ ] **Step 6: Add campaigns.json to .gitignore**

  Open `.gitignore` and add `campaigns.json` on a new line after `agents.json`.

- [ ] **Step 7: Restart server and smoke-test**

  ```
  pm2 restart upsell
  ```

  Then in PowerShell:
  ```powershell
  # Should return { campaigns: [] }
  Invoke-RestMethod http://localhost:4321/api/campaigns

  # Create a campaign (replace X-Agent-Id value with your admin agent id, e.g. 1)
  Invoke-RestMethod http://localhost:4321/api/campaigns -Method POST `
    -Headers @{ "Content-Type"="application/json"; "X-Agent-Id"="1" } `
    -Body '{"nombre":"Test","planActual":"Conectao prime","planNuevo":"Domestico","precioActual":999,"precioNuevo":1300,"precioPromo":999,"mesesPromo":3,"filtroZona":null}'

  # Should return campaign with id:1
  Invoke-RestMethod http://localhost:4321/api/campaigns
  ```

  Expected: second GET returns `{ campaigns: [{id:1, nombre:"Test", ...}] }`

- [ ] **Step 8: Commit**

  ```
  git add server.js .gitignore
  git commit -m "feat: add campaigns.json backend with CRUD API"
  ```

---

## Task 2: Frontend — PLANES array, remove hardcoded constants, add `plan` to clients

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace hardcoded constants with PLANES array**

  Find and replace the entire CONSTANTES DE NEGOCIO block (the 5 lines starting with `const PLAN_ACTUAL`):

  **Remove:**
  ```js
  const PLAN_ACTUAL = { nombre: '20/20 Mbps', precio: 999 };
  const PLAN_NUEVO  = { nombre: '40/40 Mbps', precio: 1300 };
  const PRECIO_PROMO = 999;          // primeros 3 meses
  const MESES_PROMO = 3;
  const UPLIFT = PLAN_NUEVO.precio - PLAN_ACTUAL.precio; // 301 RD$/mes a partir del mes 4
  ```

  **Replace with:**
  ```js
  const PLANES = [
    { nombre: "Conectao'",  precio: 999  },
    { nombre: 'Doméstico',  precio: 1300 },
    { nombre: 'Estudio',    precio: 1630 },
    { nombre: 'Emprende',   precio: 1899 },
    { nombre: 'Cinemática', precio: 2550 },
    { nombre: 'Negocio',    precio: 2999 },
    { nombre: 'Gamer',      precio: 3499 },
    { nombre: 'Galáctico',  precio: 3800 },
  ];

  // Returns the PLANES entry for the given plan name (case-insensitive), or null
  function planInfo(nombre) {
    if (!nombre) return null;
    return PLANES.find(p => p.nombre.toLowerCase() === nombre.toLowerCase()) || null;
  }
  ```

- [ ] **Step 2: Add `recordatorio: null` in the AGREGAR reducer case**

  Find the AGREGAR case in the reducer:

  ```js
  case 'AGREGAR': {
    const nextId = state.clients.reduce((m,c)=>Math.max(m,c.id),0) + 1;
    const nuevo = { id: nextId, ...action.cliente, tier: '999', estado:'pendiente', notas:'', callbackAt:null, lastContact:null };
    return { ...state, clients: [...state.clients, nuevo] };
  }
  ```

  Replace with:

  ```js
  case 'AGREGAR': {
    const nextId = state.clients.reduce((m,c)=>Math.max(m,c.id),0) + 1;
    const nuevo = {
      id: nextId, ...action.cliente, tier: '999',
      estado:'pendiente', notas:'', callbackAt:null, lastContact:null,
      recordatorio: null,
    };
    return { ...state, clients: [...state.clients, nuevo] };
  }
  ```

- [ ] **Step 3: Add `plan` and `recordatorio` fields in CSV import**

  In the `importarCSV` function, find the object returned inside the `parsed` mapping. It ends with `agentNombre: null,`. Replace the entire returned object with:

  ```js
  const tier = col(row, 'tier', 'plan_tier') || '999';
  const planFromCSV = col(row, 'plan', 'servicio', 'paquete', 'descripcion');
  const planDerived = planFromCSV || (() => {
    const p = PLANES.find(pl => String(pl.precio) === tier);
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
  ```

- [ ] **Step 4: Verify no JS errors in browser**

  Open http://localhost:4321, log in. DevTools console must show no errors. The app should load normally (client list visible, no "PLAN_ACTUAL is not defined" errors).

- [ ] **Step 5: Commit**

  ```
  git add index.html
  git commit -m "feat: add PLANES array, plan+recordatorio fields on clients, remove hardcoded constants"
  ```

---

## Task 3: Campaign state in App, Header selector, ClientList filtering

**Files:**
- Modify: `index.html` — App component, Header component, ClientList component, Dashboard component

- [ ] **Step 1: Add setCampaniaSession helper**

  Find the `touchSession` function. After it, add:

  ```js
  function setCampaniaSession(campaniaId) {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      s.campaniaId = campaniaId;
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {}
  }
  ```

- [ ] **Step 2: Add campaign state to App component**

  In the App component, find the useState declarations at the top. After `const [session, setSession] = useState(loadSession);`, add:

  ```js
  const [campaigns, setCampaigns] = useState([]);
  const [campaniaId, setCampaniaId] = useState(() => {
    const s = loadSession();
    return s ? (s.campaniaId || null) : null;
  });
  ```

  Then, right after all useState declarations (before any useRef or useCallback), add the derived `campania` variable:

  ```js
  const campania = campaigns.find(c => c.id === campaniaId) || null;
  ```

- [ ] **Step 3: Add fetchCampaigns to App**

  Find the `fetchState` useCallback. After it, add:

  ```js
  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {}
  }, []);
  ```

  Then find:
  ```js
  useEffect(() => { fetchState(); }, []);
  ```

  Replace with:
  ```js
  useEffect(() => { fetchState(); fetchCampaigns(); }, []);
  ```

- [ ] **Step 4: Add campaign selection handler to App**

  After the `onRevertir` handler, add:

  ```js
  const onSelectCampania = (id) => {
    setCampaniaId(id);
    setCampaniaSession(id);
  };
  ```

- [ ] **Step 5: Update stats useMemo to use campania instead of UPLIFT**

  Find:
  ```js
  const stats = useMemo(() => {
    const convertidos = state.clients.filter(c => c.estado === 'convertido').length;
    const total = state.clients.length;
    const llamadasHoy = state.log.filter(l => esHoy(l.at)).length;
    return {
      convertidos,
      tasa: total ? Math.round(convertidos/total*100) : 0,
      ingreso: convertidos * UPLIFT,
      llamadasHoy,
    };
  }, [state]);
  ```

  Replace with:

  ```js
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
  ```

- [ ] **Step 6: Update App render JSX — pass campania to all children**

  Find the Header JSX in App's return and replace:

  ```jsx
  <Header stats={stats} vista={vista === 'llamada' ? 'lista' : vista}
    setVista={(v) => { setVista(v); setActiveId(null); fetchState(); touchSession(); }}
    onExport={exportarCSV} onReset={onReset} onImport={importarCSV}
    session={session} onLogout={handleLogout} onAdmin={onAdmin} />
  ```

  With:

  ```jsx
  <Header stats={stats} vista={vista === 'llamada' ? 'lista' : vista}
    setVista={(v) => { setVista(v); setActiveId(null); fetchState(); touchSession(); }}
    onExport={exportarCSV} onReset={onReset} onImport={importarCSV}
    session={session} onLogout={handleLogout} onAdmin={onAdmin}
    campaigns={campaigns} campania={campania} onSelectCampania={onSelectCampania} />
  ```

  Find the Dashboard JSX and replace:

  ```jsx
  {vista === 'dashboard' && <Dashboard clients={state.clients} log={state.log} stats={stats} />}
  ```

  With:

  ```jsx
  {vista === 'dashboard' && <Dashboard clients={state.clients} log={state.log} stats={stats} campania={campania} />}
  ```

  Find the ClientList JSX and replace:

  ```jsx
  {vista === 'lista' && <ClientList clients={state.clients} onOpen={abrirCliente} onAdd={onAdd} onTomar={onTomar} onEliminar={onEliminar} onRevertir={onRevertir} session={session} />}
  ```

  With:

  ```jsx
  {vista === 'lista' && <ClientList clients={state.clients} onOpen={abrirCliente} onAdd={onAdd} onTomar={onTomar} onEliminar={onEliminar} onRevertir={onRevertir} session={session} campania={campania} />}
  ```

  Find the AdminView JSX and replace:

  ```jsx
  {vista === 'admin' && session.isAdmin && <AdminView session={session} />}
  ```

  With:

  ```jsx
  {vista === 'admin' && session.isAdmin && <AdminView session={session} onCampaignsChange={fetchCampaigns} />}
  ```

  Find the CallPanel JSX and replace:

  ```jsx
  <CallPanel cliente={activeCliente} onResult={onResult} onNota={onNota}
    onBack={() => { setVista('lista'); setActiveId(null); }}
    hayNext={!!siguientePendiente(activeCliente.id)} />
  ```

  With:

  ```jsx
  <CallPanel cliente={activeCliente} onResult={onResult} onNota={onNota}
    onBack={() => { setVista('lista'); setActiveId(null); }}
    hayNext={!!siguientePendiente(activeCliente.id)}
    campania={campania} />
  ```

- [ ] **Step 7: Update Header component**

  Find the Header function signature:

  ```js
  function Header({ stats, vista, setVista, onExport, onReset, onImport, session, onLogout, onAdmin }) {
  ```

  Replace with:

  ```js
  function Header({ stats, vista, setVista, onExport, onReset, onImport, session, onLogout, onAdmin, campaigns, campania, onSelectCampania }) {
  ```

  Find the subtitle line inside Header:

  ```jsx
  <div className="text-xs font-medium text-slate-500">Campaña Upsell · 20→40 Mbps</div>
  ```

  Replace with:

  ```jsx
  <div className="text-xs font-medium text-slate-500">
    {campania ? campania.nombre : 'Sin campaña activa'}
  </div>
  ```

  Inside Header, in the `<div className="order-2 ml-auto flex items-center gap-2 sm:order-3">` div, find the `<span className="hidden text-xs ...">Hola, {session.nombre}</span>` and insert the campaign selector **before** it:

  ```jsx
  <select
    value={campania ? campania.id : ''}
    onChange={e => onSelectCampania(e.target.value ? Number(e.target.value) : null)}
    className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 sm:block">
    <option value="">Sin campaña</option>
    {(campaigns || []).map(c => (
      <option key={c.id} value={c.id}>{c.nombre}</option>
    ))}
  </select>
  ```

- [ ] **Step 8: Update ClientList to filter by campaign**

  Find the ClientList function signature:

  ```js
  function ClientList({ clients, onOpen, onAdd, onTomar, onEliminar, onRevertir, session }) {
  ```

  Replace with:

  ```js
  function ClientList({ clients, onOpen, onAdd, onTomar, onEliminar, onRevertir, session, campania }) {
  ```

  Find the `visibles` useMemo inside ClientList. At the **start** of the memo body, before the existing `filtro` and `busqueda` filtering, add:

  ```js
  // Campaign filter
  let base = clients;
  if (campania) {
    base = base.filter(c => {
      const planMatch = !campania.planActual ||
        (c.plan || '').toLowerCase() === campania.planActual.toLowerCase();
      const zonaMatch = !campania.filtroZona ||
        (c.direccion || '').toLowerCase().includes(campania.filtroZona.toLowerCase());
      return planMatch && zonaMatch;
    });
  }
  ```

  Then change the first line of existing filtering from `let r = filtro === 'todos' ? clients : clients.filter(...)` to use `base` instead of `clients`:

  ```js
  let r = filtro === 'todos' ? base : base.filter(c => c.estado === filtro);
  ```

  Also update the count chips. The `conteo` useMemo currently counts from `clients`. It should also count from the campaign-filtered base. Update `conteo` to use a separate `clientesFiltradosCampania` memo:

  After the `campania` prop is in scope, add near the top of ClientList body:

  ```js
  const clientesFiltradosCampania = useMemo(() => {
    if (!campania) return clients;
    return clients.filter(c => {
      const planMatch = !campania.planActual ||
        (c.plan || '').toLowerCase() === campania.planActual.toLowerCase();
      const zonaMatch = !campania.filtroZona ||
        (c.direccion || '').toLowerCase().includes(campania.filtroZona.toLowerCase());
      return planMatch && zonaMatch;
    });
  }, [clients, campania]);
  ```

  Then update `conteo` useMemo to use `clientesFiltradosCampania`:

  ```js
  const conteo = useMemo(() => {
    const o = { todos: clientesFiltradosCampania.length };
    ORDEN_ESTADOS.forEach(e => o[e] = 0);
    clientesFiltradosCampania.forEach(c => o[c.estado] = (o[c.estado]||0) + 1);
    return o;
  }, [clientesFiltradosCampania]);
  ```

  Update the `visibles` useMemo to use `clientesFiltradosCampania` instead of `clients` (simplify):

  ```js
  const visibles = useMemo(() => {
    let r = filtro === 'todos'
      ? clientesFiltradosCampania
      : clientesFiltradosCampania.filter(c => c.estado === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter(c => c.nombre.toLowerCase().includes(q) || c.telefono.includes(q));
    }
    return [...r].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  }, [clientesFiltradosCampania, filtro, busqueda]);
  ```

  Add `campania` to the dependency array of `clientesFiltradosCampania`.

  Update the footer line:

  ```jsx
  <p className="mt-3 text-xs text-slate-400">
    Mostrando {visibles.length} de {clientesFiltradosCampania.length} clientes
    {campania ? ` · campaña: ${campania.nombre}` : ` (${clients.length} total)`}
    · ordenados por antigüedad.
  </p>
  ```

- [ ] **Step 9: Update Dashboard to use campania**

  Find Dashboard function signature:

  ```js
  function Dashboard({ clients, log, stats }) {
  ```

  Replace with:

  ```js
  function Dashboard({ clients, log, stats, campania }) {
  ```

  Find:
  ```jsx
  <p className="mb-5 text-sm text-slate-500">Promoción 40/40 Mbps · primeros {MESES_PROMO} meses a {RD(PRECIO_PROMO)}, luego {RD(PLAN_NUEVO.precio)}.</p>
  ```

  Replace with:

  ```jsx
  <p className="mb-5 text-sm text-slate-500">
    {campania
      ? `${campania.nombre} · primeros ${campania.mesesPromo} meses a ${RD(campania.precioPromo)}, luego ${RD(campania.precioNuevo)}.`
      : 'Sin campaña activa — selecciona una desde el encabezado.'}
  </p>
  ```

  Find the ingreso card text referencing `UPLIFT`:

  ```jsx
  <div className="mt-2 text-sm text-brand-100">
    {stats.convertidos} convertidos × {RD(UPLIFT)} <span className="opacity-80">(a partir del mes 4)</span>
  </div>
  ```

  Replace with:

  ```jsx
  <div className="mt-2 text-sm text-brand-100">
    {campania
      ? `${stats.convertidos} convertidos × ${RD(campania.precioNuevo - campania.precioActual)} (mes ${campania.mesesPromo + 1} en adelante)`
      : `${stats.convertidos} convertidos`}
  </div>
  ```

  Find the StatCard "Clientes en lista":

  ```jsx
  <StatCard icon={Icon.Users} label="Clientes en lista" value={clients.length} sub="Plan actual 20/20 · $999" tone="brand" />
  ```

  Replace with:

  ```jsx
  <StatCard icon={Icon.Users} label="Clientes en lista" value={clients.length}
    sub={campania ? `Plan ${campania.planActual} · ${RD(campania.precioActual)}` : 'Todos los planes'}
    tone="brand" />
  ```

- [ ] **Step 10: Verify in browser**

  1. Log in → header shows dropdown "Sin campaña" (no campaigns yet).
  2. Dashboard shows "Sin campaña activa…".
  3. No console errors.

- [ ] **Step 11: Commit**

  ```
  git add index.html
  git commit -m "feat: campaign state in App, selector in Header, filtering in ClientList and Dashboard"
  ```

---

## Task 4: AdminView — Promos tab

**Files:**
- Modify: `index.html` — Icon object, AdminView component

- [ ] **Step 1: Add Icon.Pencil and Icon.Bell to the Icon object**

  Find the Icon object definition. After the `Upload` icon, add:

  ```js
  Bell: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>),
  ```

- [ ] **Step 2: Replace the entire AdminView component**

  Find the `function AdminView({ session })` component (starting around line 930) and replace it entirely with the following. This replaces the component through the closing `}` that ends AdminView:

  ```jsx
  function AdminView({ session, onCampaignsChange }) {
    const [tab, setTab] = useState('agentes');

    // ---- Agents ----
    const [agents, setAgents] = useState([]);
    const [agentsLoading, setAgentsLoading] = useState(true);
    const [agentForm, setAgentForm] = useState({ nombre: '', password: '', isAdmin: false });
    const [agentFormError, setAgentFormError] = useState('');
    const [agentSaving, setAgentSaving] = useState(false);
    const agentHeaders = { 'Content-Type': 'application/json', 'X-Agent-Id': String(session.id) };

    const loadAgents = async () => {
      setAgentsLoading(true);
      try {
        const res = await fetch('/api/agents', { headers: { 'X-Agent-Id': String(session.id) } });
        const data = await res.json();
        setAgents(data.agents || []);
      } catch {} finally { setAgentsLoading(false); }
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
        await fetch(`/api/agents/${agent.id}`, { method: 'DELETE', headers: { 'X-Agent-Id': String(session.id) } });
        await loadAgents();
      } catch {}
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
        const res = await fetch('/api/campaigns');
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      } catch {} finally { setCampaignsLoading(false); }
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
      if (!window.confirm(`¿Eliminar la campaña "${c.nombre}"?`)) return;
      try {
        await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE', headers: { 'X-Agent-Id': String(session.id) } });
        await loadCampaigns();
        if (onCampaignsChange) onCampaignsChange();
      } catch {}
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
                  <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Contraseña</span>
                    <input type="text" value={agentForm.password} onChange={e => setAgentForm(f => ({ ...f, password: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" placeholder="Contraseña" /></label>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={agentForm.isAdmin} onChange={e => setAgentForm(f => ({ ...f, isAdmin: e.target.checked }))} className="rounded" /> Rol Admin</label>
                {agentFormError && <p className="text-xs font-semibold text-rose-600">{agentFormError}</p>}
                <button type="submit" disabled={agentSaving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40">{agentSaving ? 'Guardando…' : 'Agregar agente'}</button>
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
                    <th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Planes</th><th className="px-4 py-3">Promo</th><th className="px-4 py-3">Zona</th><th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {campaigns.map(c => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                        <td className="px-4 py-3 text-slate-600">{c.planActual} → {c.planNuevo}</td>
                        <td className="px-4 py-3 text-slate-600">{RD(c.precioPromo)} × {c.mesesPromo}m</td>
                        <td className="px-4 py-3 text-slate-500">{c.filtroZona || <span className="text-slate-300">Todas</span>}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEdit(c)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">Editar</button>
                            <button onClick={() => handleDeleteCampaign(c)} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {campaigns.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-sm text-slate-400">No hay campañas. Crea una nueva.</td></tr>}
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
  ```

- [ ] **Step 3: Verify in browser**

  1. Log in as admin → click "Admin".
  2. See tabs "Agentes" | "Campañas".
  3. Click "Campañas" → "Nueva campaña".
  4. Fill in: nombre "Upsell Conectao' a Domestico", planActual "Conectao'" (precio promo auto-fills to 999), planNuevo "Doméstico" (precioNuevo auto-fills to 1300), meses 3.
  5. Click "Crear campaña" → appears in table.
  6. Return to client list → header dropdown shows the new campaign.
  7. Select it → client list filters to show only Conectao' plan clients.
  8. Dashboard shows the campaign name.

- [ ] **Step 4: Commit**

  ```
  git add index.html
  git commit -m "feat: AdminView Promos tab with campaign CRUD"
  ```

---

## Task 5: CallPanel — dynamic campaign data + GUION

**Files:**
- Modify: `index.html` — GUION constant, CallPanel component, LoginPage

- [ ] **Step 1: Replace GUION constant with makeGuion function**

  Find the `const GUION = [...]` array. Replace the entire array with:

  ```js
  function makeGuion(campania) {
    const planA = campania ? campania.planActual : "Conectao'";
    const planN = campania ? campania.planNuevo  : 'Doméstico';
    const promo  = campania ? RD(campania.precioPromo) : RD(999);
    const precN  = campania ? RD(campania.precioNuevo) : RD(1300);
    const meses  = campania ? campania.mesesPromo : 3;
    return [
      { paso: 1, titulo: 'Apertura',
        texto: 'Buenas [tardes/noches], ¿hablo con [nombre del cliente]? Le llamo de ValNet, soy [nombre del agente]. Le llamo porque usted es uno de nuestros clientes y tenemos una promoción exclusiva para usted — no le va a costar nada adicional.' },
      { paso: 2, titulo: 'La oferta',
        texto: `Queremos subirle el plan de ${planA} a ${planN} — más velocidad — y usted sigue pagando los mismos ${promo} durante los próximos ${meses} meses. No hay instalación, no hay trámite, lo activamos hoy mismo.` },
      { paso: 3, titulo: `Transparencia mes ${meses + 1}`,
        texto: `A partir del mes ${meses + 1}, el plan ${planN} queda en ${precN}. Pero si en ese momento usted prefiere regresar al plan anterior, sin problema — usted decide. Lo importante es que pruebe la diferencia sin riesgo.` },
      { paso: 4, titulo: 'Cierre',
        texto: '¿Le parece bien que lo activemos ahora mismo?',
        nota: 'Pregunta directa. Esperar respuesta sin agregar más.' },
    ];
  }
  ```

- [ ] **Step 2: Update CallPanel signature and use dynamic guion**

  Find:
  ```js
  function CallPanel({ cliente, onResult, onNota, onBack, hayNext }) {
  ```

  Replace with:
  ```js
  function CallPanel({ cliente, onResult, onNota, onBack, hayNext, campania }) {
  ```

  Near the top of CallPanel body (after the state declarations), add:

  ```js
  const guion = useMemo(() => makeGuion(campania), [campania]);
  ```

  Then find every reference to `GUION` inside CallPanel and replace with `guion`:

  - `GUION.length` → `guion.length` (appears in the stepper loop and keyboard shortcut handler)
  - `GUION[paso]` → `guion[paso]`
  - `GUION.map(...)` → `guion.map(...)`

- [ ] **Step 3: Update plan info box in CallPanel**

  Find the plan info box inside CallPanel (the `rounded-xl bg-slate-50 p-3` div):

  ```jsx
  <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs ring-1 ring-slate-100">
    <div className="flex items-center justify-between">
      <span className="text-slate-500">Plan actual</span>
      <span className="font-semibold text-slate-700">{PLAN_ACTUAL.nombre} · {RD(PLAN_ACTUAL.precio)}</span>
    </div>
    <div className="mt-1.5 flex items-center justify-between">
      <span className="text-slate-500">Oferta</span>
      <span className="font-semibold text-brand-700">{PLAN_NUEVO.nombre} · {RD(PRECIO_PROMO)} × {MESES_PROMO}m</span>
    </div>
  </div>
  ```

  Replace with:

  ```jsx
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
  ```

- [ ] **Step 4: Update LoginPage subtitle**

  Find:
  ```jsx
  <div className="text-sm text-slate-500">Campaña Upsell · 20→40 Mbps</div>
  ```

  Replace with:
  ```jsx
  <div className="text-sm text-slate-500">ValNet Wireless · Gestión de Campañas</div>
  ```

- [ ] **Step 5: Verify in browser**

  1. Select a campaign from the header.
  2. Open a client in the call panel.
  3. Plan info box shows the campaign's plans and promo price (not hardcoded values).
  4. Script step 2 text references the campaign's plan names.
  5. Switch to "Sin campaña" → plan info box shows the amber warning.

- [ ] **Step 6: Commit**

  ```
  git add index.html
  git commit -m "feat: dynamic CallPanel and GUION driven by active campaign"
  ```

---

## Task 6: Reminders — reducer, auto-suggest, ClientList section, Header badge

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add date helpers for reminders**

  Find the `esHoy` function. After it, add:

  ```js
  function esVencido(fechaStr) {
    if (!fechaStr) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const d = new Date(fechaStr + 'T00:00:00');
    return d <= hoy;
  }

  function fechaMasNMeses(n) {
    const d = new Date();
    d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);
  }
  ```

- [ ] **Step 2: Add SET_RECORDATORIO and CLEAR_RECORDATORIO to reducer**

  Find `default: return state;` in the reducer and insert before it:

  ```js
  case 'SET_RECORDATORIO': {
    const { id, fecha, nota } = action;
    const clients = state.clients.map(c =>
      c.id === id ? { ...c, recordatorio: { fecha, nota } } : c
    );
    return { ...state, clients };
  }
  case 'CLEAR_RECORDATORIO': {
    const clients = state.clients.map(c =>
      c.id === action.id ? { ...c, recordatorio: null } : c
    );
    return { ...state, clients };
  }
  ```

- [ ] **Step 3: Add reminder handlers to App and pass to children**

  After `const onRevertir = ...` in App, add:

  ```js
  const onSetRecordatorio = (id, fecha, nota) => {
    dispatch({ type: 'SET_RECORDATORIO', id, fecha, nota });
    showToast('Recordatorio guardado 🔔');
  };

  const onClearRecordatorio = (id) => {
    dispatch({ type: 'CLEAR_RECORDATORIO', id });
    showToast('Recordatorio eliminado');
  };
  ```

  Add `recordatoriosCount` computed value in App (after `stats` useMemo):

  ```js
  const recordatoriosCount = useMemo(() =>
    state.clients.filter(c => c.recordatorio && esVencido(c.recordatorio.fecha)).length,
  [state.clients]);
  ```

  Update Header JSX to pass `recordatoriosCount`:
  ```jsx
  <Header ... recordatoriosCount={recordatoriosCount} />
  ```

  Update ClientList JSX to pass reminder handlers:
  ```jsx
  {vista === 'lista' && <ClientList clients={state.clients} onOpen={abrirCliente} onAdd={onAdd}
    onTomar={onTomar} onEliminar={onEliminar} onRevertir={onRevertir}
    session={session} campania={campania}
    onClearRecordatorio={onClearRecordatorio} />}
  ```

  Update CallPanel JSX to pass `onSetRecordatorio`:
  ```jsx
  <CallPanel cliente={activeCliente} onResult={onResult} onNota={onNota}
    onBack={() => { setVista('lista'); setActiveId(null); }}
    hayNext={!!siguientePendiente(activeCliente.id)}
    campania={campania}
    onSetRecordatorio={onSetRecordatorio} />
  ```

- [ ] **Step 4: Add bell badge to Header**

  Update Header signature:
  ```js
  function Header({ stats, vista, setVista, onExport, onReset, onImport, session, onLogout, onAdmin, campaigns, campania, onSelectCampania, recordatoriosCount }) {
  ```

  Inside Header, after the campaign `<select>`, add:

  ```jsx
  {recordatoriosCount > 0 && (
    <div className="relative flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-600">
      <Icon.Bell className="h-4 w-4" />
      <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none">
        {recordatoriosCount}
      </span>
    </div>
  )}
  ```

- [ ] **Step 5: Add auto-suggest reminder in CallPanel**

  Update CallPanel signature:
  ```js
  function CallPanel({ cliente, onResult, onNota, onBack, hayNext, campania, onSetRecordatorio }) {
  ```

  Add state for reminder suggest (after the existing useState declarations in CallPanel):

  ```js
  const [showReminderSuggest, setShowReminderSuggest] = useState(false);
  const [reminderFecha, setReminderFecha] = useState('');
  const [reminderNota, setReminderNota] = useState('');
  ```

  Find the `registrar` function in CallPanel:

  ```js
  const registrar = (resultado, callbackAt) => {
    if (nota !== cliente.notas) onNota(cliente.id, nota);
    onResult(cliente.id, resultado, callbackAt);
  };
  ```

  Replace with:

  ```js
  const registrar = (resultado, callbackAt) => {
    if (nota !== cliente.notas) onNota(cliente.id, nota);
    onResult(cliente.id, resultado, callbackAt);
    if (resultado === 'convertido' && campania && campania.mesesPromo > 0 && onSetRecordatorio) {
      setReminderFecha(fechaMasNMeses(campania.mesesPromo));
      setReminderNota(`Verificar si mantiene plan ${campania.planNuevo}`);
      setShowReminderSuggest(true);
    }
  };
  ```

  Also reset reminder suggest on client change (inside the useEffect that resets on `cliente.id`):

  ```js
  useEffect(() => {
    setPaso(0); setNota(cliente.notas || ''); setObjAbierta(null); setShowCallback(false);
    setShowReminderSuggest(false);
  }, [cliente.id]);
  ```

  After the `{showCallback && (...)}` block in CallPanel JSX, add:

  ```jsx
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
  ```

- [ ] **Step 6: Add reminders section and row indicator to ClientList**

  Update ClientList signature:

  ```js
  function ClientList({ clients, onOpen, onAdd, onTomar, onEliminar, onRevertir, session, campania, onClearRecordatorio }) {
  ```

  Inside ClientList body, after the `clientesFiltradosCampania` memo, add:

  ```js
  const recordatoriosVencidos = useMemo(() =>
    clients.filter(c => c.recordatorio && esVencido(c.recordatorio.fecha))
      .sort((a, b) => a.recordatorio.fecha.localeCompare(b.recordatorio.fecha)),
  [clients]);
  ```

  In ClientList JSX, before the filter chips row (`<div className="flex flex-wrap`), insert:

  ```jsx
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
              <div className="mt-0.5 text-xs text-amber-700">
                <span className="font-semibold">{c.recordatorio.fecha}</span>
                {c.recordatorio.nota && <span> · {c.recordatorio.nota}</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button onClick={() => onOpen(c.id)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                Llamar
              </button>
              {onClearRecordatorio && (
                <button onClick={() => onClearRecordatorio(c.id)} title="Limpiar recordatorio"
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
  ```

  Inside the client table row, in the nombre `<td>`, after the `{c.notas && ...}` block, add:

  ```jsx
  {c.recordatorio && (
    <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
      🔔 {c.recordatorio.fecha}
    </div>
  )}
  ```

- [ ] **Step 7: Verify full reminder flow in browser**

  1. Select a campaign from the header.
  2. Open a client → register "Convertido".
  3. Reminder suggestion appears pre-filled with date (today + mesesPromo) and note.
  4. Click "Guardar" → toast "Recordatorio guardado 🔔".
  5. Go back to list → client row shows 🔔 icon with date.
  6. If date is today or past: "Recordatorios pendientes" section appears at top, Header shows bell badge.
  7. Click "✕" in the reminders section → reminder clears, badge decreases.

- [ ] **Step 8: Commit**

  ```
  git add index.html
  git commit -m "feat: reminders — reducer, auto-suggest on convertido, ClientList section, Header badge"
  ```

---

## Task 7: Final cleanup and verification

**Files:**
- Modify: `index.html` (if any stale references remain)

- [ ] **Step 1: Scan for stale references to removed constants**

  In PowerShell:

  ```powershell
  Select-String -Path index.html -Pattern "PLAN_ACTUAL|PLAN_NUEVO|PRECIO_PROMO|MESES_PROMO|\bUPLIFT\b"
  ```

  Expected: zero matches. If any found, remove or replace them with the equivalent `campania.*` expression.

- [ ] **Step 2: Full smoke-test**

  1. `pm2 restart upsell`
  2. Open http://localhost:4321 → log in.
  3. Admin → Campañas → create "Upsell Conectao' a Doméstico" with planActual "Conectao'", planNuevo "Doméstico", promo 999, meses 3.
  4. Select campaign from header → client list filters to Conectao' clients.
  5. Dashboard shows campaign name and dynamic ingreso.
  6. Open a client → call panel shows correct plan info and dynamic script.
  7. Register Convertido → reminder suggestion appears → save it.
  8. List shows 🔔 on the client row.
  9. If reminder date = today → "Recordatorios pendientes" section visible, bell badge in header.
  10. Clear reminder → section and badge disappear.
  11. Edit and delete campaign from Admin → Campañas tab.
  12. Hard-refresh → campaign selection from dropdown persists via localStorage.

- [ ] **Step 3: Final commit**

  ```
  git add index.html server.js .gitignore
  git commit -m "chore: campaigns and reminders feature complete"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ campaigns.json + CRUD API (Task 1)
- ✅ PLANES array replaces hardcoded constants (Task 2)
- ✅ `plan` field added to clients in CSV import + AGREGAR (Task 2)
- ✅ `recordatorio` field initialized as null on new clients (Task 2)
- ✅ Campaign state in App + fetchCampaigns (Task 3)
- ✅ setCampaniaSession helper persists selection (Task 3)
- ✅ Header campaign selector dropdown (Task 3)
- ✅ ClientList filtered by planActual + filtroZona (Task 3)
- ✅ Dashboard uses campania instead of hardcoded constants (Task 3)
- ✅ stats.ingreso uses campania uplift (Task 3)
- ✅ AdminView Promos tab with full CRUD (Task 4)
- ✅ Plan dropdowns auto-fill prices; planActual ≠ planNuevo enforced (Task 4)
- ✅ onCampaignsChange refreshes header dropdown after admin saves (Task 4)
- ✅ CallPanel receives campania prop (Task 5)
- ✅ makeGuion() produces dynamic script from campaign (Task 5)
- ✅ Plan info box dynamic or shows "Sin campaña" warning (Task 5)
- ✅ SET_RECORDATORIO + CLEAR_RECORDATORIO reducer cases (Task 6)
- ✅ esVencido + fechaMasNMeses helpers (Task 6)
- ✅ Auto-suggest reminder on Convertido with campaign promo data (Task 6)
- ✅ Reminder section in ClientList for vencidos (Task 6)
- ✅ 🔔 indicator in client table row (Task 6)
- ✅ Bell badge in Header (Task 6)
- ✅ campaigns.json excluded from git (Task 1)
- ✅ Graceful fallback when no campaign selected (Tasks 3, 5)
- ✅ Deleted-campaign fallback: campania = null if campaniaId not found in campaigns list (Task 3 — derived via `campaigns.find`, returns null)

**Type consistency:**
- `campaniaId`: `number | null` everywhere
- `campania`: `object | null` everywhere (derived, never stored as state)
- `recordatorio`: `{ fecha: string (YYYY-MM-DD), nota: string } | null`
- `plan`: `string` on client objects
