---
title: Scaffolding de un módulo
description: Qué genera el CLI de Catalyst para un módulo backend y cómo el lockfile controla las ediciones manuales.
---

## Por qué existe

Un módulo backend de Catalyst siempre tiene la misma forma: un controlador REST, un resolver de GraphQL, un handler de capa de aplicación, un service, un DTO, un fragmento de esquema GraphQL, un esquema de tabla de Drizzle, un repositorio y un field schema — un juego por operación en las capas que son por operación. Un módulo con seis operaciones CRUD supera rápido los treinta archivos, todos con convenciones estrictas de nombres, capas y decoradores. Escribir eso a mano es repetitivo y hace que la forma se vaya desviando entre módulos.

Catalyst trata el archivo `*.module.yaml` del módulo como la única fuente de verdad. El CLI lee la YAML y emite el árbol completo de manera determinista. Cuando el módulo tiene que evolucionar, editas la YAML — no el TypeScript generado — y vuelves a generar.

## Cómo funciona

Cada módulo vive en `cliter/<bounded-context>/<module>.module.yaml`.

:::note
Los proyectos antiguos llamaban a este archivo `<module>.aurora.yaml`. El CLI ya no lee ese nombre: si solo existe el archivo antiguo, `catalyst generate` falla, nombra ambos archivos y te indica ejecutar `catalyst upgrade`, que los renombra.
:::

Al ejecutar:

```bash
catalyst generate back module --name=<bounded-context>/<module> --force
```

el CLI emite archivos en todas las capas del backend:

| Capa                                                  | Archivos                                                                     |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@api/<bc>/<mod>/controllers/`                        | Un controlador REST por operación                                            |
| `@api/<bc>/<mod>/resolvers/`                          | Un resolver de GraphQL por operación                                         |
| `@api/<bc>/<mod>/dto/` y `@api/<bc>/<mod>/graphql/`   | DTOs de entrada y salida y el fragmento de esquema GraphQL                   |
| `@app/<bc>/<mod>/application/<op>/`                   | Handler + service por operación                                              |
| `@app/<bc>/<mod>/domain/`                             | El field schema y un barrel (`index.ts`)                                     |
| `@app/<bc>/<mod>/infrastructure/drizzle/`             | Esquema de tabla de Drizzle (`*.schema.ts`) e implementación del repositorio |

El módulo no contiene clases de entidad ni de value objects: el field schema describe el agregado y el esquema de Drizzle describe su tabla.

Se emiten dos cosas más cuando el módulo las pide. Un módulo con propiedades `readOnly` recibe un `<bc>-<mod>.payload-types.ts` junto a sus handlers, y un módulo con `hasCustomFields` o `i18nStrategy: table` recibe sus tablas y repositorios satélite.

### Archivos compartidos por todo el bounded context

Algunos archivos pertenecen al bounded context y no a un módulo. El CLI no los renderiza desde cero: los **parchea en el sitio**, añadiendo una entrada por cada módulo generado, y nunca los reescribe por completo.

| Archivo                        | Qué añade cada módulo                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| `@api/<bc>/<bc>.module.ts`     | Los controladores y resolvers del módulo                                |
| `@app/<bc>/index.ts`           | El export del barrel del módulo                                         |
| `@app/<bc>/<bc>.seed.ts`       | Los permisos del módulo                                                 |
| `@app/<bc>/<bc>.relations.ts`  | Las relaciones de Drizzle del módulo                                    |

El archivo `@api/<bc>/<bc>.module.ts` provee además un `BoundedContextDeclaration` construido a partir de `@app/<bc>/<bc>.seed.ts`. Cuando el paquete IAM está instalado, recoge todas las declaraciones al arrancar y registra el bounded context y sus permisos. Sin IAM la declaración queda inerte, así que el bounded context nunca depende de IAM. Ya no existe ningún `<bc>.seeder.ts`.

### Imports ESM

El backend es un proyecto de módulos ES (`"type": "module"`). Todo import relativo o con alias, generado o escrito a mano, lleva extensión explícita: `./foo.js`, o `@app/iam/tag/domain/index.js` para un barrel. Los imports de paquetes como `@aurorajs.dev/core-back` no cambian. Si un import escrito a mano no resuelve, lo primero que debes revisar es que no falte un `.js` o un `/index.js`.

### Relaciones con módulos de otro bounded context

Una relación que apunta a un módulo de otro bounded context produce un tipo GraphQL, una entrada en el field schema y una entrada de relación de Drizzle. Esa entrada no puede vivir en `<bc>.relations.ts`, porque ese archivo resuelve relaciones solo sobre las tablas de su propio bounded context. Dónde va depende de quién es el dueño del bounded context:

- **Un bounded context del proyecto**: el CLI inserta o actualiza la entrada en `projectCrossBcRelations`, dentro de `backend/src/project.composition.ts`, un archivo que es tuyo. Repetir la ejecución es idempotente, y generar cualquiera de los dos extremos de la relación completa el par.
- **Un bounded context de un paquete**: el manifiesto del paquete declara sus relaciones y el `@config/drizzle/aurora-drizzle-schema.ts` generado las incluye. El CLI se salta esas entradas.

Si el módulo del otro extremo todavía no se ha generado, el CLI no escribe nada para esa relación e imprime la relación y el destino que falta como `[CROSS-BC RELATION SKIPPED]`. Genera el otro módulo y la entrada aparece. No escribas ese bloque a mano.

El comando también ejecuta `pnpm back:graphql:types` por defecto, así los tipos GraphQL quedan alineados con la YAML. Usa `--noGraphQLTypes` (`-g`) para omitir ese paso. Consulta la [referencia de `catalyst generate`](../../../reference/cli-commands/generate/) para el listado completo de flags.

### Operaciones que el CLI reconoce

Cada operación se mapea a un conjunto handler + service + resolver + controller. Lo que aparece en la lista `operations` del módulo, o simplemente no está en `excludedOperations`, se emite.

| Operación             | Genera                                                     |
| --------------------- | ---------------------------------------------------------- |
| `count`               | Contar filas que cumplan un filtro                         |
| `create`              | Crear una fila                                             |
| `createBatch`         | Crear varias filas en una sola llamada                     |
| `delete`              | Borrar varias filas por filtro                             |
| `deleteById`          | Borrar una fila por id                                     |
| `find`                | Buscar una fila por filtro                                 |
| `findById`            | Buscar una fila por id                                     |
| `get`                 | Obtener varias filas por filtro                            |
| `getRaw`              | Obtener filas con forma SQL en crudo                       |
| `paginate`            | Listado paginado                                           |
| `update`              | Actualizar varias filas por filtro                         |
| `updateAndIncrement`  | Actualizar con incremento atómico de un contador           |
| `updateById`          | Actualizar una fila por id                                 |
| `upsert`              | Insertar o actualizar según la presencia de la clave       |
| `max` / `min` / `sum` | Agregados sobre una columna numérica                       |

`getRaw` ejecuta SQL que aporta quien llama, así que el handler generado lleva `@Format` solo por coherencia: una consulta puede renombrar una columna con un alias y esquivar la máscara. Por eso la generación falla en un agregado que declara una propiedad enmascarada (`secret`, `password`, `encrypted`) salvo que `getRaw` esté en `excludedOperations`. El mismo fallo se aplica a `getRaw` y `upsert` en un módulo con `hasTenant: true`, porque ninguna de las dos firmas tiene un argumento `constraint` con el que acotar por tenant. El error nombra la propiedad y la exclusión que debes añadir.

Los verbos personalizados que no encajan en el vocabulario CRUD — `activate`, `approve`, `cancel`, `check-unique-<field>` — viven en una lista aparte, `additionalApis`, dentro de la misma YAML. Cada uno genera un scaffold más ligero: un controller, un resolver y un handler, que luego completas tú. Si restringes una entrada con `excludedLayers`, las capas que listes no se emiten (consulta [Excluir APIs](../../../guides/backend/exclude-generated-apis/)).

### Lockfile y archivos `.origin`

Cada archivo generado tiene una entrada de lockfile que guarda el SHA-1 del contenido emitido por el CLI. Al regenerar, el CLI compara el hash de integridad del archivo que encuentra en disco contra el del lockfile:

- **Los hashes coinciden** → no hay ediciones manuales. El CLI sobreescribe el archivo con la nueva salida.
- **Los hashes difieren** → el archivo tiene ediciones manuales. El CLI escribe la nueva salida en `<archivo>.origin` al lado del tuyo y te deja a ti resolver la discrepancia.

Cuando una ejecución produce archivos `.origin`, `catalyst generate` abre al final la revisión interactiva si se ejecuta en un terminal, y en caso contrario solo imprime un resumen. `--review` y `--no-review` lo fuerzan en un sentido u otro. La reconciliación también vive en los subcomandos hermanos `catalyst origin` (`list`, `diff`, `accept`, `reject`, `ignore`, `review`).

El lockfile conserva una entrada por cada archivo que sigue en disco, incluso uno que la ejecución actual no renderizó (una operación excluida, o un archivo compartido que solo se parchea). La entrada de un archivo que ya no existe se elimina. Así una ejecución nunca desinstala la protección de un archivo que se saltó.

`catalyst origin ignore <ruta>` marca un archivo con un centinela `// ignored file` en la primera línea y el generador deja de tocarlo. El centinela significa dos cosas distintas según el archivo:

- **Archivos compartidos que mantienes por completo a mano** (rutas, navegación, traducciones, el `project.composition.ts` del frontend): el generador se salta el archivo sin avisar.
- **Archivos sin los que el módulo no funciona** (el seed del bounded context, las relaciones, el `project.composition.ts` del backend, `@api/<bc>/<bc>.module.ts`, `@app/<bc>/index.ts`): el generador **se detiene con un error** cuando tiene que añadir una entrada. Ahí el centinela no sirve para excluir el archivo. O dejas el archivo al generador, cuyo parche es aditivo y respeta tus otras ediciones, o asumes a mano todo el registro y lo mantienes al día.

Editar el cuerpo de `main()` de un handler es seguro: el scaffold alrededor queda intacto, así que la siguiente regeneración produce un `.origin` prácticamente idéntico a tu archivo. Editar decoradores, imports o firmas de métodos es lo que genera conflictos reales en el `.origin`.

## Cuándo aplica

- Scaffoldeas un módulo nuevo, agregas un campo o agregas una operación — editas la YAML, ejecutas `catalyst generate …` y commiteas tanto la YAML como los archivos generados.
- Ves un archivo `.origin` después de regenerar — una edición a mano divergió del scaffold anterior; decide qué versión queda y borra el `.origin`.
- Quieres un verbo personalizado — decláralo en `additionalApis`, regenera y completa el stub que el CLI produce.
- Quieres omitir operaciones o archivos específicos — consulta [Excluir APIs](../../../guides/backend/exclude-generated-apis/).

## Trade-offs y límites

- **El CLI no borra archivos huérfanos.** Quitar una operación de la YAML no elimina los archivos que ya emitió — bórralos a mano después.
- **Las ediciones estructurales cuestan caras.** Cambiar decoradores, firmas de métodos o imports de un archivo generado convierte cada regeneración futura en una revisión de `.origin`. Cuando se pueda, expresa el cambio en la YAML.
- **El vocabulario CRUD es cerrado.** La tabla de operaciones de arriba es el conjunto completo; cualquier otra cosa va en `additionalApis`.

## Relacionado

- [Excluir APIs](../../../guides/backend/exclude-generated-apis/) — cómo funcionan `excludedOperations` y `excludedFiles` en la práctica.
- [Referencia de `catalyst generate`](../../../reference/cli-commands/generate/) — cada flag y argumento.
- [Regiones de preservación](../../frontend/preservation-regions/) — cómo proteger código personalizado dentro de una plantilla generada.
