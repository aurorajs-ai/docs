---
title: Tenant scope
description: How a hasTenant module keeps each caller inside their own tenants — the generated TenantConstraint and TenantPolicy decorators, the dTenants snapshot, and why relations are denied by default.
---

## Why this exists

A multi-tenant application keeps the data of several organizations in the same tables. The rule that one tenant never sees another's rows has to hold on every endpoint, for every operation, including the ones a developer forgot about. Hand-writing that filter in each handler guarantees that one of them will miss it.

Aurora makes it a declaration. A module that declares `hasTenant: true` in its YAML gets the scoping emitted into every generated resolver and controller. The developer does not write the filter and cannot forget it.

The same declaration closes a less obvious leak. A query language that can follow relations can also ask a question the caller should not be able to ask: "does any row exist, in someone else's tenant, that matches this?". The tenant scope therefore decides which relations a client may cross, and the default is none.

## How it works

### Who the caller is: `dTenants`

Every account carries `dTenants`, a denormalized list of the tenant ids it may act in. It is derived from the account's direct tenant memberships. If the account has `hasAddChildTenants` set, it also includes every current descendant of those tenants. It is read-only to clients and recomputed on account create, on account update and on every token issuance (authorization code, refresh token, client credentials and impersonation). The refresh writes only when the value changed. If it fails, token issuance still succeeds with the stored snapshot and the error is logged.

An account with an empty `dTenants` is not "unrestricted". It matches no row.

### Reads: `@TenantConstraint`

On every generated read, and on the lookup of every generated update and delete by id, the resolver or controller runs `@TenantConstraint` before the handler. It does two things.

First, it classifies what the client sent. The `query`, the `constraint` and the aggregated field are checked against the module's field schema. Any relation outside the module's declared list, any unknown field and any malformed shape is rejected with HTTP `400` and `Errors.TenantScopeQueryRejected`. The error names the offending path in the caller's own input, never a tenant id or a stored value.

Second, it builds a new constraint `{ and: [callerWhere, tenantWhere] }`, where `tenantWhere` matches the module's tenant column against the caller's `dTenants`. The caller's whole `where`, including any `or`, stays one indivisible operand, so the tenant predicate always applies next to it.

The tenant column is `tenantId` (a single tenant, matched with `in`) or `tenantIds` (an array, matched with `overlap`). The generator matches those two names exactly, never by prefix. A nullable tenant column means that `NULL` is a global record visible to every tenant, and the predicate becomes `isNull OR <scoped>`.

### Writes: `@TenantPolicy`

Creates and updates run `@TenantPolicy` over the payload. A tenant value outside the caller's `dTenants` is rejected with `403` (`Errors.TenantScopeViolation`); a bulk payload is rejected whole if any item is out of scope. On create, a payload with no tenant value is a `400` (`Errors.TenantScopeMissingProperty`), because the value decides where the row is born. On update an absent value means "leave it as is" and is allowed, since the row was already scoped by `@TenantConstraint`. A present value is checked either way. An empty tenant array in a payload is rejected, never read as "every tenant".

### Fail closed

If `@TenantConstraint` or `@TenantPolicy` finds no principal at the position of the account argument, it throws `Errors.TenantScopeMisconfigured` (`500`) and the handler never runs. That is a wiring bug in the emitted code, not a caller mistake, and the response does not describe it. The detail goes to the server log.

### Relations: deny by default

Before this rule, a client could send `where: { someRelation: { ... } }` and the engine compiled it to an `EXISTS` subquery with no tenant predicate. Combined with a count, that answers "is there a matching row in another tenant?". `relations`, `order` and `aggregation` leaked the same way.

Now a relation is crossed only if the module declares `traversableInTenantScope: true` on that relationship, and then one hop only: inside the related record, only its own scalar fields are usable. The classifier works against the field schema and never strips what it rejects. It fails the request. The framework never infers which relations are safe. That follows from the declare-never-infer rule: the YAML says it, or it does not happen.

## When it applies

- You set `hasTenant: true` on a module, or you wonder why a query that follows a relation now returns `Errors.TenantScopeQueryRejected`.
- A client creates or updates a record for a tenant the account does not belong to and receives a `403`.
- An account sees no data in a tenant-scoped list. Check its `dTenants` before suspecting the filter.

## Trade-offs and limits

- **A `hasTenant` module with no traversable relation rejects every relation.** That is deny-by-default working as intended: a request that names a relation fails. Declare each relation you need.
- **The target of a traversable relation is not tenant-scoped by this rule.** Only the one hop is allowed. Declare a relation traversable when its target is safe to read from this tenant, such as the tenant record itself or a parent the same tenant owns.
- **Generation refuses unsafe setups.** `hasTenant: true` needs `hasOAuth: true` (the decorators need the authenticated account), needs a `tenantId` or `tenantIds` property, and needs `getRaw` and `upsert` in `excludedOperations`. Those two have no `constraint` argument to scope their row lookup. Each error names the module and the remedy.
- **Report cubes are scoped separately.** The report engine declares `tenantColumns` per table alias. See [Report engine](../report-engine/).

## Related

- [Scope a module by tenant](../../../guides/backend/scope-a-module-by-tenant/) — the recipe: declare the flag, mark the relations, verify.
- [QueryStatement reference](../../../reference/query-statement/) — the query language the scope classifies.
- [Module YAML keys](../../../reference/module-yaml/) — `hasTenant` neighbors and `traversableInTenantScope`.
- [Account impersonation](../account-impersonation/) — an impersonated session is scoped by the target account's `dTenants`.
