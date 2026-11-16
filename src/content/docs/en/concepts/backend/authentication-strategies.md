---
title: Authentication strategies
description: The three OAUTH_STRATEGY modes — none, local-provider, aurora-hub — the BFF pattern, and how tokens flow between a hub and its satellites.
---

## Why this exists

Every Catalyst backend resolves one question at startup: **who is the identity authority?** The answer is the `OAUTH_STRATEGY` environment variable. It is read once at boot (`resolveAuthenticationMode`) and fixed for the lifetime of the process — there is no per-request switching. It has three values, and each one casts the backend in a different role.

A missing or empty value defaults to `none`, and an unrecognized value crashes the app at boot with a message listing the valid options. The default changed to `none` precisely so a fresh install boots without any identity infrastructure — but a prominent warning is logged until you choose a real provider.

## How it works

| `OAUTH_STRATEGY` | Role | What the backend does |
| --- | --- | --- |
| `none` | no authority | Every request arrives as an anonymous account with no permissions. Endpoints that declare no permission are public. A transient bootstrap state — not for production. |
| `local-provider` | **the** authority (a hub) | Issues its own tokens at `POST /api/o-auth/token` (Authorization Code, Refresh Token and Client Credentials grants) and publishes its public key at `GET /.well-known/jwks.json` so others can verify them. |
| `aurora-hub` | a consumer (a satellite) | Issues nothing. Validates incoming Bearer tokens against an external hub's JWKS and hydrates the account from the hub. Login is delegated entirely to the hub. |

A deployment with a central identity and several delegating apps is just one hub plus one or more satellites:

```
        ┌─────────────────────────────┐
        │  HUB   OAUTH_STRATEGY =      │   issues tokens, serves JWKS,
        │        local-provider        │   owns the login UI
        └──────────────┬──────────────┘
                       │ JWKS + iamMeAccount
        ┌──────────────┴──────────────┐
        │              │              │
   ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
   │satellite│    │satellite│    │satellite│   OAUTH_STRATEGY = aurora-hub
   └─────────┘    └─────────┘    └─────────┘   (delegate login to the hub)
```

### Grants and client types

The token endpoint (`POST /api/o-auth/token`, form-encoded only) supports three grants. The Password grant no longer exists: a request for it is answered with `unsupported_grant_type`.

| Grant | Who uses it | Notes |
| --- | --- | --- |
| Authorization Code (with PKCE) | A browser app, directly or through a BFF | Single-use code, S256 challenge mandatory. |
| Refresh Token | The same apps | Rotation on every use. |
| Client Credentials | A machine caller | Confidential clients only. HTTP Basic client authentication. The token acts as the one active `SERVICE` account linked to the application's `CLIENT_CREDENTIALS` client, and no refresh token is issued. |

An application declares how it authenticates at the token endpoint with `tokenEndpointAuthMethod`:

- **`NONE`** is a **public client**, such as a single-page app. It is identified by its `client_id` (the application code) in the form body and proves possession with the PKCE verifier. It holds no secret.
- **`CLIENT_SECRET_BASIC`** is a **confidential client**, such as a satellite BFF. It presents its secret with HTTP Basic, and the hub stores only a bcrypt hash of it.

A fresh scaffold seeds the `aurora` application as a public client with one `AUTHORIZATION_CODE` client whose redirect is `<OAUTH_SIGN_IN_FRONTEND_URL>/auth/callback`. When a registered redirect is an `http` loopback address (`localhost`, `127.0.0.1`), the port is ignored, so a dev server on another port still matches; the scheme, host and path must still be equal.

The flow of the hub's own single-page app, without a BFF:

```
SPA ──GET /api/o-auth/authorize?code_challenge,client_id=aurora,state──▶ HUB
HUB (no session) ──302──▶ sign-in page ──POST /api/o-auth/sign-in──▶ HUB (sets hub_session cookie, no token)
HUB ──302 redirect_uri=…/auth/callback?code=&state=──▶ SPA
SPA ──POST /api/o-auth/token (form: client_id, code, redirect_uri, code_verifier)──▶ HUB ──{ access_token, refresh_token }──▶ SPA
```

The sign-in step may take two requests: a user with two-factor authentication enabled gets a challenge first and only receives the `hub_session` cookie after the code. See [Account self-service](../account-self-service/).

Impersonation tokens do not come from the token endpoint. They are issued by a GraphQL mutation instead: see [Account impersonation](../account-impersonation/).

### The Authorization Code flow through a satellite

When a satellite delegates login it uses the OAuth 2.1 **Authorization Code flow with PKCE**. The satellite backend acts as a **Backend-for-Frontend (BFF)**: it is the confidential OAuth client, so the client secret lives only on the satellite backend and never reaches the browser.

```
SPA ─/auth/login─▶ satellite BFF ──302 /authorize?code_challenge,client_id=<app code>,state─▶ HUB
                   (stashes code_verifier by state)                                        │
HUB (no session) ─302─▶ HUB /sign-in?continue=…  → user logs in → hub_session cookie set   │
HUB ──302 redirect_uri=…/callback?code=&state=─────────────────────────────────────────────┘
SPA /callback ─POST {code,state}─▶ BFF ──POST /token (form, Basic, code, redirect_uri, verifier)─▶ HUB
HUB ──{ access_token, refresh_token }──▶ BFF ──▶ SPA token store
```

Two decisions keep this safe:

- **PKCE S256 is mandatory.** The BFF generates a `code_verifier`, sends only its SHA-256 `code_challenge` to the hub, and keeps the verifier server-side keyed by `state`. The verifier never touches the browser; the hub rejects a missing or `plain` challenge.
- **The hub session is a cookie, not a token in a URL.** After login the hub sets an `httpOnly` RS256 JWT cookie (`hub_session`) so the user is not re-prompted on the next `/authorize`. The credentials are POSTed to establish it — never placed in a query string. Each cookie names a revocable `o_auth_session` row (see below), and a sign-in is accepted only from an allowed `Origin`.

### How a satellite reads identity

In `aurora-hub` mode the satellite issues nothing. On each request it validates the Bearer against the hub's `/.well-known/jwks.json` (RS256) and hydrates the account by calling the hub's `iamMeAccount` GraphQL query with the user's token. It checks the header `typ`, the issuer, and that the audience equals its own `OAUTH_APPLICATION_CODE`, so a token minted for another application is refused. Authorization is then resolved from `dPermissions` — the OAuth `scope` is a cosmetic passthrough and grants nothing in this first-party model.

### Tokens, revocation and sessions

The access token is a JWT with exactly these claims: `sub` (the account), `jti` (the id of its `o_auth_access_token` row), `client_id` and `aud` (the application code), `iss`, `iat` and `exp`. Its header is `typ: at+jwt` with a `kid` (RFC 9068). It carries no permissions, roles or tenants: those come from the account, not from the token. An impersonation token adds an `act` claim.

On a hub, the guard loads the token's row on **every** request and rejects it when the row is missing, revoked or expired, or when the account is missing or inactive. A token is therefore revocable at once, and a `hub_session` cookie, which shares the signing key but has `typ: hub-session+jwt`, is rejected as a Bearer.

- **Refresh tokens** are random strings, stored only as a SHA-256 hash. Each use rotates the token atomically. Presenting a token that was already rotated or revoked is read as a leak: the whole family of refresh tokens and the access tokens paired with them are revoked.
- **Deactivating an account or changing its password** revokes every access token, refresh token and hub session of that account in the same request.
- **The hub session** is a server-side row. Revoking the row ends the session, and the next `/authorize` treats the cookie as unauthenticated.
- **Login is rate-limited per user**: after `OAUTH_LOGIN_MAX_ATTEMPTS` failures the account locks for `OAUTH_LOGIN_LOCK_SECONDS`.

A satellite cannot read the hub's rows, so it caches the account by `jti` for five minutes. That cache is the real revocation lag, and it exists only on satellites.

## When it applies

- You see the boot warning that `OAUTH_STRATEGY=none` and need to pick a real provider.
- You are wiring a new app to delegate login to an existing hub — see [Connect a satellite to an Aurora Hub](/aurora-catalyst-docs/en/tutorials/getting-started/install-satellite/).
- You are debugging a `401 invalid_client` or `400 invalid_request` during the Authorization Code round-trip.

## Trade-offs and limits

- **`none` is bootstrap-only.** It exists so a clean install boots; ship it to production and every endpoint without a declared permission is open.
- **Only `local-provider` needs a key pair.** The JWT signer loads the private key only in `local-provider` mode. A satellite in `aurora-hub` mode validates via the hub's JWKS, never signs anything and starts without any key file; the hub (`local-provider`) will not start without its key, see [`catalyst keys`](/aurora-catalyst-docs/en/reference/cli-commands/keys/).
- **One redirect URI per client.** `OAuthClient.redirect` is a single string and is matched exactly; a client serves one satellite callback.
- **The PKCE verifier store is in-memory.** It is correct for a single-instance satellite; behind multiple replicas a verifier stashed on one instance is invisible to another, so a shared store is needed before scaling out.
- **Revocation lags on satellites, not on the hub.** The hub checks the token row on every request. A satellite caches the validated account per token for five minutes, so a revocation or a permission change reaches it after that window.

## Related

- [Account impersonation](../account-impersonation/) — act as another account without sharing a password.
- [Account self-service](../account-self-service/) — password reset, change of password and two-factor sign-in.
- [Connect a satellite to an Aurora Hub](/aurora-catalyst-docs/en/tutorials/getting-started/install-satellite/) — the practical recipe.
- [`catalyst keys`](/aurora-catalyst-docs/en/reference/cli-commands/keys/) — generate the RSA key pair.
