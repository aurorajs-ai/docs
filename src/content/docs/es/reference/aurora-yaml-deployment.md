---
title: Referencia de despliegue de aurora.yaml
description: Todas las claves de la configuración de despliegue de aurora.yaml que leen catalyst provision, deploy, env y backup para el proveedor Coolify, las variables de entorno que usan y los campos del destino de copias de seguridad.
---

Para saber qué hacen los comandos, consulta [Despliegue en Coolify](../../concepts/workflow/coolify-deployment/). Para el orden de los pasos, consulta [Desplegar un proyecto en Coolify](../../guides/workflow/deploy-to-coolify/).

## Ejemplo

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

Un recurso se crea solo cuando existe su declaración: la CLI nunca lee los paquetes instalados ni el remoto de Git para decidir. Todos los problemas se informan en un solo mensaje antes de cualquier acción remota.

## `project`

| Clave | Descripción |
| --- | --- |
| `name` | Nombre del proyecto de Coolify. Cumple `^[a-z][a-z0-9-]*$`. |
| `repo` | Repositorio de GitHub (`owner/name`). El workflow sube las imágenes a `ghcr.io/<owner>/<repo>/{backend,frontend}` (en minúsculas) y guarda allí los secretos de despliegue. |

## `deployment`

| Clave | Descripción |
| --- | --- |
| `provider` | `coolify`, el único proveedor. |
| `dns.provider` | Opcional. `ionos`. Sin él, la CLI nunca toca el DNS. Declarar un `dns_zone` sin él es un error. |
| `host.automatic_reboot` | `"HH:MM"` en hora del servidor, o `false`. El reinicio reinicia los contenedores (cerca de un minuto de indisponibilidad). |
| `host.docker_address_pool` | Rango de direcciones del que se toman las redes de Docker. Los puertos de contenedor son accesibles sin regla de cortafuegos solo desde este rango. |
| `coolify.version` | Versión exacta de Coolify, nunca `latest`. |
| `coolify.admin.username`, `coolify.admin.email` | La cuenta de administrador de Coolify. El dominio de su correo debe tener registros DNS. |
| `backups.destination` | Un destino de copias por proyecto. Ver más abajo. |

## `server`

| Clave | Descripción |
| --- | --- |
| `host` | Dirección del servidor. Es también a donde se conecta GitHub. Con `dns.provider` debe ser una dirección IPv4. |
| `ssh.user` | `root` o un usuario con sudo. |
| `ssh.private_key` | Ruta a una clave privada OpenSSH. Un archivo PuTTY `.ppk` se rechaza. Una clave con frase de paso debe cargarse antes en `ssh-agent`. |
| `ssh.port` | Opcional, por defecto `22`. |

Cada entorno puede sobrescribir `server:`. Los entornos que comparten host y puerto comparten un servidor.

## `environments.<name>`

Los nombres de entorno cumplen `^[a-z][a-z0-9-]*$`. `back` y `front` son obligatorios.

| Clave | Descripción |
| --- | --- |
| `source` | Rama que `catalyst deploy` sube a `environments/<name>`. Por defecto `main`. |
| `back.domain`, `front.domain` | Opcionales. Si faltan, Coolify genera un dominio, servido solo por HTTP. |
| `back.dns_zone`, `front.dns_zone` | Zona DNS del dominio. Solo con `deployment.dns.provider`, una por dominio. |
| `back.dir` | Directorio del backend. Por defecto `backend`. |
| `back.dot_env_enc` | Archivo de variables cifrado, relativo a `back.dir`. Por defecto `.env.<name>.enc`. |
| `back.database` | `{ type: postgresql, name, user }`. Si falta, no se crea base de datos y las variables `DATABASE_*` son tuyas. `type` debe ser `postgresql`. |
| `back.redis` | `true` crea Redis. Si falta, no hay. |
| `front.env_configuration` | Configuración de Angular que se compila. Por defecto, el nombre del entorno. |
| `backups.schedule` | Una expresión de calendario de systemd en hora del servidor, en una línea. Sin el bloque `backups`, el entorno no tiene copias. |
| `backups.retention_days` | Entero de al menos 1. |

## Destino de las copias de seguridad

`deployment.backups.destination` recibe un `type` y los campos de ese tipo. Todos los campos listados son obligatorios. `encryption` (booleano, por defecto `false`) es opcional en cualquier tipo.

| `type` | Campos | Secretos (variables de entorno de `catalyst provision`) |
| --- | --- | --- |
| `s3` | `endpoint`, `bucket`, `region`, `path` | `CATALYST_BACKUP_S3_ACCESS_KEY`, `CATALYST_BACKUP_S3_SECRET_KEY` |
| `azure` | `account`, `container`, `path` | `CATALYST_BACKUP_AZURE_KEY` |
| `gcs` | `bucket`, `path` | `CATALYST_BACKUP_GCS_CREDENTIALS_FILE`, la ruta a un JSON de cuenta de servicio |
| `sftp` | `host`, `port`, `user`, `host_key`, `path` | exactamente una de `CATALYST_BACKUP_SFTP_PASSWORD` o `CATALYST_BACKUP_SFTP_KEY_FILE` |
| `ftps` | `host`, `port`, `user`, `path` | `CATALYST_BACKUP_FTPS_PASSWORD` |

Con `encryption: true`, también se exige `CATALYST_BACKUP_ENCRYPTION_PASSWORD`. `port` es un entero de 1 a 65535. En `s3`, `azure` y `gcs`, `path` es un prefijo dentro del bucket o del contenedor. El `host_key` de SFTP es la línea única que imprime `ssh-keyscan` para el destino: `<host> <tipo de clave> <clave en base64>`, con `[<host>]:<port>` en lugar de `<host>` cuando el puerto no es 22. Solo se leen las variables del tipo declarado, y solo cuando un entorno seleccionado declara `backups`.

Una copia contiene la base de datos (cuando se declara `back.database`) y los volúmenes de subidas, y toda copia es completa. `schedule` se valida en el servidor con `systemd-analyze calendar` antes de escribir cualquier temporizador.

## Variables de entorno que lee la CLI

| Variable | Se necesita cuando |
| --- | --- |
| `CATALYST_GHCR_TOKEN` | El servidor aún no tiene credencial de `ghcr.io` (siempre en un servidor nuevo). Un token clásico con `read:packages`. |
| `SOPS_AGE_KEY_FILE` | Tu clave age no está en `<back.dir>/.keys/age.txt`. |
| `IONOS_API_KEY` | Se declara `deployment.dns.provider: ionos` y al menos un `domain`. |
| `CATALYST_SUDO_PASSWORD` | El usuario SSH no es root y su sudo pide contraseña. |
| `CATALYST_COOLIFY_ADMIN_PASSWORD` | La cuenta de administrador de Coolify aún no existe. |
| `CATALYST_BACKUP_*` | El tipo de destino de copias declara secretos (tabla anterior). |

Nunca se escriben en `aurora.yaml`, en un archivo ni en un registro.

## Variables que deriva `provision`

`provision` guarda las variables de `<back.dir>/<dot_env_enc>` en la aplicación del backend, junto con `OAUTH_PRIVATE_KEY` y `OAUTH_PUBLIC_KEY` (leídas de, o generadas en, `<back.dir>/oauth-private.key` y `oauth-public.key`), `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD` y `DATABASE_SCHEMA` cuando se declara `back.database`, y `REDIS_HOST`, `REDIS_PORT` y `REDIS_PASSWORD` cuando `back.redis` es `true`. Declarar una de ellas en el archivo cifrado de ese entorno es un error que nombra la clave y el archivo.

## Secretos y variables de GitHub

Los nombres usan el nombre del entorno en mayúsculas con `-` sustituido por `_` (el entorno `pre-prod` da `PRE_PROD_...`):

| Nombre | Tipo |
| --- | --- |
| `<ENV>_DEPLOY_SSH_KEY` | Secreto |
| `<ENV>_DEPLOY_SSH_HOST`, `<ENV>_DEPLOY_SSH_PORT`, `<ENV>_DEPLOY_SSH_KNOWN_HOSTS`, `<ENV>_DEPLOY_SSH_KEY_FINGERPRINT`, `<ENV>_FRONT_ENV_CONFIGURATION` | Variables |

Para rotar la clave de despliegue, borra el secreto `<ENV>_DEPLOY_SSH_KEY` y ejecuta `catalyst provision`: la entrada del servidor se reemplaza y la clave antigua deja de funcionar de inmediato.

## Relacionado

- [Concepto: Despliegue en Coolify](../../concepts/workflow/coolify-deployment/)
- [Guía: Desplegar un proyecto en Coolify](../../guides/workflow/deploy-to-coolify/)
- [Referencia de la CLI: provision](../cli-commands/provision/), [backup](../cli-commands/backup/)
