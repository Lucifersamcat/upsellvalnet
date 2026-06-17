# Agregar clientes a campañas — diseño

**Fecha:** 2026-06-16
**Estado:** Aprobado

## Problema

La pertenencia de un cliente a una campaña es *derivada*, no asignada
(`matchesCampania` en `src/utils.js`): un cliente pertenece a la campaña si su
`plan` coincide con `campania.planActual` y su `direccion` contiene
`campania.filtroZona` (si la campaña define zona).

El formulario "Agregar cliente" (`src/components/ModalAgregar.jsx`) solo captura
nombre, teléfono, dirección y fecha. No captura el plan, así que el reducer
(`AGREGAR` en `src/reducer.js`) usa `"Conectao'"` por defecto. Resultado: todo
cliente agregado a mano cae siempre en `Conectao'` y nunca aparece en campañas
cuyo plan actual sea otro. De ahí "no hay forma de agregar clientes a campañas".

## Decisión

Mantener el modelo por filtro (no introducir asignación explícita por campaña).
Permitir elegir el plan al agregar el cliente.

## Cambios

1. **`src/components/ModalAgregar.jsx`**
   - Nuevo campo `plan` en el estado del formulario.
   - Selector "Plan actual del cliente" poblado desde `PLANES` (`src/constants.js`).
   - Valor por defecto = `campania.planActual` si hay campaña activa; si no,
     `"Conectao'"`.
   - El `plan` elegido se incluye en el objeto que recibe `onSave`.
   - Nueva prop `campania`.
   - Si hay campaña activa: mostrar contexto ("Se agregará a la campaña: X") y,
     si la campaña tiene `filtroZona`, una nota indicando que la dirección debe
     contener esa zona para que el cliente aparezca.

2. **`src/components/ClientList.jsx`**
   - Pasar la prop `campania` al `<ModalAgregar>`.

3. **Aviso post-agregado (`src/App.jsx`, `onAdd`)**
   - Si el cliente recién agregado no coincide con la campaña activa
     (`matchesCampania`), mostrar un toast de aviso explicando por qué no se ve
     en la lista filtrada.

## Fuera de alcance

Servidor, modelo de datos persistido, y demás pantallas no cambian. El reducer
ya respeta `cliente.plan`, así que no requiere cambios.
