import { RD } from './constants';

    /* ============================================================
       GUIÓN Y OBJECIONES
    ============================================================ */
    function makeGuion(campania) {
      const planA = campania ? campania.planActual : "Conectao'";
      const planN = campania ? campania.planNuevo  : 'Doméstico';
      const promo  = campania ? RD(campania.precioPromo) : RD(999);
      const precN  = campania ? RD(campania.precioNuevo) : RD(1300);
      const meses  = campania ? campania.mesesPromo : 3;
      return [
        { paso: 1, titulo: 'Apertura',
          texto: 'Buenas [tardes/noches], ¿hablo con [nombre del cliente]? Le llamo de ValNet, soy [nombre del agente]. Le llamo porque usted es uno de nuestros clientes y tenemos una promoción exclusiva para usted — no le va a costar nada adicional.' },
        { paso: 2, titulo: 'La oferta',
          texto: `Queremos subirle el plan de ${planA} a ${planN} — más velocidad — y usted sigue pagando los mismos ${promo} durante los próximos ${meses} meses. No hay instalación, no hay trámite, lo activamos hoy mismo.` },
        { paso: 3, titulo: `Transparencia mes ${meses + 1}`,
          texto: `A partir del mes ${meses + 1}, el plan ${planN} queda en ${precN}. Pero si en ese momento usted prefiere regresar al plan anterior, sin problema — usted decide. Lo importante es que pruebe la diferencia sin riesgo.` },
        { paso: 4, titulo: 'Cierre',
          texto: '¿Le parece bien que lo activemos ahora mismo?',
          nota: 'Pregunta directa. Esperar respuesta sin agregar más.' },
      ];
    }

    const OBJECIONES = [
      { q: '"¿Y después me van a cobrar más sin avisarme?"', a: 'No — le vamos a enviar un mensaje avisándole un mes antes de que termine la promoción para que usted decida. Sin sorpresas.' },
      { q: '"Ahora mismo no necesito más velocidad"', a: 'Entiendo, pero como es sin costo y sin cambiar nada de su contrato, no pierde nada probándolo. Si no nota diferencia, igual puede quedarse como está al mes 4.' },
      { q: '"Déjame pensarlo"', a: 'Claro, no hay presión. ¿Le puedo llamar mañana a esta misma hora? La oferta está disponible esta semana solamente.' },
    ];

export { makeGuion, OBJECIONES };
