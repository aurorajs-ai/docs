---
title: "Upgrade"
---

`catalyst upgrade`
==================

Merge the current scaffold and the locked packages into an installed project through its "aurora/scaffold" branch.

* [`catalyst upgrade`](#catalyst-upgrade)

## `catalyst upgrade`

Merge the current scaffold and the locked packages into an installed project through its "aurora/scaffold" branch.

```
USAGE
  $ catalyst upgrade [-v]

FLAGS
  -v, --verbose  Report all steps on screen.

DESCRIPTION
  Merge the current scaffold and the locked packages into an installed project through its "aurora/scaffold" branch.

  Run it from the root of the project, on the branch that should receive the upgrade. git must be on the PATH.

  1. It reads the installed packages from aurora.lock.yaml and refuses to run without it, or when the running CLI no
  longer ships a locked package. It also refuses, before changing anything, when the "aurora/scaffold" branch is missing
  or when a tracked file has staged or unstaged changes (untracked files do not count): commit or stash them first.
  2. It migrates the module definition files, with no version gate, so a rerun after a merge picks up late arrivals: it
  renames each cliter/<bc>/<module>.aurora.yaml to <module>.module.yaml with "git mv", rewrites in every tracked file
  the two generated lines that name the old file (the "@source" header and the field-schema "derived from" line,
  changing only the suffix), and recomputes the cliter/<bc>/.locks integrity of a rewritten file only when the stored
  hash matched the file before the rewrite, so a file you modified still shows up as modified. Developer comments and
  docs are not touched. If both names exist for one module it stops, naming both paths. When it changed something it
  commits exactly that in one commit, "chore(catalyst): rename module definition files to <module>.module.yaml", running
  the project's git hooks, before the merge.
  3. It renders the scaffold of the running CLI plus every locked package into a temporary directory, with the
  composition files generated from the package manifests and the lockfile updated to the running CLI version. The
  install, the backend/.env copy and the GraphQL codegen are not part of that rendering, so pnpm-lock.yaml, backend/.env
  and backend/src/@api/graphql.ts never enter it.
  4. It commits that rendering on "aurora/scaffold" as a child of its tip, without switching branches or touching the
  working tree. When the rendering equals the tip it creates no commit, and it reports the scaffold as up to date only
  when the tip is already contained in the checked-out branch; otherwise it runs the merge again.
  5. It runs "git merge --no-edit aurora/scaffold" on the checked-out branch.
  6. After a merge without conflict it installs the dependencies, appends to backend/.env the keys with a declared value
  that any locked package declares and the file lacks (an existing value is never changed), regenerates the GraphQL
  types and the business-rules index, and prints what is left to do: "pnpm db:generate --name <package>" for each
  package whose backend changed, the required keys missing in backend/.env and the tools SQL scripts to run. It never
  generates or applies a schema migration.

  Git's three-way merge resolves ownership. A file the project never changed (for example under backend/src/@aurora/)
  takes the new rendering's content. A file the project changed (wiring, custom module declarations, aurora.yaml) keeps
  its changes and receives only the rendering's own delta. A file the rendering removed and the project never changed is
  deleted.

  When the project and the rendering change the same lines, the command exits non-zero, lists the conflicted files,
  names the post-merge steps to run after the resolution together with the backend/.env keys to add (with their value)
  or to set, and leaves the merge in progress. Resolve the markers, then "git add" and "git commit", or discard the
  upgrade with "git merge --abort"; the next run merges the same rendering again.

  The "aurora/scaffold" branch must exist: "catalyst new" creates it. It lives in the clone that ran "catalyst new"
  until it is pushed: after each upgrade, "git push origin aurora/scaffold" together with the merged branch, and a fresh
  clone gets it with "git fetch origin aurora/scaffold:aurora/scaffold". Installed packages upgrade here together with
  the scaffold; the framework npm packages update through npm.

  A post-merge step that fails (for example the install without network) stops the command with a non-zero exit after
  the merge commit: it names the failed step and the ones not run, and prints the pending backend/.env keys, because a
  rerun finds the project up to date.

  To restore a file to its pristine rendering: git checkout aurora/scaffold -- <path>
  To undo a completed upgrade: git reset --hard ORIG_HEAD
  When the run created the migration commit ("chore(catalyst): rename module definition files to <module>.module.yaml"),
  it sits before the merge: after that reset, git reset --hard HEAD~1 undoes it too.

EXAMPLES
  $ catalyst upgrade

  $ catalyst upgrade --verbose
```

_See code: [src/commands/upgrade/index.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/upgrade/index.ts)_
