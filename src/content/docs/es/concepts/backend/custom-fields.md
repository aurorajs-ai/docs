---
title: Campos personalizados
description: Cómo un operador añade campos tipados a una entidad en tiempo de ejecución, sin cambiar el esquema — grupos, definiciones, el camino de escritura generado, reglas de obligatoriedad, valores cifrados y maquetación del formulario.
---

## Por qué existe

Algunas entidades necesitan campos cuyo conjunto cambia según la instalación o el tenant, y que decide un operador y no un desarrollador: los atributos extra de un producto, el formulario de alta de un caso. Añadir una columna por cada uno implica editar el YAML, regenerar, hacer una migración y desplegar, cada vez.

Los campos personalizados trasladan ese trabajo al tiempo de ejecución. Un administrador define un campo tipado en las pantallas de `tools` y aparece en el formulario, el listado y la API de la entidad sin tocar el código ni el esquema. El desarrollador activa la opción en un agregado una sola vez, en tiempo de diseño. Todo lo demás son datos.

Si el conjunto de campos está fijado cuando construyes, añade mejor una propiedad normal en el YAML. Los campos personalizados cuestan una tabla satélite, un viaje de validación y una sección de formulario que una columna simple no necesita.

## Cómo funciona

### El lado de administración

El bounded context `tools` contiene cuatro agregados:

- **Grupo.** Una sección visual y la unidad de reutilización. Un grupo enumera los tipos de entidad a los que se aplica (`entityTypes`, una lista de nombres de agregado como `IamTag`), de modo que un mismo grupo puede servir a varias entidades. Un grupo sin tipos de entidad no se aplica a ninguna.
- **Definición.** Un campo tipado dentro de un grupo: `TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `SELECT`, `MULTISELECT` o `ENCRYPTED`. Su `key` de máquina es inmutable y única globalmente, y lo mismo vale para su `type`: cambiar el tipo dejaría los valores existentes en una columna tipada para el anterior. La etiqueta es traducible y solo sirve para mostrar.
- **Opción.** Las opciones que hay detrás de una definición `SELECT` o `MULTISELECT`.
- **Entidad.** El inventario de agregados que se han adherido. Cada módulo consumidor se registra en el arranque, y un administrador puede desactivar una entidad.

La [referencia](../../../reference/custom-fields/) lista los campos y tipos exactos.

### El lado del desarrollador: `hasCustomFields`

`hasCustomFields: true` en el YAML de un módulo (fuera de `tools`) hace que el generador emita, solo para ese módulo:

- una tabla satélite `<bc>_<module>_custom_field_value` con columnas tipadas y un único `(parentId, definitionId)`;
- un repositorio de valores y un servicio de valores;
- una relación `customFieldValues` en el tipo GraphQL y un input `customFieldValues` en la creación y la actualización;
- un provider que registra el agregado en el inventario de entidades al arrancar;
- el cableado de formulario, formulario embebido y listado en el frontend.

Un módulo sin el flag genera exactamente lo mismo que antes.

### Escritura

El `create` y el `updateById` generados aceptan `customFieldValues: [{ definitionId, value }]` en el mismo payload que el padre. La fila padre y todas las filas de valores se escriben en una sola transacción, así que un rechazo no deja escrito ninguno.

Un único validador protege tanto este camino como el puerto entre contextos. Falla cerrado: una definición desconocida, borrada o no asociada a la entidad se rechaza, y cada valor se enruta a la columna de su tipo. Un `NUMBER` se redondea a la `scale` de la definición, y un valor `SELECT` o `MULTISELECT` debe ser una de las opciones activas de esa misma definición.

En una actualización, cada valor enviado es un upsert para esa definición, y un `null` (o `[]`) enviado lo elimina. Una definición que no aparece en el payload conserva su valor almacenado.

`createBatch` y `upsert` llevan el mismo tipo de input, pero rechazan con un `400` cualquier elemento con `customFieldValues` no vacío. Nunca lo descartan en silencio.

### Los campos obligatorios se juzgan sobre el estado resultante

`create` rechaza un payload que omite una definición obligatoria. `updateById` evalúa el estado en el que quedaría el registro, valores persistidos combinados con los enviados, incluso cuando la actualización no envía `customFieldValues`. La consecuencia la notan los operadores: cuando una definición obligatoria nueva se aplica a un tipo de entidad, todos los registros existentes de ese tipo quedan bloqueados para actualizar hasta que se envíe un valor para ella.

### Lectura y filtrado

`customFieldValues` es una relación normal. Se carga cuando el `relations` de la consulta lo pide, y filtrar por un valor es un predicado anidado bajo ella, que se compila a un `EXISTS`, también en el conteo paginado. El listado generado añade una columna por definición activa, aplica un filtro por columna cuando la definición lo permite e incluye las definiciones de texto y de selección marcadas como buscables en la búsqueda general. Ordenar por un campo personalizado no está soportado.

### Valores cifrados

Un valor `ENCRYPTED` se guarda como texto cifrado en su propia columna y ninguna lectura de la API lo devuelve. Se enmascara en cada lectura, se rechaza en `where`, `order` y `aggregation`, y nunca se ofrece como columna del listado. En el formulario es un campo de contraseña de solo escritura que empieza vacío: dejarlo vacío al editar conserva el valor almacenado, y no hay forma de borrarlo desde el formulario. El código de servidor que necesita el texto en claro lee el cifrado a través del value store y lo descifra en el punto de uso con `Crypt.decryptWithAuroraPrivateKey`. No existe una API de lectura que descifre.

### Maquetación

El administrador también decide cómo se distribuyen los campos, sin código:

- **Orden.** Los grupos, y las definiciones dentro de cada grupo, siguen `sort` ascendente. Un `sort` ausente va al final y los empates se resuelven por `rowId`.
- **Ubicación.** Un grupo con `isTab: false` es una sección bajo los campos estáticos. En un formulario sin pestañas YAML, un grupo con `isTab: true` obtiene su propia pestaña, y la primera pestaña pasa a contener los campos estáticos y todos los grupos sin pestaña. Con pestañas YAML, las pestañas de grupo van después y los grupos sin pestaña quedan en la primera pestaña YAML. En un diálogo o un form-embed, todos los grupos son secciones, porque no hay pestañas.
- **Aspecto.** El `icon` de un grupo es la URL de una imagen que se muestra junto a su etiqueta. `headerClasses` y las `classes` de una definición combinan clases de utilidad de Tailwind sobre las predeterminadas, y la clase del administrador gana solo donde entra en conflicto. Un grupo en pestaña con un campo inválido muestra una marca de error en la pestaña.

Tailwind solo emite las clases que encuentra en el código fuente, así que el frontend incluye una lista de seguridad (safelist): de `col-span-1` a `col-span-12` en la base, los breakpoints `md:` y `lg:`, y la escala de márgenes y relleno. Una clase fuera de esa lista no tiene garantía de existir.

### Desde otro bounded context

Un handler de otro bounded context que deba rellenar o leer los campos personalizados de un elemento, por ejemplo un localizador fijado tras un OCR, inyecta el puerto del value store (`TOOLS_CUSTOM_FIELD_VALUE_STORE`). Identifica los campos por `key`, escribe dentro de la transacción del llamante cuando se le pasa una y comparte el mismo validador que el camino del formulario. Nunca toca la tabla satélite directamente.

## Cuándo aplica

- Un operador pide un atributo nuevo en una entidad y no quieres una versión por cada uno.
- Ves `customFieldValues` en un tipo GraphQL, una tabla `<bc>_<module>_custom_field_value` o una sección extra en un formulario.
- Una actualización falla porque un campo personalizado obligatorio no tiene valor.

## Compromisos y límites

- **Registrar antes de asociar.** Un grupo solo se puede asociar a entidades que ya se hayan registrado, algo que ocurre cuando el backend arranca con el módulo regenerado.
- **El catálogo tiene permisos.** El formulario lee las definiciones a través de la API de `tools`, así que un rol necesita los permisos `get` de custom-field-group, custom-field-definition y custom-field-option. Los permisos no se asignan automáticamente.
- **Un elemento por escritura.** El camino programático no tiene operación masiva.
- **Una definición obligatoria nueva bloquea registros existentes.** Es un comportamiento aceptado. Avisa a quien la crea.
- **El código entre contextos nunca descifra a través de una API.** Descifra el texto cifrado él mismo, donde lo necesita.

## Relacionado

- [Añadir campos personalizados a un módulo](../../../guides/backend/add-custom-fields-to-a-module/) — la receta.
- [Referencia de campos personalizados](../../../reference/custom-fields/) — campos, tipos, columnas de valor y la forma del input.
- [Escritura de propiedades](../property-writability/) — por qué el `type` de una definición es de solo creación.
- [Campos traducidos a través de relaciones](../translated-fields-through-relations/) — el lado i18n de los registros relacionados.
