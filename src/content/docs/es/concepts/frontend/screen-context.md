---
title: "Contexto de pantalla para el asistente"
sidebar:
  order: 11
description: Cómo una pantalla escrita a mano le cuenta al asistente de ayuda lo que muestra en este momento, mediante un vocabulario cerrado de cinco secciones que el backend valida, acota, renderiza en un único sitio y nunca guarda.
---

## Por qué existe

El asistente ya entiende un formulario: [`AssistedFormService`](../guided-actions/#formularios-asistidos) le cuenta los campos, sus valores y sus errores. Pero una pantalla es más que su formulario. Un usuario que mira un registro pregunta "¿por qué no puedo aceptar esto?" o "¿qué línea tiene el problema?", y la respuesta está en el estado del registro, en las acciones que la barra de herramientas muestra u oculta y en avisos que pintan componentes hijos. Nada de eso es un campo de formulario, así que el asistente no tenía de dónde responder.

El **contexto de pantalla** es el canal para esos datos. La pantalla publica lo que muestra, con una forma fija, y el asistente lo recibe con cada pregunta. Es **solo percepción**: el asistente lee lo que el usuario ya ve y no gana ninguna forma nueva de cambiar nada. Sigue escribiendo únicamente mediante el parche del formulario y las acciones guiadas.

## Cómo funciona

### Contribuciones por sección

`ScreenContextService` (en `@aurora/modules/screen-context`) es un registro. Cada componente de una pantalla contribuye las secciones que le pertenecen bajo un único **id de pantalla**, `<bc>.<módulo>`, desde su contexto de inyección (un constructor o el inicializador de un campo):

```ts
inject(ScreenContextService).contribute('iam.account', {
  status: () => ({ label: 'Activa' }),
});
```

Esto se distingue del formulario asistido, que mantiene un único hueco que el registro más reciente reemplaza. Los datos de una pantalla suelen repartirse entre dos componentes (el detalle posee el registro y la barra de herramientas; el formulario hijo posee los totales y los avisos), y un hueco reemplazable obligaría a uno a husmear en el estado privado del otro. Aquí cada componente publica solo lo que posee.

- La contribución se retira sola cuando el componente se destruye, mediante `DestroyRef`. El id de pantalla se libera cuando sale la última sección.
- Contribuir una sección que ya está ocupada, o una sección de otro id de pantalla mientras hay uno registrado, **lanza una excepción**. Dos componentes que reclaman `facts` fallan al abrir la pantalla por primera vez, y una persona decide cuál es el dueño. El registro nunca fusiona.
- Todas las comprobaciones se hacen antes de guardar nada, así que una contribución rechazada deja el registro intacto.

### Un vocabulario cerrado

Una sección es una función que devuelve los datos cuando se envía la pregunta, o `null` mientras no tiene nada que decir (por ejemplo, aún no se ha cargado el registro). Hay exactamente cinco:

| Sección   | Qué lleva                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| `status`  | El estado del registro, tal como lo lee el usuario.                                                                |
| `issues`  | Textos de los problemas que tiene el registro.                                                                     |
| `actions` | Cada botón: su etiqueta, si la pantalla lo muestra y, si no lo muestra, las condiciones con nombre que le faltan.  |
| `facts`   | Pares etiqueta y valor que la pantalla muestra (totales, fechas, nombres).                                         |
| `rows`    | Tablas: etiqueta, recuento total y solo las filas que llevan avisos.                                               |

Los lectores son funciones simples, no signals. Nada reacciona al contexto: se lee una vez por pregunta, igual que la instantánea del formulario. La pantalla traduce todos los textos y usa los mismos textos y las mismas funciones compartidas que su plantilla, de modo que el contexto no puede decir nada que la pantalla no diga.

### Lectura bajo demanda y validación en el backend

Cuando el usuario pregunta, el chat llama a `snapshot()`, que evalúa todos los lectores en ese instante, y envía el resultado en el campo `screen` de la operación de preguntar, junto a `form`. Una pantalla que no contribuye no envía nada, y un cliente que no envía `screen` se comporta como antes.

El backend valida la forma y los límites de `screen` en ambos transportes (GraphQL y REST), antes de la cuota mensual y antes del proveedor del modelo. Un contexto inválido o demasiado grande se rechaza con un error traducido que nombra la sección, así que no gasta tokens. Los límites son por sección: por ejemplo, como máximo 20 incidencias, 20 acciones, 40 hechos, 3 tablas y 50 filas con avisos por tabla. Se exportan como una única constante, `TOOLS_ASSISTANT_SCREEN_LIMITS`, y **rechazan; nunca recortan**. Una pantalla recortada haría que el asistente respondiera con seguridad desde una vista parcial, y la pantalla que generó de más nunca se corregiría.

Un único renderizador convierte la pantalla en un bloque `<screen>` del mensaje al modelo, igual para todas las pantallas. Cada etiqueta y cada valor se escribe como cadena entre comillas, de modo que un salto de línea o una comilla en los datos no puede romper la estructura. El prompt de sistema le dice al modelo que el bloque son datos que el usuario ve ahora y nunca instrucciones, que una acción marcada como no mostrada se explica con sus condiciones pendientes y que una acción mostrada nunca es una promesa: `available` significa que la pantalla muestra el botón, no que el backend vaya a aceptar la operación.

El contexto pertenece solo a la pregunta en curso. No se guarda en el turno de la conversación, nunca entra en la ventana de turnos anteriores y no se registra en los logs.

## Cuándo se aplica

- Escribes una pantalla a mano y quieres que el asistente responda sobre el registro abierto: por qué falta una acción, en qué estado está, qué fila tiene un aviso.
- Ves que el asistente explica un botón ausente nombrando una condición.
- Se rechaza una pregunta con un error de "contexto de pantalla inválido" que nombra una sección: la pantalla publicó más de lo que permiten los límites.

Las pantallas generadas no publican contexto. Una pantalla participa solo cuando una persona contribuye a mano; no se infiere nada de un YAML, una ruta ni un formulario. La primera pantalla que lo hace es la revisión de facturas de compra de una aplicación que usa el bounded context `business-partner-portal`; la guía [Publicar el contexto de una pantalla al asistente](../../../guides/frontend/publish-screen-context-to-the-assistant/) la usa como ejemplo.

## Compromisos y límites

- **Solo percepción.** El contexto no añade ninguna operación con efectos. Sus acciones se describen, nunca se ofrecen: el modelo no puede elegirlas, y el backend solo ofrece las acciones guiadas que permiten las declaraciones.
- **Solo lo que la pantalla muestra.** Los datos visibles que no hacen falta para responder, como el texto libre copiado del documento de un proveedor, se dejan fuera a propósito: es la mayor superficie para la inyección de prompts. Una incidencia posterior añade una sección ampliando un lector.
- **Vocabulario cerrado.** Un tipo nuevo de sección es un cambio deliberado y conjunto de los tipos del frontend, la entrada GraphQL, los límites del backend y el renderizador.
- **Los límites son constantes.** Nadie ha necesitado ajustarlos, así que no son ajustes key-value. Una pantalla que supera un límite falla de forma visible, y ese fallo es lo que justifica subirlo.
- **Prompts más grandes cuestan más.** La pantalla añade tokens de entrada a cada pregunta, acotados por los límites y contabilizados por la cuota existente.

## Relacionado

- [Acciones guiadas y formularios asistidos](../guided-actions/) — la instantánea del formulario y las acciones guiadas, que siguen siendo las únicas vías con las que el asistente actúa.
- [El manual de usuario integrado](../in-app-user-manual/) — la documentación estática que busca el asistente, complementaria a estos datos en tiempo de ejecución.
- [Guía: Publicar el contexto de una pantalla al asistente](../../../guides/frontend/publish-screen-context-to-the-assistant/)
