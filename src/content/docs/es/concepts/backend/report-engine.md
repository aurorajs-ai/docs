---
title: Motor de informes
description: Cómo ejecuta Aurora los informes de agregación curados — los cubos como lista blanca en compilación, un único registro alimentado por cada bounded context, la ejecución por informe almacenado y las protecciones alrededor del SQL.
---

## Por qué existe

Un endpoint de listado puede agrupar y agregar, pero un informe es otro trabajo: KPIs curados, joins entre varias tablas, resultados con la forma que necesita un gráfico. Dejar que un cliente componga ese SQL le abriría la puerta a todas las tablas. Dejar que cada bounded context escriba a mano sus propias consultas de informes duplicaría en muchos sitios el mismo trabajo de seguridad, como el acotado por tenant y las comprobaciones de permisos.

El motor de informes es el único lugar donde se ejecutan los informes. El desarrollador describe qué se puede informar como un **cubo**, y el motor ejecuta solo lo que el cubo permite. Un cliente nunca envía SQL, un nombre de tabla ni una expresión. Elige un informe almacenado y, como mucho, sustituye filtros, orden y página.

## Cómo funciona

### El cubo: una lista blanca en compilación

Un cubo es un dato plano en el código, sin decoradores ni inyección. Declara:

- la **tabla de hechos** (`primaryTableSql` y su alias): qué es una fila del informe;
- las **dimensiones**: columnas por las que se puede agrupar, cada una con una clave, una expresión SQL y metadatos de visualización;
- las **medidas**: un `aggregate` (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX` sobre una expresión) o un `ratio` de otras dos medidas agregadas del mismo cubo, compilado de forma que un denominador cero da `NULL` y la división entera nunca trunca;
- los **filtros declarados**: filtros de filas que no añaden columna, como un rango de fechas sobre un intervalo;
- los **joins**, cada uno con una `cardinality` declarada (`one` o `many`) respecto a la tabla de hechos;
- `tenantColumns`, `requiredPermissions`, un `baseFilter` opcional, un `resultMode` y una `category`;
- `systemReports`: al menos una instancia de informe curada, con su selección almacenada.

Todo lo que un cliente puede nombrar debe existir en esta lista. La selección se valida contra el cubo antes de construir ningún SQL.

### Un registro, muchos contribuyentes

El módulo raíz del motor se importa una sola vez, desde el módulo de reporting, y es dueño del registro, del servicio de ejecución y de la conexión de solo lectura. Cada bounded context que posee un cubo lo aporta importando el módulo feature con sus cubos, en su propio módulo `@api`. El archivo del cubo vive en el contexto que posee su tabla de hechos.

En el arranque el registro descubre todas las contribuciones de la aplicación, y dos cubos con la misma clave, incluso de contextos distintos, hacen fallar el arranque nombrando la clave. Un cubo que nadie aporta simplemente no se registra, y el siguiente arranque borra los informes de sistema almacenados que apuntaban a él, junto con sus favoritos.

### Ejecución por informe almacenado

Un cliente ejecuta un informe por su id almacenado, mediante la mutación `reportingExecuteReportReport` o el endpoint REST equivalente. El payload lleva `reportId` y, opcionalmente, `filters`, `sort` y `pagination` en tiempo de ejecución. No existe una clave de cubo, una selección ni un parámetro libre suministrado por el cliente.

El handler carga el informe almacenado, aplica la misma regla de visibilidad de filas que el catálogo y ejecuta la selección almacenada combinada con los valores de ejecución. Un informe que no existe y un informe que el llamante no puede ver producen el mismo error de no encontrado, de modo que la ejecución nunca revela que un informe existe. Un filtro de ejecución sustituye al almacenado con el mismo id y conserva los demás. Un orden de ejecución no vacío sustituye al orden almacenado.

### El contrato de filtros

Un filtro es `{ id, operator, value }`, donde `value` es un objeto cuyos campos dependen del operador. Hay tres operadores, y el motor fija qué destino admite cada uno:

| Operador | Destino | Se compila a |
| --- | --- | --- |
| `eq` | una dimensión | un predicado `WHERE`, esté o no seleccionada la dimensión |
| `gte` | una medida | un predicado `HAVING` |
| `within` | un filtro declarado de intervalo | una contención `WHERE` semiabierta sobre el intervalo |

Los modos client y server compilan filtros y orden de forma idéntica. `resultMode` solo elige entre una consulta con tope y un par de conteo más consulta paginada.

### Las protecciones alrededor del SQL

- **Conexión de solo lectura.** Los informes se ejecutan en un pool dedicado con un rol de base de datos de solo lectura. En el arranque, una comprobación previa verifica que el rol no puede escribir, y un fallo aborta el arranque. En producción, que falte el usuario de solo lectura es un fallo de arranque.
- **Acotado por tenant por columna.** El motor añade un predicado de tenant por cada alias de tabla que declara una columna de tenant, y ninguno para un alias que no la declara. Se rechaza una cuenta ausente y también unos `dTenants` vacíos, incluso cuando el cubo no declara columna de tenant.
- **Guarda de cardinalidad.** Un join `many` hace inseguros `SUM` y `AVG` en el otro lado, porque las filas se multiplican, y dos joins `many` los hacen inseguros en todas partes. El motor rechaza esas selecciones. `COUNT` siempre es seguro.
- **Tope de filas.** En modo client el resultado tiene un tope (50 000 filas por defecto) y un resultado que lo supera devuelve una marca `tooLarge` sin filas parciales. El modo server pagina.
- **Permisos.** `requiredPermissions` protege el cubo, de modo que un usuario que no puede leer los datos de origen no puede leer sus agregados.

## Cuándo aplica

- Un responsable pide un conteo, un total o una ratio agrupados por alguna dimensión, y un listado simple no lo expresa.
- Necesitas el mismo informe en un widget de un panel y en una pantalla de informes.
- Ves desaparecer un informe almacenado tras un despliegue: su cubo ya no se aporta.

## Compromisos y límites

- **Los cubos son código.** Una dimensión o medida nueva es un cambio de código y un despliegue. Es el precio de una lista blanca.
- **Solo tres operadores.** `eq`, `gte` y `within`. Añadir uno es un cambio deliberado del motor, que se hace cuando un informe real lo necesita.
- **Las columnas de tenant se declaran a mano.** El arranque valida claves, ratios, filtros y selecciones, pero no `tenantColumns`. Una entrada errónea o ausente arranca sin quejas y filtra de más o de menos, así que revísala contra el esquema del contexto propietario.
- **Un cubo puede hacer join con tablas de otro contexto.** Es una relajación documentada y de solo lectura de la regla de bridges, justificada por la agregación. El cubo sigue sin importar código de ese contexto.
- **Un filtro `within` no captura los intervalos abiertos.** Una fila cuya columna de fin es `NULL` nunca coincide, porque `NULL < $to` nunca es verdadero. Decide en cada informe si las filas en curso deben contar.
- **La agregación de `QueryStatement` no es esto.** El bloque `aggregation` ad hoc de un endpoint de listado es simple a propósito. Consulta la [referencia de QueryStatement](../../../reference/query-statement/).

## Relacionado

- [Crear un cubo de informes](../../../guides/backend/author-a-report-cube/) — la receta paso a paso.
- [Alcance por tenant](../tenant-scope/) — el acotado de los endpoints normales; los cubos declaran el suyo por alias de tabla.
- [Ports entre bounded contexts](../cross-bounded-context-ports/) — por qué los joins de un cubo son una excepción declarada.
