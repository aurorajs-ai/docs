---
title: Adopt the state machine in a module
description: Register a machine at boot, enter new items at the initial state, move them through the transition port, and filter lists by state category.
---

## Goal

Give an aggregate of your bounded context a lifecycle whose states and transitions an administrator can edit, while your code keeps working with a few stable category codes.

## Before you start

- The `automation` package is installed: `catalyst add automation`. It requires `identity` and installs it if missing.
- You know the lifecycle your code depends on: which states it must always find (the *minimum* states), and which categories it reasons with.

## Steps

1. **Declare the state column in the module YAML.** It is a relation to the state table, `readOnly` so that no generic create or update can write it, and without a foreign key constraint because the relation crosses a bounded context.

   ```yaml
   - name: stateId
     type: id
     nullable: false
     readOnly: true
     relationship:
       type: many-to-one
       aggregateName: AutomationStateMachineState
       modulePath: automation/state-machine-state
       key: id
       field: state
       avoidConstraint: true
   ```

   Regenerate the module with `catalyst generate`. See [Property writability](../../../concepts/backend/property-writability/) for what `readOnly` removes.

2. **Register the machine at boot.** Inject `AUTOMATION_STATE_MACHINE_REGISTRAR` from `@bridges/automation/state-machine/index.js` into a provider that implements `OnApplicationBootstrap`, and call `register`:

   ```ts
   await this.registrar.register({
     entityType: 'Invoice',          // the aggregate name
     field: 'stateId',               // the column of step 1; always declared, never inferred
     label: 'Invoices',
     categories: [
       { code: 'ENTRY', label: 'Entry', sort: 1 },
       { code: 'ERROR', label: 'Error', sort: 2 },
     ],
     minimumStates: [
       {
         code: 'RECEIVED',
         nameI18n: { en: 'Received', es: 'Recibida' },
         categoryCode: 'ENTRY',
         isInitial: true,
       },
       { code: 'FAILED', nameI18n: { en: 'Failed', es: 'Fallida' }, categoryCode: 'ERROR' },
     ],
     initialConfiguration: {
       states: [],
       transitions: [{ fromCode: 'FAILED', toCode: 'RECEIVED', isAutomatic: false }],
     },
   });
   ```

   Exactly one state across `minimumStates` and `initialConfiguration.states` must set `isInitial`. A manual transition seeded without `roleIds` can be run by nobody until an administrator assigns roles.

3. **Enter new items at the initial state.** In your create handler, inside the transaction that writes the item, inject `AUTOMATION_STATE_MACHINE_TRANSITIONER` and call `enter(entityType, field, itemId, account, repositoryOptions)`. Write the returned state `id` into the item's `stateId`.

4. **Move items only through `transition`.** Pass the *stored* state as the origin, so a stale request is rejected:

   ```ts
   const target = await this.transitioner.transition(
     'Invoice', 'stateId', itemId,
     item.stateId,      // origin: the stored state
     toStateId,
     false,             // isAutomatic
     currentAccount,
     repositoryOptions, // carries your transaction
   );
   await this.updateByIdService.main({ id: itemId, stateId: target.id }, undefined, handlerMeta);
   ```

   The call writes the history row in your transaction. If it rejects, nothing is written. Only in-process code should pass `isAutomatic: true`: never read it from an API payload.

5. **Filter by category with the query DSL.** No category-specific filter code exists: use a relation predicate.

   ```ts
   where: { state: { category: { code: { in: ['ERROR'] } } } }
   ```

   The `state` and `category` relations must be declared for the aggregate, as with any relation read through the [Query DSL](../query-with-querystatement/).

## Verify it worked

- Boot the backend. The machine, its categories and its minimum states appear in the Automation section of the admin panel, and a malformed declaration stops the boot with a message that names the machine.
- Create an item: it has the initial state and one history row with no origin state.
- Run a manual transition with an account that lacks the roles of the edge: it is rejected and nothing changes.

## Troubleshooting

- **The boot fails with "Invalid state machine declaration".** The message names the machine and the entry: a duplicate code, a state with an unknown category, a transition to an unknown state, or zero or several initial states.
- **A transition is rejected for every user.** The edge has no roles (manual edges are fail-closed), or no edge exists from the stored state. Assign roles on the transition screen, or add the edge.
- **A generic create or update rejects `stateId`.** That is the `readOnly` declaration working: the column is written only through `enter` and `transition`.

## Related

- [Concept: Configurable state machine](../../../concepts/backend/state-machine/)
- [How-to: Register an entity with the rules engine](../register-an-entity-with-the-rules-engine/) — to move items by rule.
