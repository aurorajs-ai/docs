---
title: Translated fields through relations
description: How a module that points at a table-i18n aggregate shows, searches and sorts by the related record's translated fields in the request language, with no extra YAML.
---

## Why this exists

An aggregate declared with `i18nStrategy: table` keeps its translated fields in a companion table (`common_country` and `common_country_i18n`). Its own read path knows how to pick the right translation. Another module that loads it as a relation used to get those fields back as `null`: the relation loaded the row, and nothing told it to load the translation.

The visible symptom was a list column showing `country.iso3166Alpha2` instead of the country name, because the name was the one field that did not arrive. This page describes the mechanism that fixes it for every module, without any new declaration.

The embedded strategy never had this problem. Its per-locale map is a column of the row, so it travels with the row wherever the row goes.

## How it works

The consumer's YAML already says what loads (the relation), and the target's YAML already says that it is `table`-i18n and which fields are translated. The generator combines the two.

### Showing the translation

A relation is covered when it is many-to-one, or one-to-one with an owned foreign key column, and its target declares `i18nStrategy: table` with at least one `isI18n` field. For each covered relation, the generated `find`, `find-by-id`, `get` and `paginate` handlers:

- load the language-filtered companion row under the relation, only when the client already asked for that relation. A relation the client did not request is never loaded because of this;
- flatten the companion row onto the related record, so the client reads `country.name`. The companion key itself does not appear in the response;
- do it before output formatting, so the target's field schema formats and masks the translated fields as usual.

The language is the `Content-Language` header of the request, and `APP_FALLBACK_LANG` when it is absent. `Content-Language: *` loads every translation row. The resolvers and controllers of the consumer forward the header to the handler, so a module gains that parameter as soon as it has a covered relation. A related record that is `null` stays `null`.

### Searching and sorting

Both use the translation of the request language, the same rule as the aggregate's own translated fields.

- **Search.** Put the predicate under the relation key: `where: { country: { name: { iLike: '%Germ%' } } }`. It filters the parent rows. It does not need the relation to be requested and does not load it. With `Content-Language: *` it matches against any translation.
- **Sort.** Use the dot path: `order: [{ field: 'country.name', dir: 'asc' }]`. Rows follow the translation the response shows, a row with no translation sorts as null, and no parent row is duplicated. Because it sorts by what the response shows, the relation must be requested. Without it the request fails with an error that names the order field.

The same two operations work on the aggregate's own translated fields. They are available on `find`, `get` and `paginate`. A sort by a translated field under `Content-Language: *` fails with an error that names the field, instead of returning an arbitrary order.

Translated fields of a masked type are left out: a filter on one is rejected by the masked-property guard like any other masked field.

## When it applies

- A list or detail shows a name that lives in a translated table, such as the country of an area or of a legal entity.
- A filter box has to match the related record's translated name in the language the user is working in.
- A column over a related translated field has to sort.

## Trade-offs and limits

- **One hop, one related record.** To-many relations, an inverse one-to-one relation with no foreign key on this side, and relations more than one hop deep are not covered.
- **Only when requested.** The translation arrives only for a relation the client asked for. Search is the exception: it filters without loading.
- **Sort needs the relation.** Sorting by a related translated field without requesting the relation fails loudly rather than returning a silent order.
- **No `*` for sort.** A sort has no single displayed translation under `Content-Language: *`.
- **Cross-context relations stay declarative.** The generated code adds no import from the other bounded context. It relies on the persistence relations the project already declares.
- **Write handlers are unchanged.** Writes of a translated aggregate still resolve their language from `Content-Language`, never from the payload.

## Related

- [Module scaffolding](../module-scaffolding/) — how a module's generated read path is laid out.
- [QueryStatement reference](../../../reference/query-statement/) — `where`, `order` and `relations` in detail.
- [Tenant scope](../tenant-scope/) — a tenant-scoped module must declare a relation traversable before a query can follow it.
