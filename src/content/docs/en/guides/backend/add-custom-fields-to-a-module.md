---
title: Add custom fields to a module
description: Opt a module into runtime custom fields with hasCustomFields, generate the write path and the form wiring, migrate, and define the first group and field.
---

## Goal

Let an administrator add typed fields to an entity from the `tools` screens, with no further code or schema change, and see them in that entity's form, list and API.

## Before you start

- The `tools` bounded context is installed in the project. `catalyst add tools` (or `catalyst add identity`) also binds the frontend catalog adapter the generated form needs.
- The module is a normal aggregate with its own `blueprint/<bounded-context>/<module>.module.yaml`. A many-to-many pivot module cannot opt in.
- You know the [concept](../../../concepts/backend/custom-fields/), including what a required field does to existing records.

## Steps

1. **Opt the module in.** Add `hasCustomFields: true` at the top of the module YAML.

   ```yaml
   boundedContextName: library
   moduleName: book
   hasCustomFields: true
   ```

2. **Regenerate the backend and the frontend.**

   ```bash
   catalyst generate back module --name=library/book --force
   catalyst generate front module --name=library/book --force
   ```

   The backend gains the value table, repository, service, input type and boot registration. The frontend form, form-embed and list gain the custom-field section, columns and filters.

3. **Create and apply the migration** for the new satellite table. See [Manage schema migrations](../manage-schema-migrations/).

   ```bash
   pnpm db:generate --name add-library-book-custom-fields
   pnpm db:migrate
   ```

4. **Restart the backend.** At boot the module registers its aggregate in the entity inventory. Until then no group can be associated with it.

5. **Grant the catalog permissions.** A role that uses the entity's form needs `tools.customFieldGroup.get`, `tools.customFieldDefinition.get` and `tools.customFieldOption.get`. Roles are assigned in the IAM screens; nothing assigns them for you.

6. **Define a group and a field.** In the `tools` screens, create a group and select your entity under its associated entities. Then create a definition inside it: a `key`, a `type`, and whether it is required, searchable or filterable. Pick the type with care, because it cannot be changed afterwards. For a `SELECT` or `MULTISELECT`, add the options.

7. **Use it from the API.** Send the values in the same payload as the record, identified by definition id.

   ```graphql
   mutation {
     libraryCreateBook(payload: {
       id: "<book-uuid>"
       title: "Dune"
       customFieldValues: [{ definitionId: "<definition-uuid>", value: "Hardcover" }]
     }) { id }
   }
   ```

   To read them back, ask for the relation: `relations: { customFieldValues: true }`.

## Verify it worked

- The entity's form shows the new group, as a section or a tab depending on its `isTab` flag, and the list offers a column for each active definition.
- Creating a record with a value for a required definition succeeds, and omitting it returns a `400`.
- Filtering the list by a custom-field column narrows the rows to the matching ones.
- A value for an `ENCRYPTED` definition is accepted on write and never appears in a read.

## Troubleshooting

**The entity is not offered when you edit a group.** The backend has not booted with the regenerated module, or an administrator deactivated the entity. Restart, then check the entity's active flag in the `tools` screens.

**The form shows no custom-field section.** Check that the role has the three `get` permissions and that the group lists this entity. A group with no associated entity appears nowhere.

**Every update of an existing record returns `400`.** A required definition now applies to the entity and these records have no value for it. Submit one, or make the definition optional.

**`createBatch` or `upsert` returns `400` for an item with `customFieldValues`.** The two bulk operations reject values by design. Use the single `create` or `updateById`.

**Layout classes you set on a field do nothing.** Tailwind builds only the safelisted classes: `col-span-1` to `col-span-12` with `md:` and `lg:`, and the margin and padding scale. See the [reference](../../../reference/custom-fields/#layout-classes).

## Related

- [Custom fields](../../../concepts/backend/custom-fields/) — the model and the rules behind each step.
- [Custom fields reference](../../../reference/custom-fields/) — definition types, value columns and layout fields.
- [Manage schema migrations](../manage-schema-migrations/) — generate and apply the table migration.
