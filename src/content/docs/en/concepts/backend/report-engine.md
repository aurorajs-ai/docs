---
title: Report engine
description: How Aurora executes curated aggregation reports — cubes as a compile-time whitelist, one registry fed by every bounded context, execution by stored report, and the safety rails around the SQL.
---

## Why this exists

A list endpoint can group and aggregate, but a report is a different job: curated KPIs, joins across several tables, results shaped for a chart. Letting a client compose that SQL would hand it an open door to every table. Letting each bounded context hand-write its own reporting queries would duplicate the same safety work, such as tenant scoping and permission checks, in many places.

The report engine is the single place that runs reports. A developer describes what may be reported as a **cube**, and the engine runs only what the cube allows. A client never sends SQL, a table name or an expression. It picks a stored report and, at most, overrides filters, sort and page.

## How it works

### The cube: a compile-time whitelist

A cube is plain data in code, with no decorators and no injection. It declares:

- the **fact table** (`primaryTableSql` and its alias): what one row of the report is;
- **dimensions**: columns you can group by, each with a key, an SQL expression and display metadata;
- **measures**: either an `aggregate` (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX` over an expression) or a `ratio` of two other aggregate measures of the same cube, compiled so that a zero denominator yields `NULL` and integer division never truncates;
- **declared filters**: row filters that do not add a column, such as a date range over an interval;
- **joins**, each with a declared `cardinality` (`one` or `many`) relative to the fact table;
- `tenantColumns`, `requiredPermissions`, an optional `baseFilter`, a `resultMode` and a `category`;
- `systemReports`: at least one curated report instance, with its stored selection.

Everything a client can name must exist in this list. The selection is validated against the cube before any SQL is built.

### One registry, many contributors

The engine's root module is imported once, by the reporting module, and owns the registry, the execution service and the read-only connection. Each bounded context that owns a cube contributes it by importing the feature module with its cubes, in its own `@api` module. The cube file lives in the context that owns its fact table.

At boot the registry discovers every contribution across the application, and two cubes with the same key, even from different contexts, fail the boot naming the key. A cube that nothing contributes is simply not registered, and the next boot deletes the system reports that pointed at it, together with their favorites.

### Execution by stored report

A client runs a report by its stored id, through the `reportingExecuteReportReport` mutation or the matching REST endpoint. The payload carries `reportId` and, optionally, runtime `filters`, `sort` and `pagination`. There is no client-supplied cube key, selection or free-form parameter.

The handler loads the stored report, applies the same row-visibility rule as the catalog, and runs the stored selection merged with the runtime values. A report that does not exist and a report the caller may not see produce the same not-found error, so execution never reveals that a report exists. A runtime filter replaces the stored one with the same id and keeps the others. A non-empty runtime sort replaces the stored sort.

### The filter contract

A filter is `{ id, operator, value }`, where `value` is an object whose fields depend on the operator. There are three operators, and the engine fixes which target takes which:

| Operator | Target | Compiles to |
| --- | --- | --- |
| `eq` | a dimension | a `WHERE` predicate, whether or not the dimension is selected |
| `gte` | a measure | a `HAVING` predicate |
| `within` | a declared interval filter | a half-open `WHERE` containment on the interval |

Client and server modes compile filters and sort identically. `resultMode` only chooses between one capped query and a count plus a paginated pair.

### The rails around the SQL

- **Read-only connection.** Reports run on a dedicated pool with a read-only database role. At boot a preflight checks that the role cannot write, and a failure aborts the boot. In production, a missing read-only user is a boot failure.
- **Tenant scoping per column.** The engine adds a tenant predicate for each table alias that declares a tenant column, and none for an alias without one. An absent account is rejected, and so is an empty `dTenants`, even when the cube declares no tenant column.
- **Cardinality guard.** A `many` join makes `SUM` and `AVG` on the other side unsafe, because rows multiply, and two `many` joins make them unsafe everywhere. The engine rejects those selections. `COUNT` is always safe.
- **Row cap.** In client mode the result is capped (50 000 rows by default) and an over-cap result returns a `tooLarge` marker with no partial rows. Server mode paginates.
- **Permissions.** `requiredPermissions` gates the cube, so a user who cannot read the underlying data cannot read its aggregates.

## When it applies

- A stakeholder asks for a count, a total or a ratio grouped by some dimension, and a plain list cannot express it.
- You need the same report on a dashboard widget and on a report screen.
- You see a stored report disappear after a deploy: its cube is no longer contributed.

## Trade-offs and limits

- **Cubes are code.** A new dimension or measure is a code change and a deploy. That is the price of a whitelist.
- **Only three operators.** `eq`, `gte` and `within`. Adding one is a deliberate change to the engine, made when a real report needs it.
- **Tenant columns are declared by hand.** Boot validates keys, ratios, filters and selections, but not `tenantColumns`. A wrong or missing entry boots cleanly and leaks or over-filters data, so review it against the owning context's schema.
- **A cube may join tables of another context.** That is a documented, read-only relaxation of the bridges rule, justified by aggregation. The cube still imports no code from that context.
- **A `within` filter misses open intervals.** A row whose end column is `NULL` never matches, because `NULL < $to` is never true. Decide per report whether in-progress rows should count.
- **`QueryStatement` aggregation is not this.** The ad-hoc `aggregation` block of a list endpoint stays simple on purpose. See [QueryStatement reference](../../../reference/query-statement/).

## Related

- [Author a report cube](../../../guides/backend/author-a-report-cube/) — the step-by-step recipe.
- [Tenant scope](../tenant-scope/) — scoping for ordinary endpoints; cubes declare theirs per table alias.
- [Cross-bounded-context ports](../cross-bounded-context-ports/) — why cube joins are a stated exception.
