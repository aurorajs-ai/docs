---
title: Estrategias de autenticación
description: Los tres modos de OAUTH_STRATEGY — none, local-provider, aurora-hub — el patrón BFF y cómo fluyen los tokens entre un hub y sus satélites.
---

## Por qué existe

Todo backend de Catalyst resuelve una pregunta al arrancar: **¿quién es la autoridad de identidad?** La respuesta es la variable de entorno `OAUTH_STRATEGY`. Se lee una sola vez en el arranque (`resolveAuthenticationMode`) y queda fija durante toda la vida del proceso — no hay cambio por petición. Tiene tres valores, y cada uno le da al backend un rol distinto.

Un valor ausente o vacío usa `none` por defecto, y un valor no reconocido revienta la app al arrancar con un mensaje que lista las opciones válidas. El default cambió a `none` precisamente para que una instalación nueva arranque sin infraestructura de identidad — pero se registra un aviso prominente hasta que elijas un proveedor real.

## Cómo funciona

| `OAUTH_STRATEGY` | Rol | Qué hace el backend |
| --- | --- | --- |
| `none` | sin autoridad | Cada petición llega como una cuenta anónima sin permisos. Los endpoints que no declaran permiso son públicos. Es un estado de arranque transitorio — no para producción. |
| `local-provider` | **la** autoridad (un hub) | Emite sus propios tokens en `POST /api/o-auth/token` (grants Authorization Code, Refresh Token y Client Credentials) y publica su clave pública en `GET /.well-known/jwks.json` para que otros los verifiquen. |
| `aurora-hub` | un consumidor (un satélite) | No emite nada. Valida los Bearer entrantes contra el JWKS de un hub externo e hidrata la cuenta desde el hub. El login se delega por completo en el hub. |

Un despliegue con una identidad central y varias apps que delegan es simplemente un hub más uno o varios satélites:

```
        ┌─────────────────────────────┐
        │  HUB   OAUTH_STRATEGY =      │   emite tokens, sirve JWKS,
        │        local-provider        │   es dueño del login
        └──────────────┬──────────────┘
                       │ JWKS + iamMeAccount
        ┌──────────────┴──────────────┐
        │              │              │
   ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
   │satélite │    │satélite │    │satélite │   OAUTH_STRATEGY = aurora-hub
   └─────────┘    └─────────┘    └─────────┘   (delegan el login en el hub)
```

### Grants y tipos de cliente

El endpoint de tokens (`POST /api/o-auth/token`, solo con cuerpo `application/x-www-form-urlencoded`) admite tres grants. El grant Password ya no existe: una petición con él recibe `unsupported_grant_type`.

| Grant | Quién lo usa | Notas |
| --- | --- | --- |
| Authorization Code (con PKCE) | Una app de navegador, directamente o a través de un BFF | Código de un solo uso, challenge S256 obligatorio. |
| Refresh Token | Las mismas apps | Rotación en cada uso. |
| Client Credentials | Un llamador máquina a máquina | Solo clientes confidenciales. Autenticación del cliente con HTTP Basic. El token actúa como la única cuenta `SERVICE` activa enlazada al cliente `CLIENT_CREDENTIALS` de la aplicación, y no se emite refresh token. |

Una aplicación declara cómo se autentica en el endpoint de tokens con `tokenEndpointAuthMethod`:

- **`NONE`** es un **cliente público**, como una single-page app. Se identifica por su `client_id` (el código de la aplicación) en el cuerpo del formulario y demuestra la posesión con el verifier de PKCE. No guarda ningún secreto.
- **`CLIENT_SECRET_BASIC`** es un **cliente confidencial**, como el BFF de un satélite. Presenta su secreto con HTTP Basic, y el hub solo guarda un hash bcrypt de él.

Un scaffold nuevo siembra la aplicación `aurora` como cliente público, con un cliente `AUTHORIZATION_CODE` cuyo redirect es `<OAUTH_SIGN_IN_FRONTEND_URL>/auth/callback`. Cuando un redirect registrado es una dirección loopback `http` (`localhost`, `127.0.0.1`), el puerto se ignora, así que un servidor de desarrollo en otro puerto sigue coincidiendo; el esquema, el host y la ruta deben seguir siendo iguales.

El flujo de la single-page app del propio hub, sin BFF:

```
SPA ──GET /api/o-auth/authorize?code_challenge,client_id=aurora,state──▶ HUB
HUB (sin sesión) ──302──▶ página de sign-in ──POST /api/o-auth/sign-in──▶ HUB (fija la cookie hub_session, sin token)
HUB ──302 redirect_uri=…/auth/callback?code=&state=──▶ SPA
SPA ──POST /api/o-auth/token (form: client_id, code, redirect_uri, code_verifier)──▶ HUB ──{ access_token, refresh_token }──▶ SPA
```

El paso de sign-in puede requerir dos peticiones: un usuario con autenticación en dos pasos activada recibe primero un desafío y solo obtiene la cookie `hub_session` tras introducir el código. Consulta [Autoservicio de la cuenta](../account-self-service/).

Los tokens de suplantación no salen del endpoint de tokens. Los emite una mutación GraphQL: consulta [Suplantación de cuentas](../account-impersonation/).

### El flujo Authorization Code a través de un satélite

Cuando un satélite delega el login usa el flujo **Authorization Code con PKCE** de OAuth 2.1. El backend del satélite actúa como **Backend-for-Frontend (BFF)**: es el cliente OAuth confidencial, así que el client secret vive solo en el backend del satélite y nunca llega al navegador.

```
SPA ─/auth/login─▶ BFF satélite ──302 /authorize?code_challenge,client_id=aurora,state─▶ HUB
                   (guarda el code_verifier por state)                                    │
HUB (sin sesión) ─302─▶ HUB /sign-in?continue=…  → el usuario entra → cookie hub_session  │
HUB ──302 redirect_uri=…/callback?code=&state=────────────────────────────────────────────┘
SPA /callback ─POST {code,state}─▶ BFF ──POST /token (form, Basic, code, redirect_uri, verifier)─▶ HUB
HUB ──{ access_token, refresh_token }──▶ BFF ──▶ token store del SPA
```

Dos decisiones lo mantienen seguro:

- **PKCE S256 es obligatorio.** El BFF genera un `code_verifier`, envía al hub solo su `code_challenge` SHA-256 y guarda el verifier en el servidor indexado por `state`. El verifier nunca toca el navegador; el hub rechaza un challenge ausente o `plain`.
- **La sesión del hub es una cookie, no un token en una URL.** Tras el login el hub fija una cookie JWT RS256 `httpOnly` (`hub_session`) para que el usuario no tenga que volver a identificarse en el siguiente `/authorize`. Las credenciales se envían por POST para establecerla — nunca en un query string. Cada cookie nombra una fila `o_auth_session` revocable (ver más abajo), y el sign-in solo se acepta desde un `Origin` permitido.

### Cómo lee la identidad un satélite

En modo `aurora-hub` el satélite no emite nada. En cada petición valida el Bearer contra el `/.well-known/jwks.json` del hub (RS256) e hidrata la cuenta llamando a la query GraphQL `iamMeAccount` del hub con el token del usuario. Comprueba el `typ` de la cabecera, el emisor y que la audiencia sea igual a su propio `OAUTH_APPLICATION_CODE`, de modo que un token emitido para otra aplicación se rechaza. La autorización se resuelve entonces desde `dPermissions` — el `scope` de OAuth es un passthrough cosmético y no concede nada en este modelo de primera parte.

### Tokens, revocación y sesiones

El access token es un JWT con exactamente estos claims: `sub` (la cuenta), `jti` (el id de su fila `o_auth_access_token`), `client_id` y `aud` (el código de la aplicación), `iss`, `iat` y `exp`. Su cabecera es `typ: at+jwt` con un `kid` (RFC 9068). No lleva permisos, roles ni tenants: esos datos salen de la cuenta, no del token. Un token de suplantación añade un claim `act`.

En un hub, el guard carga la fila del token en **cada** petición y lo rechaza si la fila falta, está revocada o ha expirado, o si la cuenta falta o está inactiva. Por eso un token se puede revocar al instante, y una cookie `hub_session`, que comparte la clave de firma pero tiene `typ: hub-session+jwt`, se rechaza como Bearer.

- **Los refresh tokens** son cadenas aleatorias y solo se guardan como hash SHA-256. Cada uso rota el token de forma atómica. Presentar un token que ya se rotó o se revocó se interpreta como una fuga: se revoca toda la familia de refresh tokens y los access tokens emparejados con ellos.
- **Desactivar una cuenta o cambiar su contraseña** revoca todos los access tokens, refresh tokens y sesiones del hub de esa cuenta en la misma petición.
- **La sesión del hub** es una fila en el servidor. Al revocar la fila termina la sesión, y el siguiente `/authorize` trata la cookie como no autenticada.
- **El login se bloquea por usuario**: tras `OAUTH_LOGIN_MAX_ATTEMPTS` fallos, la cuenta queda bloqueada durante `OAUTH_LOGIN_LOCK_SECONDS`.

Un satélite no puede leer las filas del hub, así que guarda la cuenta en caché por `jti` durante cinco minutos. Esa caché es el retardo real de revocación, y solo existe en los satélites.

## Cuándo aplica

- Ves el aviso de arranque de que `OAUTH_STRATEGY=none` y necesitas elegir un proveedor real.
- Estás conectando una app nueva para que delegue el login en un hub existente — mira [Conectar un satélite a un Aurora Hub](/aurora-catalyst-docs/es/tutorials/getting-started/install-satellite/).
- Estás depurando un `401 invalid_client` o un `400 invalid_request` durante el ida y vuelta del Authorization Code.

## Concesiones y límites

- **`none` es solo para arranque.** Existe para que una instalación limpia arranque; si lo llevas a producción, todo endpoint sin permiso declarado queda abierto.
- **`aurora-hub` sigue leyendo una clave privada al arrancar.** Aunque un satélite valida vía el JWKS del hub y nunca firma nada, el firmador de JWT se construye al arrancar y lee `OAUTH_PRIVATE_KEY_PATH` en cualquier modo distinto de `none`. Por eso un satélite necesita `.keys/oauth-private.key` presente o revienta al arrancar — genérala con [`catalyst keys`](/aurora-catalyst-docs/es/reference/cli-commands/keys/) incluso en modo hub.
- **Un redirect URI por cliente.** `OAuthClient.redirect` es una sola cadena y se compara de forma exacta; un cliente sirve un único callback de satélite.
- **El almacén del verifier PKCE es en memoria.** Es correcto para un satélite de instancia única; detrás de varias réplicas, un verifier guardado en una instancia es invisible para otra, así que hace falta un almacén compartido antes de escalar horizontalmente.
- **La revocación se retrasa en los satélites, no en el hub.** El hub comprueba la fila del token en cada petición. Un satélite guarda en caché la cuenta validada por token durante cinco minutos, así que una revocación o un cambio de permisos le llega pasada esa ventana.

## Relacionado

- [Suplantación de cuentas](../account-impersonation/) — actuar como otra cuenta sin compartir contraseña.
- [Autoservicio de la cuenta](../account-self-service/) — restablecer y cambiar la contraseña, e inicio de sesión en dos pasos.
- [Conectar un satélite a un Aurora Hub](/aurora-catalyst-docs/es/tutorials/getting-started/install-satellite/) — la receta práctica.
- [`catalyst keys`](/aurora-catalyst-docs/es/reference/cli-commands/keys/) — genera el par de claves RSA.
