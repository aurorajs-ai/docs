---
title: Custom fields
description: How an operator adds typed fields to an entity at runtime, with no schema change — groups, definitions, the generated write path, required rules, encrypted values and form layout.
---

## Why this exists

Some entities need fields whose set changes per installation or per tenant, decided by an operator rather than a developer: the extra attributes of a product, the intake form of a case. Adding a column for each means a YAML edit, a regeneration, a migration and a deploy, every time.

Custom fields move that work to runtime. An administrator defines a typed field in the `tools` screens and it shows up on the entity's form, list and API with no change to the code or the schema. The developer opts an aggregate in once, at design time. Everything after that is data.

If the field set is fixed when you build, add an ordinary YAML property instead. Custom fields cost a satellite table, a validation round trip and a form section that a plain column does not.

## How it works

### The admin side

The `tools` bounded context holds four aggregates:

- **Group.** A visual section and the unit of reuse. A group lists the entity types it applies to (`entityTypes`, a list of aggregate names such as `IamTag`), so one group can serve several entities. A group with no entity types applies to none.
- **Definition.** One typed field inside a group: `TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `SELECT`, `MULTISELECT` or `ENCRYPTED`. Its machine `key` is immutable and globally unique, and so is its `type`: changing the type would leave existing values in a column typed for the old one. The label is translatable and display-only.
- **Option.** The choices behind a `SELECT` or `MULTISELECT` definition.
- **Entity.** The inventory of aggregates that opted in. Each consuming module registers itself at boot, and an administrator can deactivate an entity.

The [reference](../../../reference/custom-fields/) lists the exact fields and types.

### The developer side: `hasCustomFields`

`hasCustomFields: true` on a module's YAML (outside `tools`) makes the generator emit, for that module only:

- a satellite table `<bc>_<module>_custom_field_value` with typed columns and a unique `(parentId, definitionId)`;
- a value repository and a value service;
- a `customFieldValues` relation on the GraphQL type and a `customFieldValues` input on create and update;
- a provider that registers the aggregate in the entity inventory at boot;
- the form, form-embed and list wiring on the frontend.

A module without the flag generates exactly what it did before.

### Writing

The generated `create` and `updateById` accept `customFieldValues: [{ definitionId, value }]` in the same payload as the parent. The parent row and every value row are written in one transaction, so a rejection leaves neither.

One validator guards both this path and the cross-context port. It fails closed: a definition that is unknown, deleted or not associated with the entity is rejected, and each value is routed to the column of its type. A `NUMBER` is rounded to the definition's `scale`, and a `SELECT` or `MULTISELECT` value must be one of the definition's own active options.

On update, each submitted value is an upsert for that definition, and a submitted `null` (or `[]`) deletes it. A definition left out of the payload keeps its stored value.

`createBatch` and `upsert` carry the same input type but reject any item with a non-empty `customFieldValues` with a `400`. They never drop it silently.

### Required fields judge the resulting state

`create` rejects a payload that omits a required definition. `updateById` evaluates the state the record would end in, persisted values merged with submitted ones, even when the update sends no `customFieldValues` at all. The consequence is visible to operators: once a new required definition applies to an entity type, every existing record of that type is blocked from update until a value is submitted for it.

### Reading and filtering

`customFieldValues` is an ordinary relation. It loads when the query's `relations` asks for it, and a filter on a value is a predicate nested under it, which compiles to an `EXISTS`, including the paginated count. The generated list adds a column per active definition, applies a column filter where the definition allows it, and includes searchable text and select definitions in the general search. Sorting by a custom field is not supported.

### Encrypted values

An `ENCRYPTED` value is stored as ciphertext in its own column and never returned by any API read. It is masked on every read, rejected in `where`, `order` and `aggregation`, and never offered as a list column. On the form it is a write-only password input that starts empty: leaving it empty on edit keeps the stored value, and there is no way to clear it from the form. Server code that needs the plaintext reads the ciphertext through the value store and decrypts it at the point of use with `Crypt.decryptWithAuroraPrivateKey`. There is no decrypting read API.

### Layout

The administrator also decides how the fields are laid out, with no code:

- **Order.** Groups, and the definitions inside each group, follow `sort` ascending. A missing `sort` goes last and ties break by `rowId`.
- **Placement.** A group with `isTab: false` is a section below the static fields. In a form without YAML tabs, a group with `isTab: true` gets its own tab, and the first tab then holds the static fields and every non-tab group. With YAML tabs, group tabs come after them and non-tab groups sit in the first YAML tab. In a dialog or a form-embed, every group is a section, because there are no tabs.
- **Look.** A group's `icon` is an image URL shown beside its label. `headerClasses` and a definition's `classes` merge Tailwind utility classes over the defaults, and the administrator's class wins only where it conflicts. A group in a tab with an invalid field shows an error mark on the tab.

Tailwind emits only the classes it finds in the source, so the frontend ships a safelist: `col-span-1` to `col-span-12` at the base, `md:` and `lg:` breakpoints, and the margin and padding scale. A class outside that list is not guaranteed to exist.

### From another bounded context

A handler in another bounded context that must fill or read an item's custom fields, for example a locator set after OCR, injects the value store port (`TOOLS_CUSTOM_FIELD_VALUE_STORE`). It names fields by `key`, writes inside the caller's own transaction when given one, and shares the same validator as the form path. It never touches the satellite table directly.

## When it applies

- An operator asks for a new attribute on an entity and you do not want a release for each one.
- You see `customFieldValues` in a GraphQL type, a `<bc>_<module>_custom_field_value` table or an extra section in a form.
- An update fails because a required custom field has no value.

## Trade-offs and limits

- **Register before you associate.** A group can only be associated with entities that have registered, which happens when the backend boots with the regenerated module.
- **The catalog is permissioned.** The form reads definitions through the `tools` API, so a role needs the `get` permissions of custom-field-group, custom-field-definition and custom-field-option. Permissions are not assigned automatically.
- **One item per write.** The programmatic path has no bulk operation.
- **A new required definition blocks existing records.** That is accepted behavior. Warn whoever creates it.
- **Cross-context code never decrypts through an API.** It decrypts the ciphertext itself, where it needs it.

## Related

- [Add custom fields to a module](../../../guides/backend/add-custom-fields-to-a-module/) — the recipe.
- [Custom fields reference](../../../reference/custom-fields/) — fields, types, value columns and the input shape.
- [Property writability](../property-writability/) — why a definition's `type` is create-only.
- [Translated fields through relations](../translated-fields-through-relations/) — the i18n side of related records.
