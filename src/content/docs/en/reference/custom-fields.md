---
title: Custom fields reference
description: The hasCustomFields flag, the customFieldValues input, the definition types and their value columns, the fields of groups, definitions and options, and the layout classes an administrator can rely on.
---

For what custom fields are and why they work this way, see [Custom fields](../../concepts/backend/custom-fields/). For the steps, see [Add custom fields to a module](../../guides/backend/add-custom-fields-to-a-module/).

## Module flag

```yaml
# blueprint/<bounded-context>/<module>.module.yaml
hasCustomFields: true
```

- `hasCustomFields` (boolean, optional, default `false`): opts the aggregate into custom fields. A module without it generates nothing for them. A many-to-many pivot module never opts in. The flag is not used on `tools` itself.

## Generated surface

| Piece | Name |
| --- | --- |
| Satellite table | `<bc>_<module>_custom_field_value`, with a unique `(parentId, definitionId)` |
| GraphQL relation | `customFieldValues` on the aggregate type (`[<Aggregate>CustomFieldValue]`, nullable) |
| GraphQL input | `<Bc><Module>CustomFieldValueInput`, used by `create` and `updateById` |
| Entity registration | `entityType` is the aggregate name (for example `LibraryBook`), registered at boot |

## The `customFieldValues` input

`create` and `updateById` accept an optional list in the same payload as the record.

- `definitionId` (id, required): the definition the value belongs to.
- `value` (JSON, required): the value, in the shape of the definition type below. A `null` (or `[]`) on update deletes the stored value.

`createBatch` and `upsert` accept the same type and reject any item whose list is not empty with `400` and `tools.error.customFieldValueBulkNotAllowed`.

## Definition types

A definition's `type` is fixed at creation. Each type is stored in its own typed column of the satellite table.

| Type | Value column | Value you send | Notes |
| --- | --- | --- | --- |
| `TEXT` | `value_text` | string | Can be searchable. |
| `NUMBER` | `value_number` | number | Rounded to the definition's `scale` before it is stored. |
| `DATE` | `value_date` | date string | Date only. A JavaScript `Date` object is a `400`. |
| `BOOLEAN` | `value_boolean` | boolean | |
| `SELECT` | `value_option_id` | option id | Must be an active option of the same definition. Can be searchable. |
| `MULTISELECT` | `value_option_ids` | list of option ids | Same rule for every id. Filters use `contains` and `overlap`. |
| `ENCRYPTED` | `value_encrypted` | string | Stored as ciphertext. Never returned, never queryable, never a list column. |

A type outside this set is rejected by the enum validation of the definition.

## Admin aggregates

### Group (`tools/custom-field-group`)

- `code` (string, 64, required, unique): machine identifier. Editable, because everything references the group by id.
- `label` (translatable string, 128, optional): the section title.
- `entityTypes` (list of strings, optional): aggregate names the group applies to. Empty or missing means none.
- `sort` (small integer, optional): order among groups, ascending, missing last, ties by `rowId`.
- `icon` (string, 2046, optional): URL of an image shown beside the label or the tab trigger.
- `isTab` (boolean, default `false`): render the group as its own tab. Dialogs and form-embeds always render a section.
- `headerClasses` (string, 510, optional): utility classes merged over the default header of a section. Ignored for a tab.

### Definition (`tools/custom-field-definition`)

- `key` (string, 64, required, unique): machine identifier. Immutable.
- `groupId` (id, required): the group it belongs to. Every definition belongs to exactly one group.
- `label` (translatable string, 128, optional): the field label.
- `type` (enum, required, create-only): see the table above.
- `scale` (small integer, optional): decimal digits for `NUMBER`. `null` for every other type.
- `required` (boolean, default `false`): judged on the resulting state of the record.
- `searchable` (boolean, default `false`): include in the general search. Meaningful for `TEXT`, `SELECT` and `MULTISELECT`.
- `filterable` (boolean, default `false`): offer a per-column filter on the list.
- `sort` (small integer, optional): order inside the group, same rule as the group's.
- `classes` (string, 510, optional): utility classes merged over the default width classes of the type.

### Option (`tools/custom-field-option`)

- `definitionId` (id, required): the `SELECT` or `MULTISELECT` definition it belongs to.
- `code` (string, 64, required): unique within the definition. Immutable.
- `label` (translatable string, 128, optional): the option text.

## Layout classes

`classes` and `headerClasses` are merged over the defaults, and the administrator's class wins only where it conflicts. `md:col-span-4` replaces the default `md:` width and keeps `col-span-12`. A missing or empty value leaves the defaults unchanged.

Tailwind builds only the classes it finds in the source, so the frontend declares a safelist in `frontend/src/styles.css`:

| Guaranteed to exist | Pattern |
| --- | --- |
| Column span | `col-span-1` to `col-span-12`, plain and with the `md:` and `lg:` prefixes |
| Margin and padding | `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml`, `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`, no breakpoint prefix, each with the steps `0`, `px`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `3.5`, `4` to `12`, `14`, `16`, `20`, `24`, `28`, `32`, `36`, `40`, `44`, `48`, `52`, `56`, `60`, `64`, `72`, `80` and `96` |

A class outside the list is not guaranteed to be in the build. The YAML `widget.span` does not use this safelist: the generator resolves it at generation time.

## Errors

| Situation | Response |
| --- | --- |
| Required definition has no value on create, or in the resulting state on update | `400` under the `tools.error.customFieldValue*` keys |
| Definition unknown, deleted or not associated with the entity | rejected by the validator |
| Bulk operation with values | `400`, `tools.error.customFieldValueBulkNotAllowed` |
| Programmatic write with an unknown or unassociated `key` | `404`, `tools.error.customFieldDefinitionKeyNotFound` or `tools.error.customFieldDefinitionNotAssociated` |

## Related

- [Custom fields](../../concepts/backend/custom-fields/) — the model and the rules.
- [Add custom fields to a module](../../guides/backend/add-custom-fields-to-a-module/) — the recipe.
- [Module YAML keys](../module-yaml/) — the other module and property keys.
