---
title: "Acciones guiadas y formularios asistidos"
sidebar:
  order: 10
description: Cómo el asistente de ayuda y la paleta de comandos llevan al usuario a una pantalla o a un formulario de alta, cómo `prefill` y `detailMode` configuran ese recorrido y qué permite `hasAssistant` dentro de un formulario abierto.
---

## Por qué existe

Un usuario que pregunta al asistente de ayuda "¿cómo creo una cuenta de servicio?" recibe una respuesta en texto y después tiene que buscar la pantalla, pulsar Crear y elegir el tipo a mano. El asistente puede acortar ese recorrido, pero con límites estrictos: nunca debe actuar por su cuenta y nunca debe inventarse una pantalla que no existe.

Dos mecanismos fijan esos límites. Una **acción guiada** es un botón que el asistente (o la paleta de comandos) ofrece para llevar al usuario a un sitio. Un **formulario asistido** es un formulario que le cuenta al asistente qué contiene, para que pueda explicarlo y preseleccionar campos de opciones fijas. Ambos son declarativos: el framework no ofrece nada que el proyecto no haya declarado.

## Cómo funciona

### Acciones guiadas

Cada bounded context declara sus acciones en `cliter/<bc>/actions.yaml`, un fichero por bounded context. Vive junto a `<module>.module.yaml` (el modelo de datos) y `processes.yaml` (los procesos de negocio), y se compila con el [manual de usuario integrado](../in-app-user-manual/) en el índice del manual.

```yaml
- id: create-account
  route: /iam/account
  kind: create
  tourId: iam.account
  label: { es: Crear una cuenta, en: Create an account }
```

- `kind: open` lleva al usuario a la pantalla de `route`.
- `kind: create` lo lleva al formulario de alta del módulo de `route`.
- El permiso de la ruta condiciona la acción: quien no puede ver la pantalla no recibe el botón.
- Una pantalla sin declaración no ofrece nada. No se infiere nada.

Una acción declarada aparece en dos sitios: como botón en la respuesta del asistente y en la paleta de comandos (grupos "Acciones" y "En esta pantalla").

Al ejecutar `catalyst generate front module`, el CLI añade al final de este fichero la acción `create` del módulo si el bounded context tiene manual. Solo añade, nunca reescribe, así que tus entradas se conservan. La etiqueta generada es provisional; ajústala a las palabras de la pantalla.

### `detailMode` en una acción create

Una acción `create` no llega al formulario de la misma manera en todos los módulos. La compilación lee `front.detailMode` del YAML del módulo y lo escribe en la acción:

| `detailMode`      | Dónde vive el formulario              | Qué hace el ejecutor                                                    |
| ----------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `view` (defecto)  | En su propia página, `<route>/new`    | Navega directamente a `<route>/new`; el listado nunca se pinta.         |
| `dialog`          | En un diálogo sobre el listado        | Navega al listado y activa su control de crear.                         |

Sin declaración, la compilación escribe `view`, el mismo valor por defecto del generador. Nunca escribes `detailMode` en `actions.yaml`: una clave `detailMode` ahí hace fallar la compilación. El campo no existe en las acciones `open` ni en rutas sin YAML de módulo, y el ejecutor trata un valor ausente como `dialog` (primero el listado, después el control de crear). Para los dos shells en sí, consulta [Detail mode](../detail-mode/).

### `prefill` en una acción create

La compilación escribe también `prefill`: una lista de `{ field, options }`, una entrada por cada campo que el asistente puede rellenar en el formulario de alta, con los valores que acepta. Se calcula a partir del YAML del módulo:

- Solo los módulos que declaran `hasAssistant: true` generan entradas.
- Solo cualifican las propiedades `enum` (con sus `enumOptions`, en orden de declaración) y `boolean` (`true`, `false`).
- Se excluyen las propiedades `readOnly` y las que declaran `hasAssistant: false`.
- Queda vacío en las acciones `open`, en módulos sin la marca y en rutas sin YAML de módulo.

El asistente recibe las opciones junto con la acción porque, cuando propone el recorrido, todavía no hay ningún formulario abierto. Cuando el usuario pulsa el botón, el ejecutor abre el formulario (según `detailMode`) y después aplica el prefill.

### Formularios asistidos

Un módulo que declara `hasAssistant: true` genera un `*-form.component.ts` que se registra en `AssistedFormService`. El registro lista un descriptor por cada campo pintado: su tipo, su clave de etiqueta y, en un enum o un booleano, sus opciones. Solo hay un formulario registrado a la vez, y se da de baja cuando el formulario se destruye.

Mientras hay un formulario abierto, cada pregunta al asistente lleva una foto del formulario: etiquetas, valores, errores y qué obligatorios están vacíos. Con ella, el asistente puede explicar cualquier campo y, cuando el usuario se lo pide, preseleccionar un campo de opciones fijas. El chat anuncia lo escrito y resalta el campo.

### Enmascarar un campo

Una propiedad con `hasAssistant: false` se registra como enmascarada: la foto lleva su estado (obligatorio, vacío, errores) pero nunca su valor ni sus opciones, y el asistente no puede escribirla. Las propiedades `password` y `encrypted` están enmascaradas se declare lo que se declare.

Úsalo cuando un valor no deba llegar al asistente o cuando el usuario no pueda ver lo que el asistente cambia. Por ejemplo, un interruptor que solo se muestra con más de un tenant no debería concederse en silencio.

### Acceso y coste

El asistente pertenece al paquete `tools`, así que una aplicación sin él no tiene asistente. Tres cosas lo condicionan:

- **Un interruptor general.** El ajuste clave-valor `tools.assistant.isEnabled` viene vacío, lo que mantiene el asistente apagado hasta que un administrador lo activa.
- **Un permiso.** Preguntar requiere `tools.assistant.ask`, concedido a los roles en IAM como cualquier otro permiso. No hay una lista aparte de roles permitidos.
- **Un presupuesto.** Un administrador fija cuántos tokens puede gastar cada rol al mes, y el ajuste `tools.assistant.monthlyTokenCap` puede añadir un tope global para todas las cuentas. Una pregunta más larga que `tools.assistant.maxQuestionLength` (2000 caracteres por defecto) se rechaza antes de que cueste nada.

El asistente guarda cada turno de conversación para que un revisor dedicado pueda leerlo. Leerlos requiere el permiso aparte `tools.assistantConversation.get`. Una purga diaria borra los turnos anteriores a `tools.assistant.conversationRetentionDays`, que viene en 90.

## Cuándo aplica

- Un usuario pregunta al asistente cómo hacer algo y recibe un botón que lo lleva allí.
- Ves una entrada `create` añadida a `actions.yaml` tras generar un módulo frontend.
- Añades `hasAssistant: true` a un módulo y el asistente empieza a explicar su formulario y a preseleccionar sus campos de opciones fijas.
- Un formulario escrito a mano participa en el asistente solo porque lo has registrado tú.

## Compromisos y límites

- **El asistente nunca guarda.** Navega, abre el formulario de alta y rellena campos de opciones fijas. El usuario revisa el formulario y pulsa Guardar.
- **Nunca escribe texto ni relaciones.** Solo se escribe una opción exacta de un campo `enum` o `boolean` sin enmascarar. Los campos de texto y de relación reciben el foco del teclado.
- **Solo ofrece lo declarado.** No hay descubrimiento de pantallas ni inferencia de acciones desde el modelo. La marca `hasAssistant` es por módulo: en un padre no dice nada de sus hijos.
- **Los formularios excluidos del codegen no se registran.** Si listas un formulario en `excludedFiles`, el generador no emite el registro; lo registras a mano y un fallo ahí es tuyo. Los objetos anidados requieren cuidado: el registro direcciona solo campos de primer nivel.
- **Los módulos de diálogo no pueden iniciar un tour sobre el formulario.** La URL no cambia, así que una acción `create` de un módulo de diálogo no lleva `tourId`. El generador sigue la misma regla: escribe `tourId: general.form` en la acción `create` que añade solo para un módulo que no está en modo diálogo.

## Relacionado

- [El canal de voz del asistente](../assistant-voice-channel/) — la forma hablada de entrada y salida del asistente.
- [Detail mode](../detail-mode/) — los dos shells entre los que elige `detailMode` en una acción guiada.
- [Cómo: Activar el asistente en un módulo](../../../guides/frontend/enable-the-assistant-on-a-module/) — la marca del YAML, el enmascarado de campos y el registro de un formulario escrito a mano.
- [El manual de usuario integrado](../in-app-user-manual/) — los capítulos y recorridos con los que se compila el catálogo de acciones.
- [Regiones de preservación](../preservation-regions/) — cómo los ficheros frontend generados conservan tus ediciones al regenerar.
