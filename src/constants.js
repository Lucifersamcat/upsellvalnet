    /* ============================================================
       CONSTANTES DE NEGOCIO
    ============================================================ */
    const PLANES = [
      { nombre: "Conectao'",  precio: 999  },
      { nombre: 'Doméstico',  precio: 1300 },
      { nombre: 'Estudio',    precio: 1630 },
      { nombre: 'Emprende',   precio: 1899 },
      { nombre: 'Cinemática', precio: 2550 },
      { nombre: 'Negocio',    precio: 2999 },
      { nombre: 'Gamer',      precio: 3499 },
      { nombre: 'Galáctico',  precio: 3800 },
    ];

    // Returns the PLANES entry for the given plan name (case-insensitive), or null
    function planInfo(nombre) {
      if (!nombre) return null;
      return PLANES.find(p => p.nombre.toLowerCase() === nombre.toLowerCase()) || null;
    }

    const RD = (n) => 'RD$' + Number(n).toLocaleString('es-DO');

    /* ============================================================
       ESTADOS DE CLIENTE
    ============================================================ */
    const ESTADOS = {
      pendiente:     { label: 'Pendiente',     chip: 'bg-slate-100 text-slate-700 ring-slate-200',  dot: 'bg-slate-400' },
      llamado:       { label: 'Llamado',       chip: 'bg-sky-100 text-sky-800 ring-sky-200',        dot: 'bg-sky-500' },
      convertido:    { label: 'Convertido',    chip: 'bg-emerald-100 text-emerald-800 ring-emerald-200', dot: 'bg-emerald-500' },
      no_interesado: { label: 'No interesado', chip: 'bg-rose-100 text-rose-800 ring-rose-200',      dot: 'bg-rose-500' },
      callback:      { label: 'Callback',      chip: 'bg-amber-100 text-amber-900 ring-amber-200',   dot: 'bg-amber-500' },
    };
    const ORDEN_ESTADOS = ['pendiente','llamado','convertido','no_interesado','callback'];

    /* ============================================================
       DATOS INICIALES (editables) — clientes del plan $999
    ============================================================ */
    const NOW = () => new Date().toISOString();

export { PLANES, planInfo, RD, ESTADOS, ORDEN_ESTADOS, NOW };
