---
title: Scope a module by tenant
description: Declare hasTenant on a module, choose which relations a client may traverse, regenerate, and verify that each caller stays inside their own tenants.
---

## Goal

Make every generated endpoint of a module return and accept only rows of the caller's tenants, and decide which relations a client may follow from it.

## Before you start

- A Catalyst project with the module's `cliter/<bounded-context>/<module>.module.yaml`.
- The module is protected by OAuth (`hasOAuth: true`). Tenant scope needs the authenticated account.
- You know the [concept](../../../concepts/backend/tenant-scope/): scope comes from the caller's `dTenants`, and relations are denied by default.

## Steps

1. **Declare the flag and the tenant column.** At the top of the YAML, set `hasTenant: true` next to `hasOAuth: true`. Add the column the scope compares against: `tenantId` for a row that belongs to one tenant, `tenantIds` (type `array`) for a row shared by several. The generator matches these two names exactly. Make the column nullable only if a `NULL` should mean "visible to every tenant".

   ```yaml
   hasOAuth: true
   hasTenant: true
   aggregateProperties:
     - name: tenantId
       type: id
       nullable: false
       index: index
       relationship:
         type: many-to-one
         aggregateName: IamTenant
         modulePath: iam/tenant
         key: id
         field: tenant
         avoidConstraint: true
   ```

2. **Exclude the two operations that cannot be scoped.** `getRaw` and `upsert` have no `constraint` argument to attach the scope to. Generation fails until both are in `excludedOperations`.

   ```yaml
   excludedOperations:
     - getRaw
     - upsert
   ```

3. **Mark the relations a client may follow.** Add `traversableInTenantScope: true` to the `relationship` block of each relation that a list or detail query needs to load, filter by or sort by. Without it, a request that names that relation fails. This includes the tenant relation above if the UI shows the tenant.

   ```yaml
       relationship:
         type: many-to-one
         aggregateName: BusinessPartnerPortalBusinessPartner
         modulePath: business-partner-portal/business-partner
         key: id
         field: businessPartner
         avoidConstraint: true
         traversableInTenantScope: true
   ```

   Only one hop is allowed, and the related record is not itself scoped by tenant. Mark a relation only when its target is safe to read from this tenant.

4. **Regenerate.**

   ```bash
   catalyst generate back module --name=<bounded-context>/<module> --force
   ```

5. **Hand-written endpoints use the decorator yourself.** If you add a read of your own on a `hasTenant` aggregate, apply `@TenantConstraint` from `@aurorajs.dev/core-back`. It needs the aggregate's field schema and the position of the query argument. If the tenant column is an array such as `tenantIds`, also set `targetProperty: 'tenantIds'` and `isArray: true`. The generated resolvers show the full shape.

   ```ts
   @TenantConstraint({
     fieldSchema: ContactFieldSchema,
     queryStatementIndex: 1,
     allowedRelations: ['tenant'],
   })
   async main(account, queryStatement, constraint, meta) { /* … */ }
   ```

   Only `queryStatementIndex` is required: it is `null` when the method takes no query, and it has no default on purpose, because a default would silently leave a query unchecked. `aggregateFieldIndex` is optional; set it only on `sum`, `max` and `min`, where it points at the aggregated field. `targetProperty` defaults to `'tenantId'` and `isArray` to `false`; set them when the tenant column is an array such as `tenantIds`:

   ```ts
   @TenantConstraint({
     fieldSchema: ContactFieldSchema,
     queryStatementIndex: 1,
     targetProperty: 'tenantIds',
     isArray: true,
   })
   ```

## Verify it worked

- Read the generated resolver of a list operation. It carries `@TenantConstraint` with your `allowedRelations`; the create and update resolvers carry `@TenantPolicy`.
- Sign in with an account whose `dTenants` holds only tenant A. A list returns only A's rows, and creating a row with tenant B's id returns `403`.
- Send a query that names a relation you did not mark. It returns `400` with `Errors.TenantScopeQueryRejected` and the path of the offending key.

## Troubleshooting

**`[tenant-property-missing ERROR]`.** The module declares `hasTenant: true` but has no `tenantId` or `tenantIds` property. Add one, or drop the flag.

**`[tenant-requires-oauth ERROR]`.** Set `hasOAuth: true`, or drop `hasTenant`. Without a guard, the decorators find no account and every request would fail with a `500`.

**`[tenant-no-constraint-operation ERROR]`.** Add the named operation (`getRaw` or `upsert`) to `excludedOperations`.

**A list the account should see comes back empty.** Check the account's `dTenants` first. An empty list matches no row, and a new tenant membership reaches `dTenants` on the next token issuance.

**`403` on an update the user is allowed to make.** The payload carries a tenant value outside the caller's scope. Send the tenant column only when you mean to change it; on update an absent value is left as is.

## Related

- [Tenant scope](../../../concepts/backend/tenant-scope/) — why the scope is shaped this way.
- [Exclude CLI-generated APIs from a module](../exclude-generated-apis/) — `excludedOperations` in detail.
- [Compose a QueryStatement](../query-with-querystatement/) — the query language and its relation rules.
- [Module YAML keys](../../../reference/module-yaml/) — `traversableInTenantScope`.
