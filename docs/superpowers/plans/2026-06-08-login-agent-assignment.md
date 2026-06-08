# Login y Asignación de Agentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add name+password login, per-agent client assignment ("Tomar cliente"), and an admin screen to manage agents.

**Architecture:** Session stored in `localStorage` with 90-min inactivity timeout. Credentials validated once via `POST /api/login` against `agents.json`. Agent identity travels as `X-Agent-Id` header for admin-only endpoints. Client ownership is a denormalized `{ agentId, agentNombre }` pair on each client, persisted through the existing `POST /api/state` flow.

**Tech Stack:** Node.js 24 + Express 5 (existing), React 18 CDN + Babel (existing), `localStorage` for session, plain JSON for agent storage.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `agents.json` | Create | Agent data: id, nombre, password, isAdmin |
| `server.js` | Modify | Add readAgents/writeAgents/requireAdmin helpers + 4 new endpoints |
| `index.html` | Modify | LoginPage component, session logic, TOMAR_CLIENTE reducer action, Agente column + Tomar button in ClientList, Admin view, Header changes |

---

## Task 1 — Create agents.json

**Files:**
- Create: `agents.json`

- [ ] **Step 1: Create agents.json**

Save as `C:\Users\HP\Desktop\upsell\agents.json`:

```json
{
  "agents": [
    { "id": 1, "nombre": "Janio", "password": "admin123", "isAdmin": true }
  ]
}
```

The admin will add more agents via the Admin screen once the feature is live. Change the password to something you prefer before first use.

- [ ] **Step 2: Add agents.json to .gitignore**

Open `C:\Users\HP\Desktop\upsell\.gitignore` and add:
```
agents.json
```

agents.json contains passwords and should not be in git.

- [ ] **Step 3: Commit**

```powershell
git add .gitignore
git commit -m "chore: exclude agents.json from git"
```

---

## Task 2 — Add agent endpoints to server.js

**Files:**
- Modify: `C:\Users\HP\Desktop\upsell\server.js`

- [ ] **Step 1: Add readAgents / writeAgents / requireAdmin helpers**

After the existing `writeData` function (around line 27), insert:

```js
const AGENTS_FILE = path.join(__dirname, 'agents.json');

function readAgents() {
  if (!fs.existsSync(AGENTS_FILE)) {
    const seed = { agents: [] };
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
}

function writeAgents(data) {
  fs.writeFileSync(AGENTS_FILE, JSON.stringify(data, null, 2));
}

function requireAdmin(req, res) {
  const agentId = Number(req.headers['x-agent-id']);
  const data = readAgents();
  const agent = data.agents.find(a => a.id === agentId);
  if (!agent || !agent.isAdmin) {
    res.status(403).json({ error: 'Acceso denegado' });
    return null;
  }
  return agent;
}
```

- [ ] **Step 2: Add POST /api/login**

After the `requireAdmin` function, add:

```js
// POST /api/login — verify credentials
app.post('/api/login', (req, res) => {
  const { nombre, password } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  const data = readAgents();
  const agent = data.agents.find(
    a => a.nombre.toLowerCase() === nombre.toLowerCase() && a.password === password
  );
  if (!agent) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  res.json({ id: agent.id, nombre: agent.nombre, isAdmin: agent.isAdmin });
});
```

- [ ] **Step 3: Add GET /api/agents**

```js
// GET /api/agents — list agents (admin only), passwords excluded
app.get('/api/agents', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readAgents();
  const agents = data.agents.map(({ id, nombre, isAdmin }) => ({ id, nombre, isAdmin }));
  res.json({ agents });
});
```

- [ ] **Step 4: Add POST /api/agents**

```js
// POST /api/agents — add agent (admin only)
app.post('/api/agents', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { nombre, password, isAdmin } = req.body;
  if (!nombre || !password) {
    return res.status(400).json({ error: 'Nombre y contraseña requeridos' });
  }
  const data = readAgents();
  const exists = data.agents.some(a => a.nombre.toLowerCase() === nombre.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'Ya existe un agente con ese nombre' });
  }
  const nextId = data.agents.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  const newAgent = { id: nextId, nombre, password, isAdmin: !!isAdmin };
  data.agents.push(newAgent);
  writeAgents(data);
  res.json({ agent: { id: newAgent.id, nombre: newAgent.nombre, isAdmin: newAgent.isAdmin } });
});
```

- [ ] **Step 5: Add DELETE /api/agents/:id**

```js
// DELETE /api/agents/:id — remove agent (admin only, cannot remove self)
app.delete('/api/agents/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const targetId = Number(req.params.id);
  if (targetId === admin.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }
  const data = readAgents();
  const before = data.agents.length;
  data.agents = data.agents.filter(a => a.id !== targetId);
  if (data.agents.length === before) {
    return res.status(404).json({ error: 'Agente no encontrado' });
  }
  writeAgents(data);
  res.json({ ok: true });
});
```

- [ ] **Step 6: Test all endpoints**

Start the server:
```powershell
cd C:\Users\HP\Desktop\upsell
node server.js
```

In a second terminal — test login (valid):
```powershell
curl -X POST http://localhost:4321/api/login -H "Content-Type: application/json" -d "{""nombre"":""Janio"",""password"":""admin123""}"
```
Expected: `{"id":1,"nombre":"Janio","isAdmin":true}`

Test login (invalid):
```powershell
curl -X POST http://localhost:4321/api/login -H "Content-Type: application/json" -d "{""nombre"":""Janio"",""password"":""wrong""}"
```
Expected: HTTP 401 with `{"error":"Credenciales incorrectas"}`

Test GET /api/agents (admin):
```powershell
curl http://localhost:4321/api/agents -H "X-Agent-Id: 1"
```
Expected: `{"agents":[{"id":1,"nombre":"Janio","isAdmin":true}]}`

Test GET /api/agents (non-admin):
```powershell
curl http://localhost:4321/api/agents -H "X-Agent-Id: 99"
```
Expected: HTTP 403

Test POST /api/agents (add agent):
```powershell
curl -X POST http://localhost:4321/api/agents -H "Content-Type: application/json" -H "X-Agent-Id: 1" -d "{""nombre"":""TestAgent"",""password"":""test123"",""isAdmin"":false}"
```
Expected: `{"agent":{"id":2,"nombre":"TestAgent","isAdmin":false}}`

Test DELETE /api/agents/2:
```powershell
curl -X DELETE http://localhost:4321/api/agents/2 -H "X-Agent-Id: 1"
```
Expected: `{"ok":true}`

Stop the server (Ctrl+C).

- [ ] **Step 7: Commit**

```powershell
git add server.js
git commit -m "feat: add login and agent management endpoints"
```

---

## Task 3 — Add LoginPage and session logic to index.html

**Files:**
- Modify: `C:\Users\HP\Desktop\upsell\index.html`

The session is stored in `localStorage` under key `valnet_session` as:
`{ id, nombre, isAdmin, lastActivity }` where `lastActivity` is `Date.now()`.
Timeout: 90 min = `5_400_000` ms.

- [ ] **Step 1: Add LoginPage component and session helpers**

In `index.html`, find the comment block `/* ============================================================\n       HEADER` (around line 223). Insert the following block immediately before it:

```js
    /* ============================================================
       SESSION HELPERS
    ============================================================ */
    const SESSION_KEY = 'valnet_session';
    const SESSION_TIMEOUT = 5_400_000; // 90 min in ms

    function loadSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (Date.now() - s.lastActivity > SESSION_TIMEOUT) {
          localStorage.removeItem(SESSION_KEY);
          return null;
        }
        return s;
      } catch { return null; }
    }

    function saveSession(session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, lastActivity: Date.now() }));
    }

    function touchSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        s.lastActivity = Date.now();
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } catch {}
    }

    /* ============================================================
       LOGIN PAGE
    ============================================================ */
    function LoginPage({ onLogin }) {
      const [nombre, setNombre] = useState('');
      const [password, setPassword] = useState('');
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);

      const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim(), password }),
          });
          const data = await res.json();
          if (!res.ok) { setError(data.error || 'Error al iniciar sesión'); return; }
          const session = { id: data.id, nombre: data.nombre, isAdmin: data.isAdmin };
          saveSession(session);
          onLogin(session);
        } catch {
          setError('No se pudo conectar al servidor');
        } finally {
          setLoading(false);
        }
      };

      return (
        <div className="fixed inset-0 grid place-items-center bg-slate-100">
          <div className="w-full max-w-sm">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-sky-400 text-white shadow-lg">
                <Icon.Signal className="h-7 w-7" />
              </div>
              <div className="text-xl font-extrabold tracking-tight text-slate-900">ValNet Wireless</div>
              <div className="text-sm text-slate-500">Campaña Upsell · 20→40 Mbps</div>
            </div>
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-slate-900">Iniciar sesión</h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Nombre</span>
                  <input autoFocus type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="Tu nombre de agente" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Contraseña</span>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="••••••••" />
                </label>
              </div>
              {error && <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
              <button type="submit" disabled={loading || !nombre.trim() || !password}
                className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40">
                {loading ? 'Verificando…' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      );
    }
```

- [ ] **Step 2: Add session state and activity tracking to App()**

In `App()`, after `const toastTimer = useRef(null);`, add:

```js
      const [session, setSession] = useState(() => loadSession());

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

      const handleLogout = () => {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
      };
```

- [ ] **Step 3: Guard the App render with LoginPage**

In the `return (...)` block of `App()`, add this line immediately before `<div className="min-h-screen pb-10">`:

```js
      if (!session) return <LoginPage onLogin={handleLogin} />;
```

- [ ] **Step 4: Add touchSession() to view changes**

Replace:
```js
    setVista={(v) => { setVista(v); setActiveId(null); fetchState(); }}
```
With:
```js
    setVista={(v) => { setVista(v); setActiveId(null); fetchState(); touchSession(); }}
```

- [ ] **Step 5: Verify login works**

Start the server (`node server.js`), open `http://localhost:4321`:
- Should see login page ✅
- Enter wrong password → red error message ✅
- Enter `Janio` / `admin123` → main app loads ✅
- Reload → stays logged in ✅
- DevTools → Application → Local Storage → delete `valnet_session` → reload → login page ✅

- [ ] **Step 6: Commit**

```powershell
git add index.html
git commit -m "feat: add login page and session management (90-min inactivity timeout)"
```

---

## Task 4 — TOMAR_CLIENTE reducer + Agente column in ClientList

**Files:**
- Modify: `C:\Users\HP\Desktop\upsell\index.html`

- [ ] **Step 1: Add TOMAR_CLIENTE case to reducer**

In `reducer()`, add before `default:`:

```js
        case 'TOMAR_CLIENTE': {
          const { clientId, agentId, agentNombre } = action;
          const clients = state.clients.map(c =>
            c.id === clientId ? { ...c, agentId, agentNombre } : c
          );
          return { ...state, clients };
        }
```

- [ ] **Step 2: Add onTomar handler in App()**

In `App()`, after the `const onNota = ...` line, add:

```js
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
```

- [ ] **Step 3: Pass session and onTomar to ClientList**

Replace:
```jsx
          {vista === 'lista' && <ClientList clients={state.clients} onOpen={abrirCliente} onAdd={onAdd} />}
```
With:
```jsx
          {vista === 'lista' && <ClientList clients={state.clients} onOpen={abrirCliente} onAdd={onAdd} onTomar={onTomar} session={session} />}
```

- [ ] **Step 4: Update ClientList signature**

Replace:
```js
    function ClientList({ clients, onOpen, onAdd }) {
```
With:
```js
    function ClientList({ clients, onOpen, onAdd, onTomar, session }) {
```

- [ ] **Step 5: Add "Agente" column header**

In the `<thead>` row, replace:
```jsx
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3"></th>
```
With:
```jsx
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Agente</th>
                    <th className="px-4 py-3"></th>
```

- [ ] **Step 6: Add Agente cell and Tomar button to each row**

In the `<tbody>` rows, find the last `<td>` with the "Llamar" button:
```jsx
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
                          <Icon.Phone className="h-3.5 w-3.5" /> Llamar
                        </span>
                      </td>
```
Replace with:
```jsx
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
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
                          <Icon.Phone className="h-3.5 w-3.5" /> Llamar
                        </span>
                      </td>
```

- [ ] **Step 7: Update empty state colSpan from 6 to 7**

Replace:
```jsx
                    <tr><td colSpan="6" className="px-4 py-12 text-center text-sm text-slate-400">No hay clientes que coincidan con el filtro.</td></tr>
```
With:
```jsx
                    <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-400">No hay clientes que coincidan con el filtro.</td></tr>
```

- [ ] **Step 8: Verify Tomar button works**

Open app, log in. Client list shows "Agente" column with "Tomar" buttons. Click "Tomar" → chip "Tú" appears. Reload page → chip persists. Open second browser tab, take the same client as a different identity (temporarily edit localStorage `valnet_session` nombre) → confirm dialog appears.

- [ ] **Step 9: Commit**

```powershell
git add index.html
git commit -m "feat: add TOMAR_CLIENTE action and Agente column in client list"
```

---

## Task 5 — AdminView component + Header changes

**Files:**
- Modify: `C:\Users\HP\Desktop\upsell\index.html`

- [ ] **Step 1: Add AdminView component**

Find the `/* ============================================================\n       APP PRINCIPAL` comment block. Insert the AdminView component immediately before it:

```jsx
    /* ============================================================
       ADMIN VIEW
    ============================================================ */
    function AdminView({ session }) {
      const [agents, setAgents] = useState([]);
      const [loading, setLoading] = useState(true);
      const [form, setForm] = useState({ nombre: '', password: '', isAdmin: false });
      const [formError, setFormError] = useState('');
      const [saving, setSaving] = useState(false);

      const agentHeaders = { 'Content-Type': 'application/json', 'X-Agent-Id': String(session.id) };

      const loadAgents = async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/agents', { headers: { 'X-Agent-Id': String(session.id) } });
          const data = await res.json();
          setAgents(data.agents || []);
        } catch {} finally { setLoading(false); }
      };

      useEffect(() => { loadAgents(); }, []);

      const handleAdd = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!form.nombre.trim() || !form.password.trim()) { setFormError('Nombre y contraseña requeridos'); return; }
        setSaving(true);
        try {
          const res = await fetch('/api/agents', {
            method: 'POST', headers: agentHeaders,
            body: JSON.stringify({ nombre: form.nombre.trim(), password: form.password.trim(), isAdmin: form.isAdmin }),
          });
          const data = await res.json();
          if (!res.ok) { setFormError(data.error || 'Error al agregar'); return; }
          setForm({ nombre: '', password: '', isAdmin: false });
          await loadAgents();
        } catch { setFormError('Error de red'); } finally { setSaving(false); }
      };

      const handleDelete = async (agent) => {
        if (!window.confirm(`¿Eliminar al agente "${agent.nombre}"? Esta acción no se puede deshacer.`)) return;
        try {
          await fetch(`/api/agents/${agent.id}`, { method: 'DELETE', headers: { 'X-Agent-Id': String(session.id) } });
          await loadAgents();
        } catch {}
      };

      return (
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Administración de agentes</h2>
          <p className="mb-5 text-sm text-slate-500">Agrega o elimina agentes que pueden acceder a la herramienta.</p>

          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Cargando…</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agents.map(a => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {a.nombre}{a.id === session.id && <span className="ml-2 text-xs text-slate-400">(tú)</span>}
                      </td>
                      <td className="px-4 py-3">
                        {a.isAdmin
                          ? <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">Admin</span>
                          : <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">Agente</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button disabled={a.id === session.id} onClick={() => handleDelete(a)}
                          title={a.id === session.id ? 'No puedes eliminarte a ti mismo' : ''}
                          className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr><td colSpan="3" className="px-4 py-8 text-center text-sm text-slate-400">No hay agentes.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-slate-900">Agregar agente</h3>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Nombre</span>
                  <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="Nombre del agente" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Contraseña</span>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="••••••••" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.isAdmin} onChange={e => setForm({ ...form, isAdmin: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
                Este agente es administrador
              </label>
              {formError && <p className="text-xs font-semibold text-rose-600">{formError}</p>}
              <button type="submit" disabled={saving}
                className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40">
                {saving ? 'Guardando…' : 'Agregar agente'}
              </button>
            </form>
          </div>
        </div>
      );
    }
```

- [ ] **Step 2: Update Header signature**

Replace:
```js
    function Header({ stats, vista, setVista, onExport, onReset, onImport }) {
```
With:
```js
    function Header({ stats, vista, setVista, onExport, onReset, onImport, session, onLogout, onAdmin }) {
```

- [ ] **Step 3: Add session info + Salir + Admin buttons to Header JSX**

In the Header, replace:
```jsx
            <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
              <div className="hidden items-center gap-4 rounded-xl bg-slate-50 px-4 py-1.5 ring-1 ring-slate-200 md:flex">
```
With:
```jsx
            <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
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
```

- [ ] **Step 4: Add onAdmin handler and admin view branch in App()**

In `App()`, after `const onReset = () => { ... };`, add:
```js
      const onAdmin = () => { setVista('admin'); setActiveId(null); };
```

After the `{vista === 'lista' && ...}` line, add:
```jsx
          {vista === 'admin' && session.isAdmin && <AdminView session={session} />}
```

Update the Header JSX — replace:
```jsx
          <Header stats={stats} vista={vista === 'llamada' ? 'lista' : vista}
            setVista={(v) => { setVista(v); setActiveId(null); fetchState(); touchSession(); }}
            onExport={exportarCSV} onReset={onReset} onImport={importarCSV} />
```
With:
```jsx
          <Header stats={stats} vista={vista === 'llamada' ? 'lista' : vista}
            setVista={(v) => { setVista(v); setActiveId(null); fetchState(); touchSession(); }}
            onExport={exportarCSV} onReset={onReset} onImport={importarCSV}
            session={session} onLogout={handleLogout} onAdmin={onAdmin} />
```

- [ ] **Step 5: Verify Admin view end-to-end**

Open `http://localhost:4321`, log in as `Janio`:
- Header shows "Hola, Janio", "Admin" button, "Salir" button ✅
- Click "Admin" → Admin view with agent list ✅
- Add agent "María" / "1234" / not admin → appears in list ✅
- Try to delete "Janio" → button disabled ✅
- Delete "María" → confirm → removed ✅
- Click "Salir" → login page ✅
- Log in as "María" → no Admin button ✅

- [ ] **Step 6: Commit**

```powershell
git add index.html
git commit -m "feat: add admin view and header session controls"
```

---

## Task 6 — Push and smoke test

- [ ] **Step 1: Push to GitHub**

```powershell
git push
```

- [ ] **Step 2: Full smoke test checklist**

With PM2 running (`pm2 list` shows `upsell` online):

1. `http://localhost:4321` → Login page appears ✅
2. Wrong password → red error ✅
3. `Janio` / `admin123` → app loads ✅
4. Reload → stays logged in ✅
5. Header: "Hola, Janio", Admin, Salir ✅
6. Client list: "Agente" column, Tomar buttons ✅
7. Tomar client → chip "Tú" appears ✅
8. Reload → chip persists ✅
9. Admin view → add agent "María" / "1234" ✅
10. Log out → login ✅
11. Log in as "María" → no Admin button ✅
12. "María" takes a client Janio already took → confirm dialog ✅
13. Open from PC 2 at `http://192.168.200.183:4321` → same data ✅

---

## Self-Review

**Spec coverage:**
- ✅ Login page with nombre + contraseña → Task 3
- ✅ Session persists on reload, expires after 90 min inactivity → Task 3 (loadSession + touchSession)
- ✅ agents.json with id, nombre, password, isAdmin → Task 1
- ✅ agentId + agentNombre fields on client (TOMAR_CLIENTE) → Task 4
- ✅ POST /api/login → Task 2
- ✅ GET /api/agents admin-only → Task 2
- ✅ POST /api/agents with dedup → Task 2
- ✅ DELETE /api/agents cannot delete self → Task 2
- ✅ requireAdmin with X-Agent-Id → Task 2
- ✅ Agente column: "—" / "Tú" / other name → Task 4
- ✅ Tomar: direct if null, confirm if taken → Task 4
- ✅ Admin view: list, add, delete → Task 5
- ✅ Admin button isAdmin-only → Task 5
- ✅ "Hola, [nombre]" + "Salir" in Header → Task 5
- ✅ agents.json excluded from git → Task 1

**Placeholder scan:** None found — all steps contain exact code or commands.

**Type consistency:**
- `session` shape `{ id, nombre, isAdmin, lastActivity }` — defined Task 3, used Tasks 4 & 5 ✅
- `TOMAR_CLIENTE` action `{ type, clientId, agentId, agentNombre }` — defined Task 4 Step 1, dispatched Task 4 Step 2 ✅
- `X-Agent-Id` header as string — used in requireAdmin (Task 2) and AdminView fetches (Task 5) ✅
- `SESSION_KEY = 'valnet_session'` — defined Task 3, used Tasks 3 Steps 2-3 ✅
- `SESSION_TIMEOUT = 5_400_000` — defined and used in `loadSession()` same task ✅
- `touchSession()` — defined Task 3 Step 1, called Task 3 Step 4 ✅
- `handleLogout` / `handleLogin` — defined Task 3 Step 2, passed to Header/LoginPage Task 5 Step 4 ✅
