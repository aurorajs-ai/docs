---
title: Publicar el contexto de una pantalla al asistente
description: "Haz que el asistente de ayuda responda sobre el registro abierto en una pantalla escrita a mano: contribuye secciones con funciones puras, respeta los límites y comprueba qué se envía."
---

## Objetivo

Lograr que una pantalla escrita a mano le cuente al asistente de ayuda lo que muestra (estado, incidencias, acciones, hechos y filas con avisos), para que pueda responder preguntas sobre el registro abierto.

## Antes de empezar

- Una pantalla escrita a mano, formada por uno o varios componentes. Las pantallas generadas no publican contexto.
- Una aplicación con el paquete `tools`, el asistente activado y un rol que pueda preguntar. Consulta [Acceso y coste](../../../concepts/frontend/guided-actions/#acceso-y-coste).
- El id de pantalla, `<bc>.<módulo>` en minúsculas (por ejemplo `iam.account`), y un dueño claro para cada sección: solo un componente puede contribuir una sección dada.

## Pasos

1. **Escribe funciones puras.** Pon la lógica que convierte los datos de la pantalla en una sección en una función simple que reciba una función `translate`, para poder probarla sin Angular. Lee de las mismas fuentes que pinta la plantilla y reutiliza las funciones que construyen los textos de la plantilla, así el contexto nunca dice más ni menos que la pantalla.

   ```ts
   export function accountScreenStatus(account: Account | null): ScreenStatus | null {
     return account ? { label: account.state } : null;
   }
   ```

   Devuelve `null` mientras los datos no estén cargados.

2. **Contribuye desde el contexto de inyección.** En el constructor (o en el inicializador de un campo) de cada componente, inyecta `ScreenContextService` y llama a `contribute` con las secciones que ese componente posee. Los lectores son funciones que se evalúan cuando se envía la pregunta:

   ```ts
   private readonly screenContext = inject(ScreenContextService);

   constructor() {
     this.screenContext.contribute('iam.account', {
       status: () => accountScreenStatus(this.account()),
       issues: () => accountScreenIssues(this.account(), this.translate),
     });
   }
   ```

   Si los datos se reparten entre dos componentes (un detalle y su formulario hijo), cada uno llama a `contribute` con sus propias secciones. Las contribuciones se retiran al destruirse los componentes; no escribes ninguna limpieza.

3. **Describe las acciones con condiciones con nombre.** En `actions`, devuelve todos los botones que la pantalla puede mostrar, cada uno con `available` y, si no está disponible, sus `missingConditions` como texto traducido. Decide la disponibilidad una sola vez, en una función que lean tanto la barra de herramientas como el contexto; dos funciones que deciden lo mismo acaban divergiendo.

4. **Respeta los límites.** En las tablas, envía el `count` total y solo las filas que tienen avisos. Los límites (`TOOLS_ASSISTANT_SCREEN_LIMITS` en el backend) rechazan y nunca recortan, así que una pantalla que supera uno hace fallar la pregunta con un error que nombra la sección.

5. **Publica solo lo que la pantalla muestra.** Deja fuera los datos que no están en pantalla y el texto libre que viene de documentos externos, salvo que una etiqueta lo necesite de verdad.

### Ejemplo

La pantalla de revisión de facturas de compra del bounded context `business-partner-portal` hace exactamente esto, con el id de pantalla `business-partner-portal.purchase-invoice-header`. El componente de detalle contribuye `status`, `issues` y `actions`, porque ahí viven la factura y el modo. El formulario hijo contribuye `facts` y `rows` (totales, fechas y las filas de líneas e impuestos que llevan avisos), porque posee la vista previa. Las funciones constructoras son puras, están en un único archivo `purchase-invoice-review-context.derive.ts` y se prueban sin renderizar la pantalla.

## Verifica que funciona

- En un test unitario, llama a tus funciones con un registro y comprueba la sección que devuelven, incluido el caso `null` y las condiciones pendientes de una acción no disponible.
- En un test del registro, inyecta `ScreenContextService`, contribuye y comprueba que `snapshot()` devuelve `{ screenId, ...sections }`.
- Abre la pantalla y pregunta al asistente algo que solo la pantalla pueda responder, como por qué no se muestra una acción. La respuesta nombra la condición pendiente y no cita ninguna sección del manual.

## Solución de problemas

- **`contribute` lanza que la sección ya está contribuida.** Dos componentes reclaman la misma sección. Decide cuál es el dueño y quita la contribución del otro.
- **`contribute` lanza un error por otro id de pantalla.** Sigue registrada una pantalla con un id distinto. Comprueba que todos los componentes de esta pantalla usan el mismo id.
- **Se rechaza la pregunta nombrando una sección.** La pantalla supera un límite. Reduce lo que devuelve el lector (solo filas con avisos, textos más cortos); no esperes que se recorte.
- **El asistente ignora la pantalla.** La pantalla no envió nada: los lectores devolvieron `null` o ningún componente contribuyó. Comprueba que la contribución se ejecuta en un contexto de inyección.

## Relacionado

- [Concepto: Contexto de pantalla para el asistente](../../../concepts/frontend/screen-context/)
- [Guía: Activar el asistente en un módulo](../enable-the-assistant-on-a-module/) — la parte del asistente que trabaja con formularios de alta.
- [Concepto: Acciones guiadas y formularios asistidos](../../../concepts/frontend/guided-actions/)
