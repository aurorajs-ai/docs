---
title: Deploy a project to Coolify
description: Take a project from catalyst new and catalyst add identity to a frontend and backend running on a Coolify server, with the encrypted environment file, the pipeline, provision and deploy commands in order.
---

## Goal

Run the frontend and backend of a scaffolded project on a Coolify server that `catalyst provision` prepares, and release it with `catalyst deploy`.

## Before you start

- **A project** created with `catalyst new` and `catalyst add identity`, with its first migration generated (`pnpm db:generate --name init`) and committed.
- **A server**: Ubuntu 22.04, 24.04 or 26.04 LTS with at least 2 CPU, 2 GB RAM and 10 GB free disk, reachable over SSH with an OpenSSH key. SSH must also be reachable from GitHub-hosted runners.
- **A GitHub repository** for the project, the one you declare as `project.repo`.
- **On your laptop**: `gh` (logged in), `sops`, `age` and the OpenSSH client.
- **A registry token**: a *classic* personal access token with `read:packages`, exported as `CATALYST_GHCR_TOKEN`. Fine-grained tokens are not accepted by GHCR. The server keeps one `ghcr.io` login for every project on it, so projects that share a server need a token that can read all their packages.
- **An age key and `.sops.yaml`.** The scaffold ships neither:

  ```bash
  mkdir -p backend/.keys
  age-keygen -o backend/.keys/age.txt     # prints the public key (age1...)
  ```

  Create `backend/.sops.yaml` with that public key as recipient, and keep a copy of the private key outside the repository. `backend/.keys/` is gitignored, and without the key nobody can decrypt the file.

## Steps

1. **Declare `aurora.yaml`.** Create `aurora.yaml` at the project root with the project, server and environments. Every key, with a complete example, is in the [deployment reference](../../../reference/aurora-yaml-deployment/).

2. **Write the backend variables.** Create `backend/.env.prod` with at least:

   | Variable | Value |
   | --- | --- |
   | `APP_CORS_ORIGIN` | The frontend's public URL |
   | `TRUST_PROXY` | `1` |
   | `DATABASE_MIGRATE_ON_BOOT` | `true` |
   | `NODE_ENV` | `production` |
   | `MAILER_ENABLED` and the other `MAILER_*` settings | `identity` does not boot without a working mailer (`MAILER_SECURE=true` for port 465) |
   | `OAUTH_STRATEGY` | `local-provider` for a project with `identity` |
   | `OAUTH_SESSION_COOKIE_SECURE` | `true` when served over HTTPS |
   | `BOOTSTRAP_SEED`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | `true` for the first deployment, and the first user's credentials |
   | `LOGGER_ERROR_LOG_PATH`, `LOGGER_CONSOLE_LOG_PATH` | `/app/backend/logs/error.log` and `/app/backend/logs/console.log` |
   | `APP_TIMEZONE` | Your time zone |

   Do not declare variables the CLI derives for the environment (`OAUTH_PRIVATE_KEY`, `OAUTH_PUBLIC_KEY`, and `DATABASE_*` or `REDIS_*` when the environment declares them): that is an error. Set `BOOTSTRAP_ADMIN_PASSWORD` before the first deploy, because it cannot be changed from the variables afterwards.

3. **Set the frontend's backend URL.** In `frontend/src/environments/environment.<config>.ts`, `api` holds two absolute URLs fixed at build time: the backend's public URL plus `/graphql`, and plus `/api`.

4. **Generate the pipeline.** `catalyst pipeline` asks only for the hosting platform (choose `coolify`) and writes `.github/workflows/deploy.yml`, both Dockerfiles and their ignore files. You own them afterwards.

5. **Encrypt the variables.** From `backend/`:

   ```bash
   catalyst env encrypt --env prod --config ../aurora.yaml
   ```

   Commit `.env.prod.enc`, never `.env.prod`.

6. **Commit, add the remote and push.**

   ```bash
   git add -A && git commit -m "ci: add the Coolify pipeline"
   git remote add origin git@github.com:my-org/my-project.git
   git push -u origin main
   ```

7. **Provision.**

   ```bash
   export CATALYST_GHCR_TOKEN=ghp_...
   catalyst provision --env prod
   ```

   Run it again after any change to `aurora.yaml` or the encrypted file. It is idempotent. If the SSH user is not root and its sudo asks for a password, export `CATALYST_SUDO_PASSWORD`. If the Coolify admin account does not exist yet, export `CATALYST_COOLIFY_ADMIN_PASSWORD`. With `deployment.dns.provider: ionos`, export `IONOS_API_KEY`.

8. **Deploy.**

   ```bash
   catalyst deploy --env prod
   ```

   It pushes the environment's `source` branch to `environments/prod`, which starts the workflow.

### With no declared domain

If `back.domain` and `front.domain` are absent, the public URLs exist only after the applications do, so run `provision` twice:

1. `catalyst provision --env prod`, which prints each application's public URL.
2. Write the backend URL into `environment.api` and the frontend URL into `APP_CORS_ORIGIN`, both `http://`.
3. `catalyst env encrypt`, then commit and push.
4. `catalyst provision --env prod` again, which applies the variable.
5. `catalyst deploy --env prod`.

In this case leave `OAUTH_SESSION_COOKIE_SECURE` at `false`: a browser drops a `Secure` cookie received over plain HTTP.

### Back up an environment

Declare `deployment.backups.destination` and an environment's `backups` block, export the secrets of the destination type, then:

```bash
catalyst provision --env prod       # timers and destination configuration
catalyst backup run --env prod      # the first copy, now
catalyst backup list --env prod
```

`catalyst backup restore --env prod --copy <id>` replaces the database and the uploads with that copy, with no confirmation prompt.

## Verify it worked

- `catalyst provision --env prod` run a second time reports no changes.
- `catalyst provision audit --env prod` exits zero.
- The workflow run on GitHub finishes, and the frontend URL loads and signs in with the first user.

## Troubleshooting

- **The workflow cannot connect.** The server's SSH port must be reachable from GitHub-hosted runners. A VPN or address restriction breaks it.
- **A variable changed in `provision` but the application did not change.** An application that was already deployed applies the change at its next deployment: push a change to its folder, or redeploy from the Coolify dashboard.
- **The backend does not boot after the first deploy.** Check that the mailer settings are present and that `OAUTH_STRATEGY` is `local-provider`. With `none` or unset, every sign-in is refused.
- **`provision` fails for the registry.** The token must be a classic token with `read:packages`. A later project's token replaces the server's login for every project on it.
- **You need the Coolify dashboard.** `provision` prints an SSH tunnel command; the dashboard port stays closed in the firewall.

## Related

- [Concept: Deploying to Coolify](../../../concepts/workflow/coolify-deployment/)
- [Reference: aurora.yaml deployment keys](../../../reference/aurora-yaml-deployment/)
- [CLI reference: provision](../../../reference/cli-commands/provision/), [env](../../../reference/cli-commands/env/), [deploy](../../../reference/cli-commands/deploy/), [backup](../../../reference/cli-commands/backup/)
