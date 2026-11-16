---
title: "Add"
---

`catalyst add`
==============

Add an Aurora package to an existing project through its "aurora/scaffold" branch.

* [`catalyst add [PACKAGE]`](#catalyst-add-package)

## `catalyst add [PACKAGE]`

Add an Aurora package to an existing project through its "aurora/scaffold" branch.

```
USAGE
  $ catalyst add [PACKAGE] [-v]

ARGUMENTS
  [PACKAGE]  Package to add. Omit it to pick one from a list. Each package installs every half it declares (backend,
             frontend) and the packages it requires.

FLAGS
  -v, --verbose  Report all steps on screen.

DESCRIPTION
  Add an Aurora package to an existing project through its "aurora/scaffold" branch.

  Run it from the root of the project, on the branch that should receive the package. git must be on the PATH.

  1. It reads the installed packages from aurora.lock.yaml and refuses to run without it. It resolves the requirements
  of the requested package against them and prints the plan (the requested package and each package added as a
  requirement); it asks nothing.
  2. It renders the scaffold plus the whole resulting package set into a temporary directory, with the composition files
  generated from the package manifests.
  3. It commits that rendering on "aurora/scaffold" as a child of its tip, without switching branches or touching the
  working tree, and runs "git merge --no-edit aurora/scaffold" on the checked-out branch.
  4. After a merge without conflict it installs the dependencies, appends to backend/.env the keys with a declared value
  that it lacks, regenerates the GraphQL types and the business-rules index, and prints what is left to do: "pnpm
  db:generate --name <package>" for each package whose backend changed, the required keys still missing and the tools
  SQL scripts to run. It never generates or applies a schema migration.

  A package already installed is not rendered again: adding it is a no-op. It refuses to run when the CLI version
  differs from the one recorded in the lockfile: run "catalyst upgrade" first.

  Installed files are never overwritten: git's three-way merge keeps your changes and adds the package's own delta. When
  you and a rendering change the same lines, the command exits non-zero, lists the conflicted files, names the
  post-merge steps without running them, with the backend/.env keys of the added packages (valued keys with their value,
  required keys to set), and leaves the merge in progress. Resolve the markers, then "git add" and "git commit" and run
  those steps, or discard the add with "git merge --abort".

  A post-merge step that fails (for example the install without network) stops the command with a non-zero exit after
  the merge commit: it names the failed step and the ones not run, and prints the pending backend/.env keys, because a
  rerun finds the package already installed.

  To restore a package file to its pristine rendering: git checkout aurora/scaffold -- <path>
  To undo a conflicted add: git merge --abort
  To undo a completed add: git reset --hard ORIG_HEAD

EXAMPLES
  $ catalyst add tools

  $ catalyst add identity

  $ catalyst add
```

_See code: [src/commands/add/index.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/add/index.ts)_
