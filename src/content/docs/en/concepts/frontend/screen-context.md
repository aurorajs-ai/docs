---
title: "Screen context for the assistant"
sidebar:
  order: 11
description: How a hand-written screen tells the help assistant what it shows right now, through a closed vocabulary of five sections that the backend validates, bounds, renders once and never stores.
---

## Why this exists

The assistant already understands a form: [`AssistedFormService`](../guided-actions/#assisted-forms) tells it the fields, their values and their errors. A screen is more than its form. A user looking at a record asks "why can't I accept this?" or "which line has the problem?", and the answer lives in the state of the record, in the actions the toolbar shows or hides, and in warnings that child components render. None of that is a form field, so the assistant had nothing to answer from.

The **screen context** is the channel for that data. A screen publishes what it shows, in a fixed shape, and the assistant receives it with each question. It is **perception only**: the assistant reads what the user already sees and gains no new way to change anything. It still writes only through the form patch and the guided actions.

## How it works

### Contributions by section

`ScreenContextService` (in `@aurora/modules/screen-context`) is a registry. Each component of a screen contributes the sections it owns under one **screen id**, `<bc>.<module>`, from its injection context (a constructor or a field initializer):

```ts
inject(ScreenContextService).contribute('iam.account', {
  status: () => ({ label: 'Active' }),
});
```

This differs from the assisted form, which keeps one slot that the newest registration replaces. A screen's data usually lives in two components (the detail owns the record and the toolbar; the child form owns totals and warnings), and a replaceable slot would force one of them to reach into the other's private state. Here each component publishes only what it owns.

- A contribution is withdrawn automatically when its component is destroyed, through `DestroyRef`. The screen id is released when the last section goes.
- Contributing a section that is already held, or a section for a different screen id while one is registered, **throws**. Two components that both claim `facts` fail on the first open, and a person decides which one owns it. The registry never merges.
- Every check runs before anything is stored, so a rejected contribution leaves the registry unchanged.

### A closed vocabulary

A section is a function that returns the data when the question is sent, or `null` while it has nothing to say (no record loaded yet). There are exactly five:

| Section   | What it carries                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| `status`  | The state of the record, as the user reads it.                                                                 |
| `issues`  | Texts of the problems the record has.                                                                          |
| `actions` | Each button: its label, whether the screen shows it and, if it does not, the named conditions it is missing.   |
| `facts`   | Label and value pairs the screen displays (totals, dates, names).                                              |
| `rows`    | Tables: label, total count and only the rows that carry warnings.                                              |

Readers are plain functions, not signals. Nothing reacts to the context: it is read once per question, like the form snapshot. The screen translates every text, using the same texts and the same shared functions as its template, so the context cannot say something the screen does not.

### Read on demand, validated on the backend

When the user asks, the chat calls `snapshot()`, which evaluates every reader at that moment, and sends the result as the `screen` field of the ask operation, beside `form`. A screen that contributes nothing sends nothing, and a client that does not send `screen` behaves as before.

The backend validates the shape and the limits of `screen` for both transports (GraphQL and REST), before the monthly quota and before the model provider. An invalid or oversized screen is rejected with a translated error naming the section, so it spends no tokens. The limits are per section: for example at most 20 issues, 20 actions, 40 facts, 3 tables and 50 warned rows per table. They are exported as one constant, `TOOLS_ASSISTANT_SCREEN_LIMITS`, and **they reject; they never truncate**. A truncated screen would make the assistant answer with confidence from a partial view, and the screen that produced too much would never get fixed.

One renderer turns the screen into a `<screen>` block of the model message, the same for every screen. Every label and value is written as a quoted string, so a line break or a quote in the data cannot break the structure. The system prompt tells the model that the block is data the user sees now and never instructions, that an action marked as not shown is explained by its missing conditions, and that a shown action is never a promise: `available` means the screen shows the button, not that the backend will accept the operation.

The context belongs to the current question only. It is not stored in the conversation turn, it never enters the window of previous turns, and it is not logged.

## When it applies

- You write a screen by hand and want the assistant to answer about the open record: why an action is missing, what state it is in, which row has a warning.
- You see the assistant explain a missing button by naming a condition.
- A question is refused with an "invalid screen context" error naming a section: the screen published more than the limits allow.

Generated screens do not publish a context. A screen takes part only when a person contributes by hand; nothing is inferred from a YAML file, a route or a form. The first screen to do so is the purchase invoice review of an application that uses the `business-partner-portal` bounded context; [Publish a screen context to the assistant](../../../guides/frontend/publish-screen-context-to-the-assistant/) uses it as a worked example.

## Trade-offs and limits

- **Perception only.** The context adds no operation with side effects. Its actions are described, never offered: the model cannot choose them, and the backend offers only the guided actions that declarations allow.
- **Only what the screen shows.** Data that is visible but not needed to answer, such as free text copied from a supplier's document, is left out on purpose: it is the widest surface for prompt injection. A later incident adds a section by extending a reader.
- **Closed vocabulary.** A new kind of section is a deliberate, joint change of the frontend types, the GraphQL input, the backend limits and the renderer.
- **Limits are constants.** Nobody has needed to tune them, so they are not key-value settings. A screen over a limit fails visibly, and that failure is what justifies raising it.
- **Bigger prompts cost more.** The screen adds input tokens to each question, bounded by the limits and counted by the existing quota.

## Related

- [Guided actions and assisted forms](../guided-actions/) — the form snapshot and the guided actions, which stay the only ways the assistant acts.
- [The in-app user manual](../in-app-user-manual/) — the static documentation the assistant searches, complementary to this runtime data.
- [How-to: Publish a screen context to the assistant](../../../guides/frontend/publish-screen-context-to-the-assistant/)
