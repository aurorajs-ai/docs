---
title: "Guided actions and assisted forms"
sidebar:
  order: 10
description: How the help assistant and the command palette take a user to a screen or to a creation form, how `prefill` and `detailMode` shape that trip, and what `hasAssistant` lets the assistant do inside an open form.
---

## Why this exists

A user who asks the help assistant "how do I create a service account?" gets an answer in words, then has to find the screen, press Create and pick the right type by hand. The assistant can shorten that trip, but only inside strict limits: it must never act on its own, and it must never guess a screen that does not exist.

Two mechanisms draw those limits. A **guided action** is a button the assistant (or the command palette) offers to take the user somewhere. An **assisted form** is a form that tells the assistant what it contains, so the assistant can explain it and preselect fixed-option fields. Both are declarative: the framework offers nothing that the project did not declare.

## How it works

### Guided actions

Each bounded context declares its actions in `cliter/<bc>/actions.yaml`, one file per bounded context. The file sits beside `<module>.module.yaml` (the data model) and `processes.yaml` (the business processes). It is compiled together with the user manual into the manual index.

```yaml
- id: create-account
  route: /iam/account
  kind: create
  tourId: iam.account
  label: { es: Crear una cuenta, en: Create an account }
```

- `kind: open` takes the user to the screen at `route`.
- `kind: create` takes the user to the creation form of the module at `route`.
- The permission of the route gates the action: a user who cannot see the screen is not offered the button.
- A screen without a declaration offers nothing. Nothing is inferred.

A declared action appears in two places: as a button in the assistant's answer, and in the command palette (the "Actions" and "On this screen" groups).

When you run `catalyst generate front module`, the CLI appends the `create` action of the module to this file if the bounded context has a manual. It appends and never rewrites, so entries you wrote are kept. The generated label is provisional; polish it to the screen's words.

### `detailMode` on a create action

A `create` action does not reach the form the same way in every module. The compile reads `front.detailMode` from the module YAML and writes it on the action:

| `detailMode`     | Where the form lives                  | What the runner does                                         |
| ---------------- | ------------------------------------- | ------------------------------------------------------------ |
| `view` (default) | Its own page at `<route>/new`        | Navigates straight to `<route>/new`; the list never renders. |
| `dialog`         | A dialog over the list                | Navigates to the list and activates its Create control.      |

Without a declaration the compile writes `view`, the same default the generator uses. You never write `detailMode` in `actions.yaml`; a `detailMode` key there fails the compile. The field is absent on `open` actions and on routes without a module YAML, and the runner treats a missing value like `dialog` (list first, then the Create control). See [Detail mode](../detail-mode/) for the two shells themselves.

### `prefill` on a create action

The compile also writes `prefill`: a list of `{ field, options }`, one entry per field the assistant may fill in the creation form, with the values it accepts. It is computed from the module YAML:

- Only modules that declare `hasAssistant: true` produce entries.
- Only `enum` properties (with their `enumOptions`, in declaration order) and `boolean` properties (`true`, `false`) qualify.
- `readOnly` properties and properties that declare `hasAssistant: false` are left out.
- It is empty for `open` actions, for modules without the flag, and for routes without a module YAML.

The assistant receives the options with the action because no form is open yet when it proposes the trip. Once the user presses the button, the runner opens the form (per `detailMode`) and then applies the prefill.

### Assisted forms

A module that declares `hasAssistant: true` generates a `*-form.component.ts` that registers with `AssistedFormService`. The registration lists one descriptor per rendered field: its kind, its label key and, for an enum or a boolean, its options. At most one form is registered at a time; it unregisters when the form is destroyed.

While a form is open, each question to the assistant carries a snapshot of the form: labels, values, errors, and which required fields are empty. With that, the assistant can explain any field and, when the user asks, preselect a fixed-option field. The chat announces what was written and highlights the field.

### Masking a field

A property with `hasAssistant: false` is registered as masked: the snapshot carries its state (required, empty, errors) but never its value or its options, and the assistant cannot write it. `password` and `encrypted` properties are masked whatever they declare.

Use it when a value must not reach the assistant, or when the user could not see what the assistant changed. For example, a switch that is only visible with more than one tenant should not be granted silently.

## When it applies

- A user asks the assistant how to do something and gets a button that takes them there.
- You see a `create` entry appended to `actions.yaml` after generating a frontend module.
- You add `hasAssistant: true` to a module and the assistant starts explaining its form and preselecting its fixed-option fields.
- A form you wrote by hand takes part in the assistant only because you registered it yourself.

## Trade-offs and limits

- **The assistant never saves.** It navigates, opens the creation form and fills fixed-option fields. The user reviews the form and presses Save.
- **It never writes text or relations.** Only an exact option of an unmasked `enum` or `boolean` field is written. Text fields and relation fields receive keyboard focus instead.
- **It only offers what is declared.** There is no screen discovery and no inference of actions from the model. The flag `hasAssistant` is per module: on a parent it says nothing about its children.
- **Forms excluded from codegen are not registered.** If you list a form in `excludedFiles`, the generator does not emit the registration; you register it by hand, and a mistake there is yours. Nested objects need care: the registry addresses top-level fields only.
- **Dialog modules cannot start a tour on the form.** The URL does not change, so a `create` action of a dialog module takes no `tourId`.

## Related

- [Detail mode](../detail-mode/) — the two shells that `detailMode` on a guided action chooses between.
- [How-to: Enable the assistant on a module](../../../guides/frontend/enable-the-assistant-on-a-module/) — the YAML flag, field masking and registering a hand-written form.
- [Preservation regions](../preservation-regions/) — how generated frontend files keep your edits across regeneration.
