---
title: Desplegar un proyecto en Coolify
description: Lleva un proyecto desde catalyst new y catalyst add identity hasta un frontend y un backend en marcha en un servidor Coolify, con el archivo de entorno cifrado y los comandos pipeline, provision y deploy en orden.
---

## Objetivo

Ejecutar el frontend y el backend de un proyecto generado en un servidor Coolify que prepara `catalyst provision`, y publicarlo con `catalyst deploy`.

## Antes de empezar

- **Un proyecto** creado con `catalyst new` y `catalyst add identity`, con su primera migración generada (`pnpm db:generate --name init`) y confirmada en Git.
- **Un servidor**: Ubuntu 22.04, 24.04 o 26.04 LTS con al menos 2 CPU, 2 GB de RAM y 10 GB de disco libre, accesible por SSH con una clave OpenSSH. SSH debe ser accesible también desde los runners alojados por GitHub.
- **Un repositorio de GitHub** para el proyecto, el que declaras como `project.repo`.
- **En tu portátil**: `gh` (con la sesión iniciada), `sops`, `age` y el cliente OpenSSH.
- **Un token de registro**: un token de acceso personal *clásico* con `read:packages`, exportado como `CATALYST_GHCR_TOKEN`. GHCR no acepta tokens de grano fino. El servidor guarda una única sesión de `ghcr.io` para todos los proyectos que aloja, así que los proyectos que comparten servidor necesitan un token que pueda leer todos sus paquetes.
- **Una clave age y `.sops.yaml`.** El scaffold no incluye ninguno:

  ```bash
  mkdir -p backend/.keys
  age-keygen -o backend/.keys/age.txt     # imprime la clave pública (age1...)
  ```

  Crea `backend/.sops.yaml` con esa clave pública como destinataria, y guarda una copia de la clave privada fuera del repositorio. `backend/.keys/` está en `.gitignore`, y sin la clave nadie puede descifrar el archivo.

## Pasos

1. **Declara `aurora.yaml`.** Crea `aurora.yaml` en la raíz del proyecto con el proyecto, el servidor y los entornos. Todas las claves, con un ejemplo completo, están en la [referencia de despliegue](../../../reference/aurora-yaml-deployment/).

2. **Escribe las variables del backend.** Crea `backend/.env.prod` con al menos:

   | Variable | Valor |
   | --- | --- |
   | `APP_CORS_ORIGIN` | La URL pública del frontend |
   | `TRUST_PROXY` | `1` |
   | `DATABASE_MIGRATE_ON_BOOT` | `true` |
   | `NODE_ENV` | `production` |
   | `MAILER_ENABLED` y el resto de ajustes `MAILER_*` | `identity` no arranca sin un mailer que funcione (`MAILER_SECURE=true` para el puerto 465) |
   | `OAUTH_STRATEGY` | `local-provider` para un proyecto con `identity` |
   | `OAUTH_SESSION_COOKIE_SECURE` | `true` cuando se sirve por HTTPS |
   | `BOOTSTRAP_SEED`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | `true` para el primer despliegue, y las credenciales del primer usuario |
   | `LOGGER_ERROR_LOG_PATH`, `LOGGER_CONSOLE_LOG_PATH` | `/app/backend/logs/error.log` y `/app/backend/logs/console.log` |
   | `APP_TIMEZONE` | Tu zona horaria |

   No declares las variables que la CLI deriva para el entorno (`OAUTH_PRIVATE_KEY`, `OAUTH_PUBLIC_KEY`, y `DATABASE_*` o `REDIS_*` cuando el entorno los declara): es un error. Define `BOOTSTRAP_ADMIN_PASSWORD` antes del primer despliegue, porque después no se puede cambiar desde las variables.

3. **Define la URL del backend en el frontend.** En `frontend/src/environments/environment.<config>.ts`, `api` contiene dos URL absolutas fijadas en el build: la URL pública del backend más `/graphql`, y más `/api`.

4. **Genera el pipeline.** `catalyst pipeline` solo pregunta por la plataforma de alojamiento (elige `coolify`) y escribe `.github/workflows/deploy.yml`, los dos Dockerfile y sus archivos de exclusión. Después son tuyos.

5. **Cifra las variables.** Desde `backend/`:

   ```bash
   catalyst env encrypt --env prod --config ../aurora.yaml
   ```

   Haz commit de `.env.prod.enc`, nunca de `.env.prod`.

6. **Haz commit, añade el remoto y sube.**

   ```bash
   git add -A && git commit -m "ci: add the Coolify pipeline"
   git remote add origin git@github.com:my-org/my-project.git
   git push -u origin main
   ```

7. **Provisiona.**

   ```bash
   export CATALYST_GHCR_TOKEN=ghp_...
   catalyst provision --env prod
   ```

   Ejecútalo de nuevo tras cualquier cambio en `aurora.yaml` o en el archivo cifrado. Es idempotente. Si el usuario SSH no es root y su sudo pide contraseña, exporta `CATALYST_SUDO_PASSWORD`. Si la cuenta de administrador de Coolify aún no existe, exporta `CATALYST_COOLIFY_ADMIN_PASSWORD`. Con `deployment.dns.provider: ionos`, exporta `IONOS_API_KEY`.

8. **Despliega.**

   ```bash
   catalyst deploy --env prod
   ```

   Sube la rama `source` del entorno a `environments/prod`, lo que inicia el workflow.

### Sin dominio declarado

Si `back.domain` y `front.domain` no están, las URL públicas solo existen cuando existen las aplicaciones, así que ejecuta `provision` dos veces:

1. `catalyst provision --env prod`, que imprime la URL pública de cada aplicación.
2. Escribe la URL del backend en `environment.api` y la URL del frontend en `APP_CORS_ORIGIN`, ambas `http://`.
3. `catalyst env encrypt`, y después commit y push.
4. `catalyst provision --env prod` otra vez, que aplica la variable.
5. `catalyst deploy --env prod`.

En este caso deja `OAUTH_SESSION_COOKIE_SECURE` en `false`: un navegador descarta una cookie `Secure` recibida por HTTP plano.

### Copias de seguridad de un entorno

Declara `deployment.backups.destination` y un bloque `backups` en el entorno, exporta los secretos del tipo de destino y después:

```bash
catalyst provision --env prod       # temporizadores y configuración del destino
catalyst backup run --env prod      # la primera copia, ahora
catalyst backup list --env prod
```

`catalyst backup restore --env prod --copy <id>` reemplaza la base de datos y las subidas con esa copia, sin pedir confirmación.

## Verifica que funciona

- `catalyst provision --env prod` ejecutado por segunda vez no informa de cambios.
- `catalyst provision audit --env prod` termina con código cero.
- La ejecución del workflow en GitHub termina, y la URL del frontend carga y permite iniciar sesión con el primer usuario.

## Solución de problemas

- **El workflow no puede conectar.** El puerto SSH del servidor debe ser accesible desde los runners alojados por GitHub. Una VPN o una restricción de direcciones lo impide.
- **Una variable cambió en `provision` pero la aplicación no cambió.** Una aplicación ya desplegada aplica el cambio en su siguiente despliegue: sube un cambio a su carpeta, o redespliega desde el panel de Coolify.
- **El backend no arranca tras el primer despliegue.** Comprueba que los ajustes del mailer están presentes y que `OAUTH_STRATEGY` es `local-provider`. Con `none` o sin definir, se rechaza todo inicio de sesión.
- **`provision` falla por el registro.** El token debe ser clásico con `read:packages`. El token de un proyecto posterior reemplaza la sesión del servidor para todos sus proyectos.
- **Necesitas el panel de Coolify.** `provision` imprime un comando de túnel SSH; el puerto del panel permanece cerrado en el cortafuegos.

## Relacionado

- [Concepto: Despliegue en Coolify](../../../concepts/workflow/coolify-deployment/)
- [Referencia: claves de despliegue de aurora.yaml](../../../reference/aurora-yaml-deployment/)
- [Referencia de la CLI: provision](../../../reference/cli-commands/provision/), [env](../../../reference/cli-commands/env/), [deploy](../../../reference/cli-commands/deploy/), [backup](../../../reference/cli-commands/backup/)
