---
title: Installable packages and scaffold upgrades
description: How bounded contexts ship as packages described by a manifest, which packages the CLI ships and which come from their own repository, how the project lockfile and the aurora/scaffold vendor branch let catalyst add and catalyst upgrade merge them without overwriting your edits.
---

## Why this exists

An Aurora project starts from a scaffold and grows by adding bounded contexts that others maintain: identity, tools, automation, reporting. Early installers copied files imperatively. They drifted from each other, gave a project no way to receive later fixes, and their `--force` flag overwrote hand edits.

Packages now follow one declarative model. A single manifest describes each package, the CLI computes everything else, and Git, not the CLI, decides who owns a line.

## How it works

### The manifest

Each package has one hand-written manifest, `cliter/packages/<package>.yaml`, in the source monorepo. It is the only declaration the packager and the installer read. It names the backend and frontend paths to copy, the packages it `requires`, pinned npm dependencies, the `.env` keys it needs, and its contribution to composition: modules, aggregates, relations, bridges, queues, routes, navigation, widgets and port bindings. It accepts no hooks, scripts or code, and a manifest with an unknown field fails validation. The [package manifest reference](../../../reference/package-manifest/) lists every key.

A package ships only its own bounded contexts and shared zones, never files of another bounded context. A cross-context need goes through a port and adapter in `@bridges`.

### Package kinds

Every manifest declares a mandatory `kind`, and the kind decides where the package ships:

| Kind | Where it ships | Who owns it | How a project gets it |
| --- | --- | --- | --- |
| `framework` | The public CLI tarball | catalyst | `catalyst add <package>` |
| `framework-solution` | Its own private git repository, tagged with the CLI version; never the CLI | catalyst, distributed to several clients | `catalyst add <package> --from <repository-url>` |
| client solution | Its client's repository; catalyst holds no manifest for it | the client | It is the project's own code |

The owner decides the kind with two questions, in order:

1. Does any framework package need it, through `requires` or a port? Then it is `framework`: a framework package never depends on a solution.
2. Otherwise, what does it solve? A sector-independent capability is `framework`. A complete business process for a kind of business is a solution: a framework solution when catalyst owns it and distributes it to several clients, a client solution when the client owns it.

"Nobody requires it" does not make a package a solution: `dashboard`, `hub`, `reporting` and `authorization-code` are leaves and still framework. Today `business-partner-portal` is the only framework solution; `production-planning` is a client solution and no longer part of catalyst.

The public CLI tarball carries only the scaffold, the harness and the framework packages. It names no solution and no private URL, so the project always supplies the repository.

### The lockfile

`aurora.lock.yaml` at the project root is the only record of what is installed. It holds the installed packages and the CLI version that rendered the tip of the vendor branch. A framework package is a plain name; a framework solution is a `{ name, source }` entry, where `source` is the repository it came from. There is no per-package version: the CLI, the core packages and the catalog packages share one version. Commands that need the installed set refuse to run without the lockfile.

### The vendor branch

`catalyst new` creates a branch named `aurora/scaffold`. It holds what Aurora would generate for your project: the scaffold plus the whole set of installed packages. Both `catalyst add` and `catalyst upgrade` work the same way:

1. Render the scaffold of the running CLI plus the resulting package set into a temporary directory. The install, `backend/.env` and the GraphQL codegen output are not part of the rendering, so they never enter it.
2. Commit that rendering on `aurora/scaffold`, as a child of its tip, without switching branches or touching your working tree.
3. Run `git merge --no-edit aurora/scaffold` on your checked-out branch.

Git's three-way merge, using the previous rendering as the base, resolves ownership. A file you never changed takes the new content. A file you changed keeps your edits and receives only the rendering's own delta. A file the rendering removed and you never touched is deleted. Where you and the rendering changed the same lines, the merge stops with conflicts, which you resolve like any other.

### Composition files

The files that wire packages together (the application module, the bridges module, the Drizzle schema aggregator, the routes, the navigation) are generated whole from the manifests of the installed set, and carry the `@aurora-catalyst-generated` header. Your own wiring goes in two developer-owned files, `backend/src/project.composition.ts` and `frontend/src/app/project.composition.ts`. Generated composition files import them and spread them after the packages' entries, so an install never rewrites what you put there. `catalyst generate` registers your own bounded contexts in these files.

### What an upgrade also does

`catalyst upgrade` first migrates module definition files: it renames each `<module>.aurora.yaml` to `<module>.module.yaml` with `git mv`, rewrites the two generated lines that name the old file and commits only that, before the merge. Then it renders and merges as above. Installed packages upgrade together with the scaffold, and so does every `source` entry: `catalyst upgrade` fetches each one again at the tag equal to the CLI version it runs with and renders it with the framework packages as one package set. A repository that is unreachable, or that lacks the tag, stops the upgrade before anything is written. The framework npm packages update through npm.

### After the merge

When the merge has no conflicts the CLI installs the dependencies, appends the `backend/.env` keys that have a declared default and are missing (an existing value is never changed), regenerates the GraphQL types and the business-rules index, and prints what is left: the required keys still missing and `pnpm db:generate --name <package>` for each package whose backend changed. A package that ships business rules copies the `.md` files with it and the index is regenerated from the files on disk, so the index belongs to your project and is never shipped. It never generates or applies a schema migration for you.

### A framework solution from its repository

`catalyst add <package> --from <repository-url>` clones the repository at the tag equal to the `cliVersion` of the lockfile, with your own git credentials, renders the package with the ones the CLI ships and records it as `{ name, source }`. It also writes the package's manifest to `cliter/packages/<package>.yaml`, which the render rewrites each time: `catalyst generate` reads it to know which bounded contexts the package owns without network access. Never edit that file. The repository holds exactly one package and carries one tag per CLI release.

## When it applies

- You add a bounded context with `catalyst add`, or move a project to a newer CLI with `catalyst upgrade`.
- A merge reports conflicts in a file you customized.
- You use a package that is not in the CLI, such as `business-partner-portal`, and need to install or upgrade it from its repository.
- You wonder why a generated composition file changed and your edits to it were lost: those files belong to the manifests, and your wiring belongs in the `project.composition.ts` files.

## Trade-offs and limits

- One version for everything: you cannot hold one package back while upgrading the rest. A framework solution follows the same rule, so its repository needs a tag for every CLI release you upgrade to.
- An upgrade depends on every `source` repository being reachable with your git credentials. If one is not, the upgrade stops instead of skipping it.
- `catalyst add` refuses to run when the CLI version differs from the lockfile's. Run `catalyst upgrade` first. `catalyst upgrade` refuses when `aurora/scaffold` is missing, or when a tracked file has staged or unstaged changes: commit or stash first.
- Schema migrations are generated after the merge, by you, and never run automatically.
- The vendor branch lives in the clone that ran `catalyst new` until you push it. After each upgrade, push `aurora/scaffold` with your branch. A fresh clone gets it with `git fetch origin aurora/scaffold:aurora/scaffold`.
- A project created before the lockfile existed has to be adopted by hand first. The CLI README describes the two adoption paths.

## Related

- [How-to: Install and upgrade packages](../../../guides/workflow/install-and-upgrade-packages/)
- [Reference: Package manifest](../../../reference/package-manifest/)
- [CLI reference: add](../../../reference/cli-commands/add/) and [upgrade](../../../reference/cli-commands/upgrade/)
- [Backend module scaffolding](../../backend/module-scaffolding/)
