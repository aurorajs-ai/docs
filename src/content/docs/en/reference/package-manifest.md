---
title: Package manifest reference
description: Every key of cliter/packages/<package>.yaml, its validation rules, a complete example and the catalog of packages that catalyst add installs.
---

For why packages work this way, see [Installable packages and scaffold upgrades](../../concepts/workflow/installable-packages/). For the steps, see [Install and upgrade packages](../../guides/workflow/install-and-upgrade-packages/).

## Location and rules

A package has exactly one hand-written manifest at `cliter/packages/<package>.yaml` in the source monorepo. `cliter/packages/` is not a bounded context. The manifest declares data only: it accepts no hooks, scripts or code, and a field outside this reference, an unknown package in `requires`, or a dependency without an exact version fails validation with a message that names the manifest and the field.

## Top-level keys

| Key | Type | Description |
| --- | --- | --- |
| `name` | string | Package name, the one you pass to `catalyst add`. |
| `label` | string | Human-readable name. |
| `requires` | list of strings | Packages installed together with this one. Names only, never version ranges. Resolved transitively. |
| `env` | map | `.env` keys the package needs, applied after the merge. A string is a development default, written when the key is absent. `null` marks a required key with no valid default: the CLI never writes it and reports it when missing. |
| `backend` | map | The backend half. A half with no `paths` is not installed. |
| `frontend` | map | The frontend half. |

## Keys of `backend`

| Key | Description |
| --- | --- |
| `paths` | Copy paths relative to `backend/`. |
| `dependencies` | npm dependencies, each pinned to an exact version. Declare only what the scaffold `package.json` does not already ship. |
| `modules` | Bounded contexts whose `<Pascal(bc)>Module` the application module imports. |
| `aggregates` | Per bounded context, its modules, each a plain name or `{ name, customFields: true }`. The aggregate name is `Pascal(bc) + Pascal(module)`. |
| `relations` | Per owning schema key, per relation label: `{ one, from, to }`, `{ many, from, to }` (joined on a column of the target) or `{ many, from, to, through: { table, from, to } }` (through a pivot table). Never a code expression. |
| `bridges.imports` | Bounded contexts whose modules the bridges module imports. |
| `bridges.providers` | Each `{ name, token: { name, from }, adapter?: { name, from } }`. `name` is the stem of `src/@bridges/providers/<name>.bridge.ts`. |
| `queues` | File stems under `src/@config/bullmq/` that the queue barrel exports. |

Validation fails, naming the manifest and the field, when a bounded context in `modules` or `aggregates` is not owned by the package, a `relations` key is not the schema key of a declared aggregate, a bounded context in `bridges.imports` is owned neither by the package nor by its transitive `requires`, a provider or queue file is not among the `paths`, or an `adapter.from` or `token.from` ends in the wrong barrel.

## Keys of `frontend`

| Key | Description |
| --- | --- |
| `paths` | Copy paths relative to `frontend/`. |
| `dependencies` | npm dependencies, pinned to exact versions. |
| `routes` | Bounded contexts whose lazy route the admin routes register. |
| `navigation` | Per sidebar section, `navMain` or `projects`, the bounded contexts whose navigation that section spreads. Each must also be in `routes`. |
| `widgets` | Bounded contexts whose `<camel(bc)>WidgetProviders` the widget providers aggregate. |
| `bindings` | Port bindings, each `{ token: { name, from }, adapter: { name, from } }`. The `token.from` must start with `@aurora`. Two manifests of one set cannot bind the same token. |

A bounded context in `routes`, `navigation` or `widgets` must have its `src/app/domains/admin/apps/<bc>` among the frontend `paths`.

## Ownership of paths

A manifest declares copy paths only inside the bounded contexts it owns, or inside shared zones such as `@config` and `assets`. A package owns the bounded contexts named by its `@api/<bc>` and `@app/<bc>` paths, and a bounded context is owned by at most one manifest. A path inside another bounded context's subtree is rejected.

## Example

```yaml
# cliter/packages/queue-manager.yaml
name: queue-manager
label: Queue Manager
backend:
  modules: [queue-manager]
  aggregates:
    queue-manager: [queue-load-snapshot]
  queues: [queue-manager-queue.constants]
  paths:
    - src/@api/queue-manager
    - src/@app/queue-manager
    - src/@config/bullmq/queue-manager-queue.constants.ts
    - test/acceptance/queue-manager
  dependencies:
    '@nestjs/bullmq': 12.0.0
    bullmq: 6.5.1
    '@bull-board/api': 9.9.0
    ioredis: 5.10.1
frontend:
  routes: [queue-manager]
  navigation: { navMain: [queue-manager] }
  widgets: [queue-manager]
  paths:
    - src/app/domains/admin/apps/queue-manager
    - public/i18n/queue-manager
```

## The lockfile

`aurora.lock.yaml` in the project root has two keys: `cliVersion` (the CLI version that rendered the tip of `aurora/scaffold`) and `packages` (the installed package names, deduplicated and sorted). Any other key is an error.

## Package catalog

| Package | Label | Requires |
| --- | --- | --- |
| `authorization-code` | Authorization Code | none |
| `automation` | Automation | `identity` |
| `business-partner-portal` | Business Partner Portal | `identity`, `queue-manager`, `common`, `storage-account`, `automation`, `fiscal`, `sap-integration` |
| `common` | Common | `identity` |
| `dashboard` | Dashboard | `identity` |
| `fiscal` | Fiscal | `identity`, `common` |
| `hub` | Hub | `identity` |
| `identity` | Identity (IAM + OAuth) | `tools` |
| `production-planning` | Production Planning | `identity` |
| `queue-manager` | Queue Manager | none |
| `reporting` | Reporting | `identity` |
| `sap-integration` | SAP Integration | `identity`, `queue-manager` |
| `storage-account` | Storage Account | `identity` |
| `tools` | Tools | none |

## Related

- [Concept: Installable packages and scaffold upgrades](../../concepts/workflow/installable-packages/)
- [How-to: Install and upgrade packages](../../guides/workflow/install-and-upgrade-packages/)
