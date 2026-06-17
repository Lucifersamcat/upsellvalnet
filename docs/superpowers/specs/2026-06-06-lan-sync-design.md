# Diseño: Sincronización LAN — ValNet Upsell Tool

**Fecha:** 2026-06-06
**Estado:** Aprobado

---

## Contexto

La herramienta de upsell actualmente es un SPA de archivo único (`index.html`) que guarda
estado en `localStorage`. Tres PCs en la misma red local necesitan compartir ese estado en
tiempo real, con cero configuración adicional para los agentes.

**Restricciones clave:**
- La PC servidor siempre está encendida (aunque con Windows lock)
- Los agentes coordinan verbalmente — no se requiere lock de clientes
- La red LAN no debe saturarse de requests
- Node.js v24 ya está instalado en la PC servidor

---

## Arquitectura

```
[ PC Servidor ]
  └── Node.js + Express  (puerto 4321)
        ├── GET  /          → sirve index.html
        ├── GET  /api/state → clientes tier $999 + log de llamadas (con ETag)
        ├── POST /api/state → guarda cambios, incrementa versión
        └── POST /api/import → importa clientes desde CSV

[ data.json ]  ← todos los clientes (4 000+), filtrado servidor-side
[ PC 2 ]  →  http://[IP-servidor]:4321
[ PC 3 ]  →  http://[IP-servidor]:4321
```

El servidor es la única fuente de verdad. `localStorage` se elimina por completo del cliente.

---

## Estructura de datos

### `data.json`
```json
{
  "version": 1,
  "clients": [...],
  "log": [...]
}
```

- `version`: entero que se incrementa con cada `POST /api/state`
- `clients`: array con todos los clientes de todos los tiers
- `log`: historial de llamadas

### Campo `tier` en cada cliente
Se agrega el campo `tier` (string) para filtrar por plan actual.
Valor para el flujo de upsell actual: `"999"`.

---

## API

### `GET /api/state`
- Filtra `clients` donde `tier === "999"` antes de responder
- Calcula ETag como `"v{version}"` (ej: `"v42"`)
- Si el request incluye `If-None-Match: "v42"` y la versión coincide → `304 Not Modified`
- Si hay cambios → `200` con JSON `{ version, clients, log }`

### `POST /api/state`
- Body: `{ clients, log }` (solo el tier $999)
- Servidor hace merge: reemplaza los clientes del tier $999 en `data.json`, preserva otros tiers
- Incrementa `version`
- Responde `{ version }`

### `POST /api/import`
- Body: array de objetos cliente (desde CSV parseado en el frontend)
- Agrega nuevos clientes a `data.json` sin sobrescribir los existentes (deduplicación por `id`)
- Responde `{ added, skipped }`

---

## Cliente (index.html)

### Reemplazo de localStorage
- Al montar la app: `GET /api/state` para cargar estado inicial
- Se elimina toda referencia a `localStorage` y `STORAGE_KEY`

### Sincronización en navegación
- Cada vez que el usuario cambia de vista (Dashboard → Lista → Panel de llamada),
  se dispara `GET /api/state` con el ETag de la versión local
- Si `304`: no se hace nada (UI sin cambios)
- Si `200`: se actualiza el estado de React con los datos nuevos

### Guardado inmediato
- Cada acción que muta el estado (registrar resultado, guardar nota, agregar cliente)
  dispara `POST /api/state` con el estado completo del tier $999

### Importar CSV
- Nuevo botón en la UI (header o modal)
- El navegador parsea el CSV localmente
- Se envía a `POST /api/import`
- Se recarga el estado tras la importación

### Índice en memoria
- El reducer de React mantiene un `Map` de clientes por ID para lookups O(1)
- El array de clientes se deriva del Map para renderizado

---

## Rendimiento

| Métrica | Estimado |
|---|---|
| Clientes tier $999 | ~800 |
| Tamaño JSON tier $999 | ~200–250 KB |
| Fetch en navegación sin cambios | `304` — 0 bytes de datos |
| Fetch en navegación con cambios | `200` — ~250 KB |

Con ETag, la mayoría de los cambios de vista serán `304`. La red solo trabaja cuando
hay una modificación real.

---

## Auto-inicio con Windows (PM2)

1. Instalar PM2 globalmente: `npm install -g pm2`
2. Registrar el servidor: `pm2 start server.js --name upsell`
3. Guardar lista de procesos: `pm2 save`
4. Registrar como tarea de inicio de Windows: `pm2 startup`

El servidor arranca automáticamente al encender la PC, antes de que cualquier usuario
haga login.

---

## Archivos a crear / modificar

| Archivo | Acción | Descripción |
|---|---|---|
| `server.js` | Crear | Servidor Express con los 3 endpoints |
| `package.json` | Crear | `{ "dependencies": { "express": "^5" } }` |
| `data.json` | Crear | Estado inicial generado desde `seedData()` |
| `index.html` | Modificar | localStorage → fetch API; ETag; re-fetch en nav; CSV import |

---

## Fuera de alcance (este ciclo)

- Integración directa con API de MikroWisp
- Autenticación / control de acceso por agente
- Historial de versiones / rollback del estado
- Soporte multi-tier simultáneo en la UI
