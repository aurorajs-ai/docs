---
title: Property writability
description: How the readOnly and createOnly flags of a module YAML property decide who may write a value, on the generated form, the API contracts and the runtime write pipeline.
---

## Why this exists

Some values are not the client's to set. A lifecycle `status` starts at `PENDING` through a column default and only backend flows move it afterwards. An external reference code is chosen by the client once, at creation, and must never change. Before these flags, the only tools were to delete the control from the generated form (which leaves its validator behind and keeps the form invalid) or to hand-write a guard in each handler.

Hiding a field in the UI is not a protection either. A DTO in this backend is a compile-time type with no runtime effect, so a property left out of the create DTO still reaches the repository if a client posts it. The contract has to be enforced where the payload enters, not only drawn on the screen.

Aurora makes the intent a declaration on the property. The generator emits the contract for every surface from it, and the runtime write pipeline rejects what the contract does not allow.

## The three writability states

| State | Who supplies the value | Declared as |
| --- | --- | --- |
| Normal | The client, on create and on every update | no flag |
| `createOnly` | The client, only at creation. Frozen afterwards | `createOnly: true` |
| `readOnly` | Never the client: a column default, a database trigger, or an internal backend flow | `readOnly: true` |

`readOnly` and `createOnly` are mutually exclusive on one property. Declaring both makes `catalyst generate` fail before it writes anything.

An auto-increment column such as `rowId` is database-assigned, so the generator also marks it `readOnly` in the field schema. A write payload that carries it is rejected.

## How it works

One declaration, three layers.

**The form.** A `readOnly` property gets no control, no model entry and no validator, so nothing can leave the form invalid for a value the user cannot type. A `createOnly` property is a normal control in `new` mode. In `edit` mode it is rendered disabled and left out of the saved payload.

**The API contracts.** A `readOnly` property is absent from the create and update inputs (GraphQL input types and REST DTOs). A `createOnly` property is present on create and absent from the update inputs. The read side is untouched: output types, list columns and fragments carry both kinds as usual, and neither flag masks the value (masking is what `secret`, `password` and `encrypted` do).

**The runtime write pipeline.** The generated field schema carries the flag, and `sanitizeRecord` (reached through `@ApplySchema` and `@Sanitize`) rejects a payload that names the key:

- `readOnly`: rejected on every operation.
- `createOnly`: rejected only on `update`; accepted on `create`.

The rejection is an HTTP `400` that names the field, for example `positions[1].code`, and it runs before the value is validated, so a bad value on a locked field reports the lock, not a type error. A key absent from the payload is never touched, which is what lets a create omit a `readOnly` field and let the database default apply. An explicit `null` counts as present and is rejected.

The decorators need to know which write they guard. That is the mandatory `operation: 'create' | 'update'` option, described in [Field-schema decorators](../../../guides/backend/apply-field-schema-decorators/).

### Why reject instead of dropping the key

GraphQL already refuses an unknown input field, so a locked property cannot even be sent there. If REST silently dropped it, REST would stay permissive while GraphQL stayed strict, and the client would believe a write succeeded. Rejecting with a `400` makes both transports say the same thing.

### What the backend can still write

The boundary is the handler, not the aggregate. A write the backend performs through a generated service never crosses `@ApplySchema` or `@Sanitize`, so lifecycle code can still set a `readOnly` field, for example a `provision` handler moving `status` forward. Do not decorate a service to make it "consistent": every internal cascade write would then fail with the same `400` a client gets.

For that internal write the generator emits payload types in `<bc>-<module>.payload-types.ts` (only for aggregates with `readOnly` properties). They are the public input plus the `readOnly` properties as optional members, so the service can write them in a single operation while the public contract never advertises them.

## When it applies

- A value computed by the database or by a backend flow: a status, a counter, a denormalized snapshot such as `dTenants` on an account.
- An identifier the client picks when the record is created, such as the parent of a child record, and that never moves.
- A form that shows a field the user cannot edit: declare `readOnly`, do not delete the generated control.

## Trade-offs and limits

- **`createOnly` is unconditional.** The value is frozen from the moment the record exists, with no state check. "Immutable once the record is ACTIVE" is hand-written logic in a handler, not a flag.
- **A purely visual lock is not a flag.** A control that looks inactive while the API still accepts the value is a `widget` concern. `createOnly` changes the wire contract: the key disappears from the update input.
- **Some combinations fail at generation, by design.** `createOnly` is refused on a primary key, an `autoIncrement` property, an `isI18n` property and a navigation relationship (a many-to-one foreign key is allowed: the client picks the parent once). `readOnly` with `isI18n` is refused under the embedded strategy and accepted under `i18nStrategy: table`. Every error names the file and the property.
- **`createOnly` needs `upsert` excluded.** The generated `upsert` takes the update input, which no longer carries the field. List `upsert` in `excludedOperations` or drop the flag. See [Exclude CLI-generated APIs from a module](../../../guides/backend/exclude-generated-apis/).
- **A hand-written write handler picks its own `operation`.** A handler that drives a generated service outside the generator's wiring, such as one over `updateAndIncrement`, must pass `operation: 'update'` itself on an aggregate with `createOnly` properties. Omitting it does not compile.
- **`readonly` is a deprecated alias.** The loader still accepts it, normalizes it to `readOnly` and warns once per property. Declaring both spellings on one property is an error.
- **Three older hand-written guards stay.** `iam/account`, `hub/app` and the `tools` custom-field definitions freeze fields by hand with their own error codes. `createOnly` is the mechanism for new fields; those guards are not migrated.

## Related

- [Module YAML keys](../../../reference/module-yaml/) — the exact declarations and their load-time errors.
- [Field-schema decorators](../../../guides/backend/apply-field-schema-decorators/) — `@ApplySchema`, `@Sanitize` and the `operation` option.
- [Configure a frontend module](../../../guides/frontend/configure-a-frontend-module/) — how the generated form treats each state.
- [Backend module scaffolding](../module-scaffolding/) — where the field schema comes from.
