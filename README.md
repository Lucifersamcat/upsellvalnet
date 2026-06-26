# ValNet Wireless — Campaña Upsell 

Herramienta interna para gestionar la campaña de llamadas a clientes con promoción.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Tailwind CSS 3, Vite 5 |
| Backend | Express 5, Node.js 20+ |
| Auth | Tokens de 32 bytes, sesiones en memoria (TTL 90 min) |
| Contraseñas | bcrypt (salt rounds = 10), migración automática de texto plano |

## Desarrollo local

```bash
npm install

# Terminal 1 — API en :4321
node server.js

# Terminal 2 — Vite dev server en :5173 (proxy /api → :4321)
npm run dev
```

## Producción

```bash
npm install
npm run build   # genera dist/
npm start       # node server.js — sirve dist/ + API en el mismo puerto
```

Copiar `.env.example` a `.env` y ajustar variables antes de iniciar:

```
PORT=4321
DATA_DIR=/ruta/a/datos   # opcional; por defecto usa el directorio del proyecto
```

## Funcionalidades

- **Lista de clientes** — filtros por estado, búsqueda, orden por antigüedad, paginación (50/página)
- **Panel de llamada** — guión paso a paso, manejo de objeciones, registro de resultado
- **Recordatorios** — crear/editar/eliminar desde la lista o el panel de llamada; badge de vencidos en el header
- **Dashboard** — conversiones, tasa, ingreso adicional proyectado, llamadas del día
- **Campañas** — múltiples campañas con planes, precios y filtro de zona (admin)
- **Gestión de agentes** — crear, eliminar, asignar rol admin (admin)
- **Importar clientes** — CSV bulk via `/api/import` (admin) — forma principal de cargar la cartera
- **Exportar resultados** — CSV con todos los campos
- **Refrescar desde MikroWisp** — botón en el panel de llamada que consulta la API de MikroWisp por cédula (`/api/mikrowisp/lookup`) y actualiza nombre, teléfono, dirección y plan del cliente, preservando estado/notas/recordatorio. El token de MikroWisp solo permite **lookup puntual** (un cliente por consulta), no listar toda la cartera; por eso la carga masiva se hace por CSV. Requiere `MIKROWISP_API_URL` + `MIKROWISP_TOKEN` en `.env` (si faltan, el botón no aparece).

## Seguridad

- Cabeceras HTTP: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`
- Rate limiting en login: 5 intentos fallidos / 15 min por IP
- Audit log en consola: LOGIN, LOGOUT, AGENT_CREATE, AGENT_DELETE, IMPORT, MIKROWISP_LOOKUP
- El token de MikroWisp vive solo en el servidor (`.env`); nunca se envía al navegador
- Datos sensibles (`data.json`, `agents.json`, `campaigns.json`) en `.gitignore`

## Estructura

```
src/
├── main.jsx                  # Entrada Vite
├── App.jsx                   # Componente raíz, estado global
├── constants.js              # Planes, estados, utilidades de formato
├── reducer.js                # Estado de clientes y log
├── session.js                # Persistencia de sesión en localStorage
├── utils.js / icons.jsx / guion.js
└── components/
    ├── LoginPage, Header, Toast, Badge
    ├── ClientList, Dashboard, CallPanel
    ├── AdminView, ModalAgregar
    └── ErrorBoundary         # Captura errores de render
server.js                     # API Express + servicio de dist/
mikrowisp.js                  # Lookup puntual de cliente por cédula (funciones puras + fetch)
```

## CI

GitHub Actions ejecuta `npm ci && npm run build` en cada push y PR a `main`.
