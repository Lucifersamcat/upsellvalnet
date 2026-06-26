import { NOW } from './constants';

    /* ============================================================
       REDUCER
    ============================================================ */
    function init() {
      return { clients: [], log: [], deletedIds: [] };
    }

    // Bump a client's revision so the server's per-client merge keeps the
    // most recently edited copy (see POST /api/state). Stale copies held by
    // other agents carry a lower rev and lose, preventing silent clobbering.
    const bump = (c, changes) => ({ ...c, ...changes, rev: (c.rev || 0) + 1 });

    function reducer(state, action) {
      switch (action.type) {
        case 'RESULTADO': {
          const { id, resultado, callbackAt } = action;
          const at = NOW();
          const clients = state.clients.map(c => c.id === id
            ? bump(c, { estado: resultado, lastContact: at, callbackAt: resultado === 'callback' ? (callbackAt || null) : null })
            : c);
          const cli = state.clients.find(c => c.id === id);
          const log = [{ id, nombre: cli ? cli.nombre : '', resultado, at }, ...state.log];
          return { ...state, clients, log };
        }
        case 'NOTA': {
          const clients = state.clients.map(c => c.id === action.id ? bump(c, { notas: action.notas }) : c);
          return { ...state, clients };
        }
        case 'ACTUALIZAR_DATOS': {
          // Refresco desde MikroWisp: parcha solo campos de origen y preserva el
          // trabajo del agente (estado, notas, recordatorio…) y el id. Sube `rev`
          // para ganar el merge del servidor. Si nada cambió, devuelve el mismo
          // estado para no disparar un guardado innecesario.
          const { id, datos } = action;
          const SOURCE = ['nombre', 'telefono', 'direccion', 'inicio', 'plan', 'idMikrowisp'];
          let changedAny = false;
          const clients = state.clients.map(c => {
            if (c.id !== id) return c;
            const changes = {};
            for (const f of SOURCE) {
              if (datos[f] !== undefined && datos[f] !== '' && datos[f] !== c[f]) changes[f] = datos[f];
            }
            if (!Object.keys(changes).length) return c;
            changedAny = true;
            return bump(c, changes);
          });
          return changedAny ? { ...state, clients } : state;
        }
        case 'AGREGAR': {
          // Ignore non-numeric ids (e.g. cédula strings from CSV import) so a
          // mixed list doesn't poison Math.max into NaN.
          const nextId = state.clients.reduce((m,c)=>Math.max(m, Number(c.id) || 0), 0) + 1;
          const nuevo = {
            id: nextId, ...action.cliente, tier: '999',
            plan: action.cliente.plan || "Conectao'",
            estado:'pendiente', notas:'', callbackAt:null, lastContact:null,
            recordatorio: null, rev: 1,
          };
          return { ...state, clients: [...state.clients, nuevo] };
        }
        case 'RESET':
          return { clients: [], log: [], deletedIds: [] };
        case 'LOAD':
          return {
            clients: action.payload?.clients ?? [],
            log: action.payload?.log ?? [],
            deletedIds: [],
          };
        case 'LIMPIAR': {
          const clients = state.clients.map(c => bump(c, { estado:'pendiente', notas:'', callbackAt:null, lastContact:null, recordatorio:null }));
          return { clients, log: [], deletedIds: [] };
        }
        case 'TOMAR_CLIENTE': {
          const { clientId, agentId, agentNombre } = action;
          const clients = state.clients.map(c =>
            c.id === clientId ? bump(c, { agentId, agentNombre }) : c
          );
          return { ...state, clients };
        }
        case 'ELIMINAR_CLIENTE':
          return {
            ...state,
            clients: state.clients.filter(c => c.id !== action.id),
            deletedIds: [...(state.deletedIds || []), action.id],
          };
        case 'REVERTIR_ESTADO': {
          const clients = state.clients.map(c =>
            c.id === action.id ? bump(c, { estado: 'pendiente', callbackAt: null, lastContact: null }) : c
          );
          return { ...state, clients };
        }
        case 'SET_RECORDATORIO': {
          const { id, fecha, nota } = action;
          const clients = state.clients.map(c =>
            c.id === id ? bump(c, { recordatorio: { fecha, nota } }) : c
          );
          return { ...state, clients };
        }
        case 'CLEAR_RECORDATORIO': {
          const clients = state.clients.map(c =>
            c.id === action.id ? bump(c, { recordatorio: null }) : c
          );
          return { ...state, clients };
        }
        default:
          return state;
      }
    }

export { init, reducer };
