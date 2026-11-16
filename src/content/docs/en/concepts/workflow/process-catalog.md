---
title: Process catalog
description: How each bounded context declares its business processes in processes.yaml as ordered paths over screens, how that differs from rules, specs and the manual, and how the catalog is validated.
---

## Why this exists

A PRD describes the flows a product should support, but nobody maintains it once the code ships. A spec describes one capability, while a business process crosses several screens: to plan a campaign, a user creates it on one screen and assigns its lines on another. Business rules state laws, and the manual explains clicks. Nothing owned the question "which goals does this bounded context let a user reach, over which screens, in which order".

The process catalog is that owner. It is a short, validated file per bounded context that names the goals and the screens that lead to them, and nothing more.

## How it works

### What a process is

A **process** is the ordered set of actions that takes the business to a state with value of its own, for example granting a person access: optionally prepare a role, optionally create a tenant, then create the account. An **action** is one operation of the system and has value only as part of a process.

What separates a process from an action is the business end, not the number of screens. A state is a business end when it passes three tests:

- It reads as a state reached ("a supplier is registered"), not an activity ("fill in the supplier form").
- Someone in the business asks for it by name, without naming screens or buttons.
- The work can stop there: no further action is needed to collect the value. A role with no account fails the test, because it only serves the next action.

Work the system does without a person is not a step. If it has a human part (someone configures, supervises or receives its result), it enters through that part. If it only changes data the user sees, it is one sentence in a manual chapter. If it has no visible effect, it is not in the catalog.

### The file

`cliter/<bc>/processes.yaml` has one top-level key, `processes`. Each process has exactly five keys, and each step has `screen` and optionally `optional: true`.

```yaml
processes:
  - id: grant-access
    goal: Una persona entra en la aplicación y solo ve lo que su rol permite.
    steps:
      - { screen: iam.role, optional: true }
      - { screen: iam.tenant, optional: true }
      - { screen: iam.account }
    rules: [BR-IAM-ROLE-004, BR-IAM-ACCOUNT-007]
    status: active
```

- `id` is kebab-case English, unique within the bounded context and cited outside it as `<bc>.<id>`. It never changes, and the id of a retired process is never reused.
- `goal` is one sentence in Spanish, the language of the business rules. Identifiers stay English and content stays Spanish on purpose.
- `steps` is a non-empty ordered list. `screen` is `<bc>.<module>`. A step names a screen only: it is not bound to an operation.
- `rules` lists the ids of the business rules that limit the path, possibly none.
- `status` is `planned` (decided in a PRD, not shipped), `active` (shipped, narrated by the manual) or `retired` (no longer exists, kept so its id is never reused).

### One owner per question

| Question | Owner |
| --- | --- |
| Which goals exist, over which screens, in which order | `processes.yaml` |
| How the user does it: fields, buttons, screenshots | The manual |
| A law that limits it: a condition, a limit, a cascade | A business rule |
| Why the code is shaped as it is | `CONTEXT.md`, developer prose only |

A process cites rules by id, and a rule never cites a process, because references in both directions drift. A sentence that starts with "if", "cannot", "only when" or "at most" is a rule, never a branch of the process.

### Validation

`pnpm processes:validate` checks the schema, that ids are unique, that each `active` process uses screens that exist in the navigation tree, and that every cited rule id exists in the business-rules index. An `active` process may not cite a derogated rule. A `planned` or `retired` process keeps the `<bc>.<module>` shape but its screens need not exist.

The manual closes the loop. Each `active` process must be narrated by exactly one manual section per language, marked with `<!-- process: <id> -->`, and `pnpm manual:compile` fails otherwise. See [The in-app user manual](../../frontend/in-app-user-manual/).

## When it applies

- A diff adds or removes a screen that a user path crosses, changes the order screens are reached, or makes a step optional or mandatory: the catalog changes.
- A diff changes a label, a column, a validation message or the behavior inside one screen without changing the path: it does not.
- A PRD introduces a flow: it enters as a `planned` process and becomes `active` in the pull request that ships it.

## Trade-offs and limits

- The catalog holds identifiers only. Its narrative lives in the manual, and developer prose in `CONTEXT.md`.
- There is no `proposed` state: approval is the pull request that changes the file.
- The catalog is not an input of the help assistant, which reads the manual.
- A process is not worth listing before a business end exists or is decided. Do not list every conceivable flow up front.

## Related

- [How-to: Maintain the process catalog](../../../guides/workflow/maintain-processes/)
- [Business rules system](../business-rules-overview/)
- [The in-app user manual](../../frontend/in-app-user-manual/)
