---
title: Campos traducidos a través de relaciones
description: Cómo un módulo que apunta a un agregado table-i18n muestra, busca y ordena por los campos traducidos del registro relacionado en el idioma de la petición, sin YAML adicional.
---

## Por qué existe

Un agregado declarado con `i18nStrategy: table` guarda sus campos traducidos en una tabla companion (`common_country` y `common_country_i18n`). Su propio camino de lectura sabe elegir la traducción correcta. Otro módulo que lo cargaba como relación recibía esos campos como `null`: la relación cargaba la fila y nada le decía que cargara también la traducción.

El síntoma visible era una columna de listado que mostraba `country.iso3166Alpha2` en lugar del nombre del país, porque el nombre era justo el campo que no llegaba. Esta página describe el mecanismo que lo resuelve para cualquier módulo, sin ninguna declaración nueva.

La estrategia embedded nunca tuvo este problema. Su mapa por idioma es una columna de la fila, así que viaja con la fila a donde vaya.

## Cómo funciona

El YAML del consumidor ya dice qué se carga (la relación), y el YAML del destino ya dice que es `table`-i18n y qué campos se traducen. El generador combina ambos.

### Mostrar la traducción

Una relación queda cubierta cuando es many-to-one, o one-to-one con una columna de clave foránea propia, y su destino declara `i18nStrategy: table` con al menos un campo `isI18n`. Para cada relación cubierta, los handlers generados `find`, `find-by-id`, `get` y `paginate`:

- cargan la fila companion filtrada por idioma bajo la relación, solo cuando el cliente ya pidió esa relación. Una relación que el cliente no pidió nunca se carga por esto;
- aplanan la fila companion sobre el registro relacionado, de modo que el cliente lee `country.name`. La clave de la companion no aparece en la respuesta;
- lo hacen antes del formateo de salida, así que el field schema del destino formatea y enmascara los campos traducidos como siempre.

El idioma es la cabecera `Content-Language` de la petición, y `APP_FALLBACK_LANG` cuando falta. `Content-Language: *` carga todas las filas de traducción. Los resolvers y controllers del consumidor reenvían la cabecera al handler, así que un módulo gana ese parámetro en cuanto tiene una relación cubierta. Un registro relacionado que es `null` sigue siendo `null`.

### Buscar y ordenar

Ambos usan la traducción del idioma de la petición, con la misma regla que los campos traducidos del propio agregado.

- **Buscar.** Pon el predicado bajo la clave de la relación: `where: { country: { name: { iLike: '%Germ%' } } }`. Filtra las filas padre. No necesita que la relación se pida y no la carga. Con `Content-Language: *` coincide con cualquier traducción.
- **Ordenar.** Usa la ruta con punto: `order: [{ field: 'country.name', dir: 'asc' }]`. Las filas siguen la traducción que muestra la respuesta, una fila sin traducción se ordena como nula y ninguna fila padre se duplica. Como ordena por lo que muestra la respuesta, la relación debe pedirse. Sin ella, la petición falla con un error que nombra el campo de orden.

Las mismas dos operaciones funcionan sobre los campos traducidos del propio agregado. Están disponibles en `find`, `get` y `paginate`. Ordenar por un campo traducido con `Content-Language: *` falla con un error que nombra el campo, en lugar de devolver un orden arbitrario.

Los campos traducidos de un tipo enmascarado quedan fuera: un filtro sobre uno lo rechaza la guarda de propiedades enmascaradas como a cualquier otro campo enmascarado.

## Cuándo aplica

- Un listado o un detalle muestra un nombre que vive en una tabla traducida, como el país de una división administrativa o de una entidad legal.
- Un cuadro de filtro tiene que coincidir con el nombre traducido del registro relacionado en el idioma en que trabaja el usuario.
- Una columna sobre un campo traducido relacionado tiene que poder ordenarse.

## Compromisos y límites

- **Un salto, un registro relacionado.** No quedan cubiertas las relaciones to-many, una relación one-to-one inversa sin clave foránea en este lado ni las relaciones de más de un salto.
- **Solo cuando se pide.** La traducción llega únicamente para una relación que el cliente pidió. La búsqueda es la excepción: filtra sin cargar.
- **Ordenar necesita la relación.** Ordenar por un campo traducido relacionado sin pedir la relación falla de forma explícita en lugar de devolver un orden silencioso.
- **Sin `*` para ordenar.** Un orden no tiene una traducción única que mostrar con `Content-Language: *`.
- **Las relaciones entre contextos siguen siendo declarativas.** El código generado no añade ningún import del otro bounded context. Se apoya en las relaciones de persistencia que el proyecto ya declara.
- **Los handlers de escritura no cambian.** Las escrituras de un agregado traducido siguen resolviendo su idioma desde `Content-Language`, nunca desde el payload.

## Relacionado

- [Scaffolding de un módulo](../module-scaffolding/) — cómo se organiza el camino de lectura generado de un módulo.
- [Referencia de QueryStatement](../../../reference/query-statement/) — `where`, `order` y `relations` en detalle.
- [Alcance por tenant](../tenant-scope/) — un módulo acotado por tenant debe declarar una relación como atravesable para que una consulta la siga.
