---
title: Install an Aurora satellite
description: Scaffold a second Catalyst app and delegate all of its login to the hub via the OAuth 2.1 Authorization Code flow with PKCE.
sidebar:
  order: 4
---

A **satellite** is a Catalyst app that keeps no login form of its own. Unauthenticated users are bounced to the hub, the hub issues the tokens, and the satellite validates them against the hub's JWKS. This step builds one and wires it to the hub from the previous steps.

This guide assumes the hub at `http://localhost:8080`, and the satellite frontend at `http://localhost:4201` with its backend at `http://localhost:8081`. Adjust to your deployment. For the roles and token flow behind these steps, see [Authentication strategies](/aurora-catalyst-docs/en/concepts/backend/authentication-strategies/).

## 1. Scaffold the satellite

```bash
catalyst new aurora-app1
```

Then, in `backend/.env`, set the `DATABASE_*` connection to its **own** database — not the hub's. The satellite keeps no identity tables, because identity lives on the hub.

## 2. Add the Authorization Code package

```bash
catalyst add authorization-code
```

This installs the BFF package that drives the `/authorize` → `/callback` → token round-trip. A satellite needs no `iam` or `o-auth` package of its own — identity lives on the hub.

:::note
A satellite in `aurora-hub` mode validates tokens against the hub's JWKS and **never signs anything**. It still reads a private key at boot, though, so keep the key pair that `catalyst new` wrote under `backend/.keys/` where it is. You do not generate anything extra.
:::

## 3. Register the satellite on the hub

The hub registers a satellite through its **Applications** screen, which belongs to the `hub` package. If the hub project does not have it yet, install it there:

```bash
catalyst add hub
```

Set the required `APP_URL` key in the hub's `backend/.env` to the hub backend's public base URL (here `http://localhost:8080`), run the `pnpm db:generate --name hub` command the install prints, and restart the hub. Then, in the hub admin, create an app:

1. **Code** → the satellite's application code, such as `aurora-app1`. Only lowercase letters, digits and hyphens are accepted.
2. **Name** and **URL** → a descriptive name and the satellite frontend's URL.
3. **Redirect URI** → the satellite's callback, **exactly**: `http://localhost:4201/callback`. It must be an absolute `http(s)` URL with no fragment (`#`); the hub matches it character for character at both `/authorize` and the token exchange.
4. Leave **Active** on, then save.

Saving does everything in one transaction: it creates the OAuth application and its Authorization Code client, a bounded context for the app, and an access permission that it attaches to the Administrator role. An admin who is already signed in sees the new app after their next token issuance (sign in again or refresh).

:::caution[Copy the credentials now]
The create response carries a one-time credential bundle: the hub's base URL, the application `code`, the `secret` and the redirect URI. The secret is shown **once** and cannot be read again. The satellite authenticates with the application's `code` and `secret`, not with a client UUID.
:::

## 4. Configure the satellite backend `.env`

In the satellite's `backend/.env`, paste the values of the credential bundle:

```dotenv
OAUTH_STRATEGY = aurora-hub
OAUTH_HUB_SERVER_URL = http://localhost:8080
OAUTH_APPLICATION_CODE = aurora-app1
OAUTH_APPLICATION_SECRET = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OAUTH_REDIRECT_URI = http://localhost:4201/callback
```

| Variable | What it is |
| --- | --- |
| `OAUTH_STRATEGY` | `aurora-hub` selects satellite mode. The default when it is unset is `none`, so you must set it. |
| `OAUTH_HUB_SERVER_URL` | Base URL of the **hub** backend. |
| `OAUTH_APPLICATION_CODE` | The application `code` from the bundle. Sent as `client_id`. The satellite also requires every token to carry it as its audience. |
| `OAUTH_APPLICATION_SECRET` | The application `secret` from the bundle. Used only in the backend's HTTP Basic header — never shipped to the frontend. |
| `OAUTH_REDIRECT_URI` | The satellite callback. Must equal the hub app's **Redirect URI** exactly. |

If the satellite runs on the **same host** as the hub, give it distinct ports so the two don't collide:

```dotenv
APP_URL = http://localhost:8081
APP_FRONTEND_URL = http://localhost:4201
APP_PORT = 8081
```

## 5. Point the satellite frontend at hub mode

In the active environment file (`frontend/src/environments/environment.ts`):

```ts
authStrategy: 'authorization-code',
api: {
  graphql: 'http://localhost:8081/graphql',
  rest: 'http://localhost:8081/api',
},
```

- `authStrategy` flips from the scaffold default `'local'` to `'authorization-code'`. This single field is the source of truth: it selects the code guard, drops the local login form, and routes sign-out to a terminal page.
- The `api` endpoints point at the satellite's **own** backend (the BFF) on `:8081` — **not** the hub. The `/callback` round-trip POSTs here.

The `/callback` route ships pre-wired and unguarded; do not add an auth guard to it.

Then set the satellite frontend's dev port in `frontend/package.json` so it doesn't clash with the hub's `:4200`:

```json
"start:local": "ng serve --configuration local --port 4201"
```

## 6. Restart and run

Restart the satellite backend (the strategy is read once at boot), then start both apps.

## 7. Verify it worked

Open a protected route on the satellite and watch the round-trip:

1. The browser is redirected to the satellite backend `…/api/auth/login`, which 302s to the hub `…/api/o-auth/authorize` with `code_challenge` and `code_challenge_method=S256`.
2. You log in on the **hub**, which redirects to `http://localhost:4201/callback?code=…&state=…`.
3. The callback POSTs to the satellite `…/api/auth/token`, tokens are stored, and you land authenticated.

Green checklist: no `invalid_request` (PKCE travelled), no `401` (the application secret matched), no redirect loop, and sign-out reaches the terminal page without bouncing back to the hub.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `400 invalid_request` | PKCE missing, or `client_id` is not the application code | Run `catalyst upgrade` to bring the BFF to the CLI's current version; set `OAUTH_APPLICATION_CODE` to the application `code`. |
| `400 redirect_uri mismatch` | The hub app's **Redirect URI** ≠ `OAUTH_REDIRECT_URI` | Make them identical — absolute, no fragment. |
| `401 invalid_client` | `OAUTH_APPLICATION_SECRET` wrong, or never copied from the bundle | Use the secret from the credential bundle. The hub cannot show it again. |
| `401 invalid_token` on the satellite's API | The token's audience is not this satellite's `OAUTH_APPLICATION_CODE` | Make `OAUTH_APPLICATION_CODE` equal the code of the application the satellite registered on the hub. |
| `429 ThrottlerException` | A redirect loop hammering the hub | Fix the underlying 4xx, then restart the hub (the throttle counter is in-memory). |
| Blank page / `NG04002` | Hub sign-in path misconfigured | Check the hub's `OAUTH_SIGN_IN_PATH` (default `/auth/sign-in`). |

## Related

- [Authentication strategies](/aurora-catalyst-docs/en/concepts/backend/authentication-strategies/) — the three modes and the token flow.
- [`catalyst add`](../../../reference/cli-commands/add/) — add the Authorization Code package.
