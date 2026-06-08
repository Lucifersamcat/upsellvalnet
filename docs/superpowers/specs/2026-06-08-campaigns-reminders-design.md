# Campaigns & Reminders Design Spec

**Date:** 2026-06-08  
**Status:** Approved

---

## Goal

Replace hardcoded campaign constants with a multi-profile campaign system. Admins create campaign profiles (plan pairs, promo pricing, geographic filters). Agents select the active campaign, which filters the client list. Converted clients automatically receive a follow-up reminder at promo end, and a dashboard badge surfaces overdue reminders.

---

## Architecture

- `campaigns.json` — new server-side file, same pattern as `agents.json`
- No schema change to `data.json` clients except adding an optional `recordatorio` field
- Filtering happens 100% on the frontend — server returns all tier-999 clients as today
- Active campaign stored in `localStorage` per agent (independent per session)
- Hardcoded constants `PLAN_ACTUAL`, `PLAN_NUEVO`, `PRECIO_PROMO`, `MESES_PROMO`, `UPLIFT` are removed; replaced by the active campaign object

---

## Data Models

### `campaigns.json`

```json
{
  "campaigns": [
    {
      "id": 1,
      "nombre": "Upsell Conectao' → Doméstico",
      "planActual": "Conectao'",
      "planNuevo": "Doméstico",
      "precioActual": 999,
      "precioNuevo": 1300,
      "precioPromo": 999,
      "mesesPromo": 3,
      "filtroZona": null
    }
  ]
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Auto-increment |
| `nombre` | string | Display name |
| `planActual` | string | Client's current plan name (must match CSV import value) |
| `planNuevo` | string | Target upsell plan name |
| `precioActual` | number | Current plan monthly price (RD$) |
| `precioNuevo` | number | New plan monthly price (RD$) |
| `precioPromo` | number | Promotional price for first N months |
| `mesesPromo` | number | Duration of promo in months |
| `filtroZona` | string\|null | Zone to filter by; `null` means all zones |

### Available Plans (canonical names + prices)

| Nombre | Velocidad | Precio mensual |
|--------|-----------|----------------|
| Conectao' | 20/20 Mbps | RD$999 |
| Doméstico | 40/40 Mbps | RD$1,300 |
| Estudio | 80/80 Mbps | RD$1,630 |
| Emprende | 100/100 Mbps | RD$1,899 |
| Cinemática | 150/150 Mbps | RD$2,550 |
| Negocio | 250/250 Mbps | RD$2,999 |
| Gamer | 350/350 Mbps | RD$3,499 |
| Galáctico | 500/500 Mbps | RD$3,800 |

### Client `recordatorio` field (added to `data.json` clients)

```json
{
  "recordatorio": {
    "fecha": "2026-09-08",
    "nota": "Verificar si mantiene plan Doméstico"
  }
}
```

`recordatorio: null` (or absent) means no reminder set.

### `localStorage` session update

```json
{
  "id": 1,
  "nombre": "Janio",
  "isAdmin": true,
  "lastActivity": 1234567890,
  "campaniaId": 2
}
```

`campaniaId: null` means no active campaign (show all clients).

---

## Backend API

### New file: `campaigns.json`

Server creates it on first start with empty seed `{ "campaigns": [] }` if missing. Same pattern as `agents.json`.

### New endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/campaigns` | All agents | Returns full campaigns list |
| `POST` | `/api/campaigns` | Admin only | Create campaign; auto-increments `id`; deduplicates by `nombre` |
| `PUT` | `/api/campaigns/:id` | Admin only | Update all fields of a campaign |
| `DELETE` | `/api/campaigns/:id` | Admin only | Delete campaign by id |

### No new endpoints for reminders

Reminders are stored on the client object via the existing `POST /api/state`. The reducer handles `SET_RECORDATORIO` and `CLEAR_RECORDATORIO` actions which update `client.recordatorio`, then the normal state sync persists them.

---

## Frontend

### Constants removed

`PLAN_ACTUAL`, `PLAN_NUEVO`, `PRECIO_PROMO`, `MESES_PROMO`, `UPLIFT` are deleted. Replaced by a `PLANES` lookup array used to populate campaign form dropdowns.

```js
const PLANES = [
  { nombre: "Conectao'",   precio: 999 },
  { nombre: "Doméstico",   precio: 1300 },
  { nombre: "Estudio",     precio: 1630 },
  { nombre: "Emprende",    precio: 1899 },
  { nombre: "Cinemática",  precio: 2550 },
  { nombre: "Negocio",     precio: 2999 },
  { nombre: "Gamer",       precio: 3499 },
  { nombre: "Galáctico",   precio: 3800 },
];
```

### Campaign selector (Header)

- Dropdown in the header: `"Campaña: [nombre] ▾"` or `"Sin campaña"` if none selected
- Populated from `/api/campaigns` fetched on login
- Selecting a campaign saves `campaniaId` to the `localStorage` session
- Changing campaign re-filters the client list immediately

### Client list filtering

When `campaniaId` is set, the displayed client list is filtered:
1. `client.plan === campania.planActual` (case-insensitive match on plan name)
2. If `campania.filtroZona !== null`: `client.zona === campania.filtroZona`

When no campaign is active, all tier-999 clients are shown (current behavior).

### Call panel

The call panel receives the active `campania` object as a prop instead of reading hardcoded constants. All pricing display (`precioActual`, `precioNuevo`, `precioPromo`, `mesesPromo`, uplift calculation) is derived from the campaign object.

If no campaign is active, the call panel shows client info without plan promotion details.

### Reducer — new actions

```js
case 'SET_RECORDATORIO': {
  // action: { id, fecha, nota }
  return {
    ...state,
    clients: state.clients.map(c =>
      c.id === action.id
        ? { ...c, recordatorio: { fecha: action.fecha, nota: action.nota } }
        : c
    )
  };
}
case 'CLEAR_RECORDATORIO': {
  // action: { id }
  return {
    ...state,
    clients: state.clients.map(c =>
      c.id === action.id ? { ...c, recordatorio: null } : c
    )
  };
}
```

### Reminder auto-suggestion on "Convertido"

When an agent registers `convertido` and there is an active campaign with `mesesPromo > 0`:
- An inline confirmation appears in the call panel pre-filled with:
  - **Fecha:** `today + mesesPromo months` (ISO date string `YYYY-MM-DD`)
  - **Nota:** `"Verificar si mantiene plan [planNuevo]"`
- Agent can confirm, edit the date/note, or skip
- On confirm: dispatches `SET_RECORDATORIO`

### Reminder badge (Header)

- Count of clients where `recordatorio.fecha <= today`
- Shown as a red numeric badge on a 🔔 icon in the header
- Clicking the badge activates the "Recordatorios" filter view in the client list

### Reminders section (ClientList)

- A collapsible "Recordatorios pendientes" section above the main table
- Shows only clients with `recordatorio.fecha <= today`
- Columns: Nombre | Plan | Fecha | Nota | Llamar | Limpiar
- "Limpiar" dispatches `CLEAR_RECORDATORIO`
- A 🔔 icon in each client row in the main table indicates a pending or upcoming reminder

### "Promos" admin tab (AdminView)

New tab alongside "Agentes":
- Table: Nombre | Plan actual → Plan nuevo | Precio promo | Meses | Zona | Acciones
- "Nueva campaña" button opens an inline form:
  - Nombre (text input)
  - Plan actual (dropdown from `PLANES`)
  - Plan nuevo (dropdown from `PLANES`, different from planActual)
  - Precio promo (number input, pre-filled with `planActual.precio` on plan selection)
  - Meses promo (number input)
  - Filtro zona (text input, optional — blank = todas las zonas)
- Edit (pencil icon) and Delete (×) per row
- Delete confirmation: `"¿Eliminar campaña '[nombre]'?"`

---

## Error Handling

- If a campaign is deleted while an agent has it active, the selector falls back to "Sin campaña" gracefully (campaign not found in list → `campaniaId` cleared from session).
- `planActual` and `planNuevo` dropdowns prevent selecting the same plan for both.
- `precioPromo` auto-fills with `planActual.precio` when plan is selected (user can override).

---

## What Does NOT Change

- Client data structure (except the new optional `recordatorio` field)
- `POST /api/state` — unchanged; persists whatever client fields it receives
- Agent assignment (`TOMAR_CLIENTE`) — unchanged
- CSV import — unchanged (plan name from CSV must match `PLANES` names for filtering to work)
- Auth / session / inactivity timeout — unchanged
