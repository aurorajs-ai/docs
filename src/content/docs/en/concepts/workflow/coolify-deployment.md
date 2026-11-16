---
title: Deploying to Coolify
description: How catalyst provision, pipeline, deploy and backup take a project from aurora.yaml to a hardened Coolify server running the frontend and backend, and why the server and the application are declared separately from deployment.
---

## Why this exists

Shipping a scaffolded project to a server used to mean hand-built servers, copied workflows and secrets pasted into dashboards, none of it reproducible. Two projects on one server overwrote each other's configuration, and nobody could tell whether a server still matched what the team believed.

The CLI now treats the deployment as a declaration. `aurora.yaml` states what the server, the environments and the backups should be. `catalyst provision` makes the server match it, `catalyst pipeline` writes the CI files, and `catalyst deploy` triggers a release. Only the `coolify` provider exists today.

## How it works

### Three layers, three commands

| Layer | What it holds | Who writes it |
| --- | --- | --- |
| **Server** | A hardened Ubuntu host with Docker and a pinned Coolify | `catalyst provision` |
| **Application** | Per environment: a Coolify project, PostgreSQL, optional Redis, a backend and a frontend application, a volume for uploads, variables, the deploy trigger | `catalyst provision` |
| **Release** | The images and the deployment itself | The CI workflow from `catalyst pipeline`, started by `catalyst deploy` |

**The server layer** leaves a host with security updates applied and unattended updates on, an optional automatic reboot window, key-only SSH, `fail2ban`, a firewall that lets in only the SSH port and ports 80 and 443 (including for Docker-published ports), Docker networks drawn from a declared address pool, Docker and Coolify at an exact version with Coolify's auto-update off, and Coolify's API reachable only from the server itself. The Coolify dashboard is not exposed: provision prints the SSH tunnel command that reaches it from your laptop.

**The application layer** creates only what `aurora.yaml` declares for each environment. The CLI never reads the installed packages or the Git remote to decide: a database exists because `back.database` is declared, Redis because `back.redis: true`. The backend's runtime variables come from an encrypted file in the repository (`.env.<env>.enc`, SOPS with an age key) that `provision` decrypts in memory on your laptop, plus the ones the CLI derives itself (the OAuth key pair, database and Redis connection values). The application holds exactly that union: a variable added by hand in the dashboard is removed on the next run.

**The release layer** builds on GitHub Actions. The generated workflow builds the images of the half that changed, pushes them to GitHub Container Registry as `<image>:<sha>`, and connects to the server over SSH to start the Coolify deployment of that application. The backend image runs under PM2. `catalyst deploy` only pushes the environment's source branch to `environments/<env>`, which is the workflow's trigger.

### How CI is allowed to deploy

`provision` creates a `catalyst-deploy` account on the server: a locked password, no sudo, no Docker access. It holds one restricted key per project and environment, and each connection runs a single forced command that accepts exactly `backend` or `frontend`, starts that application's deployment and waits for the result. The Coolify token it uses lives on the server and never in GitHub. Two projects on one server never collide, because each entry is identified by `<project>.<env>`.

### Idempotent and auditable

Running `provision` again against an unchanged declaration reports no change. `catalyst provision audit` compares the server with the declarations and changes nothing: it reports drift (a hand-added firewall rule, an edited timer, an extra key), probes the ports from outside and exits non-zero when the server drifted. The next `provision` removes the drift.

### Backups

An environment can declare scheduled, off-server backups of its database and its uploaded files. A timer on the server takes each copy, uploads it to a destination (S3, Azure, GCS, SFTP or FTPS), verifies it and deletes copies older than the retention. `catalyst backup list`, `run` and `restore` operate on them. The [deployment reference](../../../reference/aurora-yaml-deployment/) lists the destination fields.

## When it applies

- You deploy a project created with `catalyst new` to a server you control.
- You want a second environment, or a second project on the same server.
- You need to know whether a server still matches what the team declared.

## Trade-offs and limits

- GitHub must reach the server over SSH, because the workflow runs on a GitHub-hosted runner. Restricting SSH to a VPN or fixed addresses breaks deployments.
- Coolify writes the decrypted variables in clear to its own files on the server at each deployment, readable by root and Coolify only, and `docker inspect` shows them.
- With no declared domain, Coolify generates an `http://` address that is served over plain HTTP only. Use a declared domain for HTTPS.
- A change to an application that was already deployed applies at its next deployment: `provision` never deploys.
- `restore` replaces data with no confirmation prompt, and Coolify's database import refuses dumps over 10 GiB.
- Losing the backup encryption password loses every encrypted copy.

## Related

- [How-to: Deploy to Coolify](../../../guides/workflow/deploy-to-coolify/)
- [Reference: aurora.yaml deployment keys](../../../reference/aurora-yaml-deployment/)
- [CLI reference: provision](../../../reference/cli-commands/provision/), [pipeline](../../../reference/cli-commands/pipeline/), [deploy](../../../reference/cli-commands/deploy/), [backup](../../../reference/cli-commands/backup/)
