---
title: The @aurora import surface
description: Why the frontend framework layer is imported through explicit sub-barrel aliases, why eagerly loaded code must never use the root barrel, and what the initial-payload budget protects.
---

## Why this exists

The root alias `@aurora` re-exports every group of the framework layer, including Angular component classes that the build cannot tree-shake. Any file that imports from it drags those components into whatever chunk contains the file. In lazily loaded code this is harmless, because the cost is paid when the route loads. In code reachable from application bootstrap, it is paid by every user on first load: the initial bundle grew to 1.93 MB before the surface was narrowed.

The fix is not a convention people must remember. The compiler enforces it: the alias table declares each public surface one by one, and a path that is not declared does not resolve.

## How it works

`frontend/tsconfig.json` declares **one explicit alias per public surface** and no `@aurora/*` wildcard. Each alias points to that surface's own `index.ts`, or to a single file when the surface is exactly that file.

| Kind | Aliases |
| --- | --- |
| Groups | `@aurora/components`, `@aurora/composables`, `@aurora/directives`, `@aurora/lib`, `@aurora/pipes`, `@aurora/query-dsl`, `@aurora/types`, `@aurora/validators` |
| Framework modules | `@aurora/modules/<name>` for `assisted-form`, `authentication`, `command-palette`, `dashboard`, `graphql`, `guided-action`, `health`, `lang`, `manual`, `report-viewer`, `session`, `theme` and `widget` |
| A few narrow surfaces | for example `@aurora/components/chart` and `@aurora/components/pdf-viewer` |

Three consequences follow:

- An import that names an implementation file, such as `@aurora/components/data-table/cells/boolean-cell.component`, matches no alias and fails to compile with `TS2307` (cannot find module).
- `@aurora/modules` as a whole is not an alias, so nobody can pull every module through one specifier.
- `@aurora` itself still resolves and still re-exports everything. Lazy code can keep using it.

### What counts as eager

Eager code is whatever the application reaches from bootstrap without a dynamic `import()`: the application config, the root routes, the Aurora provider, the widget-provider aggregator and the widget registries of each bounded context. These files must import framework symbols from declared sub-barrels, never from the root barrel. The same holds for the current-account adapter of IAM: it is imported from its own small sub-barrel, because importing it from the module barrel drags the module's components into the eager graph.

### The rule

The harness rule `HR-BARRELS-005` (active; it supersedes the derogated `HR-BARRELS-001`, `-003` and `-004`) says an asset of a module is imported through a barrel, either the module's own or a public sub-barrel with a narrow surface, never through a deep path to an implementation file. A dynamic `import()` with a literal target, as in a lazy route, is exempt, because it is the chunk boundary the rule protects. If the asset you need is not exposed, add it to the right `index.ts` instead of reaching for the file.

### The budget

`frontend/angular.json` sets an `initial` budget, currently a warning at 1.6 MB and an error at 2 MB. Read the *raw* figure of the `Initial total` line of a production build, the first of its two columns.

## When it applies

- A build fails with `TS2307` on an `@aurora/<path>`: that subpath is not a declared surface. Import from the group or module barrel, or add the asset to the barrel that should expose it.
- You add code to the application config, root routes or a provider: import from sub-barrels.
- The `Initial total` grows after a change: look for an eager file that imports `@aurora`.

## Trade-offs and limits

- A green build does not prove an import change is safe. A barrel that closes a dependency cycle can crash Angular dependency injection at boot, with an undefined parameter type, while the build passes. Load the built application in a browser after reshaping barrels.
- The alias table is mirrored into the application template by the packager, so generated applications inherit it. Never edit the template by hand.

## Related

- [Composables: atoms and presets](../composables/)
- [The four governance artifacts](../../workflow/governance-artifacts/) — what a harness rule is and how it is enforced.
