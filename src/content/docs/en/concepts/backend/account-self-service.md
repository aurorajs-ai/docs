---
title: Account self-service
description: How an account manages its own profile, password and two-factor authentication through operations bound to the caller's token, and how password reset and TOTP sign-in work.
---

## Why this exists

A user needs to change their own name, photo, email and password, and to turn on a second factor, without holding any administrative permission. The generic update operations cannot serve that: they take an account id from the payload and accept roles, tenants and the active flag, so exposing them to the owner would let anyone promote themselves.

Self-service solves it by shape. Dedicated operations act on the account of the token, never on an id the client names, and their inputs are narrow: there is no field through which an escalation could travel.

## How it works

### Operations bound to the token

The profile, password and two-factor operations are GraphQL operations guarded by `@Auth()` with no permission: any authenticated account may call them, and each takes its target from `@CurrentAccount()`.

| Operation | What it does |
| --- | --- |
| `iamMeAccount` | Reads the caller's own account. |
| `iamUpdateMeAccount` | Updates email, username and the user profile (name, surname, mobile, language, avatar). |
| `iamChangePasswordMeAccount` | Changes the caller's password. |
| `iamMeAvatarAccount` | Reads the caller's avatar. |
| `iamMeTwoFactorAccount`, `iamEnrollTwoFactorMeAccount`, `iamActivateTwoFactorMeAccount`, `iamDisableTwoFactorMeAccount`, `iamRegenerateTwoFactorRecoveryCodesMeAccount` | The two-factor lifecycle. |

Anything outside the narrow input is ignored, never forwarded. Derived columns such as `dPermissions` and `dTenants` cannot be reached, and the "managed by" reservation that protects externally managed accounts does not apply, because the owner acting on their own data is not the administration API.

### Profile and avatar

Changing the email asks for `currentPassword`, which is verified on the server and never stored or returned. That check counts as a login attempt: a failure counts toward the lockout, and a locked account is refused like a wrong password. Clearing the email counts as a change, because it cuts off recovery by reset link. A username change does not ask for the password.

The avatar travels as a `data:` URI. Only PNG, JPEG and WebP are accepted, the base64 must be strict, the decoded image may be at most 64 KB, and the bytes must match the declared type. SVG is refused on purpose because it can carry script. Listing fragments leave the avatar out, so a list never ships image bytes. A client reads it with `iamMeAvatarAccount`.

### Changing the password

`iamChangePasswordMeAccount` verifies the current password, validates and hashes the new one, and then ends every session of the account, the caller's own included. The caller signs in again with the new password.

### Password reset

A user who cannot sign in uses two public REST endpoints, `POST /api/iam/user/forgot-password` with `{ email }` and `POST /api/iam/user/reset-password` with `{ token, password }`.

The first endpoint is built not to reveal which emails exist. It answers the same way, and does the same synchronous work, for an existing account, an inactive one and an unknown email, and it does not wait for the email to send. The token is 32 random bytes. Only its SHA-256 digest is stored, in `rememberToken` with an expiry, so a database reader cannot use it. The emailed link is the configured sign-in frontend URL plus `/auth/reset-password/<token>`, and the origin never comes from the request.

A new request replaces the previous token, so a user has one live link. The link works once. Resetting validates the new password before it consumes the token, so a password that is too short leaves the link usable. A successful reset clears the failed-login counter and the lock, and ends every session of the account.

### Two-factor sign-in

Two-factor authentication uses TOTP (RFC 6238): HMAC-SHA1, 6 digits, 30-second steps, with one step of clock skew accepted on each side. It is off unless the deployment enables it.

**Enrolling.** `iamEnrollTwoFactorMeAccount` returns an `otpauth://` URI and a secret, and the factor is still pending. `iamActivateTwoFactorMeAccount` takes a code from the authenticator app, turns it on and returns ten one-shot recovery codes. That is the only time they are shown. The secret is stored encrypted with the OAuth public key and decrypted with the private key to verify.

**Signing in.** For a user with two-factor on, `POST /api/o-auth/sign-in` verifies the password and answers `200` with the next step and a single-use challenge, and sets no cookie. The client then calls `POST /api/o-auth/sign-in/two-factor` with the challenge and either a `code` or a `recoveryCode`. Only then does the backend set the `hub_session` cookie and answer `204`. A code is never accepted twice, a recovery code is consumed, and wrong codes count toward their own lockout, separate from the password lock. The challenge lives ten minutes.

**Managing it.** The owner can disable the factor with a code or a recovery code, and regenerate the recovery codes with a code. An administrator with the `iam.account.resetTwoFactor` permission can reset another account's factor with `iamResetTwoFactorAccount`, and that does not revoke the user's sessions.

## When it applies

- You build or review a profile screen and need to know what the owner may change.
- A user reports "I never got the reset email" or "my reset link stopped working".
- You enable two-factor for a deployment, or a user lost their authenticator.

## Trade-offs and limits

- **Replacing the key pair breaks enrolled factors.** Stored secrets become undecryptable, and those users cannot pass the second step until an administrator resets their factor and they enrol again.
- **One live reset link per user.** Requesting a second link invalidates the first.
- **The reset is public and rate limited.** Both endpoints share a per-IP throttle, and sign-in checks the request `Origin`.
- **Email is part of recovery.** A deployment without a working mailer cannot deliver reset links.
- **Generic user operations no longer carry two-factor fields.** Only the dedicated operations write them.

## Related

- [Configure account security](../../../guides/backend/configure-account-security/) — the environment variables and the forced-enrollment policy.
- [Authentication strategies](../authentication-strategies/) — sessions, tokens and revocation that password changes trigger.
- [Account impersonation](../account-impersonation/) — an operator acting as an account, the opposite of self-service.
