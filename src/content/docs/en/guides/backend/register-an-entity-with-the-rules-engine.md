---
title: Register an entity with the rules engine
description: Declare the fields and actions of an entity at boot, evaluate an item against the rules administrators author, and optionally add an operator or move items through a state machine.
---

## Goal

Let administrators author decision tables over one of your aggregates, and run them when your own process decides.

## Before you start

- The `automation` package is installed: `catalyst add automation` (it requires `identity`).
- You know which attributes of the item rules should compare, and which effects a rule may trigger.

## Steps

1. **Register the entity at boot.** Inject `AUTOMATION_RULES_ENGINE_REGISTRAR` from `@bridges/automation/rules-engine/index.js` into a provider that implements `OnApplicationBootstrap`:

   ```ts
   await this.registrar.registerEntity<InvoiceItem>({
     entityType: 'Invoice',
     label: 'Invoices',
     fields: [
       { code: 'SUPPLIER', label: 'Supplier', valueType: 'TEXT', resolve: (item) => item.supplierCode },
       {
         code: 'CHANNEL',
         label: 'Channel',
         valueType: 'OPTIONS',
         options: async ({ search, codes, limit }) => searchChannels(search, codes, limit),
         resolve: (item) => item.channel,
       },
       { code: 'LINES', label: 'Lines', valueType: 'TEXT', isLine: true, resolve: (item) => item.lines.map((l) => l.code) },
     ],
     actions: [
       {
         code: 'FORWARD',
         label: 'Forward',
         parameters: [{ code: 'recipients', label: 'Recipients', type: 'EMAIL_LIST', required: true }],
         execute: async ({ parameters, item, options }) => {
           await forward(item.id, parameters.recipients as string[], options);
           return { forwarded: true };
         },
       },
     ],
   });
   ```

   - `valueType` is `TEXT`, `NUMBER`, `OPTIONS`, `REFERENCE` or `BOOLEAN`. `OPTIONS` and `REFERENCE` require an `options` resolver; the other types must not declare one.
   - A parameter `type` is `TEXT`, `MULTILINE_TEXT`, `NUMBER`, `OPTIONS`, `REFERENCE` or `EMAIL_LIST`. The same resolver rule applies.
   - `isLine: true` means `resolve` returns an array, and a condition holds when any element satisfies it.
   - An action succeeds by returning (optionally an output object) and fails by throwing.

   A malformed declaration, or registering the same `entityType` twice in a process, fails the boot with a message that names the entry.

2. **Read facts from persisted state when an action can change them.** If an earlier action of the same evaluation can change a field, resolve it from the database using the `options` the engine passes (`resolve: async (item, options) => ...`), not from `item`.

3. **Evaluate when your process decides.** Inject `AUTOMATION_RULES_ENGINE_EVALUATOR`:

   ```ts
   const result = await this.evaluator.evaluate('Invoice', invoice, repositoryOptions);
   ```

   Pass your transaction in `repositoryOptions` to join it; without one the engine opens its own. The call throws when `entityType` was not registered in this process. The result lists each rule in the order it ran, each condition outcome (`held`, `not-held`, `error`), each action status (`succeeded`, `failed`) and `stoppedAtRuleId`. The engine stores none of it: log it if you need a trace.

4. **Optionally add an operator.** The six built-in operators cover most cases. For another one, call `registerOperator` at boot with a code, a label, a `valueKind` (`NONE`, `SINGLE` or `LIST`), the `valueTypes` it accepts and an `evaluate(fact, operand)` function.

5. **Optionally opt into `MOVE_TO_STATE`.** Add `stateMachines` to the registration, one binding per state field:

   ```ts
   stateMachines: [{
     field: 'stateId',
     readStateId: (item) => item.stateId,
     writeStateId: async (itemId, stateId, options) => { /* update the column with options */ },
   }],
   ```

   The consumer keeps owning the column. The `field` must be the one the machine was registered with. `MOVE_TO_STATE` is reserved: declaring an action with that code fails the boot.

6. **Author the rules.** In the Automation section of the admin panel, create a definition for your entity, add condition and action columns, then rows. Saving generates the rules.

## Verify it worked

- After boot, your entity, fields, action types and operators appear in the Automation screens.
- Create a definition with a row that matches a test item, call `evaluate`, and check that the result lists the rule with `isMatched: true` and the action as `succeeded`.
- Add a *stop here* row above another matching row and confirm `stoppedAtRuleId` names it and the later rule is absent from the result.

## Troubleshooting

- **A field is missing in the panel after a code change.** Registration runs at boot: restart the backend.
- **The result reports `ACTION_TYPE_NOT_REGISTERED` or `FIELD_NOT_REGISTERED`.** The catalog still holds a code the running code no longer registers (dropped codes are never deleted). Re-register it or remove the rule that uses it.
- **A condition on a field reads a stale value.** The field resolves from the in-memory item while an earlier action changes it. Resolve it from persisted state through `options`.
- **The boot fails with "Invalid rules engine declaration".** The message names the entity and the entry: a duplicate code, a missing or unexpected `options` resolver, or an empty `stateMachines` list (omit it to opt out).

## Related

- [Concept: Rules engine](../../../concepts/backend/rules-engine/)
- [How-to: Adopt the state machine](../adopt-the-state-machine/)
