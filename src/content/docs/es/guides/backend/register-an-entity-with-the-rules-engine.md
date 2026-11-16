---
title: Registrar una entidad en el motor de reglas
description: Declara los campos y las acciones de una entidad al arrancar, evalúa un elemento contra las reglas que redactan los administradores y, si lo necesitas, añade un operador o mueve elementos por una máquina de estados.
---

## Objetivo

Permitir que los administradores redacten tablas de decisión sobre uno de tus agregados, y ejecutarlas cuando tu propio proceso lo decida.

## Antes de empezar

- El paquete `automation` está instalado: `catalyst add automation` (requiere `identity`).
- Sabes qué atributos del elemento deben comparar las reglas y qué efectos puede disparar una regla.

## Pasos

1. **Registra la entidad al arrancar.** Inyecta `AUTOMATION_RULES_ENGINE_REGISTRAR` desde `@bridges/automation/rules-engine/index.js` en un provider que implemente `OnApplicationBootstrap`:

   ```ts
   await this.registrar.registerEntity<InvoiceItem>({
     entityType: 'Invoice',
     label: 'Facturas',
     fields: [
       { code: 'SUPPLIER', label: 'Proveedor', valueType: 'TEXT', resolve: (item) => item.supplierCode },
       {
         code: 'CHANNEL',
         label: 'Canal',
         valueType: 'OPTIONS',
         options: async ({ search, codes, limit }) => searchChannels(search, codes, limit),
         resolve: (item) => item.channel,
       },
       { code: 'LINES', label: 'Líneas', valueType: 'TEXT', isLine: true, resolve: (item) => item.lines.map((l) => l.code) },
     ],
     actions: [
       {
         code: 'FORWARD',
         label: 'Reenviar',
         parameters: [{ code: 'recipients', label: 'Destinatarios', type: 'EMAIL_LIST', required: true }],
         execute: async ({ parameters, item, options }) => {
           await forward(item.id, parameters.recipients as string[], options);
           return { forwarded: true };
         },
       },
     ],
   });
   ```

   - `valueType` es `TEXT`, `NUMBER`, `OPTIONS`, `REFERENCE` o `BOOLEAN`. `OPTIONS` y `REFERENCE` exigen un resolvedor `options`; los demás tipos no deben declararlo.
   - El `type` de un parámetro es `TEXT`, `MULTILINE_TEXT`, `NUMBER`, `OPTIONS`, `REFERENCE` o `EMAIL_LIST`. Se aplica la misma regla del resolvedor.
   - `isLine: true` significa que `resolve` devuelve un array, y una condición se cumple cuando cualquier elemento la satisface.
   - Una acción tiene éxito cuando devuelve (opcionalmente un objeto de salida) y falla cuando lanza una excepción.

   Una declaración mal formada, o registrar dos veces el mismo `entityType` en un proceso, hace fallar el arranque con un mensaje que nombra la entrada.

2. **Lee los hechos del estado persistido cuando una acción pueda cambiarlos.** Si una acción anterior de la misma evaluación puede cambiar un campo, resuélvelo desde la base de datos con las `options` que pasa el motor (`resolve: async (item, options) => ...`), no desde `item`.

3. **Evalúa cuando tu proceso lo decida.** Inyecta `AUTOMATION_RULES_ENGINE_EVALUATOR`:

   ```ts
   const result = await this.evaluator.evaluate('Invoice', invoice, repositoryOptions);
   ```

   Pasa tu transacción en `repositoryOptions` para unirte a ella; sin transacción, el motor abre la suya. La llamada lanza una excepción si `entityType` no se registró en este proceso. El resultado lista cada regla en el orden en que se ejecutó, el desenlace de cada condición (`held`, `not-held`, `error`), el estado de cada acción (`succeeded`, `failed`) y `stoppedAtRuleId`. El motor no guarda nada de esto: regístralo tú si necesitas una traza.

4. **Opcionalmente, añade un operador.** Los seis operadores integrados cubren la mayoría de los casos. Para otro, llama a `registerOperator` al arrancar con un código, una etiqueta, un `valueKind` (`NONE`, `SINGLE` o `LIST`), los `valueTypes` que acepta y una función `evaluate(fact, operand)`.

5. **Opcionalmente, adhiérete a `MOVE_TO_STATE`.** Añade `stateMachines` al registro, un enlace por campo de estado:

   ```ts
   stateMachines: [{
     field: 'stateId',
     readStateId: (item) => item.stateId,
     writeStateId: async (itemId, stateId, options) => { /* actualiza la columna con options */ },
   }],
   ```

   El consumidor sigue siendo dueño de la columna. El `field` debe ser el mismo con el que se registró la máquina. `MOVE_TO_STATE` está reservado: declarar una acción con ese código hace fallar el arranque.

6. **Redacta las reglas.** En la sección Automation del panel de administración, crea una definición para tu entidad, añade columnas de condición y de acción, y después filas. Al guardar se generan las reglas.

## Verifica que funciona

- Tras el arranque, tu entidad, sus campos, sus tipos de acción y tus operadores aparecen en las pantallas de Automation.
- Crea una definición con una fila que coincida con un elemento de prueba, llama a `evaluate` y comprueba que el resultado lista la regla con `isMatched: true` y la acción como `succeeded`.
- Añade una fila *parar aquí* por encima de otra fila que también se cumple y confirma que `stoppedAtRuleId` la nombra y que la regla posterior no aparece en el resultado.

## Solución de problemas

- **Falta un campo en el panel tras un cambio de código.** El registro se ejecuta al arrancar: reinicia el backend.
- **El resultado informa `ACTION_TYPE_NOT_REGISTERED` o `FIELD_NOT_REGISTERED`.** El catálogo conserva un código que el código en ejecución ya no registra (los códigos eliminados nunca se borran). Vuelve a registrarlo o elimina la regla que lo usa.
- **Una condición sobre un campo lee un valor obsoleto.** El campo se resuelve desde el elemento en memoria mientras una acción anterior lo cambia. Resuélvelo desde el estado persistido mediante `options`.
- **El arranque falla con "Invalid rules engine declaration".** El mensaje nombra la entidad y la entrada: un código duplicado, un resolvedor `options` ausente o inesperado, o una lista `stateMachines` vacía (omítela para no adherirte).

## Relacionado

- [Concepto: Motor de reglas](../../../concepts/backend/rules-engine/)
- [Guía: Adoptar la máquina de estados](../adopt-the-state-machine/)
