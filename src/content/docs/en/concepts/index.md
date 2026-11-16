---
title: Concepts
description: The ideas, decisions, and philosophy behind Aurora Catalyst.
---

Concept pages are **understanding-oriented**: they explain the _why_ behind Aurora rather than how to use it. Read these when you want to form a solid mental model.

If you want to _do_ something, use the [how-to guides](../guides/). If you need exact facts, use the [reference](../reference/).

## Topics

### Backend

- **[Account impersonation](./backend/account-impersonation/)** — how an authorized operator acts as another account without sharing a password, with a short-lived token and three vetoes.
- **[Account self-service](./backend/account-self-service/)** — how an account manages its own profile, password and two-factor authentication, and how password reset works.
- **[Authentication strategies](./backend/authentication-strategies/)** — the three `OAUTH_STRATEGY` modes, the BFF pattern, and how tokens flow between a hub and its satellites.
- **[Cross-bounded-context ports](./backend/cross-bounded-context-ports/)** — how the `@bridges` folder decouples bounded contexts through ports, tokens, adapters, and a global composition root.
- **[Custom fields](./backend/custom-fields/)** — typed fields an operator adds to an entity at runtime, with no schema change.
- **[File storage catalog](./backend/file-storage/)** — external storages the platform writes files to, referenced by id, behind a write-only port.
- **[Mailbox catalog and reader port](./backend/mailbox/)** — e-mail addresses the platform reads and sends from, and the neutral reading port over Microsoft 365, Google and IMAP.
- **[Backend module scaffolding](./backend/module-scaffolding/)** — what the CLI generates for a backend module, and how the lockfile keeps hand edits in check.
- **[Property writability](./backend/property-writability/)** — how `readOnly` and `createOnly` decide who may write a value across the form, the API contracts and the write pipeline.
- **[Report engine](./backend/report-engine/)** — how curated aggregation reports run: cubes as a compile-time whitelist and execution by stored report.
- **[Rules engine](./backend/rules-engine/)** — business rules that administrators author as decision tables over the fields and actions a bounded context declares.
- **[Configurable state machine](./backend/state-machine/)** — a lifecycle whose states and transitions administrators edit without a deploy.
- **[Tenant scope](./backend/tenant-scope/)** — how a `hasTenant` module keeps each caller inside their tenants, and why relations are denied by default.
- **[Translated fields through relations](./backend/translated-fields-through-relations/)** — how a module that points at a table-i18n aggregate shows, searches and sorts by its translated fields.

### Frontend

- **[The @aurora import surface](./frontend/aurora-import-surface/)** — why the framework layer is imported through explicit sub-barrel aliases, and what the initial-payload budget protects.
- **[Cell renderers](./frontend/cell-renderers/)** — how the data-table dispatches by property type and how to override rendering per column.
- **[Composables: atoms and presets](./frontend/composables/)** — why brain logic splits into single-responsibility atoms and opinionated presets wired to TanStack Table.
- **[Composition vs inheritance](./frontend/composition-over-inheritance/)** — why the brain layer extends horizontally by composing functions instead of through class hierarchies.
- **[Detail mode](./frontend/detail-mode/)** — how `front.detailMode` chooses between a routed detail page and a list-with-modal CRUD.
- **[Embed mode](./frontend/embed-mode/)** — how `front.embedSupport` opts a child module into being embedded inside its parent's detail view.
- **[Form field widths](./frontend/form-field-widths/)** — how the 12-column grid, type defaults, `widget.span`, and the auto-expand pass decide each field's width.
- **[Guided actions and assisted forms](./frontend/guided-actions/)** — how the assistant and the command palette take a user to a screen or a creation form, and what `hasAssistant` lets it fill.
- **[The in-app user manual](./frontend/in-app-user-manual/)** — an end-user manual written per screen, compiled at build time, searched by permission and complemented by guided tours.
- **[Preservation regions](./frontend/preservation-regions/)** — how you own a slice of a generated file and why that slice survives regeneration.
- **[Role UI preferences](./frontend/role-ui-preferences/)** — how a role's landing page and hidden navigation shape the session at sign-in and impersonation.
- **[Column pinning (TanStack)](./frontend/tanstack-column-pinning/)** — why pinning a column reorders rather than moves it, and how the data-table writes both pinning and order.
- **[Theme palettes](./frontend/theme-palettes/)** — how the active color palette is resolved and propagated to the whole UI.

### Workflow & governance

- **[Business rules system](./workflow/business-rules-overview/)** — a catalog of domain invariants beside the YAML schemas, used as institutional memory and incoherence detector.
- **[Anatomy of a business rule](./workflow/business-rule-anatomy/)** — the fields, ID grammar, state/severity, case table, and lifecycle of a single rule.
- **[Business rules system architecture](./workflow/business-rules-architecture/)** — the technical pieces (index, scripts, slash commands, skill, hooks, CI, OpenSpec extension) and how they relate.
- **[Deploying to Coolify](./workflow/coolify-deployment/)** — how `provision`, `pipeline`, `deploy` and `backup` take a project from `aurora.yaml` to a hardened server.
- **[Development modes](./workflow/development-modes/)** — Framework mode vs Solution mode, and the `/dev-mode` command that switches between them.
- **[The four governance artifacts](./workflow/governance-artifacts/)** — Harness Rules, the architecture-checkpoint hook, and the backend/frontend project-structure skills: what blocks you, what advises you, and who owns what.
- **[Installable packages and scaffold upgrades](./workflow/installable-packages/)** — manifests, the lockfile and the `aurora/scaffold` vendor branch behind `catalyst add` and `catalyst upgrade`.
- **[Process catalog](./workflow/process-catalog/)** — the business processes of a bounded context as ordered paths over screens, and how they differ from rules and the manual.
