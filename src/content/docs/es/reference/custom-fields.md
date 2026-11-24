---
title: Referencia de campos personalizados
description: El flag hasCustomFields, el input customFieldValues, los tipos de definición y sus columnas de valor, los campos de grupos, definiciones y opciones, y las clases de maquetación con las que puede contar un administrador.
---

Para saber qué son los campos personalizados y por qué funcionan así, consulta [Campos personalizados](../../concepts/backend/custom-fields/). Para los pasos, consulta [Añadir campos personalizados a un módulo](../../guides/backend/add-custom-fields-to-a-module/).

## Flag del módulo

```yaml
# blueprint/<bounded-context>/<module>.module.yaml
hasCustomFields: true
```

- `hasCustomFields` (booleano, opcional, por defecto `false`): activa los campos personalizados en el agregado. Un módulo sin él no genera nada para ellos. Un módulo pivote many-to-many nunca lo activa. El flag no se usa en el propio `tools`.

## Superficie generada

| Pieza | Nombre |
| --- | --- |
| Tabla satélite | `<bc>_<module>_custom_field_value`, con un único `(parentId, definitionId)` |
| Relación GraphQL | `customFieldValues` en el tipo del agregado (`[<Aggregate>CustomFieldValue]`, nullable) |
| Input GraphQL | `<Bc><Module>CustomFieldValueInput`, usado por `create` y `updateById` |
| Registro de la entidad | `entityType` es el nombre del agregado (por ejemplo `LibraryBook`), registrado en el arranque |

## El input `customFieldValues`

`create` y `updateById` aceptan una lista opcional en el mismo payload que el registro.

- `definitionId` (id, obligatorio): la definición a la que pertenece el valor.
- `value` (JSON, obligatorio): el valor, con la forma del tipo de definición de la tabla siguiente. Un `null` (o `[]`) en una actualización elimina el valor almacenado.

`createBatch` y `upsert` aceptan el mismo tipo y rechazan cualquier elemento cuya lista no esté vacía con `400` y `tools.error.customFieldValueBulkNotAllowed`.

## Tipos de definición

El `type` de una definición queda fijado al crearla. Cada tipo se guarda en su propia columna tipada de la tabla satélite.

| Tipo | Columna de valor | Valor que envías | Notas |
| --- | --- | --- | --- |
| `TEXT` | `value_text` | string | Puede ser buscable. |
| `NUMBER` | `value_number` | número | Se redondea a la `scale` de la definición antes de guardarse. |
| `DATE` | `value_date` | string de fecha | Solo fecha. Un objeto `Date` de JavaScript es un `400`. |
| `BOOLEAN` | `value_boolean` | booleano | |
| `SELECT` | `value_option_id` | id de opción | Debe ser una opción activa de la misma definición. Puede ser buscable. |
| `MULTISELECT` | `value_option_ids` | lista de ids de opción | La misma regla para cada id. Los filtros usan `contains` y `overlap`. |
| `ENCRYPTED` | `value_encrypted` | string | Se guarda cifrado. Nunca se devuelve, nunca se puede consultar y nunca es columna del listado. |

Un tipo fuera de este conjunto lo rechaza la validación de enum de la definición.

## Agregados de administración

### Grupo (`tools/custom-field-group`)

- `code` (string, 64, obligatorio, único): identificador de máquina. Es editable, porque todo referencia al grupo por id.
- `label` (string traducible, 128, opcional): el título de la sección.
- `entityTypes` (lista de strings, opcional): nombres de agregado a los que se aplica el grupo. Vacío o ausente significa ninguno.
- `sort` (entero pequeño, opcional): orden entre grupos, ascendente, los ausentes al final, empates por `rowId`.
- `icon` (string, 2046, opcional): URL de una imagen que se muestra junto a la etiqueta o al disparador de la pestaña.
- `isTab` (booleano, por defecto `false`): mostrar el grupo como pestaña propia. Los diálogos y los form-embed siempre muestran una sección.
- `headerClasses` (string, 510, opcional): clases de utilidad combinadas sobre la cabecera predeterminada de una sección. Se ignoran en una pestaña.

### Definición (`tools/custom-field-definition`)

- `key` (string, 64, obligatorio, único): identificador de máquina. Inmutable.
- `groupId` (id, obligatorio): el grupo al que pertenece. Toda definición pertenece a exactamente un grupo.
- `label` (string traducible, 128, opcional): la etiqueta del campo.
- `type` (enum, obligatorio, solo creación): consulta la tabla anterior.
- `scale` (entero pequeño, opcional): dígitos decimales para `NUMBER`. `null` en el resto de tipos.
- `required` (booleano, por defecto `false`): se juzga sobre el estado resultante del registro.
- `searchable` (booleano, por defecto `false`): incluir en la búsqueda general. Tiene sentido en `TEXT`, `SELECT` y `MULTISELECT`.
- `filterable` (booleano, por defecto `false`): ofrecer un filtro por columna en el listado.
- `sort` (entero pequeño, opcional): orden dentro del grupo, con la misma regla que el del grupo.
- `classes` (string, 510, opcional): clases de utilidad combinadas sobre las clases de ancho predeterminadas del tipo.

### Opción (`tools/custom-field-option`)

- `definitionId` (id, obligatorio): la definición `SELECT` o `MULTISELECT` a la que pertenece.
- `code` (string, 64, obligatorio): único dentro de la definición. Inmutable.
- `label` (string traducible, 128, opcional): el texto de la opción.

## Clases de layout

`classes` y `headerClasses` se combinan sobre los valores por defecto, y la clase del administrador gana solo donde entra en conflicto. `md:col-span-4` sustituye al ancho `md:` predeterminado y conserva `col-span-12`. Un valor ausente o vacío deja los valores por defecto sin cambios.

Tailwind solo genera las clases que encuentra en el código fuente, así que el frontend declara una safelist en `frontend/src/styles.css`:

| Garantizado que existe | Patrón |
| --- | --- |
| Ancho de columna | de `col-span-1` a `col-span-12`, sin prefijo y con los prefijos `md:` y `lg:` |
| Margen y relleno | `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml`, `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`, sin prefijo de breakpoint, cada uno con los pasos `0`, `px`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `3.5`, `4` a `12`, `14`, `16`, `20`, `24`, `28`, `32`, `36`, `40`, `44`, `48`, `52`, `56`, `60`, `64`, `72`, `80` y `96` |

Una clase fuera de la lista no tiene garantía de estar en el build. El `widget.span` del YAML no usa esta safelist: el generador lo resuelve en tiempo de generación.

## Errores

| Situación | Respuesta |
| --- | --- |
| Una definición obligatoria sin valor al crear, o en el estado resultante al actualizar | `400` bajo las claves `tools.error.customFieldValue*` |
| Definición desconocida, borrada o no asociada a la entidad | la rechaza el validador |
| Operación masiva con valores | `400`, `tools.error.customFieldValueBulkNotAllowed` |
| Escritura programática con una `key` desconocida o no asociada | `404`, `tools.error.customFieldDefinitionKeyNotFound` o `tools.error.customFieldDefinitionNotAssociated` |

## Relacionado

- [Campos personalizados](../../concepts/backend/custom-fields/) — el modelo y las reglas.
- [Añadir campos personalizados a un módulo](../../guides/backend/add-custom-fields-to-a-module/) — la receta.
- [Claves del YAML de módulo](../module-yaml/) — el resto de claves de módulo y de propiedad.
