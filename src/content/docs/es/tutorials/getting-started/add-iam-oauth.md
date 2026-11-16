---
title: Añadir IAM + OAuth al hub
description: Instala el paquete Identity, genera la primera migración, arranca el hub y entra como el admin sembrado.
sidebar:
  order: 3
---

Ahora convierte el proyecto vacío del paso anterior en un **Aurora Hub**: una instancia Catalyst que es dueña de la identidad y firma sus propios tokens OAuth.

## 1. Añade el paquete Identity

```bash
catalyst add identity
```

Esto instala los bounded contexts `iam` y `o-auth` en el backend y las pantallas de login e IAM correspondientes en el frontend, junto con el paquete `tools` que Identity necesita. Un paquete instala todas las mitades que declara, así que no hay un paso separado para backend y frontend. El comando imprime el plan antes de cambiar nada. Mira [`catalyst add`](../../../reference/cli-commands/add/).

Al terminar, imprime lo que queda por hacer. Guarda esa lista para los pasos siguientes: el comando `pnpm db:generate` que debes ejecutar y las claves obligatorias que `backend/.env` todavía no tiene.

## 2. Establece las claves que listó el comando

El paquete Identity declara los ajustes `MAILER_*` como claves obligatorias. `catalyst add` no las escribe: si faltan o están vacías en `backend/.env`, las lista bajo *Set these required keys in backend/.env*. Dales un valor. Para desarrollo local basta un sumidero de correo como Mailpit: acepta todos los mensajes y no entrega ninguno.

```dotenv
MAILER_ENABLED = true
MAILER_HOST = localhost
MAILER_PORT = 1025
MAILER_SECURE = false
MAILER_IGNORE_TLS = true
```

Usa `MAILER_SECURE = true` para el puerto 465. Cualquier otra clave `MAILER_*` que liste el comando (usuario, contraseña, remitente) puede quedarse como está para un sumidero.

## 3. Comprueba la estrategia de hub

Identity declara `OAUTH_STRATEGY = local-provider`, y `catalyst add` la escribe en `backend/.env` cuando la clave no existe. Abre el archivo y confirma el valor, porque este ajuste es lo que convierte a la app en un hub:

```dotenv
OAUTH_STRATEGY = local-provider
```

Si el archivo ya tenía otro valor, cámbialo tú: el comando nunca sobrescribe una clave existente. Cuando la clave no está definida el valor por defecto es `none`, y `none` rechaza todo inicio de sesión.

No necesitas `catalyst keys`: `catalyst new` ya escribió `oauth-private.key` y `oauth-public.key` en `backend/.keys/`. Un hub firma sus propios tokens, así que **lee la clave privada al arrancar y no levanta sin ella**.

## 4. Genera la primera migración

El scaffold todavía no tiene tablas. Genera la migración que crea las de Identity, desde la raíz del proyecto:

```bash
pnpm db:generate --name init
```

`--name` es obligatorio. Este paso es offline: no abre ninguna conexión a la base de datos. Revisa el `.sql` generado en `backend/src/database/migrations/drizzle/` y haz commit con el resto.

## 5. Arranca el hub

```bash
pnpm dev
```

En el primer arranque el backend aplica la migración, y después el seeder de bootstrap puebla las tablas: la cuenta admin por defecto, los roles y la aplicación OAuth `aurora` con su cliente Authorization Code. La aplicación `aurora` es un **cliente público**: el frontend se identifica con el código `aurora` y demuestra la posesión con PKCE, así que no guarda ningún secreto.

## 6. Conecta el frontend con el hub

Antes de entrar, alinea las dos puntas de la conexión: el código de aplicación OAuth del frontend y el origen permitido en el backend.

**Frontend — código de aplicación.** El frontend inicia sesión con el flujo Authorization Code con PKCE. Envía el **código de aplicación** OAuth y nada más: no hay secreto. El código tiene que coincidir con la aplicación que registró el seeder. Cada archivo de entorno bajo `frontend/src/environments/` lleva su propio bloque `oAuth`:

```ts
// frontend/src/environments/environment.ts (y .local.ts, .dev.ts, .qa.ts, .prod.ts)
authStrategy: 'local',
oAuth: {
  applicationCode: 'aurora',
},
```

El scaffold trae estos valores ya alineados con la aplicación sembrada, así que el login local funciona tal cual. Cuando registres una aplicación distinta, o sobrescribas `BOOTSTRAP_OAUTH_APP_CODE` en el backend, define `applicationCode` en **cada** `environment.*.ts` con el código registrado en la base de datos.

**Backend — origen permitido (CORS).** En `backend/.env`, pon `APP_CORS_ORIGIN` con la URL del frontend que va a iniciar sesión contra el hub:

```dotenv
APP_CORS_ORIGIN = http://localhost:4200
```

La petición de inicio de sesión lleva el `Origin` del frontend, y el hub rechaza cualquier `Origin` que no esté en esta lista. Cuando la variable no está definida, solo se permite el origen del propio backend, así que el frontend que corre en otro puerto no puede iniciar sesión. Fíjala al origen real del frontend desde el principio.

## 7. Entra

Abre el frontend en [http://localhost:4200](http://localhost:4200) e inicia sesión con el admin sembrado:

| Campo | Valor |
| --- | --- |
| Email | `admin@aurora.dev` |
| Contraseña | `admin1234` |

La contraseña sembrada es pública: cámbiala desde la aplicación, o define `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` antes del primer arranque.

## 8. Sabe qué orígenes permite el hub

Si vas a añadir apps satélite (el siguiente paso), la lista que fijaste en el paso 6 no cambia. Un satélite envía a sus usuarios al frontend del propio hub para iniciar sesión, así que el origen que ve el hub en la petición de inicio de sesión es el del frontend del hub. El backend del satélite habla con el servidor del hub de servidor a servidor, sin ningún `Origin` de navegador de por medio. Amplía la lista solo si otro frontend sirve la página de inicio de sesión del hub.

## Siguiente

El hub está en marcha y es dueño de la identidad. Ahora, [instala un satélite Aurora](/aurora-catalyst-docs/es/tutorials/getting-started/install-satellite/) que delegue su login aquí.
