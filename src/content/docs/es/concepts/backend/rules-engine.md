---
title: Motor de reglas
description: Cómo el paquete automation permite a los administradores redactar reglas de negocio como tablas de decisión sobre campos y acciones que un bounded context declara en código, y cómo se ejecuta una evaluación.
---

## Por qué existe

Algunos comportamientos del negocio cambian más rápido que las versiones: "cuando el proveedor es X y el canal está vacío, reenvía el documento a esta dirección y retenlo tres días". Fijar cada regla en el código supone un desarrollador y un despliegue por cada cambio.

El motor de reglas divide el problema. El bounded context consumidor declara en código qué se puede *comparar* (campos) y qué se puede *hacer* (acciones). Los administradores los combinan en reglas, en una tabla, sin desplegar. El motor no conoce ningún campo ni acción concretos: solo evalúa.

## Cómo funciona

### Qué declara el código y qué redacta el cliente

| Lo declara el consumidor al arrancar | Lo redacta el administrador |
| --- | --- |
| Una **entidad** (el agregado sobre el que versan las reglas) | **Tablas de decisión** y, a través de ellas, las reglas |
| Sus **campos**: código, etiqueta, tipo de valor, cómo leer el valor | Qué campos y operadores usa cada columna de condición |
| Sus **acciones**: código, etiqueta, parámetros tipados, el handler | Qué acciones ejecuta cada columna de acción |
| **Operadores** adicionales (los seis integrados vienen con el motor) | Valores de las filas, orden y activación |

El registro se ejecuta al arrancar, así que un cambio en una declaración surte efecto en el siguiente arranque. El registro **asegura** el catálogo: las filas se crean si faltan, nunca se borran, y las etiquetas que un administrador editó nunca se sobrescriben. Para un campo, una acción o un operador existentes solo resincroniza los metadatos que pertenecen al código (el tipo de valor y la marca de línea de un campo, los parámetros de una acción, el tipo y los tipos aceptados de un operador) cuando difieren. Un código que se elimina de la declaración permanece en el catálogo.

### El vocabulario tipado

Un campo declara un tipo de valor: `TEXT`, `NUMBER`, `OPTIONS`, `REFERENCE` o `BOOLEAN`. Los valores se guardan siempre como texto o como códigos, de modo que un campo `BOOLEAN` se compara como `'true'` o `'false'`. Los campos `OPTIONS` y `REFERENCE` declaran un resolvedor de opciones que responde pares `{ code, label }` para un texto de búsqueda o una lista de códigos, y nada más de lo que guarda el consumidor. El catálogo guarda solo los tipos, así que las pantallas de administración dibujan un control por campo sin leer código.

Un **campo de líneas** (`isLine`) se resuelve en la lista de posiciones de un documento, como las líneas de una factura. Una condición sobre él se cumple cuando *cualquier* posición la satisface.

Una acción declara parámetros tipados (`TEXT`, `MULTILINE_TEXT`, `NUMBER`, `OPTIONS`, `REFERENCE` o `EMAIL_LIST`, obligatorios o no). `BOOLEAN` es solo un tipo de campo.

Los operadores declaran cuántos operandos toman (`NONE`, `SINGLE` o `LIST`) y qué tipos de valor de campo aceptan. Los seis integrados son `EXISTS`, `NOT_EXISTS`, `EQUALS`, `NOT_EQUALS`, `IN` y `NOT_IN`. El guardado rechaza una columna de condición cuyo operador no acepta el tipo de su campo.

### Tablas de decisión

El cliente compone las reglas en una tabla, no una a una:

- Una **definición** pertenece a una entidad y tiene un nombre, una descripción opcional (solo documentación) y una posición entre las definiciones de la entidad.
- Sus **columnas** son de *condición* (un campo, un operador y una lista opcional de valores permitidos) o de *acción* (un tipo de acción).
- Cada **fila** tiene un indicador de activa, un indicador de *parar aquí* y un orden. Una celda es donde una fila se cruza con una columna: un valor para una condición, parámetros para una acción. Una celda ausente significa "cualquier valor" en una condición y "ninguna acción" en una acción.

Guardar una definición genera **una regla por fila**, con sus condiciones y acciones, de forma atómica. Los módulos generados de reglas, condiciones y acciones son de solo lectura en la API: las únicas puertas de escritura son guardar, reordenar y eliminar una definición. El panel para ello está escrito a mano, no generado.

### Una evaluación

El consumidor llama a `evaluate(entityType, item, options)` cuando su propio proceso lo decide.

1. El motor lee las reglas activas de la entidad en cada llamada. No hay caché, así que una edición se aplica en la siguiente evaluación.
2. Las reglas se procesan una a una en **prioridad** ascendente, que se deriva de la posición de la definición y después de la fila. Los empates se resuelven por orden de creación.
3. Una regla se cumple cuando se cumplen todas sus condiciones. Una regla sin condiciones se cumple siempre.
4. Si se cumple, sus acciones se ejecutan antes de evaluar la siguiente regla, de modo que una regla posterior ve los efectos persistidos de las anteriores. Los hechos leídos durante la ejecución se memorizan, y la memoria se vacía tras cada regla que ejecutó alguna acción.
5. Una regla cumplida con la marca *parar aquí* termina la evaluación después de sus propias acciones. El resultado la nombra en `stoppedAtRuleId`.

La ejecución es de una sola pasada: ninguna regla se evalúa dos veces y ninguna acción inicia una evaluación nueva. Las reglas se acumulan: todas las que se cumplen actúan, salvo que intervenga una marca de parada.

**Aislamiento de fallos.** Cada acción se ejecuta en su propio punto de guardado (savepoint) de la transacción de la evaluación. Una acción que falla se deshace sola y se informa como fallida; las demás acciones se ejecutan igualmente. Un código de campo, operador o acción que el catálogo conserva pero que el código en ejecución ya no registra produce un error explícito en el resultado, nunca un salto silencioso.

El motor no persiste ningún resultado ni guarda registro alguno. El consumidor registra el resultado devuelto si necesita una traza.

### Mover elementos por una máquina de estados

Una entidad que declara `stateMachines` se adhiere a la acción integrada `MOVE_TO_STATE`. Cada enlace nombra un `field` de estado, cómo leer el id del estado almacenado y cómo escribirlo. La acción tiene un parámetro `OPTIONS` obligatorio, `stateCode`, cuyo valor es `field:code`, de modo que una entidad con dos máquinas pueda apuntar a cualquiera. Consulta la [máquina de estados](../state-machine/).

## Cuándo aplica

- Los administradores necesitan cambiar condiciones y consecuencias sin esperar a una versión.
- La misma decisión se toma a partir de varios atributos de un elemento (proveedor, importe, canal) y las combinaciones se multiplican.
- Quieres que toda decisión automática sea explicable: el resultado lista cada regla, el desenlace de cada condición y el estado de cada acción.

## Compromisos y límites

- Un campo que una acción puede cambiar debe resolverse desde el estado persistido, usando las `options` que pasa el motor (llevan la transacción de la ejecución), no desde el elemento en memoria, que el motor nunca muta.
- Un efecto externo irreversible (un correo, una llamada a otro sistema) no debe ejecutarse dentro de una acción: un savepoint no puede deshacerlo y la transacción del consumidor aún puede revertirse. Emítelo como evento después de confirmar la transacción. Las acciones que cambian estado siguen siendo síncronas.
- No hay encadenamiento ni segunda pasada.
- El paquete requiere `identity` y se instala con `catalyst add automation`.

## Relacionado

- [Guía: Registrar una entidad en el motor de reglas](../../../guides/backend/register-an-entity-with-the-rules-engine/)
- [Máquina de estados configurable](../state-machine/)
- [Ports entre bounded contexts](../cross-bounded-context-ports/)
