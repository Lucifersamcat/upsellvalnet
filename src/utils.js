    /* ============================================================
       UTILIDADES DE FECHA
    ============================================================ */
    function mesesEntre(d1, d2) {
      let m = (d2.getFullYear()-d1.getFullYear())*12 + (d2.getMonth()-d1.getMonth());
      if (d2.getDate() < d1.getDate()) m -= 1;
      return Math.max(0, m);
    }
    function antiguedad(inicioISO) {
      const m = mesesEntre(new Date(inicioISO), new Date());
      const y = Math.floor(m/12), mm = m%12;
      if (y === 0) return mm + (mm === 1 ? ' mes' : ' meses');
      if (mm === 0) return y + (y === 1 ? ' año' : ' años');
      return y + (y===1?' año':' años') + ' ' + mm + (mm===1?' mes':' meses');
    }
    function fechaCorta(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleDateString('es-DO', { day:'2-digit', month:'short', year:'numeric' });
    }
    function fechaHora(iso) {
      if (!iso) return '—';
      return new Date(iso).toLocaleString('es-DO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    }
    function esHoy(iso) {
      if (!iso) return false;
      const d = new Date(iso), h = new Date();
      return d.getFullYear()===h.getFullYear() && d.getMonth()===h.getMonth() && d.getDate()===h.getDate();
    }
    function esVencido(fechaStr) {
      if (!fechaStr) return false;
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const d = new Date(fechaStr + 'T00:00:00');
      return d <= hoy;
    }
    function fechaMasNMeses(n) {
      const d = new Date();
      d.setMonth(d.getMonth() + n);
      return d.toISOString().slice(0, 10);
    }
    function telLink(telefono) {
      const digits = telefono.replace(/\D/g,'');
      return 'tel:+1' + digits;
    }

    // Single source of truth for whether a client belongs to the active
    // campaign. Used by both the list filter and next-client navigation so the
    // two can't drift apart (which previously let "Siguiente" jump to a client
    // outside the campaign while CallPanel showed the campaign's pitch).
    function matchesCampania(cliente, campania) {
      if (!campania) return true;
      const planMatch = !campania.planActual ||
        (cliente.plan || '').toLowerCase() === campania.planActual.toLowerCase();
      const zonaMatch = !campania.filtroZona ||
        (cliente.direccion || '').toLowerCase().includes(campania.filtroZona.toLowerCase());
      return planMatch && zonaMatch;
    }

export { mesesEntre, antiguedad, fechaCorta, fechaHora, esHoy, esVencido, fechaMasNMeses, telLink, matchesCampania };
