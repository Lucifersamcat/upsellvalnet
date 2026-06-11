import { NOW } from './constants';

    /* ============================================================
       REDUCER
    ============================================================ */
    function init() {
      return { clients: [], log: [] };
    }

    function reducer(state, action) {
      switch (action.type) {
        case 'RESULTADO': {
          const { id, resultado, callbackAt } = action;
          const at = NOW();
          const clients = state.clients.map(c => c.id === id
            ? { ...c, estado: resultado, lastContact: at, callbackAt: resultado === 'callback' ? (callbackAt || null) : null }
            : c);
          const cli = state.clients.find(c => c.id === id);
          const log = [{ id, nombre: cli ? cli.nombre : '', resultado, at }, ...state.log];
          return { ...state, clients, log };
        }
        case 'NOTA': {
          const clients = state.clients.map(c => c.id === action.id ? { ...c, notas: action.notas } : c);
          return { ...state, clients };
        }
        case 'AGREGAR': {
          const nextId = state.clients.reduce((m,c)=>Math.max(m,c.id),0) + 1;
          const nuevo = {
            id: nextId, ...action.cliente, tier: '999',
            plan: action.cliente.plan || "Conectao'",
            estado:'pendiente', notas:'', callbackAt:null, lastContact:null,
            recordatorio: null,
          };
          return { ...state, clients: [...state.clients, nuevo] };
        }
        case 'RESET':
          return { clients: [], log: [] };
        case 'LOAD':
          return {
            clients: action.payload?.clients ?? [],
            log: action.payload?.log ?? [],
          };
        case 'LIMPIAR': {
          const clients = state.clients.map(c => ({ ...c, estado:'pendiente', notas:'', callbackAt:null, lastContact:null, recordatorio:null }));
          return { clients, log: [] };
        }
        case 'TOMAR_CLIENTE': {
          const { clientId, agentId, agentNombre } = action;
          const clients = state.clients.map(c =>
            c.id === clientId ? { ...c, agentId, agentNombre } : c
          );
          return { ...state, clients };
        }
        case 'ELIMINAR_CLIENTE':
          return { ...state, clients: state.clients.filter(c => c.id !== action.id) };
        case 'REVERTIR_ESTADO': {
          const clients = state.clients.map(c =>
            c.id === action.id ? { ...c, estado: 'pendiente', callbackAt: null, lastContact: null } : c
          );
          return { ...state, clients };
        }
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
        default:
          return state;
      }
    }

export { init, reducer };
