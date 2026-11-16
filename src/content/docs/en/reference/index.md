---
title: Reference
description: Auto-generated technical reference for Aurora Catalyst.
---

Reference material is **information-oriented**: accurate, complete, consultable quickly.

Most of this section is **auto-generated** from the Aurora repositories by the `import-from-sources` script. Do not edit auto-generated pages by hand — changes will be overwritten on the next `pnpm sync`.

## What lives here

- **CLI commands** — every `catalyst <command>` with its flags, args, and examples (generated from `oclif readme`).
- **YAML schema** — full reference of the `<module>.module.yaml` fields: [Module YAML keys](./module-yaml/).
- **Lockfile** — structure of `cliter/{bc}/.locks/{scope}/{module}.lock.json`, including the `regions` field.
- **[Query Statement (Aurora Query DSL)](./query-statement/)** — the `where`, `relations`, `order` and `aggregation` language and its safety rules.
- **[Custom fields reference](./custom-fields/)** — the `hasCustomFields` flag, the `customFieldValues` input and the definition types.
- **[Package manifest](./package-manifest/)** — every key of `cliter/packages/<package>.yaml` and the catalog of installable packages.
- **[aurora.yaml deployment keys](./aurora-yaml-deployment/)** — the Coolify deployment configuration, backup destinations and the variables the CLI reads.
- **[Composables reference](./frontend/composables/)** and **[Harness reference](./harness/)** — the frontend brain composables and the harness catalog.
- **[Glossary](./glossary/)** — the technical terms used across the docs.

## What does NOT live here

- Tutorials → [`/tutorials/`](../tutorials/)
- How-to guides → [`/guides/`](../guides/)
- Conceptual background → [`/concepts/`](../concepts/)
