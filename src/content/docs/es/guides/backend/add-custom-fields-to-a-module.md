---
title: Añadir campos personalizados a un módulo
description: Activa los campos personalizados en tiempo de ejecución en un módulo con hasCustomFields, genera el camino de escritura y el cableado del formulario, migra y define el primer grupo y el primer campo.
---

## Objetivo

Permitir que un administrador añada campos tipados a una entidad desde las pantallas de `tools`, sin más cambios de código ni de esquema, y verlos en el formulario, el listado y la API de esa entidad.

## Antes de empezar

- El bounded context `tools` está instalado en el proyecto. `catalyst add tools` (o `catalyst add identity`) también enlaza el adaptador de catálogo de frontend que necesita el formulario generado.
- El módulo es un agregado normal con su propio `cliter/<bounded-context>/<module>.module.yaml`. Un módulo pivote many-to-many no puede activarlo.
- Conoces el [concepto](../../../concepts/backend/custom-fields/), incluido el efecto de un campo obligatorio sobre los registros existentes.

## Pasos

1. **Activa el módulo.** Añade `hasCustomFields: true` al inicio del YAML del módulo.

   ```yaml
   boundedContextName: library
   moduleName: book
   hasCustomFields: true
   ```

2. **Regenera el backend y el frontend.**

   ```bash
   catalyst generate back module --name=library/book --force
   catalyst generate front module --name=library/book --force
   ```

   El backend incorpora la tabla de valores, el repositorio, el servicio, el tipo de input y el registro en el arranque. El formulario, el form-embed y el listado del frontend incorporan la sección de campos personalizados, las columnas y los filtros.

3. **Crea y aplica la migración** de la nueva tabla satélite. Consulta [Gestionar migraciones de esquema](../manage-schema-migrations/).

   ```bash
   pnpm db:generate --name add-library-book-custom-fields
   pnpm db:migrate
   ```

4. **Reinicia el backend.** En el arranque el módulo registra su agregado en el inventario de entidades. Hasta entonces ningún grupo puede asociarse a él.

5. **Concede los permisos del catálogo.** Un rol que use el formulario de la entidad necesita `tools.customFieldGroup.get`, `tools.customFieldDefinition.get` y `tools.customFieldOption.get`. Los roles se asignan en las pantallas de IAM; nada los asigna por ti.

6. **Define un grupo y un campo.** En las pantallas de `tools`, crea un grupo y elige tu entidad en sus entidades asociadas. Después crea una definición dentro de él: una `key`, un `type` y si es obligatoria, buscable o filtrable. Elige el tipo con cuidado, porque no se puede cambiar después. Para un `SELECT` o `MULTISELECT`, añade las opciones.

7. **Úsalo desde la API.** Envía los valores en el mismo payload que el registro, identificados por el id de la definición.

   ```graphql
   mutation {
     libraryCreateBook(payload: {
       id: "<book-uuid>"
       title: "Dune"
       customFieldValues: [{ definitionId: "<definition-uuid>", value: "Hardcover" }]
     }) { id }
   }
   ```

   Para leerlos, pide la relación: `relations: { customFieldValues: true }`.

## Verifica que funciona

- El formulario de la entidad muestra el nuevo grupo, como sección o como pestaña según su flag `isTab`, y el listado ofrece una columna por cada definición activa.
- Crear un registro con un valor para una definición obligatoria funciona, y omitirlo devuelve un `400`.
- Filtrar el listado por una columna de campo personalizado deja solo las filas que coinciden.
- El valor de una definición `ENCRYPTED` se acepta al escribir y nunca aparece en una lectura.

## Solución de problemas

**La entidad no aparece al editar un grupo.** El backend no ha arrancado con el módulo regenerado, o un administrador desactivó la entidad. Reinicia y revisa el flag de activa de la entidad en las pantallas de `tools`.

**El formulario no muestra ninguna sección de campos personalizados.** Comprueba que el rol tenga los tres permisos `get` y que el grupo incluya esta entidad. Un grupo sin entidad asociada no aparece en ningún sitio.

**Cada actualización de un registro existente devuelve `400`.** Ahora hay una definición obligatoria que se aplica a la entidad y esos registros no tienen valor para ella. Envía uno, o haz la definición opcional.

**`createBatch` o `upsert` devuelve `400` para un elemento con `customFieldValues`.** Las dos operaciones masivas rechazan valores por diseño. Usa `create` o `updateById` individuales.

**Las clases de maquetación que fijas en un campo no hacen nada.** Tailwind solo genera las clases de la safelist: de `col-span-1` a `col-span-12` con `md:` y `lg:`, y la escala de márgenes y relleno. Consulta la [referencia](../../../reference/custom-fields/#clases-de-layout).

## Relacionado

- [Campos personalizados](../../../concepts/backend/custom-fields/) — el modelo y las reglas detrás de cada paso.
- [Referencia de campos personalizados](../../../reference/custom-fields/) — tipos de definición, columnas de valor y campos de maquetación.
- [Gestionar migraciones de esquema](../manage-schema-migrations/) — generar y aplicar la migración de la tabla.
