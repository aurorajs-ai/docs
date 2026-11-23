---
title: How-to guides
description: Task-oriented recipes for Aurora Catalyst users who already know the basics.
---

How-to guides are **task-oriented**: they assume you already understand the fundamentals and just need to solve a specific problem.

If you are new to Aurora, start with the [tutorials](../tutorials/) instead.

## Backend

- **[Add a cross-BC port](./backend/add-a-cross-bc-port/)** — wire a new cross-bounded-context dependency through `@bridges`.
- **[Add custom fields to a module](./backend/add-custom-fields-to-a-module/)** — opt a module into runtime custom fields and define the first group and field.
- **[Adopt the state machine in a module](./backend/adopt-the-state-machine/)** — register a machine at boot, enter items at the initial state and move them through the transition port.
- **[Field-schema decorators](./backend/apply-field-schema-decorators/)** — validate payloads and format return values with `@ApplySchema`, `@Format` and `@Sanitize`.
- **[Author a report cube](./backend/author-a-report-cube/)** — declare dimensions, measures, joins and a curated report, and register it.
- **[Configure account security](./backend/configure-account-security/)** — set up password reset and TOTP two-factor authentication for a deployment.
- **[Declare a bounded context's queues](./backend/declare-bc-queues/)** — declare the BullMQ queues a BC owns with `QueueDeclarationModule.forFeature`.
- **[Exclude CLI-generated APIs from a module](./backend/exclude-generated-apis/)** — skip operations or files when regenerating a module.
- **[Manage schema migrations with drizzle-kit](./backend/manage-schema-migrations/)** — edit the YAML, generate the migration, review and apply it.
- **[Compose a QueryStatement](./backend/query-with-querystatement/)** — build `where`, `relations` and `order` clauses and load relations safely.
- **[Register an entity with the rules engine](./backend/register-an-entity-with-the-rules-engine/)** — declare fields and actions at boot and evaluate an item against administrator-authored rules.
- **[Register handlers by key](./backend/register-and-resolve-handlers/)** — dispatch to every handler registered for a runtime key.
- **[Scope a module by tenant](./backend/scope-a-module-by-tenant/)** — declare `hasTenant`, choose traversable relations and verify isolation.

## Frontend

- **[Configure a frontend module](./frontend/configure-a-frontend-module/)** — pick the detail shell, choose widgets, lay out the form and regenerate.
- **[Enable the assistant on a module](./frontend/enable-the-assistant-on-a-module/)** — let the help assistant fill a module's creation form.
- **[Enable voice in the assistant](./frontend/enable-voice-in-the-assistant/)** — turn on listening modes and choose the ElevenLabs or the local speech profile.
- **[Implement a grid-elements-manager widget](./frontend/implement-grid-elements-manager/)** — embed a child module's CRUD inside its parent's detail page.
- **[Manage theme palettes](./frontend/manage-theme-palettes/)** — use the palette selector and add a palette from a tweakcn export.
- **[Publish a screen context to the assistant](./frontend/publish-screen-context-to-the-assistant/)** — let the assistant answer about the record open on a hand-written screen.
- **[Write a manual chapter](./frontend/write-a-manual-chapter/)** — create a screen's chapter, mark its processes, add a tour and compile the manual.

## Workflow

- **[Deploy a project to Coolify](./workflow/deploy-to-coolify/)** — from `catalyst new` to a frontend and backend running on a Coolify server.
- **[Install and upgrade packages](./workflow/install-and-upgrade-packages/)** — `catalyst add` and `catalyst upgrade`, conflicts, migrations and the vendor branch.
- **[Maintain the business-rules catalog](./workflow/maintain-business-rules/)** — the three authoring workflows, the commands and the pre-commit hook.
- **[Maintain the process catalog](./workflow/maintain-processes/)** — bootstrap, edit and validate `processes.yaml` and its manual markers.
