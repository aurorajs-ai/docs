---
title: Escritura de propiedades
description: Cómo los flags readOnly y createOnly de una propiedad del YAML de módulo deciden quién puede escribir un valor, en el formulario generado, en los contratos de la API y en el pipeline de escritura en tiempo de ejecución.
---

## Por qué existe

Hay valores que no le corresponde fijar al cliente. Un `status` de ciclo de vida arranca en `PENDING` por un valor por defecto de la columna y, después, solo lo mueven flujos del backend. Un código de referencia externo lo elige el cliente una vez, al crear, y no debe cambiar nunca. Antes de estos flags, las únicas herramientas eran borrar el control del formulario generado (lo que deja atrás su validador y mantiene el formulario inválido) o escribir a mano una guarda en cada handler.

Ocultar un campo en la interfaz tampoco protege. Un DTO en este backend es un tipo que solo existe en compilación y no tiene efecto en ejecución: una propiedad que no está en el DTO de creación llega igualmente al repositorio si un cliente la envía. El contrato hay que hacerlo cumplir donde entra el payload, no solo dibujarlo en pantalla.

Aurora convierte la intención en una declaración sobre la propiedad. El generador emite el contrato de cada superficie a partir de ella y el pipeline de escritura en ejecución rechaza lo que el contrato no permite.

## Los tres estados de escritura

| Estado | Quién aporta el valor | Se declara como |
| --- | --- | --- |
| Normal | El cliente, al crear y en cada actualización | sin flag |
| `createOnly` | El cliente, solo al crear. Después queda congelado | `createOnly: true` |
| `readOnly` | Nunca el cliente: un valor por defecto de la columna, un trigger de base de datos o un flujo interno del backend | `readOnly: true` |

`readOnly` y `createOnly` son mutuamente excluyentes en una propiedad. Declarar ambos hace que `catalyst generate` falle antes de escribir nada.

Una columna autoincremental como `rowId` la asigna la base de datos, así que el generador también la marca `readOnly` en el field schema. Un payload de escritura que la incluya se rechaza.

## Cómo funciona

Una declaración, tres capas.

**El formulario.** Una propiedad `readOnly` no tiene control, ni entrada en el modelo, ni validador, de modo que nada puede dejar el formulario inválido por un valor que el usuario no puede escribir. Una propiedad `createOnly` es un control normal en modo `new`. En modo `edit` se muestra deshabilitada y se deja fuera del payload guardado.

**Los contratos de la API.** Una propiedad `readOnly` no aparece en los inputs de creación ni de actualización (tipos input de GraphQL y DTOs REST). Una propiedad `createOnly` está en la creación y no está en los inputs de actualización. La lectura no cambia: los tipos de salida, las columnas de listado y los fragmentos llevan ambos tipos como siempre, y ninguno de los flags enmascara el valor (el enmascarado es lo que hacen `secret`, `password` y `encrypted`).

**El pipeline de escritura en ejecución.** El field schema generado lleva el flag, y `sanitizeRecord` (al que se llega mediante `@ApplySchema` y `@Sanitize`) rechaza un payload que nombre la clave:

- `readOnly`: se rechaza en cualquier operación.
- `createOnly`: se rechaza solo en `update`; en `create` se acepta.

El rechazo es un `400` HTTP que nombra el campo, por ejemplo `positions[1].code`, y ocurre antes de validar el valor, así que un valor inválido en un campo bloqueado informa del bloqueo y no de un error de tipo. Una clave ausente del payload no se toca, y eso es lo que permite que un create omita un campo `readOnly` y deje actuar el valor por defecto de la base de datos. Un `null` explícito cuenta como presente y se rechaza.

Los decoradores necesitan saber qué escritura protegen. Para eso existe la opción obligatoria `operation: 'create' | 'update'`, descrita en [Decoradores de field-schema](../../../guides/backend/apply-field-schema-decorators/).

### Por qué rechazar en lugar de descartar la clave

GraphQL ya rechaza un campo de input desconocido, así que una propiedad bloqueada ni siquiera se puede enviar por ahí. Si REST la descartara en silencio, REST seguiría siendo permisivo mientras GraphQL es estricto, y el cliente creería que la escritura se hizo. Rechazar con un `400` hace que ambos transportes digan lo mismo.

### Lo que el backend sí puede escribir

La frontera es el handler, no el agregado. Una escritura que el backend hace a través de un servicio generado no pasa por `@ApplySchema` ni por `@Sanitize`, así que el código de ciclo de vida puede seguir fijando un campo `readOnly`, por ejemplo un handler `provision` que avanza el `status`. No decores un servicio para que sea «consistente»: cada escritura interna en cascada fallaría entonces con el mismo `400` que recibe un cliente.

Para esa escritura interna el generador emite tipos de payload en `<bc>-<module>.payload-types.ts` (solo en agregados con propiedades `readOnly`). Son el input público más las propiedades `readOnly` como miembros opcionales, de modo que el servicio las escribe en una sola operación y el contrato público nunca las anuncia.

## Cuándo aplica

- Un valor calculado por la base de datos o por un flujo del backend: un estado, un contador, una instantánea desnormalizada como `dTenants` en una cuenta.
- Un identificador que el cliente elige al crear el registro, como el padre de un registro hijo, y que no se mueve nunca.
- Un formulario que muestra un campo que el usuario no puede editar: declara `readOnly`, no borres el control generado.

## Compromisos y límites

- **`createOnly` es incondicional.** El valor queda congelado desde que el registro existe, sin comprobar ningún estado. «Inmutable cuando el registro está ACTIVE» es lógica escrita a mano en un handler, no un flag.
- **Un bloqueo meramente visual no es un flag.** Un control que parece inactivo mientras la API sigue aceptando el valor es cuestión de `widget`. `createOnly` cambia el contrato de red: la clave desaparece del input de actualización.
- **Algunas combinaciones fallan al generar, a propósito.** `createOnly` se rechaza en una clave primaria, en una propiedad `autoIncrement`, en una propiedad `isI18n` y en una relación de navegación (una clave foránea many-to-one sí se permite: el cliente elige el padre una vez). `readOnly` con `isI18n` se rechaza con la estrategia embedded y se acepta con `i18nStrategy: table`. Cada error nombra el archivo y la propiedad.
- **`createOnly` exige excluir `upsert`.** El `upsert` generado recibe el input de actualización, que ya no lleva el campo. Añade `upsert` a `excludedOperations` o quita el flag. Consulta [Excluir APIs](../../../guides/backend/exclude-generated-apis/).
- **Un handler de escritura manual elige su propia `operation`.** Un handler que usa un servicio generado fuera del cableado del generador, como uno sobre `updateAndIncrement`, debe pasar `operation: 'update'` él mismo en un agregado con propiedades `createOnly`. Si la omites, no compila.
- **`readonly` es un alias obsoleto.** El cargador aún lo acepta, lo normaliza a `readOnly` y avisa una vez por propiedad. Declarar ambas grafías en una propiedad es un error.
- **Tres guardas manuales anteriores se mantienen.** `iam/account`, `hub/app` y las definiciones de campos personalizados de `tools` congelan campos a mano con sus propios códigos de error. `createOnly` es el mecanismo para campos nuevos; esas guardas no se migran.

## Relacionado

- [Claves del YAML de módulo](../../../reference/module-yaml/) — las declaraciones exactas y sus errores al cargar.
- [Decoradores de field-schema](../../../guides/backend/apply-field-schema-decorators/) — `@ApplySchema`, `@Sanitize` y la opción `operation`.
- [Configurar un módulo frontend](../../../guides/frontend/configure-a-frontend-module/) — cómo trata el formulario generado cada estado.
- [Scaffolding de un módulo](../module-scaffolding/) — de dónde sale el field schema.
