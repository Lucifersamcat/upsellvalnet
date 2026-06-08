# Diseño: Login y Asignación de Agentes — ValNet Upsell Tool

**Fecha:** 2026-06-08
**Estado:** Aprobado

---

## Contexto

La herramienta ya sincroniza estado entre 3 PCs vía servidor Node.js/Express. Se requiere:
1. Identificar qué agente está en cada PC (login con nombre + contraseña)
2. Registrar qué agente está trabajando cada cliente (campo `agentId` + botón "Tomar")
3. Pantalla de administración para gestionar agentes (solo admin)

---

## Estructura de datos

### `agents.json` (nuevo archivo, separado de `data.json`)
```json
{
  "agents": [
    { "id": 1, "nombre": "Admin", "password": "admin123", "isAdmin": true },
    { "id": 2, "nombre": "Agente1", "password": "pass1", "isAdmin": false }
  ]
}
```
- `isAdmin: true` da acceso a la pantalla de administración
- Las contraseñas se almacenan en texto plano (seguridad mínima acordada)
- El primer agente admin se crea manualmente editando el archivo antes del primer arranque

### Campo nuevo en cada cliente (`data.json`)
```json
{ "id": 1, "nombre": "...", "tier": "999", "agentId": 2, "agentNombre": "Agente1" }
```
- `agentId: null` — sin agente asignado
- `agentId: 2` — tomado por el agente con id 2
- `agentNombre` — nombre del agente en el momento de asignación (desnormalizado para mostrar sin lookup)

### Sesión en `localStorage` — clave `valnet_session`
```json
{ "id": 2, "nombre": "Agente1", "isAdmin": false, "lastActivity": 1749123456789 }
```
- `lastActivity`: timestamp en ms (`Date.now()`)
- Expira si `Date.now() - lastActivity > 5400000` (90 minutos = 90 × 60 × 1000)
- Se renueva en cada click del documento y en cada cambio de vista
- Se elimina al cerrar sesión manualmente

---

## API — Endpoints nuevos en `server.js`

### `POST /api/login`
- Body: `{ nombre, password }`
- Busca en `agents.json` por nombre (case-insensitive) y contraseña exacta
- Éxito `200`: `{ id, nombre, isAdmin }`
- Error `401`: `{ error: "Credenciales incorrectas" }`

### `GET /api/agents`
- Header requerido: `X-Agent-Id: <id>`
- Verifica que el agente existe y tiene `isAdmin: true`
- Éxito `200`: `{ agents: [{ id, nombre, isAdmin }] }` — sin campo `password`
- Error `403` si no es admin

### `POST /api/agents`
- Header requerido: `X-Agent-Id: <id>` (admin)
- Body: `{ nombre, password, isAdmin }`
- Valida que el nombre no exista ya (case-insensitive)
- Asigna `id` auto-incremental
- Error `400` si nombre duplicado
- Responde `{ agent: { id, nombre, isAdmin } }` sin campo `password`

### `DELETE /api/agents/:id`
- Header requerido: `X-Agent-Id: <id>` (admin)
- No permite eliminar el agente cuyo id coincide con `X-Agent-Id`
- Responde `{ ok: true }`
- Error `400` si intenta eliminarse a sí mismo

### Helper `requireAdmin(req, res)`
```js
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

### Endpoints existentes sin cambios
`GET /api/state`, `POST /api/state`, `POST /api/import` — el campo `agentId` y `agentNombre` viajan dentro del array `clients` como cualquier otro campo.

---

## UI — `index.html`

### Componente `LoginPage`
- Se muestra cuando no hay sesión válida (ausente o expirada)
- Reemplaza toda la app hasta que el usuario autentique
- Campos: `nombre` (text, autofocus) + `password` (password) + botón "Entrar"
- Estado de carga en el botón mientras espera la respuesta del servidor
- Mensaje de error en rojo si las credenciales son incorrectas
- Al éxito: guarda sesión en `localStorage`, continúa carga normal de la app

### Lógica de sesión en `App()`
```
Al montar:
  1. Leer valnet_session de localStorage
  2. Si existe y (Date.now() - lastActivity) < 5400000 → restaurar sesión
  3. Si no → mostrar LoginPage

En cada click del documento (addEventListener) y cambio de vista:
  → actualizar lastActivity en localStorage

Cerrar sesión:
  → eliminar valnet_session de localStorage
  → mostrar LoginPage
```

### Reducer — acción nueva `TOMAR_CLIENTE`
```js
case 'TOMAR_CLIENTE': {
  const { clientId, agentId, agentNombre } = action;
  const clients = state.clients.map(c =>
    c.id === clientId ? { ...c, agentId, agentNombre } : c
  );
  return { ...state, clients };
}
```

### Header — cambios
- Texto "Hola, [nombre]" junto al título
- Botón "Cerrar sesión" (pequeño, extremo derecho)
- Botón "Admin" visible solo si `session.isAdmin === true`
- Al hacer click en "Admin" → cambia `vista` a `'admin'`

### Lista de clientes — columna "Agente" y botón "Tomar"
- Nueva columna **"Agente"** en cada fila:
  - `agentId === null` → "—"
  - `agentId === session.id` → chip verde "Tú"
  - `agentId` es otro → nombre del agente (`agentNombre`)
- Botón **"Tomar"** en cada fila:
  - `agentId === null` → asigna directamente, dispatch TOMAR_CLIENTE + postState
  - `agentId === session.id` → botón deshabilitado ("Tuyo")
  - `agentId` es otro → modal de confirmación: *"Este cliente ya lo tiene [agentNombre]. ¿Deseas tomarlo?"* → confirmar o cancelar

### Vista `admin` (nueva)
- Solo accesible si `session.isAdmin === true` (verificado en el render)
- Lista de agentes: nombre, badge "Admin" si aplica
- Formulario "Agregar agente": nombre + contraseña + checkbox "Es admin" + botón Guardar
- Botón "Eliminar" por agente:
  - Deshabilitado con tooltip si es el agente actualmente logueado
  - Activo para los demás, con `window.confirm` antes de eliminar
- Llama a `GET /api/agents` con header `X-Agent-Id` al cargar la vista

---

## Flujos clave

### Login exitoso
```
POST /api/login → 200
→ localStorage.setItem('valnet_session', JSON.stringify({ id, nombre, isAdmin, lastActivity: Date.now() }))
→ fetchState()
→ App renderiza normalmente
```

### Tomar cliente sin agente previo
```
Click "Tomar" → agentId === null
→ dispatch({ type: 'TOMAR_CLIENTE', clientId, agentId: session.id, agentNombre: session.nombre })
→ postState(state)
→ Toast "Cliente asignado a ti"
```

### Tomar cliente ya asignado a otro
```
Click "Tomar" → agentId !== null && agentId !== session.id
→ window.confirm("Este cliente ya lo tiene [agentNombre]. ¿Deseas tomarlo?")
→ Si confirma: dispatch TOMAR_CLIENTE → postState
→ Si cancela: no hace nada
```

### Expiración de sesión (al recargar)
```
Date.now() - session.lastActivity > 5400000
→ localStorage.removeItem('valnet_session')
→ mostrar LoginPage
```

---

## Archivos modificados / creados

| Archivo | Acción | Descripción |
|---|---|---|
| `agents.json` | Crear | Agentes iniciales — el admin edita manualmente antes del primer arranque |
| `server.js` | Modificar | Agregar `readAgents`, `writeAgents`, `requireAdmin`, 4 endpoints nuevos |
| `index.html` | Modificar | LoginPage, lógica de sesión, acción TOMAR_CLIENTE, columna Agente, botón Tomar, vista Admin, cambios en Header |

---

## Fuera de alcance

- Contraseñas hasheadas (bcrypt, etc.) — seguridad mínima acordada
- Tokens JWT o sesiones server-side
- Recuperación de contraseñas
- Historial de asignaciones (quién tomó qué y cuándo)
- Roles más allá de admin / agente
