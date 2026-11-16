---
title: Crear un cubo de informes
description: Escribe un cubo de informes en el bounded context que posee su tabla de hechos, declara dimensiones, medidas, joins, columnas de tenant y un informe curado, regístralo y verifica que se ejecuta.
---

## Objetivo

Añadir un informe de agregación nuevo: un cubo con una instancia de informe curada que aparece en el catálogo de informes y se ejecuta a través del motor de informes.

## Antes de empezar

- El bounded context de reporting está en el proyecto y el módulo del motor se importa una sola vez (`ReportEngineModule.forRoot()` en el módulo `@api` de reporting).
- Hay un rol de base de datos de solo lectura configurado para los informes (`REPORTS_DATABASE_USER` y `REPORTS_DATABASE_PASSWORD`). En producción el backend se niega a arrancar sin él.
- Conoces el [concepto](../../../concepts/backend/report-engine/), en particular qué hacen la guarda de cardinalidad y `tenantColumns`.

## Pasos

1. **Coloca el archivo junto a su tabla de hechos.** Pon el cubo en el bounded context que posee la tabla de la que sale una fila del informe, en `backend/src/@app/<bc>/shared/cubes/<name>.cube.ts`. Expórtalo desde el barrel `shared/cubes/index.ts` y reexporta ese barrel desde `shared/index.ts`. Nombra la clave `reporting.<context>.<name>`. El cubo es un dato plano de tipo `ReportCube`, importado de `@aurora/modules/index.js`.

2. **Decide el grano y después declara la tabla de hechos.** Primero responde: ¿qué representa una fila de la tabla de hechos? Eso decide qué medidas tienen sentido y si se podría ampliar un cubo existente con el mismo grano.

   ```ts
   export const ordersByStatusCube: ReportCube = {
     key: 'reporting.sales.orders-by-status',
     category: 'Ventas',
     description: 'Pedidos agrupados por estado.',
     resultMode: 'client',
     primaryTableAlias: 'ord',
     primaryTableSql: 'sales_order ord',
   ```

3. **Declara dimensiones y medidas.** Una dimensión es una columna agrupable con una expresión calificada por alias. Una medida es un `aggregate` sobre una expresión, o un `ratio` de dos medidas agregadas del mismo cubo, nombradas por clave.

   ```ts
     dimensions: [
       { key: 'status', expression: 'ord.status', tableAlias: 'ord', display: { label: 'Estado' } },
     ],
     measures: [
       { kind: 'aggregate', key: 'orders', expression: '*', tableAlias: 'ord', aggregateFunction: 'COUNT' },
       { kind: 'aggregate', key: 'amount', expression: 'ord.total', tableAlias: 'ord', aggregateFunction: 'SUM' },
       { kind: 'ratio', key: 'avg_amount', numerator: 'amount', denominator: 'orders' },
     ],
   ```

   `display` es solo serializable: las etiquetas son strings simples y `cellRenderer` es una clave de texto, nunca una función.

4. **Declara los joins con su cardinalidad real.** Para cada join, escribe el fragmento SQL completo y márcalo `one` (una búsqueda que no multiplica las filas de hechos) o `many` (una tabla pivote o una relación uno a muchos, que sí las multiplica). Lee el esquema del contexto propietario para decidirlo y justifícalo en un comentario de una línea. Si no puedes justificarlo, para y pregunta.

   ```ts
     joins: [
       {
         tableAlias: 'cus',
         sql: 'INNER JOIN sales_customer cus ON cus.id = ord.customer_id',
         type: 'inner',
         cardinality: 'one', // un cliente por pedido
       },
     ],
   ```

5. **Declara `tenantColumns` solo donde existe una columna de tenant.** Una entrada por cada alias de tabla que tenga su propia columna de tenant, con `column`, `isArray` y, opcionalmente, `nullable`. Una tabla sin ella no lleva entrada. Comprueba cada tabla en el esquema de su contexto propietario; no inventes una entrada transitiva. Un predicado sobre la tabla de hechos ya acota las filas que producen sus joins.

   ```ts
     tenantColumns: {
       ord: { column: 'ord.tenant_id', isArray: false, nullable: false },
     },
   ```

6. **Declara `requiredPermissions`.** Enumera los permisos de lectura de cada contexto cuyas tablas toca el cubo, usando solo permisos ya sembrados, como `iam.account.get` para la tabla de cuentas. La cuenta necesita todos. Una cadena de permiso inventada nunca se siembra, así que todos recibirían `403`. Los permisos se asignan a los roles a mano en las pantallas de IAM: indica a quien los administra cuáles necesita el cubo.

   ```ts
     requiredPermissions: ['sales.order.get', 'sales.customer.get'], // los permisos get sembrados de ambos contextos
   ```

7. **Declara al menos una entrada en `systemReports`.** Sin ella, el cubo se rechaza en el arranque. Su `name` es su identidad: el cargador busca o crea el informe almacenado por `definitionKey` y `name`.

   ```ts
     systemReports: [
       { name: 'Pedidos por estado', selection: { dimensions: ['status'], measures: ['orders'] } },
     ],
   };
   ```

   `category` es un nombre que se resuelve a una fila de categoría, con `System` como alternativa. Una categoría nueva necesita antes una entrada en el seed de reporting.

8. **(Opcional) Añade filtros declarados.** Usa `filters` cuando un informe deba acotar filas por algo por lo que no agrupas, como un periodo. Un widget `dateRange` usa el operador `within` sobre un destino `interval`. Las claves deben ser únicas entre dimensiones, medidas y filtros.

9. **Registra el cubo en su contexto.** En el módulo `@api` del mismo bounded context, añade el cubo a `ReportEngineModule.forFeature([...])` dentro de `imports`. No vuelvas a importar el módulo raíz del motor.

   ```ts
   imports: [ReportEngineModule.forFeature([ordersByStatusCube])],
   ```

   El import y esta línea están en la sección de mantenimiento manual del módulo generado. Edita el archivo directamente; la conciliación `.origin` los conserva entre regeneraciones.

## Verifica que funciona

- Arranca el backend. El registro valida la unicidad de claves, las referencias de las ratios, los filtros declarados y cada selección de `systemReports`, y después el seed registra en el log las instancias creadas.
- Ejecuta los tests de reporting: `pnpm --filter aurora-back test src/@aurora/modules/report-engine src/@app/reporting`.
- Ejecuta el informe desde la pantalla de reporting con una cuenta real y compara los totales con una consulta directa. `tenantColumns` no se comprueba en el arranque, así que verifícalo a mano: inicia sesión con una cuenta de un solo tenant y confirma que ve únicamente sus filas.

## Solución de problemas

**El cubo está en disco pero el informe no aparece.** Nadie lo aporta. Añádelo a `forFeature`. El cargador trata los informes almacenados bajo esa clave como huérfanos y los borra, con sus favoritos, en el siguiente arranque, y no hay aviso para un cubo que nadie registra.

**El arranque falla nombrando una clave duplicada.** Dos cubos, quizá de contextos distintos, comparten clave. Renombra uno.

**Todos reciben `403` en el informe.** Un permiso de `requiredPermissions` nunca se sembró, o ningún rol lo tiene. Usa los permisos CRUD sembrados y asígnalos a un rol.

**Se rechaza una selección por insegura.** Un join `many` hace inseguros `SUM` y `AVG` en el otro lado, y dos joins `many` los hacen inseguros en todas partes. Agrega en el lado seguro, usa `COUNT` o reestructura el cubo.

**Al renombrar un informe de sistema se perdieron sus favoritos.** `name` es la identidad. Renombrar borra la fila antigua y sus favoritos y siembra una nueva.

**El informe devuelve una marca `tooLarge`.** En modo client el resultado superó el tope de filas. Agrupa por menos dimensiones, añade un filtro o usa `resultMode: 'server'`.

## Relacionado

- [Motor de informes](../../../concepts/backend/report-engine/) — el modelo detrás de cada paso.
- [Alcance por tenant](../../../concepts/backend/tenant-scope/) — el acotado de los endpoints normales.
- [Ports entre bounded contexts](../../../concepts/backend/cross-bounded-context-ports/) — por qué un cubo puede hacer join con tablas de otro contexto.
