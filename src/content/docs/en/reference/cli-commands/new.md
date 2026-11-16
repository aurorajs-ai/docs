---
title: "New"
---

`catalyst new`
==============

Create a new Aurora monorepo project.

* [`catalyst new NAME`](#catalyst-new-name)

## `catalyst new NAME`

Create a new Aurora monorepo project.

```
USAGE
  $ catalyst new NAME [-f]

ARGUMENTS
  NAME  Name of the project to create.

FLAGS
  -f, --force  Overwrite existing directory.

DESCRIPTION
  Create a new Aurora monorepo project.

  It initializes a git repository in the project directory and commits exactly the files its scaffold copy produces,
  before the install and the code generation run, on a branch named "aurora/scaffold". It then creates main at that
  commit and leaves main checked out. pnpm-lock.yaml, backend/.env, the OAuth key pair in backend/.keys (the one
  "catalyst keys" writes) and the GraphQL codegen output are created afterwards, so they are not part of that commit.
  git must be on the PATH.

  The "aurora/scaffold" branch is the merge base of "catalyst add" and "catalyst upgrade", the only commands that write
  to it. It exists only in the clone that ran "catalyst new" until it is pushed with main: "git push origin main
  aurora/scaffold". A fresh clone gets it with "git fetch origin aurora/scaffold:aurora/scaffold".

EXAMPLES
  $ catalyst new my-project

  $ catalyst new my-project --force
```

_See code: [src/commands/new/index.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/new/index.ts)_
