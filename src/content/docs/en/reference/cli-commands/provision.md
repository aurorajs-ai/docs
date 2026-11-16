---
title: "Provision"
---

`catalyst provision`
====================

Provision Aurora project infrastructure (DNS + Hosting + CI/CD)

* [`catalyst provision`](#catalyst-provision)
* [`catalyst provision audit`](#catalyst-provision-audit)

## `catalyst provision`

Provision Aurora project infrastructure on Coolify: the server layer and the application layer (project, PostgreSQL and Redis if declared, both applications, their variables, the deploy trigger and its GitHub secret and variables).

```
USAGE
  $ catalyst provision [-c <value>] [--env <value>] [--full-upgrade]

FLAGS
  -c, --config=<value>  [default: ./aurora.yaml] Path to aurora.yaml config file
      --env=<value>     Provision only this environment (e.g. dev, qa, prod)
      --full-upgrade    Besides the security updates, upgrade every installed package. This can upgrade Docker, which
                        restarts Coolify and every application on the server.

DESCRIPTION
  Provision Aurora project infrastructure on Coolify: the server layer and the application layer (project, PostgreSQL
  and Redis if declared, both applications, their variables, the deploy trigger and its GitHub secret and variables).

EXAMPLES
  $ catalyst provision --env dev

  CATALYST_GHCR_TOKEN=ghp_x catalyst provision --env prod   # servers and applications
```

_See code: [src/commands/provision/index.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/provision/index.ts)_

## `catalyst provision audit`

Compare Coolify servers with the state aurora.yaml declares, without changing them. Exits non-zero on drift or when an expected port state is violated.

```
USAGE
  $ catalyst provision audit [-c <value>] [--env <value>]

FLAGS
  -c, --config=<value>  [default: ./aurora.yaml] Path to aurora.yaml config file
      --env=<value>     Audit only this environment (e.g. dev, qa, prod)

DESCRIPTION
  Compare Coolify servers with the state aurora.yaml declares, without changing them. Exits non-zero on drift or when an
  expected port state is violated.

EXAMPLES
  $ catalyst provision audit

  $ catalyst provision audit --env prod
```

_See code: [src/commands/provision/audit.ts](https://github.com/avvale/aurora-catalyst/blob/main/packages/cli/src/commands/provision/audit.ts)_
