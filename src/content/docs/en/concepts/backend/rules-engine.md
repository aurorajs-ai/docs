---
title: Rules engine
description: How the automation package lets administrators author business rules as decision tables over fields and actions a bounded context declares in code, and how one evaluation runs.
---

## Why this exists

Some business behavior changes faster than releases: "when the supplier is X and the channel is empty, forward the document to this address and hold it for three days". Hard-coding each rule means a developer and a deploy per change.

The rules engine splits the problem. The consuming bounded context declares in code what can be *compared* (fields) and what can be *done* (actions). Administrators combine them into rules, in a table, with no deploy. The engine knows no concrete field or action: it only evaluates.

## How it works

### What code declares, and what the client authors

| Declared by the consumer at boot | Authored by the administrator |
| --- | --- |
| An **entity** (the aggregate the rules are about) | **Decision tables**, and through them the rules |
| Its **fields**: code, label, value type, how to read the value | Which fields and operators each condition column uses |
| Its **actions**: code, label, typed parameters, the handler | Which actions each action column runs |
| Extra **operators** (the six built-in ones come with the engine) | Row values, order and activation |

Registration runs at boot, so a change to a declaration takes effect on the next start. It *ensures* the catalog: rows are created when missing, never deleted, and labels an administrator edited are never overwritten. For an existing field, action or operator it re-syncs only the metadata that code owns (a field's value type and line flag, an action's parameters, an operator's kind and accepted types) when it differs. A code dropped from the declaration stays in the catalog.

### The typed vocabulary

A field declares a value type: `TEXT`, `NUMBER`, `OPTIONS`, `REFERENCE` or `BOOLEAN`. Values are always stored as text or codes, so a `BOOLEAN` field is compared as `'true'` or `'false'`. `OPTIONS` and `REFERENCE` fields declare an options resolver that answers `{ code, label }` pairs for a search text or a list of codes, and nothing else the consumer holds. The catalog stores only the types, so the admin screens render one control per field without reading code.

A **line field** (`isLine`) resolves to the list of positions of a document, such as invoice lines. A condition on it holds when *any* position satisfies it.

An action declares typed parameters (`TEXT`, `MULTILINE_TEXT`, `NUMBER`, `OPTIONS`, `REFERENCE` or `EMAIL_LIST`, each required or not). `BOOLEAN` is a field type only.

Operators declare how many operands they take (`NONE`, `SINGLE` or `LIST`) and which field value types they accept. The built-in six are `EXISTS`, `NOT_EXISTS`, `EQUALS`, `NOT_EQUALS`, `IN` and `NOT_IN`. The save rejects a condition column whose operator does not accept the type of its field.

### Decision tables

The client composes rules in a table, not one by one:

- A **definition** belongs to one entity and has a name, an optional description (documentation only) and a position among the entity's definitions.
- Its **columns** are either *condition* columns (a field, an operator and an optional list of allowed values) or *action* columns (an action type).
- Each **row** has an active flag, a *stop here* flag and an order. A cell is where a row meets a column: a value for a condition, parameters for an action. An absent cell means "any value" for a condition and "no action" for an action.

Saving a definition generates **one rule per row**, with its conditions and actions, atomically. The generated rule, condition and action modules are read-only through the API: the only write doors are saving, reordering and deleting a definition. The panel for this is hand-written, not generated.

### One evaluation

The consumer calls `evaluate(entityType, item, options)` when its own process decides.

1. The engine reads the active rules of the entity on every call. There is no cache, so an edit applies to the next evaluation.
2. Rules are processed one at a time in ascending **priority**, which derives from the position of the definition and then of the row. Ties are broken by creation order.
3. A rule matches when all its conditions hold. A rule with no conditions always matches.
4. If it matches, its actions run before the next rule is evaluated, so a later rule sees the persisted effects of earlier ones. Facts read during the run are memoized, and the memo is cleared after every rule that ran an action.
5. A matched rule with the *stop here* flag ends the evaluation after its own actions. The result names it in `stoppedAtRuleId`.

The run is a single pass: no rule is evaluated twice and no action starts a new evaluation. Rules accumulate: every matching rule acts, unless a stop flag intervenes.

**Failure isolation.** Each action runs in its own savepoint of the evaluation's transaction. A failing action is rolled back alone and reported as failed; the other actions still run. A field, operator or action code that the catalog holds but the running code no longer registers produces an explicit error in the result, never a silent skip.

The engine persists no result and keeps no log. The consumer logs the returned result if it needs a trace.

### Moving items through a state machine

An entity that declares `stateMachines` opts into the built-in `MOVE_TO_STATE` action. Each binding names a state `field`, how to read the stored state id and how to write it. The action has one required `OPTIONS` parameter, `stateCode`, whose value is `field:code`, so an entity with two machines can target either. See the [state machine](../state-machine/).

## When it applies

- Administrators need to change conditions and consequences without a release.
- The same decision is made from several attributes of one item (supplier, amount, channel) and the combinations multiply.
- You want every automatic decision to be explainable: the result lists each rule, each condition outcome and each action status.

## Trade-offs and limits

- A field an action can change must be resolved from persisted state, using the `options` the engine passes (they carry the run's transaction), not from the in-memory item, which the engine never mutates.
- An irreversible external effect (an e-mail, a call to another system) must not run inside an action: a savepoint cannot undo it and the consumer's transaction may still roll back. Emit it as an event after the transaction commits. Actions that change state stay synchronous.
- There is no chaining and no second pass.
- The package requires `identity` and installs with `catalyst add automation`.

## Related

- [How-to: Register an entity with the rules engine](../../../guides/backend/register-an-entity-with-the-rules-engine/)
- [Configurable state machine](../state-machine/)
- [Cross-bounded-context ports](../cross-bounded-context-ports/)
