---
title: Configure account security
description: Set up password reset and TOTP two-factor authentication for a deployment — environment variables, the forced-enrollment policy, lockouts and the administrator reset.
---

## Goal

Have working password-reset emails and, if you want them, two-factor sign-in with an optional forced-enrollment policy, with the limits and lockouts tuned for your deployment.

## Before you start

- The IAM and OAuth contexts are in the project (`catalyst add identity` installs them).
- You know the [concept](../../../concepts/backend/account-self-service/): what reset and two-factor do for the user.
- You can set environment variables for the backend, and you have a way to send email from it.

## Steps

1. **Make email work.** Password reset sends its link by email through the backend mailer, which is off unless `MAILER_ENABLED=true`. Configure the mailer transport for your environment before testing anything else. Without it, requesting a reset still answers normally, by design, and no email arrives.

2. **Point the link at your frontend.** The emailed link is `OAUTH_SIGN_IN_FRONTEND_URL` plus `/auth/reset-password/<token>`. Set it to the public URL of the frontend. The origin is never taken from the request, so a wrong value here means every link is wrong.

   ```ini
   OAUTH_SIGN_IN_FRONTEND_URL=https://app.example.com
   ```

3. **Tune the reset (optional).** Defaults are shown.

   ```ini
   IAM_PASSWORD_RESET_TOKEN_TTL_MINUTES=60   # lifetime of the link
   THROTTLE_IAM_PASSWORD_RESET_LIMIT=5       # requests per IP, both endpoints
   THROTTLE_IAM_PASSWORD_RESET_TTL_MS=60000  # window of that limit
   ```

4. **Tune the password lockout (optional).** After this many consecutive failed password checks the account is locked, and it answers like a wrong password even with the right one. A successful sign-in resets the counter, and so does a password reset.

   ```ini
   OAUTH_LOGIN_MAX_ATTEMPTS=5
   OAUTH_LOGIN_LOCK_SECONDS=900
   ```

5. **Enable two-factor (optional).** Only the exact string `true` turns the capability on. While it is off, every sign-in is password-only and the profile and sign-in screens hide the feature. Users keep an enrolled secret, so turning it back on restores their factor.

   ```ini
   IAM_TWO_FACTOR_ENABLED=true
   IAM_TWO_FACTOR_ISSUER=Aurora        # label the authenticator app shows
   IAM_TWO_FACTOR_MAX_ATTEMPTS=5       # wrong codes before the second factor locks
   IAM_TWO_FACTOR_LOCK_SECONDS=900
   ```

   Wrong codes count toward their own lockout and never touch the password lock.

6. **Force enrollment (optional).** The policy is not an environment variable. It is the key-value `iam.twoFactor.required`, a boolean seeded as `false`. Set it to `true` in the key-value screens of `tools`; no redeploy is needed. It takes effect only while `IAM_TWO_FACTOR_ENABLED` is `true`. Every user account without a factor must then enrol during their next sign-in, before it gets a session. Live sessions are not revoked.

7. **Let administrators reset a factor.** Assign the permission `iam.account.resetTwoFactor` to the role that handles lost authenticators. The account screen then offers a reset action for another account's factor. It does not revoke that user's sessions, and the user enrols again at the next sign-in.

## Verify it worked

- Request a reset for a real address. The same response comes back for an unknown address. For the real one, an email arrives with a link to your frontend that opens the reset form, and the link works once.
- After resetting, sign in with the new password, and confirm that an older session of that account no longer works.
- With two-factor enabled, enrol an account in its profile, sign out and sign in: the password step answers with a challenge instead of a session, and the second step with a code sets the session.
- With the forced policy on, sign in with an account that has no factor: it must enrol before it gets a session.

## Troubleshooting

**The reset request returns success but no email arrives.** The answer is identical on purpose. Check `MAILER_ENABLED` and the transport settings, then the backend log: a delivery failure is logged with the user id, never with the link.

**The link opens the wrong site.** `OAUTH_SIGN_IN_FRONTEND_URL` is not the public frontend URL.

**`429` on reset.** The per-IP throttle on both endpoints was hit. Wait for the window or raise the limit.

**Users cannot pass the second step after a key change.** Secrets are encrypted with the OAuth key pair, and replacing the pair makes every stored secret undecryptable. Reset those users' factors and have them enrol again.

**A user lost their authenticator.** They can sign in with a recovery code, each usable once. If they have none left, reset their factor as an administrator.

## Related

- [Account self-service](../../../concepts/backend/account-self-service/) — how reset, password change and two-factor work.
- [Authentication strategies](../../../concepts/backend/authentication-strategies/) — sessions and the lockout a failed sign-in feeds.
