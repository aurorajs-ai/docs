---
title: Claves del YAML de módulo
description: Referencia de las claves de un *.module.yaml que deciden la escritura, el alcance por tenant, las restricciones de relaciones, las ayudas de formulario y los widgets de lista de strings, con los errores que la generación lanza ante combinaciones inválidas.
---

Esta página documenta las claves de `blueprint/<bounded-context>/<module>.module.yaml` que cambian lo que el generador emite para la escritura, el alcance por tenant, las relaciones y los widgets de formulario. No es la gramática completa. Para el razonamiento detrás de una clave, sigue el enlace de su fila.

El archivo se llama siempre `<module>.module.yaml`, uno por módulo, directamente dentro de la carpeta de un bounded context de `blueprint/`. Los editores que usan [SchemaStore](https://www.schemastore.org/) validan el archivo contra el JSON schema del módulo cuando su ruta coincide con `**/blueprint/*/*.module.yaml`.

## Claves de módulo

| Clave | Tipo | Efecto |
| --- | --- | --- |
| `hasOAuth` | booleano | Los endpoints generados exigen una cuenta autenticada. Lo exige `hasTenant`. |
| `hasTenant` | booleano | Las lecturas y escrituras generadas se acotan a los tenants del llamante. Consulta [Alcance por tenant](../../concepts/backend/tenant-scope/). |
| `hasCustomFields` | booleano | Activa en el agregado los campos personalizados en tiempo de ejecución. Consulta la [referencia de campos personalizados](../custom-fields/). |
| `excludedOperations` | lista | Operaciones que el generador no emite. Consulta [Excluir APIs](../../guides/backend/exclude-generated-apis/). |

## Flags de propiedad

Se declaran en una entrada de `aggregateProperties`. Todos deben ser booleanos literales: `yes`, `"true"` y cualquier otro valor hacen fallar la generación nombrando el agregado, la propiedad y el valor encontrado.

| Clave | Significado |
| --- | --- |
| `readOnly` | Ningún cliente escribe la propiedad. No aparece en ningún input de creación ni de actualización ni en el formulario. Se rechaza con `400` si un payload la incluye. |
| `createOnly` | El cliente la escribe solo al crear. No aparece en los inputs de actualización, se deshabilita en el formulario `edit` y se rechaza con `400` al actualizar. |
| `readonly` | Alias obsoleto de `readOnly`. Se normaliza a `readOnly` con un aviso por propiedad. |
| `hasAssistant` | `false` excluye la propiedad de los campos que el asistente puede rellenar, en un módulo con `hasAssistant: true`. Consulta [Activar el asistente en un módulo](../../guides/frontend/enable-the-assistant-on-a-module/). |

Una propiedad autoincremental se trata como `readOnly` en el field schema generado sin que lo declares.

El razonamiento, el comportamiento en ejecución y lo que hace cada flag en cada superficie están en [Escritura de propiedades](../../concepts/backend/property-writability/).

### Errores de generación por combinaciones de flags

Cada mensaje nombra el archivo y la propiedad, y no se escribe nada.

| Declaración | Por qué falla | Remedio |
| --- | --- | --- |
| `readOnly` y `createOnly` en una propiedad | No se puede adivinar un ganador sin cambiar el contrato. | Deja uno. |
| `readOnly` y `readonly` en una propiedad | Igual. | Deja `readOnly`. |
| `createOnly` en una propiedad `type: relationship` | Una propiedad many-to-many o de navegación no tiene una entrada escalar a la que enganchar el flag. | Quita el flag. Una clave foránea many-to-one (`type: id` con un bloque `relationship`) sí se permite. |
| `createOnly` en la clave primaria | El handler de actualización por id sigue leyendo la clave del payload. | Quita el flag. |
| `createOnly` en una propiedad `autoIncrement` | La propiedad ya es `readOnly`, así que el flag no haría nada. | Quita el flag. |
| `createOnly` mientras `upsert` no está excluido en todas las capas | El `upsert` generado recibe el input de actualización, que ya no lleva el campo. | Añade `upsert` a `excludedOperations`, o quita el flag. |
| `createOnly` e `isI18n` | La clave sigue en el contrato de actualización mientras el field schema la rechaza, de modo que cada edición fallaría. | Quita uno. |
| `readOnly` e `isI18n` con `i18nStrategy: embedded` | La misma forma de fallo. Se acepta con `i18nStrategy: table`. | Quita uno, o usa `table`. |

## Claves de relación

Se declaran en el bloque `relationship` de una propiedad.

| Clave | Tipo | Por defecto | Significado |
| --- | --- | --- | --- |
| `avoidConstraint` | booleano | | `true` no emite clave foránea en la base de datos. `false` emite una clave foránea real. |
| `onDelete` | acción | ninguna | Acción referencial cuando se borra la fila destino. |
| `onUpdate` | acción | ninguna | Acción referencial cuando se actualiza la clave destino. |
| `traversableInTenantScope` | booleano | `false` | En un módulo `hasTenant`, permite que una lectura acotada por tenant cruce esta relación, un salto. Consulta [Acotar un módulo por tenant](../../guides/backend/scope-a-module-by-tenant/). |

`onDelete` y `onUpdate` toman una de las grafías YAML de la tabla siguiente. Solo tienen efecto con `avoidConstraint: false`. Una acción que no declaras deja una clave foránea simple, y el generador nunca infiere una, tampoco en las tablas pivote many-to-many. Un valor desconocido detiene la generación y lista los válidos.

| YAML | Drizzle |
| --- | --- |
| `cascade` | `cascade` |
| `restrict` | `restrict` |
| `no-action` | `no action` |
| `set-null` | `set null` |
| `set-default` | `set default` |

Añadir o cambiar una acción cambia la restricción, así que necesita una migración. Consulta [Gestionar migraciones de esquema](../../guides/backend/manage-schema-migrations/#acciones-referenciales-en-una-relación).

```yaml
relationship:
  type: many-to-one
  aggregateName: ToolsMailbox
  modulePath: tools/mailbox
  key: id
  field: mailbox
  avoidConstraint: false
  onDelete: restrict
```

`modulePath` nombra un `blueprint/<bounded-context>/<module>.module.yaml` que debe existir en el proyecto. Un bounded context de un paquete cumple la condición cuando el paquete está instalado con la CLI 5.2.0 o posterior, porque el render escribe sus YAML en `blueprint/`. Un destino que ni el proyecto ni un paquete instalado aportan detiene la generación con `relationship.modulePath "<path>" does not name an existing schema`.

## Claves de widget

Se declaran en el bloque `widget` de una propiedad.

| Clave | Tipo | Significado |
| --- | --- | --- |
| `hint` | `{ text, example? }` | Añade un tooltip informativo junto a la etiqueta de un campo de formulario. Ambos valores siembran una sola vez las claves i18n `<Field>Hint` y `<Field>Example`, y después el JSON es el dueño. Una propiedad sin `hint` genera la misma salida que antes. |
| `type: dialog-string-list` | | Un `string[]` de texto libre que se edita en un diálogo, abierto desde un resumen de una línea. |
| `type: inline-string-list` | | La misma lista editada en un panel desplegable dentro del formulario. |

Ambos tipos de lista de strings solo son válidos en `type: array` con `arrayOptions.type: varchar`. Cualquier otra declaración detiene la generación y nombra la propiedad. El procedimiento para `hint` y la elección entre los dos widgets de lista están en [Configurar un módulo frontend](../../guides/frontend/configure-a-frontend-module/).

## Relacionado

- [Escritura de propiedades](../../concepts/backend/property-writability/) — qué hacen `readOnly` y `createOnly`.
- [Alcance por tenant](../../concepts/backend/tenant-scope/) — qué hacen `hasTenant` y `traversableInTenantScope`.
- [Referencia de campos personalizados](../custom-fields/) — `hasCustomFields` y su superficie generada.
