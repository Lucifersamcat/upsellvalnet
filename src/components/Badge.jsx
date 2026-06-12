import { ESTADOS } from '../constants';

    /* ============================================================
       COMPONENTES PEQUEÑOS
    ============================================================ */
    function Badge({ estado }) {
      const e = ESTADOS[estado] || ESTADOS.pendiente;
      return (
        <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ' + e.chip}>
          <span className={'h-1.5 w-1.5 rounded-full ' + e.dot}></span>{e.label}
        </span>
      );
    }

export { Badge };
