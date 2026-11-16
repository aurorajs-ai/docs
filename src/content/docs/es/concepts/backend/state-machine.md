---
title: Máquina de estados configurable
description: Cómo el paquete automation da a un bounded context un ciclo de vida editable, con estados y transiciones que los administradores cambian sin desplegar, y qué sigue siendo responsabilidad del consumidor en código.
---

## Por qué existe

Muchos agregados tienen un ciclo de vida: una factura se recibe, queda lista, se envía, falla, se archiva. Fijar los estados en un enum congela ese ciclo dentro de la versión. Cada estado nuevo, y cada cambio sobre quién puede mover un elemento de un estado a otro, exige entonces un despliegue.

La máquina de estados del paquete `automation` traslada el ciclo de vida a tablas que edita un administrador. El bounded context consumidor conserva solo lo que su propio código necesita, y la máquina responde una pregunta: "¿está permitido este paso para este llamante?", y deja constancia de la respuesta.

## Cómo funciona

Existe una **máquina** por entidad consumidora y campo de estado. Se identifica por `entityType` (el nombre del agregado) más `field` (la columna que guarda el estado, por ejemplo `stateId`). Una entidad puede tener varias máquinas, una por campo, y una transición en una nunca afecta a otra.

Cada máquina es dueña de cuatro tipos de filas:

| Filas | Quién las escribe |
| --- | --- |
| **Categorías** | El consumidor, al arrancar. Una categoría es un código con el que razona el propio código del consumidor (`ERROR`, `ARCHIVED`). El administrador solo edita su etiqueta y su orden. |
| **Estados** | Un estado tiene código, nombre por idioma, color, orden y categoría. Los estados que el consumidor declara como *mínimos* se crean en cada arranque y no se pueden borrar. El resto pertenece al administrador. |
| **Transiciones** | Un paso de un estado a otro, automático o manual. Un paso manual lista los roles que pueden ejecutarlo. |
| **Historial** | Una fila de solo añadir por cada entrada y cada transición. Solo se exponen lecturas. |

Exactamente un estado de la máquina es el inicial. Una transición entre dos estados existe solo si hay una fila que la declare: a un estado al que no apunta ninguna fila no se puede llegar.

### Registro al arrancar

El consumidor llama una vez por máquina al puerto registrador, durante el arranque de la aplicación, con un `AutomationStateMachineDeclaration`: el tipo de entidad, el campo, una etiqueta, las categorías, los estados mínimos y, opcionalmente, una `initialConfiguration` con estados y transiciones adicionales.

- La máquina, cada categoría y cada estado mínimo se **aseguran** en cada arranque: se crean si faltan y nunca se actualizan después. Una etiqueta o un nombre que el administrador editó sobrevive.
- `initialConfiguration` se **siembra una sola vez**, en el arranque que crea la máquina. Desde entonces pertenece al cliente.
- La declaración se valida antes de escribir nada. Una declaración mal formada (códigos duplicados, un estado que apunta a una categoría desconocida, cero o varios estados iniciales, una transición hacia un estado desconocido) hace fallar el arranque y nombra la máquina y la entrada culpable.

### Mover un elemento

Dos puertos hacen el trabajo, y ambos se ejecutan dentro de la transacción del consumidor:

- `enter` coloca un elemento nuevo en el estado inicial de la máquina y escribe una fila de historial sin estado de origen.
- `transition` recibe como origen el estado *almacenado* del elemento, más el estado destino y si el movimiento es automático. Rechaza la llamada, sin escribir nada, cuando no existe ese paso, o cuando un paso manual lo ejecuta una cuenta que no tiene ninguno de sus roles. Un paso sin roles no lo puede ejecutar nadie. Una transición automática ignora los roles y no registra cuenta.

Como el consumidor pasa su estado almacenado como origen, una petición obsoleta se rechaza sin esfuerzo: un reintento en cola para un elemento que ya se envió no encuentra ningún paso de "enviado" a "listo".

Un tercer puerto, el lector, resuelve un estado por código (`findStateByCode`), de modo que el consumidor pueda usar su propio vocabulario.

## Cuándo aplica

- Un agregado tiene un ciclo de vida que el negocio quiere ajustar sin esperar a una versión.
- Quién puede mover un elemento entre dos estados depende del rol del usuario.
- Necesitas un rastro de auditoría de cada cambio de estado.

## Compromisos y límites

- El contrato del consumidor es estricto. La columna de estado es una relación con la tabla de estados declarada `readOnly: true`, así que ninguna creación o actualización genérica puede escribirla. El consumidor la fija solo mediante `enter` y `transition`, en la misma transacción que la fila de historial.
- Un paso de doble sentido son dos filas, una por dirección.
- Un cliente no puede crear ni borrar máquinas ni categorías: ambas vienen del código.
- La máquina no cuenta reintentos, no programa trabajo ni envía avisos. Eso sigue en el consumidor.
- El paquete requiere `identity` (los roles vienen de IAM) y se instala con `catalyst add automation`.

## Relacionado

- [Guía: Adoptar la máquina de estados](../../../guides/backend/adopt-the-state-machine/)
- [Motor de reglas](../rules-engine/) — su acción integrada `MOVE_TO_STATE` mueve un elemento por una máquina.
- [Ports entre bounded contexts](../cross-bounded-context-ports/) — por qué el consumidor inyecta tokens en lugar de importar `automation`.
