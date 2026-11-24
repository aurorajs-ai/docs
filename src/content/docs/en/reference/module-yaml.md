---
title: Module YAML keys
description: Reference for the keys of a *.module.yaml that decide writability, tenant scope, relationship constraints, form hints and string-list widgets, with the errors generation raises for invalid combinations.
---

This page documents the keys of `blueprint/<bounded-context>/<module>.module.yaml` that change what the generator emits for writability, tenant scope, relationships and form widgets. It is not the whole grammar. For the reasoning behind a key, follow the link in its row.

The file name is always `<module>.module.yaml`, one per module, directly inside a bounded context folder of `blueprint/`. Editors that use [SchemaStore](https://www.schemastore.org/) validate the file against the module JSON schema when its path matches `**/blueprint/*/*.module.yaml`.

## Module keys

| Key | Type | Effect |
| --- | --- | --- |
| `hasOAuth` | boolean | Generated endpoints require an authenticated account. Required by `hasTenant`. |
| `hasTenant` | boolean | Generated reads and writes are scoped to the caller's tenants. See [Tenant scope](../../concepts/backend/tenant-scope/). |
| `hasCustomFields` | boolean | Opts the aggregate into runtime custom fields. See the [custom fields reference](../custom-fields/). |
| `excludedOperations` | list | Operations the generator does not emit. See [Exclude CLI-generated APIs from a module](../../guides/backend/exclude-generated-apis/). |

## Property flags

Declared on an entry of `aggregateProperties`. All of them must be literal booleans: `yes`, `"true"` and any other value make generation fail naming the aggregate, the property and the value found.

| Key | Meaning |
| --- | --- |
| `readOnly` | No client ever writes the property. Absent from every create and update input and from the form. Rejected with `400` if a payload carries it. |
| `createOnly` | The client writes it only at creation. Absent from update inputs, disabled in the `edit` form, rejected with `400` on update. |
| `readonly` | Deprecated alias of `readOnly`. Normalized to `readOnly` with one warning per property. |
| `hasAssistant` | `false` excludes the property from the fields the assistant may fill, on a module with `hasAssistant: true`. See [Enable the assistant on a module](../../guides/frontend/enable-the-assistant-on-a-module/). |

An auto-increment property is treated as `readOnly` in the generated field schema without declaring it.

The reasoning, the runtime behavior and what each flag does on each surface are in [Property writability](../../concepts/backend/property-writability/).

### Generation errors for flag combinations

Each message names the file and the property, and nothing is written.

| Declaration | Why it fails | Remedy |
| --- | --- | --- |
| `readOnly` and `createOnly` on one property | A winner cannot be guessed without changing the contract. | Keep one. |
| `readOnly` and `readonly` on one property | Same. | Keep `readOnly`. |
| `createOnly` on a `type: relationship` property | A many-to-many or navigation property has no scalar entry for the flag to attach to. | Drop the flag. A many-to-one foreign key (`type: id` with a `relationship` block) is allowed. |
| `createOnly` on the primary key | The update-by-id handler still reads the key from the payload. | Drop the flag. |
| `createOnly` on an `autoIncrement` property | The property is already `readOnly`, so the flag would do nothing. | Drop the flag. |
| `createOnly` while `upsert` is not excluded in every layer | The generated `upsert` takes the update input, which no longer carries the field. | Add `upsert` to `excludedOperations`, or drop the flag. |
| `createOnly` and `isI18n` | The key stays in the update contract while the field schema rejects it, so every edit would fail. | Drop one. |
| `readOnly` and `isI18n` with `i18nStrategy: embedded` | Same failure shape. It is accepted with `i18nStrategy: table`. | Drop one, or use `table`. |

## Relationship keys

Declared in the `relationship` block of a property.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `avoidConstraint` | boolean | | `true` emits no database foreign key. `false` emits a real foreign key. |
| `onDelete` | action | none | Referential action when the target row is deleted. |
| `onUpdate` | action | none | Referential action when the target key is updated. |
| `traversableInTenantScope` | boolean | `false` | On a `hasTenant` module, lets a tenant-scoped read cross this relation, one hop. See [Scope a module by tenant](../../guides/backend/scope-a-module-by-tenant/). |

`onDelete` and `onUpdate` take one of the YAML spellings below. They have effect only with `avoidConstraint: false`. An action you do not declare leaves a plain foreign key, and the generator never infers one, including for many-to-many pivots. An unknown value stops generation and lists the valid ones.

| YAML | Drizzle |
| --- | --- |
| `cascade` | `cascade` |
| `restrict` | `restrict` |
| `no-action` | `no action` |
| `set-null` | `set null` |
| `set-default` | `set default` |

Adding or changing an action changes the constraint, so it needs a migration. See [Manage schema migrations](../../guides/backend/manage-schema-migrations/#referential-actions-on-a-relationship).

```yaml
relationship:
  type: many-to-one
  aggregateName: ToolsMailbox
  modulePath: tools/mailbox
  key: id
  field: mailbox
  avoidConstraint: false
  onDelete: restrict
```

## Widget keys

Declared in the `widget` block of a property.

| Key | Type | Meaning |
| --- | --- | --- |
| `hint` | `{ text, example? }` | Adds an info tooltip beside the label of a form field. Both values seed the i18n keys `<Field>Hint` and `<Field>Example` once, and the JSON owns them afterwards. A property without `hint` generates the same output as before. |
| `type: dialog-string-list` | | A free-text `string[]` edited in a dialog, opened from a one-line summary. |
| `type: inline-string-list` | | The same list edited in a collapsible panel inside the form. |

Both string-list types are valid only on `type: array` with `arrayOptions.type: varchar`. Any other declaration stops generation and names the property. The procedure for `hint` and the choice between the two list widgets is in [Configure a frontend module](../../guides/frontend/configure-a-frontend-module/).

## Related

- [Property writability](../../concepts/backend/property-writability/) — what `readOnly` and `createOnly` do.
- [Tenant scope](../../concepts/backend/tenant-scope/) — what `hasTenant` and `traversableInTenantScope` do.
- [Custom fields reference](../custom-fields/) — `hasCustomFields` and its generated surface.
