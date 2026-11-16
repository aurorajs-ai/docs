---
title: Enable the assistant on a module
description: "Let the help assistant fill the creation form of a module: declare `hasAssistant`, mask sensitive fields, register a hand-written form and check the compiled prefill."
---

## Goal

Make the help assistant able to explain the form of a module and preselect its fixed-option fields (enums and booleans), including a form you wrote by hand.

## Before you start

- A module under `cliter/<bc>/<module>.module.yaml` with a generated frontend.
- A `create` guided action for the module in `cliter/<bc>/actions.yaml` (`catalyst generate front module` appends it when the bounded context has a manual).
- The `catalyst` CLI available locally.
- An application that has the `tools` package installed (without it there is no assistant), the assistant switched on (`tools.assistant.isEnabled`), and a role that holds the permission `tools.assistant.ask`, granted in IAM like any other permission. See [Access and cost](../../../concepts/frontend/guided-actions/#access-and-cost).

## Steps

1. **Opt the module in.** Add `hasAssistant: true` at module level in the YAML:

   ```yaml
   boundedContextName: iam
   moduleName: account
   hasAssistant: true
   ```

   Both `hasAssistant` flags must be literal booleans, or the load fails naming the module.

2. **Mask what the assistant must not touch.** On a property, `hasAssistant: false` excludes it from the prefill and hides its value and options from the assistant:

   ```yaml
   - name: hasAddChildTenants
     type: boolean
     hasAssistant: false
   ```

   `password` and `encrypted` properties are masked without declaring anything, and [`readOnly` properties](../../../concepts/backend/property-writability/) are excluded.

3. **Regenerate the frontend.** Run `catalyst generate front module --force`. The generated `*-form.component.ts` now registers with `AssistedFormService`.

4. **(Hand-written forms only) Register the form yourself.** A form listed in `excludedFiles` never receives the generated registration. Call `register` from its constructor (an injection context), one descriptor per field:

   ```ts
   constructor() {
     inject(AssistedFormService).register({
       formId: 'iam.account',
       mode: this.mode, // pass the signal; reading it here throws
       form: this.signalForm,
       fields: [
         {
           name: 'type',
           kind: 'enum',
           labelKey: 'iam.account.Type',
           options: [
             { value: 'USER', labelKey: 'iam.account.Type.USER' },
             { value: 'SERVICE', labelKey: 'iam.account.Type.SERVICE' },
           ],
           isMasked: false,
         },
         { name: 'email', kind: 'text', labelKey: 'iam.account.Email', isMasked: false },
       ],
     });
   }
   ```

   Register top-level fields only. Mark a field `isMasked: true` when the assistant must not see its value.

5. **Recompile the manual.** The compile lists the module's `enum` and `boolean` properties as the `prefill` of its `create` action.

## Verify it worked

- Ask the assistant how to create a record of the module: the answer offers a button, and pressing it opens the form with the fixed-option fields preselected.
- In a unit test, inject `AssistedFormService`, call `snapshot()` and check the field kinds and options; call `patch([{ field, value }])` and check the form control changed.

## Troubleshooting

- **The assistant explains nothing about the form.** The module has no `hasAssistant: true`, or a hand-written form was never registered.
- **A field is not preselected.** It is text, a relation, `readOnly`, masked, or an enum without declared options. Only exact options of unmasked enums and booleans are written.
- **`NG0950` when registering.** The registration read the `mode` input. Pass the signal itself, not its value.

## Related

- [Concept: Guided actions and assisted forms](../../../concepts/frontend/guided-actions/)
- [Concept: The in-app user manual](../../../concepts/frontend/in-app-user-manual/) — the manual that the `create` action is compiled with.
- [How-to: Exclude CLI-generated APIs from a module](../../backend/exclude-generated-apis/)
