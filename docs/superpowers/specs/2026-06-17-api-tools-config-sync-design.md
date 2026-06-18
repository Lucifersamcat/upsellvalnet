# Configurador de APIs (admin) + Sync automático de clientes

**Fecha:** 2026-06-17
**Estado:** Aprobado (diseño) — pendiente plan de implementación

## Problema

La app de upsell necesita una **página de configuración de API, solo para admin**, donde se
definan "herramientas" de integración (endpoint, método, parámetros, autenticación), al estilo
de un configurador genérico ya existente en otra plataforma. El servidor debe **ejecutar esas
herramientas automáticamente** para sincronizar los clientes de MikroWisp hacia la lista de
llamadas de la campaña.

Hoy no existe nada de esto: `AdminView` solo tiene pestañas *Agentes* y *Campañas*, `server.js`
no llama a ninguna API externa, y `.env` tiene `MIKROWISP_API_URL` / `MIKROWISP_TOKEN` sin uso.

## Alcance (decidido con el usuario)

- **Configurador genérico** de herramientas API (CRUD) que replica la captura de referencia.
- El **servidor ejecuta** las herramientas (no un humano, no IA): es un proceso de sync.
- Acción del sync: **upsert por cédula** — crea clientes nuevos y actualiza existentes.
- Disparadores: **al arrancar el servidor + botón manual "Sincronizar ahora" + automático cada 24 h**.
- Filtro: **todos los clientes** de MikroWisp (sin filtrar por plan).

## Enfoque elegido (A)

UI genérica de configuración + sync por **tipo de herramienta**. La pantalla es un CRUD genérico
como la captura; cada herramienta tiene un campo `tipo`. Hoy hay un tipo funcional,
`mikrowisp-clientes`, con un handler dedicado en el servidor. Mantiene la UI flexible que se pidió,
pero el mapeo de datos es concreto y seguro (no un mapeador genérico frágil). Extensible: una
integración nueva = un handler pequeño más.

Descartados: motor 100% genérico con mapeo por configuración (sobre-ingeniería para una sola
integración real hoy) y solución solo-MikroWisp sin configurador (no cumple lo pedido).

## Modelo de datos

Nuevo archivo `apitools.json` en `DATA_DIR`, siguiendo el patrón `readJsonFile`/`writeJsonFile`:

```js
{
  tools: [
    {
      id,                          // entero autoincremental
      nombre,                      // "Buscar cliente (MikroWisp)"
      descripcion,                 // "cuándo usar esta herramienta"
      tipo: 'mikrowisp-clientes',  // selector de tipo (hoy 1 funcional)
      endpoint,                    // https://proxy.valnetrd.com/api/v1/GetClientsDetails
      metodo: 'POST',
      parametros: [ { nombre, tipo, descripcion, requerido } ],
      auth: { modo: 'none'|'bearer'|'apikey'|'body', campo, valor },
      timeoutMs,                   // ej. 15000
      cacheTtl,                    // segundos, opcional (0 = sin cache)
      activa,                      // boolean
      ultimoRun: { at, ok, creados, actualizados, sinCambios, errores, mensaje } | null
    }
  ]
}
```

**Secreto:** `auth.valor` (token) se guarda solo en el servidor y **nunca** se devuelve al cliente.
`GET /api/apitools` expone `tieneValor: boolean` en lugar de `valor`. En la UI, *"Valor (vacío =
no cambiar)"*: un `PUT` con `valor` vacío conserva el valor existente.

## Backend

Todos los endpoints son admin (`X-Auth-Token` + `requireAdmin`), igual que agentes/campañas.

- `GET    /api/apitools`         — lista herramientas, sin el secreto (`tieneValor`).
- `POST   /api/apitools`         — crea herramienta.
- `PUT    /api/apitools/:id`     — actualiza (valor vacío = conservar).
- `DELETE /api/apitools/:id`     — elimina.
- `POST   /api/apitools/:id/run` — ejecuta el sync ahora; devuelve `ultimoRun`.

### Motor de sync (`sync.js`, funciones puras y testeables)

- `buildRequest(tool)` → `{ url, method, headers, body }` aplicando el modo de auth:
  - `bearer` → header `Authorization: Bearer <valor>`
  - `apikey` → header `[campo]: <valor>`
  - `body`   → `body[campo] = valor` (combinado con `parametros`)
  - `none`   → nada
  Usa `AbortController` con `timeoutMs`.
- La respuesta viene envuelta: `{ estado: 'exito', datos: [ ...clientes ] }`. El motor valida
  `estado === 'exito'` y recorre `datos[]`.
- `mapMikrowispClient(raw)` (mapeo real, confirmado contra respuesta de producción):
  - `id`        ← `String(raw.cedula)`  *(match key; si `cedula` viene vacío, fallback `mw-<raw.id>`)*
  - `nombre`    ← `raw.nombre`
  - `telefono`  ← `raw.telefono || raw.movil || ''`
  - `direccion` ← `raw.direccion_principal || ''`
  - `inicio`    ← `raw.servicios?.[0]?.instalado || ''`  *(fecha de instalación)*
  - `plan`      ← ver "Mapeo de plan" abajo
  - `idMikrowisp` ← `raw.id`  *(id interno, guardado para futuros usos; no se muestra)*
  - **No** se mapea `raw.estado` (`"ACTIVO"` = estado de cuenta) al `estado` de llamada de la app.
- `upsertClients(data, incoming)`:
  - **Nuevo** (no existe `String(id)`): se crea con el esquema completo del reducer —
    `tier:'999'`, `estado:'pendiente'`, `notas:''`, `callbackAt:null`, `lastContact:null`,
    `recordatorio:null`, `rev:1`.
  - **Existente** (match por `String(id)` = cédula): actualiza solo datos de origen
    (`nombre`, `telefono`, `direccion`, `plan`). **Preserva** `estado`, `notas`, `recordatorio`,
    `callbackAt`, `lastContact` (trabajo del agente). Si algún dato de origen cambió, sube `rev`
    para ganar el merge de `POST /api/state` y que una copia vieja de un agente no lo pise.
  - Devuelve `{ creados, actualizados, sinCambios, errores }`.
  - Incrementa `data.version` para que el polling con ETag de `/api/state` refresque a los agentes.

### Disparadores

- **Arranque:** tras `app.listen`, ejecuta el sync de toda herramienta `activa` con
  `tipo === 'mikrowisp-clientes'`.
- **Cada 24 h:** `setInterval(24h).unref()`, mismo barrido.
- **Manual:** `POST /api/apitools/:id/run`.
- Lock en memoria (`syncing` boolean / set por id) evita runs solapados.
- Todo no-fatal: si MikroWisp falla, se captura en `ultimoRun` y el servidor sigue.

## Frontend

Nueva pestaña **"API"** en `AdminView` (solo admin), que replica la captura:

- Tabla de herramientas: nombre, estado (Activa/Inactiva), último run (ok/errores), botones
  **Editar / Eliminar / Sincronizar ahora**.
- Editor (sección o modal) con: Endpoint URL, Método, Parámetros (agregar/quitar; nombre, tipo,
  descripción, requerido), Autenticación segmentada (Sin auth / Bearer / API key header / Token en
  body) con Campo + Valor, Timeout (ms), Cache TTL (s), Estado (Activa).
- Llama a los nuevos endpoints reutilizando el patrón `agentHeaders` existente.

## Manejo de errores y seguridad

- Timeouts y errores de red capturados; respuesta con forma inválida cuenta como error.
- Secretos (`auth.valor`) nunca salen al cliente.
- Audit log en consola: `APITOOL_CREATE` / `APITOOL_UPDATE` / `APITOOL_DELETE` / `APITOOL_RUN`.

## Pruebas

`node --test` (igual que las pruebas actuales de merge), funciones puras:

- `buildRequest` — un caso por modo de auth (none/bearer/apikey/body).
- `mapMikrowispClient` — mapea una respuesta de ejemplo al esquema de cliente.
- `upsertClients` — crear nuevo / actualizar existente / **preservar `estado` y `notas`**.
- Handler de `run` con `fetch` mockeado (éxito y fallo de red).

### Mapeo de plan

MikroWisp devuelve el perfil técnico (`raw.Plan` = `"1 GB-Fibra Optica"`, `idperfil: 141`), que
**no** coincide con los planes comerciales de la app (`PLANES`: `Conectao'`, `Doméstico`, …).
**Decisión:** el `plan` se guarda **tal cual** desde MikroWisp (`raw.Plan`). Esto solo afecta el
filtro por plan de las campañas; en la lista principal (`tier:'999'`) los clientes aparecen igual.
Un mapeo perfil→`PLANES` queda como mejora posterior si se necesita.

## Estrategia de listado

La prueba fue con una cédula y devolvió 1 cliente en `datos[]`. El sync llama a `GetClientsDetails`
**sin filtro de cédula** (con los `parametros` configurados) y recorre `datos[]`. Si la respuesta
trae señales de paginación o un tope de filas, se añade un **bucle `limit`/`offset`** hasta agotar.
Se verifica con una llamada real durante la implementación; el resto del diseño no cambia.

## Pendientes a confirmar al implementar

1. **Listado completo:** confirmar con una llamada real si `GetClientsDetails` sin cédula devuelve
   todos los clientes o si pagina (y los nombres de los parámetros de paginación).
2. `fetch` global requiere Node 18+ (README declara Node 20+): OK, sin dependencias nuevas.

## Resuelto

- Mapeo de campos MikroWisp→cliente (respuesta real de producción, ver "Motor de sync").
- Plan: se guarda el valor crudo de MikroWisp (`raw.Plan`).

## No incluido (YAGNI)

- Mapeo de respuesta configurable desde la UI (enfoque B).
- Ejecución por IA / function-calling.
- Empuje de cambios *hacia* MikroWisp (solo lectura/sync de entrada).
