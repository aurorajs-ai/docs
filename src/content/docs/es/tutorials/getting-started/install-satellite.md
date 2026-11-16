---
title: Instalar un satélite Aurora
description: Genera una segunda app Catalyst y delega todo su login en el hub mediante el flujo Authorization Code de OAuth 2.1 con PKCE.
sidebar:
  order: 4
---

Un **satélite** es una app Catalyst que no conserva formulario de login propio. Los usuarios no autenticados se redirigen al hub, el hub emite los tokens, y el satélite los valida contra el JWKS del hub. Este paso crea uno y lo conecta al hub de los pasos anteriores.

Esta guía asume el hub en `http://localhost:8080`, y el frontend del satélite en `http://localhost:4201` con su backend en `http://localhost:8081`. Ajusta a tu despliegue. Para los roles y el flujo de tokens detrás de estos pasos, mira [Estrategias de autenticación](/aurora-catalyst-docs/es/concepts/backend/authentication-strategies/).

## 1. Genera el satélite

```bash
catalyst new aurora-app1
```

Después, en `backend/.env`, apunta la conexión `DATABASE_*` a su **propia** base de datos — no a la del hub. El satélite no guarda tablas de identidad, porque la identidad vive en el hub.

## 2. Añade el paquete Authorization Code

```bash
catalyst add authorization-code
```

Esto instala el paquete BFF que gestiona el ida y vuelta `/authorize` → `/callback` → token. Un satélite no necesita ningún paquete `iam` ni `o-auth` propio — la identidad vive en el hub.

:::note
Un satélite en modo `aurora-hub` valida los tokens contra el JWKS del hub y **nunca firma nada**. Aun así lee una clave privada al arrancar, así que deja en su sitio el par de claves que `catalyst new` escribió en `backend/.keys/`. No tienes que generar nada más.
:::

## 3. Registra el satélite en el hub

El hub registra un satélite desde su pantalla **Aplicaciones**, que pertenece al paquete `hub`. Si el proyecto del hub todavía no lo tiene, instálalo allí:

```bash
catalyst add hub
```

Define la clave obligatoria `APP_URL` en el `backend/.env` del hub con la URL base pública del backend del hub (aquí `http://localhost:8080`), ejecuta el comando `pnpm db:generate --name hub` que imprime la instalación y reinicia el hub. Después, en la administración del hub, crea una app:

1. **Código** → el código de aplicación del satélite, como `aurora-app1`. Solo se admiten minúsculas, dígitos y guiones.
2. **Nombre** y **URL** → un nombre descriptivo y la URL del frontend del satélite.
3. **Redirect URI** → el callback del satélite, **exactamente**: `http://localhost:4201/callback`. Debe ser una URL `http(s)` absoluta sin fragmento (`#`); el hub la compara carácter por carácter tanto en `/authorize` como en el intercambio del token.
4. Deja **Activa** marcada y guarda.

Al guardar, todo ocurre en una sola transacción: se crea la aplicación OAuth y su cliente Authorization Code, un bounded context para la app y un permiso de acceso que se asigna al rol Administrador. Un admin que ya tenga sesión iniciada verá la nueva app tras su próxima emisión de token (inicia sesión otra vez o renueva el token).

:::caution[Copia las credenciales ahora]
La respuesta de la creación incluye un paquete de credenciales de un solo uso: la URL base del hub, el `code` de la aplicación, el `secret` y la redirect URI. El secreto se muestra **una sola vez** y no se puede volver a leer. El satélite se autentica con el `code` y el `secret` de la aplicación, no con el UUID de un cliente.
:::

## 4. Configura el `.env` del backend del satélite

En el `backend/.env` del satélite, pega los valores del paquete de credenciales:

```dotenv
OAUTH_STRATEGY = aurora-hub
OAUTH_HUB_SERVER_URL = http://localhost:8080
OAUTH_APPLICATION_CODE = aurora-app1
OAUTH_APPLICATION_SECRET = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OAUTH_REDIRECT_URI = http://localhost:4201/callback
```

| Variable | Qué es |
| --- | --- |
| `OAUTH_STRATEGY` | `aurora-hub` selecciona el modo satélite. El valor por defecto cuando no está definida es `none`, así que tienes que definirla. |
| `OAUTH_HUB_SERVER_URL` | URL base del backend del **hub**. |
| `OAUTH_APPLICATION_CODE` | El `code` de la aplicación del paquete. Se envía como `client_id`. El satélite además exige que todo token lo lleve como audiencia. |
| `OAUTH_APPLICATION_SECRET` | El `secret` de la aplicación del paquete. Solo se usa en la cabecera HTTP Basic del backend — nunca se envía al frontend. |
| `OAUTH_REDIRECT_URI` | El callback del satélite. Debe ser igual a la **Redirect URI** de la app del hub, exactamente. |

Si el satélite corre en el **mismo host** que el hub, dale puertos distintos para que no choquen:

```dotenv
APP_URL = http://localhost:8081
APP_FRONTEND_URL = http://localhost:4201
APP_PORT = 8081
```

## 5. Apunta el frontend del satélite al modo hub

En el archivo de entorno activo (`frontend/src/environments/environment.ts`):

```ts
authStrategy: 'authorization-code',
api: {
  graphql: 'http://localhost:8081/graphql',
  rest: 'http://localhost:8081/api',
},
```

- `authStrategy` pasa del valor por defecto del scaffold `'local'` a `'authorization-code'`. Este único campo es la fuente de verdad: selecciona el guard de código, elimina el formulario de login local y lleva el cierre de sesión a una página terminal.
- Los endpoints `api` apuntan al backend **propio** del satélite (el BFF) en `:8081` — **no** al hub. El ida y vuelta de `/callback` hace sus POST aquí.

La ruta `/callback` viene ya cableada y sin guard; no le añadas un guard de autenticación.

Después fija el puerto de desarrollo del frontend del satélite en `frontend/package.json` para que no choque con el `:4200` del hub:

```json
"start:local": "ng serve --configuration local --port 4201"
```

## 6. Reinicia y ejecuta

Reinicia el backend del satélite (la estrategia se lee una sola vez al arrancar) y arranca las dos apps.

## 7. Verifica que funcionó

Abre una ruta protegida en el satélite y observa el ida y vuelta:

1. El navegador se redirige al backend del satélite `…/api/auth/login`, que responde 302 al hub `…/api/o-auth/authorize` con `code_challenge` y `code_challenge_method=S256`.
2. Inicias sesión en el **hub**, que redirige a `http://localhost:4201/callback?code=…&state=…`.
3. El callback hace POST al satélite `…/api/auth/token`, se guardan los tokens y llegas autenticado.

Lista de comprobación en verde: ningún `invalid_request` (PKCE viajó), ningún `401` (el secreto de la aplicación coincidió), ningún bucle de redirección, y el cierre de sesión llega a la página terminal sin rebotar de vuelta al hub.

## Solución de problemas

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `400 invalid_request` | Falta PKCE, o `client_id` no es el código de la aplicación | Ejecuta `catalyst upgrade` para llevar el BFF a la versión actual del CLI; define `OAUTH_APPLICATION_CODE` con el `code` de la aplicación. |
| `400 redirect_uri mismatch` | La **Redirect URI** de la app del hub ≠ `OAUTH_REDIRECT_URI` | Haz que sean idénticas — absolutas, sin fragmento. |
| `401 invalid_client` | `OAUTH_APPLICATION_SECRET` incorrecto, o nunca copiado del paquete | Usa el secreto del paquete de credenciales. El hub no puede mostrarlo otra vez. |
| `401 invalid_token` en la API del satélite | La audiencia del token no es el `OAUTH_APPLICATION_CODE` de este satélite | Haz que `OAUTH_APPLICATION_CODE` sea igual al código de la aplicación que el satélite registró en el hub. |
| `429 ThrottlerException` | Un bucle de redirección machacando al hub | Corrige el 4xx de fondo y reinicia el hub (el contador del throttle está en memoria). |
| Página en blanco / `NG04002` | Ruta de sign-in del hub mal configurada | Revisa el `OAUTH_SIGN_IN_PATH` del hub (por defecto `/auth/sign-in`). |

## Relacionado

- [Estrategias de autenticación](/aurora-catalyst-docs/es/concepts/backend/authentication-strategies/) — los tres modos y el flujo de tokens.
- [`catalyst add`](../../../reference/cli-commands/add/) — añade el paquete Authorization Code.
