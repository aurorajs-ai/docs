---
title: Adoptar la máquina de estados en un módulo
description: Registra una máquina al arrancar, da entrada a los elementos nuevos en el estado inicial, muévelos mediante el puerto de transición y filtra los listados por categoría de estado.
---

## Objetivo

Dar a un agregado de tu bounded context un ciclo de vida cuyos estados y transiciones pueda editar un administrador, mientras tu código sigue trabajando con unos pocos códigos de categoría estables.

## Antes de empezar

- El paquete `automation` está instalado: `catalyst add automation`. Requiere `identity` y lo instala si falta.
- Conoces el ciclo de vida del que depende tu código: qué estados debe encontrar siempre (los estados *mínimos*) y con qué categorías razona.

## Pasos

1. **Declara la columna de estado en el YAML del módulo.** Es una relación con la tabla de estados, `readOnly` para que ninguna creación o actualización genérica pueda escribirla, y sin restricción de clave foránea porque la relación cruza un bounded context.

   ```yaml
   - name: stateId
     type: id
     nullable: false
     readOnly: true
     relationship:
       type: many-to-one
       aggregateName: AutomationStateMachineState
       modulePath: automation/state-machine-state
       key: id
       field: state
       avoidConstraint: true
   ```

   Regenera el módulo con `catalyst generate`. En [Escritura de propiedades](../../../concepts/backend/property-writability/) verás qué elimina `readOnly`.

2. **Registra la máquina al arrancar.** Inyecta `AUTOMATION_STATE_MACHINE_REGISTRAR` desde `@bridges/automation/state-machine/index.js` en un provider que implemente `OnApplicationBootstrap` y llama a `register`:

   ```ts
   await this.registrar.register({
     entityType: 'Invoice',          // el nombre del agregado
     field: 'stateId',               // la columna del paso 1; siempre se declara, nunca se infiere
     label: 'Facturas',
     categories: [
       { code: 'ENTRY', label: 'Entrada', sort: 1 },
       { code: 'ERROR', label: 'Error', sort: 2 },
     ],
     minimumStates: [
       {
         code: 'RECEIVED',
         nameI18n: { en: 'Received', es: 'Recibida' },
         categoryCode: 'ENTRY',
         isInitial: true,
       },
       { code: 'FAILED', nameI18n: { en: 'Failed', es: 'Fallida' }, categoryCode: 'ERROR' },
     ],
     initialConfiguration: {
       states: [],
       transitions: [{ fromCode: 'FAILED', toCode: 'RECEIVED', isAutomatic: false }],
     },
   });
   ```

   Exactamente un estado entre `minimumStates` y `initialConfiguration.states` debe llevar `isInitial`. Una transición manual sembrada sin `roleIds` no la puede ejecutar nadie hasta que un administrador asigne roles.

3. **Da entrada a los elementos nuevos en el estado inicial.** En tu handler de creación, dentro de la transacción que escribe el elemento, inyecta `AUTOMATION_STATE_MACHINE_TRANSITIONER` y llama a `enter(entityType, field, itemId, account, repositoryOptions)`. Escribe el `id` del estado devuelto en el `stateId` del elemento.

4. **Mueve los elementos solo con `transition`.** Pasa el estado *almacenado* como origen, de modo que una petición obsoleta se rechace:

   ```ts
   const target = await this.transitioner.transition(
     'Invoice', 'stateId', itemId,
     item.stateId,      // origen: el estado almacenado
     toStateId,
     false,             // isAutomatic
     currentAccount,
     repositoryOptions, // lleva tu transacción
   );
   await this.updateByIdService.main({ id: itemId, stateId: target.id }, undefined, handlerMeta);
   ```

   La llamada escribe la fila de historial en tu transacción. Si se rechaza, no se escribe nada. Solo el código que se ejecuta dentro del proceso debe pasar `isAutomatic: true`: nunca lo leas de un payload de la API.

5. **Filtra por categoría con el Query DSL.** No existe código de filtrado específico para categorías: usa un predicado sobre la relación.

   ```ts
   where: { state: { category: { code: { in: ['ERROR'] } } } }
   ```

   Las relaciones `state` y `category` deben estar declaradas para el agregado, como en cualquier relación que se lee con el [Query DSL](../query-with-querystatement/).

## Verifica que funciona

- Arranca el backend. La máquina, sus categorías y sus estados mínimos aparecen en la sección Automation del panel de administración, y una declaración mal formada detiene el arranque con un mensaje que nombra la máquina.
- Crea un elemento: tiene el estado inicial y una fila de historial sin estado de origen.
- Ejecuta una transición manual con una cuenta que no tenga los roles del paso: se rechaza y nada cambia.

## Solución de problemas

- **El arranque falla con "Invalid state machine declaration".** El mensaje nombra la máquina y la entrada: un código duplicado, un estado con una categoría desconocida, una transición hacia un estado desconocido, o cero o varios estados iniciales.
- **Una transición se rechaza para todos los usuarios.** El paso no tiene roles (los pasos manuales se cierran por defecto) o no existe ningún paso desde el estado almacenado. Asigna roles en la pantalla de transiciones, o añade el paso.
- **Una creación o actualización genérica rechaza `stateId`.** Es la declaración `readOnly` funcionando: la columna solo se escribe mediante `enter` y `transition`.

## Relacionado

- [Concepto: Máquina de estados configurable](../../../concepts/backend/state-machine/)
- [Guía: Registrar una entidad en el motor de reglas](../register-an-entity-with-the-rules-engine/) — para mover elementos mediante reglas.
