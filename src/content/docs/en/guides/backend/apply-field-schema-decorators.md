---
title: Field-schema decorators
description: Wire @ApplySchema, @Format, or @Sanitize on a handler's main() so payloads get validated and return values get formatted automatically.
---

## Goal

Pick the correct field-schema decorator for the handler you just scaffolded, wire it on `main()`, and let it handle validation, sanitation, and output masking — instead of duplicating those checks by hand.

## Before you start

- You have a backend module scaffolded and its `*.field-schema.ts` file exists on disk. The CLI generated it from the module's YAML `aggregateProperties`; do not hand-edit it.
- You know which role the handler plays: does it receive a payload? does it return the entity?
- `@aurorajs.dev/core-back` is installed — it ships with every Catalyst backend.

## Steps

1. **Pick the decorator using this decision tree.**

   ```
   Does the handler RECEIVE a payload?
     ├── No  → @Format(schema)
     └── Yes → Does it RETURN the entity?
                ├── Yes → @ApplySchema({ schema, operation })
                └── No  → @Sanitize({ schema, operation })
   ```

   `@ApplySchema` composes sanitize (input) + format (output). `@Format` only formats the return (reads are idempotent). `@Sanitize` only sanitizes the payload (write-only flows whose return is `void`, a boolean, or a summary type).

   **`@ApplySchema` and `@Sanitize` take an object, and `operation` is mandatory.** It is `'create'` or `'update'`, and it tells the sanitizer which write the handler performs. A call that omits it does not compile; there is no default. The generator emits `'create'` for `create` and `createBatch`, and `'update'` for `updateById`, `update` and `upsert`. `@Format` takes no `operation`: the read direction has no write operations. The operation matters on aggregates with writable-once or never-writable properties, because the sanitizer rejects the payload key with a `400` rather than dropping it silently. See [Property writability](../../../concepts/backend/property-writability/).

   **`@Sanitize` is rarely written on its own.** The CLI never emits it: every write handler it generates returns the entity, so it gets `@ApplySchema`. And `@ApplySchema` composes it internally — `applyDecorators(Format(schema), Sanitize({ schema, payloadIndex, operation }))` — so sanitation already runs there. Wire a bare `@Sanitize` only on a hand-written write handler whose return value is not the entity. When you read `@Sanitize` in a code comment or a test name, it refers to that inner branch of `@ApplySchema`, not to a separately written decorator.

2. **Wire `@ApplySchema` on a write handler that returns the entity.** Real example from `iam/tag`:

   ```typescript
   import { ApplySchema, EmitEvent } from '@aurorajs.dev/core-back';
   import { IamTagFieldSchema } from '@app/iam/tag/domain/index.js';

   @EmitEvent('iam.tag.created')
   @ApplySchema({ schema: IamTagFieldSchema, operation: 'create' })
   async main(payload: IamCreateTagInput, handlerMeta?: HandlerMeta): Promise<IamTag> {
     await this.createService.main(payload, handlerMeta);
     return await this.findByIdService.main(payload.id, {}, handlerMeta);
   }
   ```

   `sanitize` runs on `payload` BEFORE `main()` — on `iam/user`, for example, that is where `type: 'password'` turns plaintext into a bcrypt hash. `format` runs on the return AFTER `main()` — that is where `password` becomes `undefined` on the way out.

3. **Wire `@Format` on a read handler.**

   ```typescript
   import { Format } from '@aurorajs.dev/core-back';

   @Format(IamTagFieldSchema)
   async main(id: string, constraint?: QueryStatement, handlerMeta?: HandlerMeta): Promise<IamTag> {
     const tag = await this.findByIdService.main(id, constraint, handlerMeta);
     if (!tag) throw new NotFoundException(`IamTag with id: ${id}, not found`);
     return tag;
   }
   ```

   `@Format` detects the return shape automatically — single object, array, or `Pagination` with a `.rows` list — and formats each element.

4. **If the payload is not the first argument, use the object form.**

   ```typescript
   @ApplySchema({ schema: IamTagFieldSchema, payloadIndex: 1, operation: 'update' })
   async main(constraint, payload, handlerMeta?) { … }
   ```

   Same option on `@Sanitize`. `@Format` has no `payloadIndex` — it always operates on the return value.

5. **On update handlers, compute the delta with `Obj.diffAtomic`.** After sanitation, persist only what changed. Real usage from `iam-update-tag-by-id.handler.ts`:

   ```typescript
   import { Obj } from '@aurorajs.dev/core-back';

   const tag = await this.findByIdService.main(payload.id, constraint, handlerMeta);
   if (!tag) throw new NotFoundException(`IamTag with id: ${payload.id}, not found`);

   const dataToUpdate = Obj.diffAtomic(payload, tag);

   await this.updateByIdService.main(
     { ...dataToUpdate, id: payload.id }, // re-add id — the diff omits matching keys
     constraint,
     handlerMeta,
   );
   ```

   `Obj.diffAtomic` omits keys whose values match between both sides, so the `id` must be re-added explicitly as the target key. Use it, not `Obj.diff`: one property is one column, so a changed array or `jsonb` value must be emitted whole. `Obj.diff` would emit only the changed fragment and overwrite the column with it.

6. **Adjust the decorator on a generated `additionalApis` handler.** A mutation handler generated for an `additionalApis` entry arrives with `@ApplySchema({ schema, operation: 'update' })` already in place. The operation is fixed, not inferred from what the handler does, so check it:

   - Change `operation` to `'create'` if the handler only inserts.
   - Add `payloadIndex: N` if the payload is not argument 0.
   - Remove the decorator if the payload is no longer aggregate-shaped. This is required, not cosmetic: a primitive payload arrives mangled, because the pipeline copies it with a spread.
   - A query-type additional API gets no decorator.

7. **Treat `decimal` as a JavaScript number in both directions.** A `decimal` property is a `number` on read and on write, with at most 15 significant digits. `@Format` turns the numeric string the database returns (`"21.00"`) into a number, so a record you read and send back unchanged passes write validation. Validate decimals as numbers only. If a YAML `decimals: [precision, scale]` declares a precision above 15, `catalyst generate` aborts at schema load: lower the precision in the YAML.

## Verify it worked

- For a `type: 'password'` field, create a user and inspect the row: the column stores a bcrypt hash, never plaintext. Read it back — the `password` key is absent from the response payload.
- For `maxLength`, `enumOptions`, or `nullable`, send a payload that violates the constraint. The decorator throws before `main()` executes.
- Timestamps returned by the handler carry the caller's timezone. That confirms `@Format` / `@ApplySchema` extracted `handlerMeta.timezone` — a direct call to `formatRecord()` would not.

## Troubleshooting

**A relation returns a sensitive field unmasked.** `@Format` recurses into every relation declared as a `relation` entry of the field schema, so a nested secret is masked there too. A relation missing from the field schema is not queryable at all, so it never reaches the formatter. See [Compose a QueryStatement](../query-with-querystatement/#loading-relations-safely).

**Validation runs twice** — once by the decorator, once inside `main()`. Remove the in-handler check. `@ApplySchema` already enforced `maxLength`, `nullable`, `enumOptions`, and declared `rules`. Keep only business rules the FieldSchema cannot express (cross-field invariants, domain math).

**You reach for a Value Object to encapsulate validation.** Catalyst has no VO layer — the validation and modification concern is fully delegated to `FieldSchema` + type handlers via `@ApplySchema`. Express the rule in the YAML's `aggregateProperties` and regenerate.

**Direct call to `formatRecord()` or `sanitizeRecord()`.** Avoid it. The decorator wires `handlerMeta.timezone` and other options automatically; a direct call loses that context and produces inconsistent output.

## Related

- [Backend module scaffolding](../../../concepts/backend/module-scaffolding/) — why `*.field-schema.ts` is generated from YAML and never hand-edited.
- [Property writability](../../../concepts/backend/property-writability/) — what `readOnly` and `createOnly` do to the payload the decorator sanitizes.
- [Compose a QueryStatement](../query-with-querystatement/) — the query side of the declarative data-access layer.
