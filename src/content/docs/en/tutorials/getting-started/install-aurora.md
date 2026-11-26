---
title: Install Aurora Catalyst
description: Scaffold a new Catalyst monorepo and point its backend at a database.
sidebar:
  order: 2
  hidden: true
---

With the CLI installed, this step scaffolds a new Aurora Catalyst project. The procedure is the same for any Catalyst app — the role it plays is decided later, from configuration.

## 1. Scaffold the project

```bash
catalyst new my-project
```

This creates an Aurora monorepo (a `backend/` + `frontend/` workspace) named `my-project`, installs its dependencies, writes `backend/.env`, and generates the OAuth signing key pair under `backend/.keys/`. It also commits the scaffold on an `aurora/scaffold` branch, which `catalyst add` and `catalyst upgrade` use later as the merge base. See [`catalyst new`](../../../reference/cli-commands/new/).

## 2. Create a database and set the connection

Create an empty PostgreSQL database, then open `backend/.env` and point the `DATABASE_*` block at it:

```dotenv
DATABASE_HOST = localhost
DATABASE_PORT = 5432
DATABASE_USER = postgres
DATABASE_PASSWORD = postgres
DATABASE_SCHEMA = my-project
```

`DATABASE_SCHEMA` is the name of the database. Each Catalyst app needs its **own** database — if you run more than one app, give each its own so they don't clash.

## 3. Know how the tables get created

The scaffold ships no tables and no migrations. The database schema changes only through versioned migrations, and the first one is generated from the schema files of the packages you install. You generate it in the next tutorial, with the `pnpm db:generate --name <package>` commands that `catalyst add` prints, and the backend applies it when it boots.

:::note
Migrations apply at boot by default (`DATABASE_MIGRATE_ON_BOOT`). The guide [Manage schema migrations](../../../guides/backend/manage-schema-migrations/) covers the full cycle and when to turn that off.
:::

## Next

Your project is scaffolded and wired to a database. Next, [add IAM + OAuth](/aurora-catalyst-docs/en/tutorials/getting-started/add-iam-oauth/) to turn it into an identity provider.

To bring a colleague onto the project, follow [Onboard a developer](/aurora-catalyst-docs/en/guides/workflow/onboard-developer/).
