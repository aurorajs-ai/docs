---
title: Maintain the process catalog
description: Bootstrap the process catalog of a bounded context, add or change a process, mark it in the manual and validate the result with the commands and scripts the project ships.
---

## Goal

Keep `blueprint/<bc>/processes.yaml` true to what the bounded context lets a user do, and keep the manual narrating every active process.

## Before you start

- You know what a process is and how it differs from a rule and from a manual chapter. Read [Process catalog](../../../concepts/workflow/process-catalog/) first.
- The screens a process crosses exist in the navigation tree of the bounded context.
- The business rules a process cites exist in the rules index. A process never cites a derogated rule.

## Steps

1. **Bootstrap a bounded context that has no catalog.** In Claude Code, run `/processes:document <bc>`. It reads the navigation tree, the manual chapters, the PRDs of the dossier, `CONTEXT.md` and the business rules, drafts the catalog and migrates the flow prose of `CONTEXT.md`. One run per bounded context, one pull request per bounded context.

2. **Add or change a process by hand.** Edit `blueprint/<bc>/processes.yaml`:

   ```yaml
   processes:
     - id: grant-access
       goal: Una persona entra en la aplicación y solo ve lo que su rol permite.
       steps:
         - { screen: iam.role, optional: true }
         - { screen: iam.account }
       rules: [BR-IAM-ROLE-004]
       status: planned
   ```

   Use a kebab-case English `id`, a one-sentence Spanish `goal`, ordered steps over `<bc>.<module>` screens, and only the rule ids that limit the path. Put a condition or a branch in a rule, never in a step.

3. **Flip a process to `active` when it ships.** In the pull request that ships it, change `status` to `active` and add the marker to the manual, in the same change:

   ```markdown
   ## Grant access to a person

   <!-- process: grant-access -->
   ```

   The marker goes on the H2 of the chapter of the process's first mandatory step, in every language the bounded context documents. See [Write a manual chapter](../../frontend/write-a-manual-chapter/).

4. **Retire a process instead of deleting it.** Set `status: retired` and keep the entry so its id is never reused. A retired process must have no marker in the manual.

5. **Validate.** From the project root:

   ```bash
   pnpm processes:validate
   pnpm manual:compile
   ```

6. **Check a change against the catalog.** In Claude Code, `/processes:check` validates the working tree, `/processes:check --branch <name>` a branch against `main`, and `/processes:check --pr <number>` a pull request. It reports `sin cambios` or the ids it updated.

## Verify it worked

- `pnpm processes:validate` and `pnpm manual:compile` both pass.
- Every `active` process has exactly one marker per language of its bounded context.
- A bounded context with active processes and no manual folder only produces a warning, which lists those processes.

## Troubleshooting

- **A screen is reported as unknown.** An `active` process may only use screens that exist as `/<bc>/<module>` in the navigation tree. Fix the name or the navigation entry, or keep the process `planned`.
- **A rule id is reported as unknown or derogated.** The id must exist in the business-rules index, and an `active` process may not cite a derogated rule.
- **The compile reports a missing or stray marker.** Every `active` process needs one marker per language, and a marker may name only an `active` process of the catalog.
- **A key is rejected.** The schema allows only `id`, `goal`, `steps`, `rules` and `status`, and `screen` and `optional` on a step.

## Related

- [Concept: Process catalog](../../../concepts/workflow/process-catalog/)
- [How-to: Maintain the business-rules catalog](../maintain-business-rules/)
