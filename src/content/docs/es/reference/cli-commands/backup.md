---
title: "Backup"
---

`catalyst backup`
=================

List, take and restore the backup copies of a Coolify environment

* [`catalyst backup list`](#catalyst-backup-list)
* [`catalyst backup restore`](#catalyst-backup-restore)
* [`catalyst backup run`](#catalyst-backup-run)

## `catalyst backup list`

List the complete backup copies of a Coolify environment at its destination, newest first: id, UTC date, size and contents. Reads no destination secret.

```
USAGE
  $ catalyst backup list --env <value> [-c <value>]

FLAGS
  -c, --config=<value>  [default: ./aurora.yaml] Path to aurora.yaml config file
      --env=<value>     (required) Environment that declares backups (e.g. prod)

DESCRIPTION
  List the complete backup copies of a Coolify environment at its destination, newest first: id, UTC date, size and
  contents. Reads no destination secret.

EXAMPLES
  $ catalyst backup list --env prod
```

_See code: [src/commands/backup/list.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/backup/list.ts)_

## `catalyst backup restore`

Restore a backup copy into the same Coolify environment: the database (when the copy holds one) and the uploaded files are REPLACED by the copy, with no confirmation prompt. The backend is stopped during the restore and started again. Running it again with the same copy is safe. Reads no destination secret.

```
USAGE
  $ catalyst backup restore --copy <value> --env <value> [-c <value>]

FLAGS
  -c, --config=<value>  [default: ./aurora.yaml] Path to aurora.yaml config file
      --copy=<value>    (required) Id of the copy to restore (see "backup list")
      --env=<value>     (required) Environment that declares backups (e.g. prod)

DESCRIPTION
  Restore a backup copy into the same Coolify environment: the database (when the copy holds one) and the uploaded files
  are REPLACED by the copy, with no confirmation prompt. The backend is stopped during the restore and started again.
  Running it again with the same copy is safe. Reads no destination secret.

EXAMPLES
  $ catalyst backup restore --env prod --copy 7k2m9qx4ab
```

_See code: [src/commands/backup/restore.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/backup/restore.ts)_

## `catalyst backup run`

Take a backup copy of a Coolify environment now: the same job as its timer. Prints the id of the new copy and exits zero only when the job succeeded. Reads no destination secret.

```
USAGE
  $ catalyst backup run --env <value> [-c <value>]

FLAGS
  -c, --config=<value>  [default: ./aurora.yaml] Path to aurora.yaml config file
      --env=<value>     (required) Environment that declares backups (e.g. prod)

DESCRIPTION
  Take a backup copy of a Coolify environment now: the same job as its timer. Prints the id of the new copy and exits
  zero only when the job succeeded. Reads no destination secret.

EXAMPLES
  $ catalyst backup run --env prod
```

_See code: [src/commands/backup/run.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/backup/run.ts)_
