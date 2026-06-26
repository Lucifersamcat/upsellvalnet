import { RD } from './constants';

    /* ============================================================
       GUIÓN Y OBJECIONES — UPSELL PURO
       Vender al cliente el plan próximo a su precio real
       (sin promociones ni meses gratis).
    ============================================================ */
    function makeGuion(campania) {
      const planA = campania ? campania.planActual  : "Conectao'";
      const precA = campania ? campania.precioActual : 999;
      const planN = campania ? campania.planNuevo   : 'Doméstico';
      const precN = campania ? campania.precioNuevo : 1300;
      const diff  = Math.max(0, precN - precA);
      return [
        { paso: 1, titulo: 'Apertura',
          texto: 'Buenas [tardes/noches], ¿hablo con [nombre del cliente]? Le llamo de ValNet, soy [nombre del agente]. Le llamo porque usted es uno de nuestros clientes y tengo disponible una mejora de plan que le va a rendir mucho mejor.' },
        { paso: 2, titulo: 'La oferta',
          texto: `Ahora mismo usted tiene el plan ${planA} en ${RD(precA)} al mes. Lo que le propongo es subirlo al plan ${planN}: bastante más velocidad y mejor estabilidad, por ${RD(precN)} al mes. La activación es inmediata, sin instalación ni trámites — lo dejamos listo hoy.` },
        { paso: 3, titulo: 'El valor',
          texto: `La diferencia es de apenas ${RD(diff)} más al mes y la nota en todo: videos sin pausas, videollamadas más claras y varios dispositivos conectados a la vez sin que se ponga lento. Es la mejor relación de velocidad por su dinero.` },
        { paso: 4, titulo: 'Cierre',
          texto: `¿Le parece bien que le dejemos activo el plan ${planN} hoy mismo?`,
          nota: 'Pregunta directa. Esperar respuesta sin agregar más.' },
      ];
    }

    function makeObjeciones(campania) {
      const planN = campania ? campania.planNuevo   : 'Doméstico';
      const precA = campania ? campania.precioActual : 999;
      const precN = campania ? campania.precioNuevo : 1300;
      const diff  = Math.max(0, precN - precA);
      return [
        { q: '"Estoy bien con el plan que tengo"',
          a: `Le entiendo. Muchos clientes pensaban igual y al probar ${planN} notaron la diferencia de inmediato: más velocidad para ver videos, en videollamadas y con varios equipos a la vez. Por ${RD(diff)} más al mes mejora toda la experiencia.` },
        { q: '"Está muy caro / no quiero pagar más"',
          a: `La diferencia es de solo ${RD(diff)} al mes y a cambio recibe bastante más velocidad y estabilidad. Es un aumento pequeño en el recibo por una mejora que va a usar todos los días.` },
        { q: '"No uso tanto internet / no lo necesito"',
          a: `No hace falta ser un gran usuario: con ${planN} todo carga más rápido y sin cortes, así que hasta el uso básico se siente más fluido. Y si comparte la conexión en casa, la diferencia es aún mayor.` },
        { q: '"Déjame pensarlo"',
          a: 'Claro, sin presión. Se lo puedo dejar activo hoy para que lo pruebe en su día a día. ¿Le parece que lo activemos? Si prefiere, lo llamo mañana a esta misma hora.' },
      ];
    }

export { makeGuion, makeObjeciones };
