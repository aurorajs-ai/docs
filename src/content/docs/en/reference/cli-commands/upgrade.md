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

  1. It reads the installed packages from aurora.lock.yaml and refuses to run without it, or when a plain-name entry is
  a package the running CLI no longer ships. An entry with a source (added with "catalyst add <package> --from <url>")
  is fetched from that repository at the tag equal to the running CLI version, before anything is changed; a failed
  fetch or a missing tag stops the command, naming the entry, the URL and the tag. It also refuses, before changing
  anything, when the "aurora/scaffold" branch is missing or when a tracked file has staged or unstaged changes
  (untracked files do not count): commit or stash them first.
  2. It renders the scaffold of the running CLI plus every locked package into a temporary directory, with the
  composition files generated from the package manifests and the lockfile updated to the running CLI version. The
  install, the backend/.env copy and the GraphQL codegen are not part of that rendering, so pnpm-lock.yaml, backend/.env
  and backend/src/@api/graphql.ts never enter it.
  3. It commits that rendering on "aurora/scaffold" as a child of its tip, without switching branches or touching the
  working tree. When the rendering equals the tip it creates no commit, and it reports the scaffold as up to date only
  when the tip is already contained in the checked-out branch; otherwise it runs the merge again.
  4. It runs "git merge --no-edit aurora/scaffold" on the checked-out branch.
  5. After a merge without conflict it installs the dependencies, appends to backend/.env the keys with a declared value
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

EXAMPLES
  $ catalyst upgrade

  $ catalyst upgrade --verbose
```

_See code: [src/commands/upgrade/index.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/upgrade/index.ts)_
