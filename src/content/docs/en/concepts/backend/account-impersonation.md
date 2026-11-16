---
title: Account impersonation
description: How an authorized operator acts as another account without sharing a password — the GraphQL mutation, the short-lived token with an actor claim, the three vetoes, and how the admin panel stacks and restores sessions.
---

## Why this exists

Support staff need to see what a user sees: the same menus, the same data, the same error. The usual workarounds are bad. Asking for the user's password breaks the promise that only the user knows it. Cloning the user's roles onto an operator account shows roughly the right thing, but it drifts the moment the roles change, and it leaves no trace of who looked.

Impersonation solves it at the token. The operator asks the backend for a token that behaves as the target account, and the token says, in a standard claim, who is really behind it. Everything the target could do, the operator can do, and everything is attributable to the operator.

## How it works

### Issuing the token

The operator calls the GraphQL mutation `oAuthCreateImpersonateToken(payload: { targetAccountId })`. It is GraphQL only, and it is not a grant type of the token endpoint, so `POST /api/o-auth/token` never issues one. The caller must be authenticated with a JWT and hold the permission `oAuth.credential.impersonalize`, which is seeded with no roles: the capability stays inert until an administrator assigns it to a role.

The response is an access token and its lifetime, nothing else:

- **No refresh token.** An impersonation credential cannot be renewed by construction.
- **Short life.** Its lifetime is `JWT_IMPERSONATION_TTL_SECONDS`, 900 seconds by default, independent of the ordinary token lifetimes.
- **An actor claim.** The token carries `act.sub`, the operator's account id (RFC 8693). The principal built from it exposes that id as `impersonatedBy`, so any code can tell an impersonated request from a normal one.
- **An audit row.** An OAuth credential row records the grant type `IMPERSONATION`, the target as the account and the operator as `impersonatorAccountId`.
- **A fresh view of the target.** The target's permission and tenant snapshots are refreshed at issuance, so the token never hands out stale access.

It works only when the backend itself issues tokens (`OAUTH_STRATEGY=local-provider`). In any other mode it answers `503`.

### The three vetoes

Before issuing, the handler refuses with `403` when:

1. **The target is the caller.** No self-impersonation.
2. **The caller is already impersonating.** No chains: a token with an actor claim cannot start another.
3. **The target holds a privilege-granting permission.** The target's permissions are checked against a deny-list: other impersonation rights, and the permissions that would let someone mint equivalent privilege by another door, namely the write permissions of roles, accounts, permissions, OAuth clients, applications and credentials; user update and upsert, which can set a password; key-value configuration, which holds this very list; and authorization codes, access tokens and refresh tokens, read permissions included, because those rows hold usable credentials. Impersonating a peer is not allowed.

The deny-list has a hard-coded floor. An operator-tunable list in the key-value store (`oAuth.impersonation.privilegeDenylist`) can only add entries. It can never remove one the floor requires, because a stored value that could shrink the list would let a compromised session disable the veto for everyone after it. A missing key, a read error or a malformed value fall back to the floor.

The veto reads the target's permissions after a strict refresh. If the refresh fails, the request fails with `503` instead of deciding on a stale snapshot. A missing or inactive target is a `404`, and a target with no client is a `400`.

### In the admin panel

The account list offers an impersonate action per account, only to a session that holds the permission, never while the session is itself impersonated, and never on the operator's own row.

Starting an impersonation stacks the operator's own credentials behind the impersonated ones in the token store. A persistent badge in the header shows whenever the active session is impersonated, derived from the actor claim of the active token and never from the presence of the stack, so a stale stack cannot make it lie. Activating the badge ends the impersonation and restores the operator's session. With nothing to restore, the panel ends the session and returns to sign-in with a message, instead of claiming a return that did not happen.

Because the token has no refresh, an expired impersonation is not a sign-out. The panel restores the operator's own session and shows one notice, even when several requests fail at once.

## When it applies

- Support needs to reproduce what a specific user sees.
- You see an `impersonatedBy` value on the principal, an `act` claim in a token, or a credential row with grant type `IMPERSONATION`.
- An impersonation request returns `403` and you need to know which veto refused it.

## Trade-offs and limits

- **Only in `local-provider` mode.** A satellite that delegates login to a hub cannot issue the token.
- **The deny-list is coarse on purpose.** A "target's permissions must be a subset of the caller's" check would compare two snapshots and break the moment a role changes, giving a veto nobody can explain. A list of known privilege-granting permissions is stable and readable. The stricter check is recorded as possible future hardening.
- **Nothing ships with the permission.** Until a role holds `oAuth.credential.impersonalize`, nobody can impersonate.
- **No renewal.** A long support session needs a new impersonation when the 15 minutes pass.

## Related

- [Authentication strategies](../authentication-strategies/) — the token endpoint impersonation deliberately does not use.
- [Tenant scope](../tenant-scope/) — an impersonated session is scoped by the target's tenants.
- [Account self-service](../account-self-service/) — what an account can do for itself, with no operator involved.
