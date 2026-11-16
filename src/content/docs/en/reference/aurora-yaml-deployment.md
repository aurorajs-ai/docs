---
title: aurora.yaml deployment reference
description: Every key of the deployment configuration in aurora.yaml that catalyst provision, deploy, env and backup read for the Coolify provider, the environment variables they use and the backup destination fields.
---

For what the commands do, see [Deploying to Coolify](../../concepts/workflow/coolify-deployment/). For the order of the steps, see [Deploy a project to Coolify](../../guides/workflow/deploy-to-coolify/).

## Example

```yaml
project:
  name: my-project
  repo: my-org/my-project

deployment:
  provider: coolify
  dns:
    provider: ionos
  host:
    automatic_reboot: "04:00"
    docker_address_pool: 172.30.0.0/16
  coolify:
    version: "4.4.6"
    admin:
      username: admin
      email: ops@my-domain.com
  backups:
    destination:
      type: sftp
      host: backups.example.com
      port: 22
      user: my-project
      host_key: "backups.example.com ssh-ed25519 AAAAC3Nz…"
      path: /copies
      encryption: true

server:
  host: 203.0.113.10
  ssh:
    user: root
    private_key: ~/.ssh/project.pem
    port: 22

environments:
  prod:
    source: main
    back:
      domain: api.my-domain.com
      dns_zone: my-domain.com
      dir: backend
      dot_env_enc: .env.prod.enc
      database: { type: postgresql, name: prod_db, user: prod_user }
      redis: true
    front:
      domain: app.my-domain.com
      dns_zone: my-domain.com
      env_configuration: prod
    backups:
      schedule: "*-*-* 03:00:00"
      retention_days: 30
```

A resource is created only when its declaration exists: the CLI never reads the installed packages or the Git remote to decide. Every problem is reported in one message before any remote action.

## `project`

| Key | Description |
| --- | --- |
| `name` | Name of the Coolify project. Matches `^[a-z][a-z0-9-]*$`. |
| `repo` | GitHub repository (`owner/name`). The workflow pushes images to `ghcr.io/<owner>/<repo>/{backend,frontend}` (lowercased) and stores the deploy secrets there. |

## `deployment`

| Key | Description |
| --- | --- |
| `provider` | `coolify`, the only provider. |
| `dns.provider` | Optional. `ionos`. Without it the CLI never touches DNS. A `dns_zone` declared without it is an error. |
| `host.automatic_reboot` | `"HH:MM"` in server time, or `false`. The reboot restarts the containers (about a minute of downtime). |
| `host.docker_address_pool` | Address pool Docker networks are drawn from. Container ports are reachable without a firewall rule only from this pool. |
| `coolify.version` | Exact Coolify version, never `latest`. |
| `coolify.admin.username`, `coolify.admin.email` | The Coolify admin account. Its email domain must have DNS records. |
| `backups.destination` | One backup destination per project. See below. |

## `server`

| Key | Description |
| --- | --- |
| `host` | Server address. It is also where GitHub connects. With `dns.provider` it must be an IPv4 address. |
| `ssh.user` | `root` or a user with sudo. |
| `ssh.private_key` | Path to an OpenSSH private key. A PuTTY `.ppk` file is rejected. A key with a passphrase must be loaded into `ssh-agent` first. |
| `ssh.port` | Optional, default `22`. |

Each environment may override `server:`. Environments that share a host and port share one server.

## `environments.<name>`

Environment names match `^[a-z][a-z0-9-]*$`. `back` and `front` are both required.

| Key | Description |
| --- | --- |
| `source` | Branch that `catalyst deploy` pushes to `environments/<name>`. Default `main`. |
| `back.domain`, `front.domain` | Optional. Absent means Coolify generates a domain, served over HTTP only. |
| `back.dns_zone`, `front.dns_zone` | DNS zone of the domain. Only with `deployment.dns.provider`, one per domain. |
| `back.dir` | Backend directory. Default `backend`. |
| `back.dot_env_enc` | Encrypted variables file, relative to `back.dir`. Default `.env.<name>.enc`. |
| `back.database` | `{ type: postgresql, name, user }`. Absent means no database is created, and `DATABASE_*` variables are yours. `type` must be `postgresql`. |
| `back.redis` | `true` creates Redis. Absent means none. |
| `front.env_configuration` | Angular configuration to build. Default is the environment name. |
| `backups.schedule` | A systemd calendar expression in server time, on one line. Without the `backups` block the environment has no backups. |
| `backups.retention_days` | Integer of at least 1. |

## Backup destination

`deployment.backups.destination` takes a `type` and the fields of that type. Every field listed is required. `encryption` (boolean, default `false`) is optional for every type.

| `type` | Fields | Secrets (environment variables of `catalyst provision`) |
| --- | --- | --- |
| `s3` | `endpoint`, `bucket`, `region`, `path` | `CATALYST_BACKUP_S3_ACCESS_KEY`, `CATALYST_BACKUP_S3_SECRET_KEY` |
| `azure` | `account`, `container`, `path` | `CATALYST_BACKUP_AZURE_KEY` |
| `gcs` | `bucket`, `path` | `CATALYST_BACKUP_GCS_CREDENTIALS_FILE`, the path to a service-account JSON file |
| `sftp` | `host`, `port`, `user`, `host_key`, `path` | exactly one of `CATALYST_BACKUP_SFTP_PASSWORD` or `CATALYST_BACKUP_SFTP_KEY_FILE` |
| `ftps` | `host`, `port`, `user`, `path` | `CATALYST_BACKUP_FTPS_PASSWORD` |

With `encryption: true`, `CATALYST_BACKUP_ENCRYPTION_PASSWORD` is also required. `port` is an integer from 1 to 65535. For `s3`, `azure` and `gcs`, `path` is a prefix inside the bucket or container. The SFTP `host_key` is the single line `ssh-keyscan` prints for the destination: `<host> <key type> <base64 key>`, with `[<host>]:<port>` instead of `<host>` when the port is not 22. Only the variables of the declared type are read, and only when a selected environment declares `backups`.

A copy holds the database (when `back.database` is declared) and the uploads volumes, and every copy is full. `schedule` is validated on the server with `systemd-analyze calendar` before any timer is written.

## Environment variables the CLI reads

| Variable | Needed when |
| --- | --- |
| `CATALYST_GHCR_TOKEN` | The server has no `ghcr.io` credential yet (always on a fresh server). A classic token with `read:packages`. |
| `SOPS_AGE_KEY_FILE` | Your age key is not at `<back.dir>/.keys/age.txt`. |
| `IONOS_API_KEY` | `deployment.dns.provider: ionos` is declared and at least one `domain` is. |
| `CATALYST_SUDO_PASSWORD` | The SSH user is not root and its sudo asks for a password. |
| `CATALYST_COOLIFY_ADMIN_PASSWORD` | The Coolify admin account does not exist yet. |
| `CATALYST_BACKUP_*` | The backup destination type declares secrets (table above). |

They are never written to `aurora.yaml`, a file or a log.

## Variables `provision` derives

`provision` stores the variables of `<back.dir>/<dot_env_enc>` in the backend application, together with `OAUTH_PRIVATE_KEY` and `OAUTH_PUBLIC_KEY` (read from, or generated into, `<back.dir>/oauth-private.key` and `oauth-public.key`), `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD` and `DATABASE_SCHEMA` when `back.database` is declared, and `REDIS_HOST`, `REDIS_PORT` and `REDIS_PASSWORD` when `back.redis` is `true`. Declaring one of these in the encrypted file for that environment is an error that names the key and the file.

## GitHub secrets and variables

Names use the upper-case environment name with `-` replaced by `_` (the environment `pre-prod` gives `PRE_PROD_...`):

| Name | Kind |
| --- | --- |
| `<ENV>_DEPLOY_SSH_KEY` | Secret |
| `<ENV>_DEPLOY_SSH_HOST`, `<ENV>_DEPLOY_SSH_PORT`, `<ENV>_DEPLOY_SSH_KNOWN_HOSTS`, `<ENV>_DEPLOY_SSH_KEY_FINGERPRINT`, `<ENV>_FRONT_ENV_CONFIGURATION` | Variables |

To rotate the deploy key, delete the secret `<ENV>_DEPLOY_SSH_KEY` and run `catalyst provision`: the server's entry is replaced and the old key stops working at once.

## Related

- [Concept: Deploying to Coolify](../../concepts/workflow/coolify-deployment/)
- [How-to: Deploy a project to Coolify](../../guides/workflow/deploy-to-coolify/)
- [CLI reference: provision](../cli-commands/provision/), [backup](../cli-commands/backup/)
