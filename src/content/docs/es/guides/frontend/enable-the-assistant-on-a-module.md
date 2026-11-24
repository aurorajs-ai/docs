---
title: Activar el asistente en un módulo
description: "Permite que el asistente de ayuda rellene el formulario de alta de un módulo: declara `hasAssistant`, enmascara campos sensibles, registra un formulario escrito a mano y comprueba el prefill compilado."
---

## Objetivo

Conseguir que el asistente de ayuda pueda explicar el formulario de un módulo y preseleccionar sus campos de opciones fijas (enums y booleanos), incluido un formulario escrito a mano.

## Antes de empezar

- Un módulo en `blueprint/<bc>/<module>.module.yaml` con frontend generado.
- Una acción guiada `create` del módulo en `blueprint/<bc>/actions.yaml` (`catalyst generate front module` la añade cuando el bounded context tiene manual).
- El CLI `catalyst` disponible en local.
- Una aplicación con el paquete `tools` instalado (sin él no hay asistente), el asistente activado (`tools.assistant.isEnabled`) y un rol que tenga el permiso `tools.assistant.ask`, concedido en IAM como cualquier otro permiso. Consulta [Acceso y coste](../../../concepts/frontend/guided-actions/#acceso-y-coste).

## Pasos

1. **Activa el módulo.** Añade `hasAssistant: true` a nivel de módulo en el YAML:

   ```yaml
   boundedContextName: iam
   moduleName: account
   hasAssistant: true
   ```

   Las dos marcas `hasAssistant` deben ser booleanos literales; si no, la carga falla indicando el módulo.

2. **Enmascara lo que el asistente no debe tocar.** En una propiedad, `hasAssistant: false` la excluye del prefill y oculta su valor y sus opciones al asistente:

   ```yaml
   - name: hasAddChildTenants
     type: boolean
     hasAssistant: false
   ```

   Las propiedades `password` y `encrypted` quedan enmascaradas sin declarar nada, y las [`readOnly`](../../../concepts/backend/property-writability/) se excluyen.

3. **Regenera el frontend.** Ejecuta `catalyst generate front module --force`. El `*-form.component.ts` generado ya se registra en `AssistedFormService`.

4. **(Solo formularios escritos a mano) Registra el formulario tú.** Un formulario listado en `excludedFiles` nunca recibe el registro generado. Llama a `register` desde su constructor (un contexto de inyección), con un descriptor por campo:

   ```ts
   constructor() {
     inject(AssistedFormService).register({
       formId: 'iam.account',
       mode: this.mode, // pasa la señal; leerla aquí lanza un error
       form: this.signalForm,
       fields: [
         {
           name: 'type',
           kind: 'enum',
           labelKey: 'iam.account.Type',
           options: [
             { value: 'USER', labelKey: 'iam.account.Type.USER' },
             { value: 'SERVICE', labelKey: 'iam.account.Type.SERVICE' },
           ],
           isMasked: false,
         },
         { name: 'email', kind: 'text', labelKey: 'iam.account.Email', isMasked: false },
       ],
     });
   }
   ```

   Registra solo campos de primer nivel. Marca un campo con `isMasked: true` cuando el asistente no deba ver su valor.

5. **Recompila el manual.** La compilación lista las propiedades `enum` y `boolean` del módulo como el `prefill` de su acción `create`.

## Comprueba que funciona

- Pregunta al asistente cómo crear un registro del módulo: la respuesta ofrece un botón y, al pulsarlo, se abre el formulario con los campos de opciones fijas preseleccionados.
- En un test unitario, inyecta `AssistedFormService`, llama a `snapshot()` y comprueba los tipos y opciones de los campos; llama a `patch([{ field, value }])` y comprueba que el control del formulario cambió.

## Solución de problemas

- **El asistente no explica nada del formulario.** El módulo no tiene `hasAssistant: true`, o un formulario escrito a mano nunca se registró.
- **Un campo no se preselecciona.** Es de texto, una relación, `readOnly`, está enmascarado o es un enum sin opciones declaradas. Solo se escriben opciones exactas de enums y booleanos sin enmascarar.
- **`NG0950` al registrar.** El registro leyó el input `mode`. Pasa la propia señal, no su valor.

## Relacionado

- [Concepto: Acciones guiadas y formularios asistidos](../../../concepts/frontend/guided-actions/)
- [Concepto: El manual de usuario integrado](../../../concepts/frontend/in-app-user-manual/) — el manual con el que se compila la acción `create`.
- [Cómo: Excluir APIs](../../backend/exclude-generated-apis/)
