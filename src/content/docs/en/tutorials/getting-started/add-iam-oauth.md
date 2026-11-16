---
title: Add IAM + OAuth to the hub
description: Install the Identity package, generate the first migration, run the hub, and log in as the seeded admin.
sidebar:
  order: 3
---

Now turn the bare project from the previous step into an **Aurora Hub**: a Catalyst instance that owns identity and signs its own OAuth tokens.

## 1. Add the Identity package

```bash
catalyst add identity
```

This installs the `iam` and `o-auth` bounded contexts into the backend and the matching login UI and IAM screens into the frontend, along with the `tools` package that Identity requires. A package installs every half it declares, so there is no separate backend and frontend step. The command prints the plan before it changes anything. See [`catalyst add`](../../../reference/cli-commands/add/).

When it finishes, it prints what is left to do. Keep that list for the next steps: the `pnpm db:generate` commands to run, and the required keys that `backend/.env` still lacks.

## 2. Set the keys the command listed

The Identity package declares the `MAILER_*` settings as required keys. `catalyst add` does not write them: if they are missing or empty in `backend/.env`, it lists them under *Set these required keys in backend/.env*. Give them a value. For local development a mail sink such as Mailpit is enough: it accepts every message and delivers none.

```dotenv
MAILER_ENABLED = true
MAILER_HOST = localhost
MAILER_PORT = 1025
MAILER_SECURE = false
MAILER_IGNORE_TLS = true
```

Use `MAILER_SECURE = true` for port 465. Any other `MAILER_*` key the command lists (user, password, sender) can stay as it is for a sink.

## 3. Check the hub strategy

Identity declares `OAUTH_STRATEGY = local-provider`, and `catalyst add` writes it to `backend/.env` when the key is missing. Open the file and confirm the value, because this setting is what makes the app a hub:

```dotenv
OAUTH_STRATEGY = local-provider
```

If the file already had another value, change it yourself: the command never overwrites an existing key. The default when the key is unset is `none`, and `none` refuses every sign-in.

You do not need `catalyst keys`: `catalyst new` already wrote `oauth-private.key` and `oauth-public.key` under `backend/.keys/`. A hub signs its own tokens, so it **reads the private key at boot and will not start without it**.

## 4. Generate the first migration

The scaffold has no tables yet. `catalyst add` printed one `pnpm db:generate --name <package>` command for each package it changed (Identity requires `tools`, so expect both). Run each printed command from the project root, for example:

```bash
pnpm db:generate --name tools
pnpm db:generate --name identity
```

`--name` is mandatory. This step is offline: it opens no database connection. Review the generated `.sql` under `backend/src/database/migrations/drizzle/` and commit it with the rest.

## 5. Run the hub

```bash
pnpm dev
```

On first boot the backend applies the migration, and then the bootstrap seeder populates the tables: the default admin account, the roles, and the `aurora` OAuth application with its Authorization Code client. The `aurora` application is a **public client**: the frontend identifies itself with the code `aurora` and proves possession with PKCE, so it holds no secret.

## 6. Wire the frontend to the hub

Before you log in, align both ends of the connection: the frontend's OAuth application code and the backend's allowed origin.

**Frontend — application code.** The frontend signs in through the Authorization Code flow with PKCE. It sends the OAuth **application code** and nothing else: there is no secret. The code must match the application the seeder registered. Each environment file under `frontend/src/environments/` carries its own `oAuth` block:

```ts
// frontend/src/environments/environment.ts (and .local.ts, .dev.ts, .qa.ts, .prod.ts)
authStrategy: 'local',
oAuth: {
  applicationCode: 'aurora',
},
```

The scaffold ships these values already aligned with the seeded application, so local login works out of the box. When you register a different application, or override `BOOTSTRAP_OAUTH_APP_CODE` on the backend, set `applicationCode` in **every** `environment.*.ts` to the code registered in the database.

**Backend — allowed origin (CORS).** In `backend/.env`, set `APP_CORS_ORIGIN` to the frontend URL that will sign in against the hub:

```dotenv
APP_CORS_ORIGIN = http://localhost:4200
```

The sign-in request carries the frontend's `Origin`, and the hub rejects any `Origin` that is not in this list. When the variable is unset, only the backend's own origin is allowed, so the frontend running on another port cannot sign in. Pin it to the real frontend origin from the start.

## 7. Log in

Open the frontend at [http://localhost:4200](http://localhost:4200) and sign in with the seeded admin:

| Field | Value |
| --- | --- |
| Email | `admin@aurora.dev` |
| Password | `admin1234` |

The seeded password is public: change it through the application, or set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` before the first boot.

## 8. Know which origins the hub allows

If you plan to add satellite apps (the next step), the allowlist you set in step 6 does not change. A satellite sends its users to the hub's own frontend to sign in, so the origin the hub sees on the sign-in request is the hub frontend's. The satellite's backend talks to the hub server to server, with no browser `Origin` involved. Extend the list only if another frontend serves the hub's sign-in page.

## Next

The hub is running and owns identity. Next, [install an Aurora satellite](/aurora-catalyst-docs/en/tutorials/getting-started/install-satellite/) that delegates its login here.
