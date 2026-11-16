---
title: Compose a QueryStatement
description: Build where/relations/order clauses in a handler or service, forward constraint for scoping, and load relations without leaking masked fields.
---

## Goal

Compose a typed `QueryStatement` inside a handler or service — `where`, `relations`, `order`, `limit` — and load relations without leaking masked fields. For every operator, block and limit of the language, see the [Query Statement reference](../../../reference/query-statement/).

## Before you start

- You have a backend handler or service scaffolded (a read handler is the common case).
- You understand the two `QueryStatement` parameters a catalyst handler receives:
  - `queryStatement` — the **client-facing** filter / sort / pagination payload, from the resolver or controller.
  - `constraint` — the **server-side scope** (tenant id, permission filter), injected upstream by middleware or decorators. On a `hasTenant: true` module, the tenant scope also decides which relations a client may traverse: see [Tenant scope](../../../concepts/backend/tenant-scope/).

  Treat both as read-only. Merging them is the service layer's job.
- `@aurorajs.dev/core-back` is installed — it ships with every Catalyst backend.

## Steps

1. **Type the statement.** Always annotate it, so the compiler checks the shape of each block:

   ```typescript
   import { QueryStatement } from '@aurorajs.dev/core-back';
   ```

2. **Build `where` with bare operator keys.** A field maps to a comparison object, and sibling fields are ANDed:

   ```typescript
   const queryStatement: QueryStatement = {
     where: {
       and: [
         { isActive: { eq: true } },
         { name: { iLike: `${query.prefix}%` } },
       ],
     },
     order: [{ field: 'createdAt', dir: 'desc' }],
     limit: query.limit ?? 50,
   };
   ```

   The operator vocabulary is closed: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `between`, `isNull`, `iLike`, `contains`, `overlap`, plus the connectors `and`, `or` and `not`. A key outside that list is rejected before any SQL runs, so a typo fails loudly instead of degrading into a different filter. If you prefer constants to string keys, `WHERE_OPERATOR` and `LOGICAL_OPERATOR` come from `@aurorajs.dev/core-back`.

3. **Load relations with `relations`.** A relation name maps to `true`, or to a node that shapes the loaded children:

   ```typescript
   const queryStatement: QueryStatement = {
     where: { id: { eq: accountId } },
     relations: { user: true, tenant: true },
   };
   ```

   Nest for graph loading:

   ```typescript
   { relations: { state: { relations: { category: true } } } }
   ```

   Keep two axes apart. A relation key inside `where` filters the **parent** rows and loads nothing. A relation key inside `relations` loads children and never filters the parents. Asking for the relation in a GraphQL selection set does not load it either: without a `relations` entry the field comes back `null`.

4. **Forward `queryStatement` and `constraint` to the service unchanged.** Build a new object if you need to augment; do not mutate the incoming ones. When you add a relation to a caller's statement, spread the relations that are already there:

   ```typescript
   return await this.getService.main(
     {
       ...queryStatement,
       relations: { ...queryStatement?.relations, state: { relations: { category: true } } },
     },
     constraint,
     handlerMeta,
   );
   ```

### Loading relations safely

`@Format` and `@ApplySchema` format the returned record with the aggregate's field schema, and they recurse into every relation the field schema declares as a `relation` entry. A masked field of a loaded relation (`type: 'password'`, `secret`, `encrypted`) is therefore masked there too.

That only holds for relations the field schema **declares**. The generator declares every relation from the YAML, and the query engine enforces it: a statement that names a relation missing from the field schema — in `relations`, in `where`, or in an `order` or `aggregation` dot-path — fails with HTTP `400` and `Errors.RelationNotQueryable`. A relation that exists only in the Drizzle relations file is not reachable from a query. Back-relations (a custom-field value to its parent, an i18n companion to its parent) are not queryable at all.

If you hand-write a relation, declare it in the module's YAML and regenerate, instead of adding it to the relations file alone.

## Verify it worked

- Run the handler with a query that uses `iLike` or `between`, and check the rows: the predicate applies to the column you named.
- Load a relation that has a masked field, and confirm the field is absent from the returned JSON.
- Confirm `constraint` is not echoed in the response or in error messages — it carries tenant / permission scope that must stay server-side.

## Troubleshooting

**The statement fails before reaching the database.** The validator is default-deny: an unknown operator, an unknown top-level key, a `limit` above 10000, or nesting deeper than 10 levels is rejected with a message that names the path. Check the [reference](../../../reference/query-statement/#validation--security).

**HTTP `400` with `Errors.RelationNotQueryable`.** The statement names a relation that the aggregate's field schema does not declare. Declare the relationship in the YAML and regenerate.

**HTTP `400` with `Errors.TenantScopeQueryRejected`.** The module is `hasTenant: true` and the statement crosses a relation that is not declared traversable in tenant scope. See [Tenant scope](../../../concepts/backend/tenant-scope/).

**HTTP `403` with `Errors.MaskedPropertyNotQueryable`.** The statement filters, sorts or aggregates by a `secret`, `password` or `encrypted` property, directly or through a relation. Remove it from the statement. Trusted backend code that really needs it passes `unsafeAllowMaskedPropertyQuery(...)` as the `exemption` of the repository call: see the [reference](../../../reference/query-statement/#masked-properties-are-not-queryable).

**The service's merge breaks after my handler runs.** You mutated `queryStatement` or `constraint`. Treat them as read-only. If you need a merged object, build a new one from a spread.

**You want to hide a column with a projection.** The language has no projection key: there is no `attributes`. Mask sensitive fields through the field schema's `format` handler (`@Format` / `@ApplySchema`), which runs on every read regardless of how the query was built.

## Related

- [Query Statement reference](../../../reference/query-statement/) — every operator, block and limit.
- [Field-schema decorators](../apply-field-schema-decorators/) — the validation / format side of the declarative layer.
- [Backend module scaffolding](../../../concepts/backend/module-scaffolding/) — how relationships are declared in YAML.
