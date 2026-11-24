---
title: Install and upgrade packages
description: Add a package to a project with catalyst add, install a framework solution from its repository, upgrade the scaffold and every installed package with catalyst upgrade, resolve conflicts, generate the migration and keep the vendor branch pushed.
---

## Goal

Add an Aurora package to an existing project, or bring the project to the scaffold and package versions of the CLI you run, without losing your own edits.

## Before you start

- The project was created with `catalyst new`, so it has `aurora.lock.yaml` and the `aurora/scaffold` branch. `git` is on the `PATH`.
- You are at the project root, on the branch that should receive the change.
- For `catalyst upgrade`, tracked files have no staged or unstaged changes (untracked files do not count). Commit or stash first.

## Steps

### Add a package

1. **Run the command.** Pass the package name, or omit it to pick from a list.

   ```bash
   catalyst add tools
   ```

   The CLI reads the installed packages from the lockfile, resolves the `requires` of the package transitively and prints the plan: the requested package and each package it adds as a requirement. It asks nothing, then renders and merges on your branch. A package that is already installed is a no-op.

2. **Resolve conflicts, if any.** The merge stops when you and the rendering changed the same lines. The command exits non-zero, lists the conflicted files and names the steps to run afterwards. Fix the markers, then `git add` and `git commit`, and run those steps yourself. To discard the add: `git merge --abort`.

3. **Generate the migration.** The CLI never generates or applies one. For each package whose backend changed it prints the command:

   ```bash
   pnpm db:generate --name tools
   ```

   Review the generated migration before applying it. See [Manage schema migrations with drizzle-kit](../../backend/manage-schema-migrations/).

4. **Set the required keys.** The CLI appends missing `backend/.env` keys that have a declared default and prints the required keys that have none, for you to set.

### Install a framework solution from its repository

A framework solution such as `business-partner-portal` is not in the CLI: it lives in its own private git repository, tagged with the CLI version. Ask the owner for the repository URL (the `repository` of the package's manifest).

1. **Run the command with the URL.** The package name is required.

   ```bash
   catalyst add business-partner-portal --from <repository-url>
   ```

   The CLI clones the repository at the tag equal to the `cliVersion` of `aurora.lock.yaml`, with your own git credentials, and renders it with the packages the CLI ships. A failed fetch or a missing tag stops the command before anything is written.

2. **Continue as for any package.** Resolve conflicts, generate the migration and set the keys, as in "Add a package".

The lockfile now holds `{ name, source }` for the package, and `blueprint/packages/<package>.yaml` holds its manifest. Never edit that file: the next render rewrites it.

### Upgrade the project

1. **Run the upgrade.**

   ```bash
   catalyst upgrade
   ```

   It refuses when the lockfile is missing, when `aurora/scaffold` does not exist or when tracked files are dirty. It renders the scaffold and every locked package and merges them. It fetches each framework solution again from its `source` at the tag equal to the CLI version, so every repository must be reachable with your git credentials and carry that tag; otherwise the upgrade stops before changing anything and names the entry, the URL and the tag.

2. **Resolve conflicts and run the post-merge steps**, as above. The upgrade also prints the `pnpm db:generate --name <package>` commands for the packages whose backend changed.

3. **Push the vendor branch with your branch.**

   ```bash
   git push origin aurora/scaffold
   ```

   Push it after every upgrade or add. A fresh clone gets it with `git fetch origin aurora/scaffold:aurora/scaffold`.

### Migrate a package the CLI no longer ships

Two packages left the CLI. Both migrations are one-time and manual, and the CLI README holds the full procedures ("Install a framework solution from its repository" and "Leave a package the CLI no longer ships"). The shape of each:

- **`business-partner-portal` locked by bare name.** `catalyst upgrade` refuses the plain name, and `catalyst add --from` refuses because the lockfile `cliVersion` differs from the running CLI, so edit the lockfile once by hand. On a clean `main` with `aurora/scaffold` present, replace `- business-partner-portal` with `- name: business-partner-portal` plus `source: <repository-url>`, commit, then run `catalyst upgrade`.
- **`production-planning`.** It is now a client solution: its code belongs to the client project. Remove it from `aurora.lock.yaml`, run `catalyst upgrade`, restore the files the merge deleted with `git checkout ORIG_HEAD -- <paths>`, and register its bounded context by hand in the two `project.composition.ts` files. Copy to the project, before upgrading, anything the monorepo holds for it that the project lacks, such as its `*.module.yaml` files.

### Undo or restore

- **Restore a file to its pristine rendering:** `git checkout aurora/scaffold -- <path>`.
- **Undo a conflicted add or upgrade:** `git merge --abort`.
- **Undo a completed one:** `git reset --hard ORIG_HEAD`. When the upgrade created the rename commit, it sits before the merge: after that reset, `git reset --hard HEAD~1` undoes it too.

## Verify it worked

- `aurora.lock.yaml` lists the package, and the CLI version equals the one you ran.
- The package's modules appear in the generated composition files, and your own wiring in the `project.composition.ts` files is intact.
- The backend and frontend build, and the migration for the package is generated and reviewed.

## Troubleshooting

- **`catalyst add` says the CLI version differs from the lockfile.** Run `catalyst upgrade` first: `add` renders packages only at the lockfile's version.
- **The CLI says `aurora.lock.yaml` is not found.** The project predates the lockfile. Adopt it by hand first: the CLI README describes two paths.
- **A post-merge step failed, for example the install without network.** The command stops with a non-zero exit after the merge commit, names the failed step and the ones that did not run, and prints the pending `.env` keys. A rerun finds the package already installed, so run the named steps yourself.
- **`catalyst add --from` or `catalyst upgrade` stops on a fetch.** The repository is unreachable with your git credentials, or it has no tag equal to the CLI version. The message names the entry, the URL and the tag. Fix the access, or ask the owner to publish the tag, and rerun: nothing was written.
- **`catalyst add --from` refuses the package name.** The name is one the CLI ships, or the running CLI differs from the lockfile `cliVersion`. In the second case run `catalyst upgrade` first.
- **An edit to a generated composition file disappeared.** Those files are generated whole from the manifests. Move your wiring to `backend/src/project.composition.ts` or `frontend/src/app/project.composition.ts`.

## Related

- [Concept: Installable packages and scaffold upgrades](../../../concepts/workflow/installable-packages/)
- [Reference: Package manifest](../../../reference/package-manifest/)
- [CLI reference: add](../../../reference/cli-commands/add/), [upgrade](../../../reference/cli-commands/upgrade/)
