---
title: Configurable state machine
description: How the automation package gives a bounded context an editable lifecycle, with states and transitions that administrators change without a deploy, and what the consumer still owns in code.
---

## Why this exists

Many aggregates have a lifecycle: an invoice is received, ready, sent, in error, archived. Hard-coding the states in an enum freezes that lifecycle into the release. Every new state, and every change to who may move an item from one state to another, then needs a deploy.

The state machine of the `automation` package moves the lifecycle into tables that an administrator edits. The consuming bounded context keeps only what its own code depends on, and the machine answers one question: "is this edge allowed for this caller?", recording the answer.

## How it works

A **machine** exists per consuming entity and state field. It is identified by `entityType` (the aggregate name) plus `field` (the column that stores the state, for example `stateId`). An entity may have several machines, one per field, and a transition in one never touches another.

Each machine owns four kinds of rows:

| Rows | Who writes them |
| --- | --- |
| **Categories** | The consumer, at boot. A category is a code the consumer's own code reasons with (`ERROR`, `ARCHIVED`). The administrator edits only its label and order. |
| **States** | A state has a code, a name per language, a color, an order and a category. States the consumer declares as *minimum* are created at every boot and cannot be deleted. Everything else belongs to the administrator. |
| **Transitions** | An edge from one state to another, either automatic or manual. A manual edge lists the roles that may run it. |
| **History** | An append-only row per entry and per transition. Only reads are exposed. |

Exactly one state of a machine is initial. A transition between two states exists only if a row says so: a state no row points to cannot be reached.

### Registration at boot

The consumer calls the registrar port once per machine, at application boot, with an `AutomationStateMachineDeclaration`: the entity type, the field, a label, the categories, the minimum states and, optionally, an `initialConfiguration` of extra states and transitions.

- The machine, each category and each minimum state are **ensured** on every boot: created when missing, never updated afterwards. A label or name the administrator edited survives.
- `initialConfiguration` is **seeded once**, only on the boot that creates the machine. After that it belongs to the client.
- The declaration is validated before any write. A malformed one (duplicate codes, a state pointing to an unknown category, zero or several initial states, a transition to an unknown state) fails the boot and names the machine and the offending entry.

### Moving an item

Two ports do the work, and both run inside the consumer's transaction:

- `enter` puts a new item at the machine's initial state and writes a history row with no origin state.
- `transition` takes the item's *stored* state as the origin, plus the target state and whether the move is automatic. It rejects the call, writing nothing, when no such edge exists, or when a manual edge is run by an account that holds none of its roles. An edge with no roles can be run by nobody. An automatic transition ignores roles and records no account.

Because the consumer passes its stored state as the origin, a stale request is rejected for free: a queued retry for an item that was already sent finds no edge from "sent" to "ready".

A third port, the reader, resolves a state by code (`findStateByCode`), so the consumer can speak its own vocabulary.

## When it applies

- An aggregate has a lifecycle that the business wants to adjust without a release.
- Who may move an item between two states depends on the role of the user.
- You need an audit trail of every state change.

## Trade-offs and limits

- The consumer contract is strict. The state column is a relation to the state table declared `readOnly: true`, so no generic create or update can write it. The consumer sets it only through `enter` and `transition`, in the same transaction as the history row.
- A two-way edge is two rows, one per direction.
- A client cannot create or delete machines or categories: both come from code.
- The machine does not count retries, schedule work or send notices. Those stay in the consumer.
- The package requires `identity` (roles come from IAM) and installs with `catalyst add automation`.

## Related

- [How-to: Adopt the state machine](../../../guides/backend/adopt-the-state-machine/)
- [Rules engine](../rules-engine/) — its built-in `MOVE_TO_STATE` action moves an item through a machine.
- [Cross-bounded-context ports](../cross-bounded-context-ports/) — why the consumer injects tokens instead of importing `automation`.
