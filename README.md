# ValNet Wireless — Campaña Upsell 40/40

Herramienta interna para gestionar la campaña de llamadas que sube a los clientes del plan 20/20 ($999) al plan 40/40, con promoción de 3 meses al mismo precio.

## Arquitectura

- **Frontend:** React 18 + Tailwind CSS 3, construido con Vite 5
- **Backend:** Express 5, Node.js — sirve la SPA y expone `/api/*`
- **Auth:** tokens de 32 bytes aleatorios (`X-Auth-Token`), sesiones en memoria con TTL de 90 min
- **Contraseñas:** bcrypt con salt rounds = 10; migración automática de contraseñas en texto plano al primer login

## Desarrollo

```bash
npm install
npm run dev        # Vite dev server en :5173, proxy /api → :4321
node server.js     # API en :4321 (en otra terminal)
```

## Producción

```bash
npm install
npm run build      # genera dist/
npm start          # node server.js — sirve dist/ + API en el mismo puerto
```

La variable de entorno `PORT` (por defecto 4321) controla el puerto del servidor.
Copiar `.env.example` a `.env` y ajustar si es necesario.

## Módulos

- Lista de clientes con filtros, búsqueda y orden por antigüedad
- Panel de llamada con guión paso a paso y manejo de objeciones
- Dashboard de campaña con ingreso adicional proyectado
- Vista de administración: importar clientes CSV, gestionar agentes y campañas
- Exportar resultados a CSV
