---
title: Author a report cube
description: Write a report cube in the bounded context that owns its fact table, declare dimensions, measures, joins, tenant columns and a curated report, register it, and verify it runs.
---

## Goal

Add a new aggregation report: a cube with a curated report instance that appears in the report catalog and runs through the report engine.

## Before you start

- The reporting bounded context is in the project, and its engine module is imported once (`ReportEngineModule.forRoot()` in the reporting `@api` module).
- A read-only database role is configured for reports (`REPORTS_DATABASE_USER` and `REPORTS_DATABASE_PASSWORD`). In production the backend refuses to boot without it.
- You know the [concept](../../../concepts/backend/report-engine/), in particular what the cardinality guard and `tenantColumns` do.

## Steps

1. **Place the file with its fact table.** Put the cube in the bounded context that owns the table one row of the report comes from, at `backend/src/@app/<bc>/shared/cubes/<name>.cube.ts`. Export it through the `shared/cubes/index.ts` barrel and re-export that from `shared/index.ts`. Name the key `reporting.<context>.<name>`. The cube is plain data typed `ReportCube`, imported from `@aurora/modules/index.js`.

2. **Decide the grain, then declare the fact table.** Answer first: what does one row of the fact table represent? That decides which measures make sense, and whether an existing cube at the same grain could be extended instead.

   ```ts
   export const ordersByStatusCube: ReportCube = {
     key: 'reporting.sales.orders-by-status',
     category: 'Ventas',
     description: 'Orders grouped by status.',
     resultMode: 'client',
     primaryTableAlias: 'ord',
     primaryTableSql: 'sales_order ord',
   ```

3. **Declare dimensions and measures.** A dimension is a groupable column with an alias-qualified expression. A measure is an `aggregate` over an expression, or a `ratio` of two aggregate measures of the same cube, named by key.

   ```ts
     dimensions: [
       { key: 'status', expression: 'ord.status', tableAlias: 'ord', display: { label: 'Status' } },
     ],
     measures: [
       { kind: 'aggregate', key: 'orders', expression: '*', tableAlias: 'ord', aggregateFunction: 'COUNT' },
       { kind: 'aggregate', key: 'amount', expression: 'ord.total', tableAlias: 'ord', aggregateFunction: 'SUM' },
       { kind: 'ratio', key: 'avg_amount', numerator: 'amount', denominator: 'orders' },
     ],
   ```

   `display` is serializable only: labels are plain strings and `cellRenderer` is a string key, never a function.

4. **Declare joins with their true cardinality.** For each join, write the complete SQL fragment and mark it `one` (a lookup that does not multiply fact rows) or `many` (a pivot or one-to-many that does). Read the owning context's schema to decide, and justify it in a one-line comment. If you cannot justify it, stop and ask.

   ```ts
     joins: [
       {
         tableAlias: 'cus',
         sql: 'INNER JOIN sales_customer cus ON cus.id = ord.customer_id',
         type: 'inner',
         cardinality: 'one', // one customer per order
       },
     ],
   ```

5. **Declare `tenantColumns` only where a tenant column exists.** One entry per table alias that has its own tenant column, with `column`, `isArray` and optionally `nullable`. A table without one gets no entry. Check each table in its owning context's schema; do not invent a transitive entry. A predicate on the fact table already scopes the rows its joins produce.

   ```ts
     tenantColumns: {
       ord: { column: 'ord.tenant_id', isArray: false, nullable: false },
     },
   ```

6. **Declare `requiredPermissions`.** List the read permissions of every context whose tables the cube touches, using only permissions already seeded, such as `iam.account.get` for the accounts table. The account needs all of them. A custom permission string is never seeded, so everyone would get `403`. Permissions are assigned to roles by hand in the IAM screens: tell whoever administers them which ones the cube needs.

   ```ts
     requiredPermissions: ['sales.order.get', 'sales.customer.get'], // the seeded get permissions of both contexts
   ```

7. **Declare at least one `systemReports` entry.** The cube is rejected at boot without one. Its `name` is its identity: the loader finds or creates the stored report by `definitionKey` and `name`.

   ```ts
     systemReports: [
       { name: 'Orders by status', selection: { dimensions: ['status'], measures: ['orders'] } },
     ],
   };
   ```

   `category` is a name resolved to a category row, with `System` as the fallback. A new category needs an entry in the reporting seed first.

8. **(Optional) Add declared filters.** Use `filters` when a report must narrow rows by something you do not group by, such as a period. A `dateRange` widget takes the `within` operator over an `interval` target. Keys must be unique across dimensions, measures and filters.

9. **Register the cube in its context.** In the `@api` module of the same bounded context, add the cube to `ReportEngineModule.forFeature([...])` in `imports`. Do not import the engine's root module again.

   ```ts
   imports: [ReportEngineModule.forFeature([ordersByStatusCube])],
   ```

   The import and this line sit in the generated module's manually maintained section. Edit the file directly; `.origin` reconciliation keeps them across regenerations.

## Verify it worked

- Boot the backend. Registration validates key uniqueness, ratio references, declared filters and every `systemReports` selection, and then the seed logs the created instances.
- Run the reporting tests: `pnpm --filter aurora-back test src/@aurora/modules/report-engine src/@app/reporting`.
- Execute the report from the reporting screen with a real account and compare the totals with a direct query. `tenantColumns` is not checked at boot, so verify it by hand: sign in as an account of one tenant and confirm it sees only its own rows.

## Troubleshooting

**The cube is on disk but the report is missing.** Nothing contributes it. Add it to `forFeature`. The loader treats stored reports under that key as orphans and deletes them, with their favorites, at the next boot, and there is no warning for a cube nobody registers.

**Boot fails naming a duplicate key.** Two cubes, possibly in different contexts, share a key. Rename one.

**Everyone gets `403` on the report.** A permission in `requiredPermissions` was never seeded, or no role holds it. Use the seeded CRUD permissions and assign them to a role.

**A selection is rejected as unsafe.** A `many` join makes `SUM` and `AVG` on the other side unsafe, and two `many` joins make them unsafe everywhere. Aggregate on the safe side, use `COUNT`, or restructure the cube.

**A rename of a system report lost its favorites.** `name` is identity. A rename deletes the old row and its favorites and seeds a new one.

**The report returns a `tooLarge` marker.** In client mode the result exceeded the row cap. Group by fewer dimensions, add a filter, or use `resultMode: 'server'`.

## Related

- [Report engine](../../../concepts/backend/report-engine/) — the model behind each step.
- [Tenant scope](../../../concepts/backend/tenant-scope/) — scoping for ordinary endpoints.
- [Cross-bounded-context ports](../../../concepts/backend/cross-bounded-context-ports/) — why a cube may join another context's tables.
