---
title: Role UI preferences
description: How a role's default landing page and hidden vertical navigation shape the session at sign-in and impersonation, which values are accepted, and what never changes the route the user asked for.
---

## Why this exists

A role often implies a way of working. A back-office role lands on a dashboard. A kiosk role has no use for a sidebar and should reach only a few pages. Without a mechanism, every user lands on the same root and every restricted role needs a custom shell.

The role carries two preferences, edited on the IAM role screen, and the frontend applies them whenever a session is established.

## How it works

| Role field | Effect |
| --- | --- |
| `defaultRedirection` | The path the user lands on after signing in. Empty means the application root. |
| `hasHiddenVerticalNavigation` | Collapses the vertical navigation (the sidebar) for users with this role. `null` reads as `false`. |

### Where the landing page comes from

When a session is established, the landing route is the first of these that is valid:

1. A `?redirectURL=` value the sign-in flow was bounced with.
2. The `defaultRedirection` of the **first role**, in the order the server returns the account's roles, whose value is non-empty.
3. The application root, `/`.

A value is accepted only if it is a same-origin path: it starts with a single `/`, is not protocol-relative (`//`), contains no backslash and is not an absolute `http://` or `https://` URL. A value that fails does not abort the flow: it falls through to the next candidate. The role field's description speaks of "absolute URLs", but the frontend ignores them on purpose, so a role value edited in the admin screen cannot become an open redirect. If the user lacks permission for the landing route, the permission guard sends them to `/`.

### Where the sidebar preference comes from

The preference is the **OR across the user's roles**: if any role hides the navigation, it is hidden. It collapses the sidebar once for that session. If a later session does not ask for the collapse, the sidebar returns to the state the user had before the forced collapse, so a forced collapse does not linger in the saved sidebar state. For example, an operator who impersonates a hidden-navigation account and then stops gets their own sidebar back.

### When it runs

The preferences apply at the three points where a session is established: a successful local sign-in, the start of an impersonation and its end. They never apply on a cold boot, a page refresh or a transparent token refresh, because those must not pull the user away from the route they requested.

The wait is bounded. If the account does not finish loading within 15 seconds, the user lands on the explicit redirect or `/`, never on a role's value that could not be trusted, and the sidebar is left alone.

## When it applies

- You configure a role that should land on a specific screen, or run without a sidebar.
- A user reports landing on the wrong page after sign-in: check the role order, since the first role with a value wins.
- A user lands on `/` after sign-in although their role has a value: the value is not a same-origin path, or the user lacks permission for it.

## Trade-offs and limits

- Hiding the navigation does not remove access. It only simplifies the interface: permissions still decide what a user can open.
- Role order is the server's order. With several roles that declare a landing page, only the first applies.

## Related

- [Authentication strategies](../../backend/authentication-strategies/)
- [Account impersonation](../../backend/account-impersonation/)
