---
title: Backend module scaffolding
description: What the Catalyst CLI generates for a backend module, and how the lockfile keeps hand edits in check.
---

## Why this exists

A Catalyst backend module has the same shape every time: a REST controller, a GraphQL resolver, an application-layer handler, a service, a DTO, a GraphQL schema fragment, a Drizzle table schema, a repository, and a field schema — one set per operation where the layer is per operation. A module with six CRUD operations quickly lands above thirty files, all following strict naming, layering, and decorator conventions. Writing that by hand is repetitive and lets the shape drift across modules.

Catalyst treats the module's `*.module.yaml` file as the single source of truth. The CLI reads the YAML and emits the whole tree deterministically. When the module has to evolve, you edit the YAML — not the generated TypeScript — and regenerate.

## How it works

Every module lives at `cliter/<bounded-context>/<module>.module.yaml`.

:::note
Older projects named this file `<module>.aurora.yaml`. The CLI no longer reads that name: when only the old file exists, `catalyst generate` fails, names both files and tells you to run `catalyst upgrade`, which renames them.
:::

Running:

```bash
catalyst generate back module --name=<bounded-context>/<module> --force
```

emits files across the backend, grouped by layer:

| Layer                                                 | Files                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `@api/<bc>/<mod>/controllers/`                        | One REST controller per operation                                          |
| `@api/<bc>/<mod>/resolvers/`                          | One GraphQL resolver per operation                                         |
| `@api/<bc>/<mod>/dto/` and `@api/<bc>/<mod>/graphql/` | Input / output DTOs and the module's GraphQL schema fragment               |
| `@app/<bc>/<mod>/application/<op>/`                   | Handler + service per operation                                            |
| `@app/<bc>/<mod>/domain/`                             | The field schema and a barrel (`index.ts`)                                 |
| `@app/<bc>/<mod>/infrastructure/drizzle/`            | Drizzle table schema (`*.schema.ts`) and repository implementation         |

The module itself holds no entity or value-object classes: the field schema describes the aggregate, and the Drizzle schema describes its table.

Two more things are emitted when the module asks for them. A module with `readOnly` properties gets a `<bc>-<mod>.payload-types.ts` beside its handlers, and a module with `hasCustomFields` or `i18nStrategy: table` gets its satellite tables and repositories.

### Files shared by the whole bounded context

Some files belong to the bounded context, not to one module. The CLI does not render them from scratch: it **patches them in place**, adding one entry per generated module, and never rewrites them wholesale.

| File                           | What each module adds                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| `@api/<bc>/<bc>.module.ts`     | The module's controllers and resolvers                                  |
| `@app/<bc>/index.ts`           | The module's barrel export                                              |
| `@app/<bc>/<bc>.seed.ts`       | The module's permissions                                                |
| `@app/<bc>/<bc>.relations.ts`  | The module's Drizzle relations                                          |

The `@api/<bc>/<bc>.module.ts` file also provides a `BoundedContextDeclaration` built from `@app/<bc>/<bc>.seed.ts`. When the IAM package is installed it collects every declaration at boot and registers the bounded context and its permissions. Without IAM the declaration stays inert, so the bounded context never depends on IAM. There is no `<bc>.seeder.ts` any more.

### ESM imports

The backend is an ES module project (`"type": "module"`). Every relative or aliased import in generated and hand-written code carries an explicit extension: `./foo.js`, or `@app/iam/tag/domain/index.js` for a barrel. Package imports such as `@aurorajs.dev/core-back` stay as they are. If a hand-written import fails to resolve, a missing `.js` or `/index.js` is the first thing to check.

### Relations to modules of another bounded context

A relationship that points to a module in another bounded context produces a GraphQL type, a field schema entry and a Drizzle relation entry. The relation entry cannot live in `<bc>.relations.ts`, because that file resolves relations over its own bounded context's tables only. Where it goes depends on who owns the bounded context:

- **A project-owned bounded context**: the CLI upserts the entry into `projectCrossBcRelations` in `backend/src/project.composition.ts`, a file you own. Re-running is idempotent, and generating either end of the relation completes the pair.
- **A package-owned bounded context**: the package manifest declares its relations, and the generated `@config/drizzle/aurora-drizzle-schema.ts` carries them. The CLI skips these entries.

When the module at the other end has not been generated yet, the CLI writes nothing for that relation and prints the relation and the missing target as `[CROSS-BC RELATION SKIPPED]`. Generate the other module and the entry appears. Do not hand-write that block.

The command also runs `pnpm back:graphql:types` by default, so the generated GraphQL types stay aligned with the YAML. Pass `--noGraphQLTypes` (`-g`) to skip that step. See the [`catalyst generate` reference](../../../reference/cli-commands/generate/) for every flag.

### Operations the CLI recognizes

Each operation maps to a handler + service + resolver + controller set. Anything listed under a module's `operations`, or simply not present in `excludedOperations`, gets emitted.

| Operation             | Generates                                          |
| --------------------- | -------------------------------------------------- |
| `count`               | Count rows matching a filter                       |
| `create`              | Create a single row                                |
| `createBatch`         | Create many rows in one call                       |
| `delete`              | Delete many rows by filter                         |
| `deleteById`          | Delete one row by id                               |
| `find`                | Find one row by filter                             |
| `findById`            | Find one row by id                                 |
| `get`                 | Get many rows by filter                            |
| `getRaw`              | Get many rows with a raw SQL shape                 |
| `paginate`            | Paginated list                                     |
| `update`              | Update many rows by filter                         |
| `updateAndIncrement`  | Update plus atomic increment of a counter field    |
| `updateById`          | Update one row by id                               |
| `upsert`              | Insert or update based on key presence             |
| `max` / `min` / `sum` | Aggregate over a numeric column                    |

`getRaw` executes caller-supplied SQL, so the generated handler carries `@Format` only for consistency: a query can alias a column away from its declared name and walk past the mask. For that reason generation fails for an aggregate that declares a masked property (`secret`, `password`, `encrypted`) unless `getRaw` is in `excludedOperations`. The same failure applies to `getRaw` and `upsert` on a `hasTenant: true` module, because neither signature has a `constraint` argument to scope by tenant. The error names the property and the exclusion to add.

Custom verbs that do not fit the CRUD vocabulary — `activate`, `approve`, `cancel`, `check-unique-<field>` — live in a separate `additionalApis` list in the same YAML. Each one generates a lighter scaffold: a controller, a resolver and a handler. You then refine the handler. Restrict an entry with `excludedLayers` and the layers you list are not emitted (see [Exclude CLI-generated APIs from a module](../../../guides/backend/exclude-generated-apis/)).

### Lockfile and `.origin` files

Every generated file has a lockfile entry recording the SHA-1 of the content the CLI emitted. On regeneration the CLI compares the current integrity hash of the file on disk against the lockfile:

- **Hashes match** → no hand edits. The CLI overwrites the file with the new output.
- **Hashes differ** → the file has hand edits. The CLI writes the new output to `<file>.origin` next to yours and leaves you to reconcile.

When a run produces `.origin` files, `catalyst generate` opens the interactive review at the end if it runs in a terminal, and only prints a summary otherwise. `--review` and `--no-review` override that. Reconciliation also lives in the sibling `catalyst origin` subcommands (`list`, `diff`, `accept`, `reject`, `ignore`, `review`).

The lockfile keeps an entry for every file that is still on disk, even one the current run did not render (an excluded operation, or a shared file that is only patched). The entry of a file that no longer exists is dropped. So a run never uninstalls the protection of a file it skipped.

`catalyst origin ignore <path>` marks a file with a first-line `// ignored file` sentinel, and the generator stops touching it. The sentinel means two different things, depending on the file:

- **Fully hand-maintained shared files** (routes, navigation, translations, the frontend `project.composition.ts`): the generator skips the file silently.
- **Files the module cannot work without** (the bounded context seed, relations, the backend `project.composition.ts`, `@api/<bc>/<bc>.module.ts`, `@app/<bc>/index.ts`): the generator **stops with an error** when it has to append an entry. The sentinel is not an opt-out there. Either leave the file to the generator, whose patch is additive and keeps your other edits, or take over the whole registration by hand and keep it current.

Editing the body of a handler's `main()` is safe: the scaffold around it stays intact, so the next regeneration produces a `.origin` that is effectively identical to your file. Editing decorators, imports, or method signatures is what produces real `.origin` conflicts.

## When it applies

- You scaffold a new module, add a field, or add an operation — edit the YAML, run `catalyst generate …`, commit both the YAML and the generated files.
- You see a `.origin` file after regeneration — a hand edit diverged from the previous scaffold; decide which version wins and delete the `.origin`.
- You want a custom verb — declare it under `additionalApis`, regenerate, and fill in the stub the CLI produced.
- You want to opt out of specific operations or files — see [Exclude CLI-generated APIs from a module](../../../guides/backend/exclude-generated-apis/).

## Trade-offs and limits

- **The CLI does not delete orphan files.** Removing an operation from the YAML does not remove the files it already produced — delete them by hand afterwards.
- **Structural hand edits are costly.** Changing decorators, method signatures, or imports on a generated file turns every future regeneration into a `.origin` review. Express the change in YAML when possible.
- **CRUD vocabulary is closed.** The operation table above is the complete set; anything else belongs in `additionalApis`.

## Related

- [Exclude CLI-generated APIs from a module](../../../guides/backend/exclude-generated-apis/) — how `excludedOperations` and `excludedFiles` work in practice.
- [`catalyst generate` reference](../../../reference/cli-commands/generate/) — every flag and argument.
- [Preservation regions](../../frontend/preservation-regions/) — how to protect custom code inside a generated template file.
