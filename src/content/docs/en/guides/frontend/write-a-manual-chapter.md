---
title: Write a manual chapter
description: Create the manual chapter of a screen, mark its processes, add a screen tour and compile the manual to check it.
---

## Goal

Document one module screen for end users, in one language, so that it appears in the manual index, opens from the help panel and is found by search.

## Before you start

- The screen exists in the navigation tree (`frontend/src/app/domains/admin/apps/<bc>/<bc>.navigation.ts`) and you know its route, for example `/iam/account`.
- You know the real behavior of the screen. Read the module's frontend folder and its i18n labels, and run `pnpm manual:dossier <bc>` to list the evidence per module.
- For the first manual of a bounded context, `/manual:reconcile-prd` aligns the PRD with what was built, and `/manual:write` drafts one chapter per screen. This guide covers the manual steps behind both.

## Steps

1. **Create the chapter file.** One file per screen and language: `cliter/<bc>/manual/<lang>/<module>.md`, with the screen route in the frontmatter.

   ```markdown
   ---
   route: /iam/account
   ---

   # Accounts

   One or two sentences: what the screen is for and who uses it.

   ## Create an account

   1. Press **New account**.
   2. Fill in **Email** and **Username**.
   3. Press **Save**.

   The account appears in the list.
   ```

   Use one H1 and one H2 per user task. Number the steps, one action each, with the label in bold exactly as the screen shows it, and close with the visible result. Write in the language of the folder.

2. **Keep it to what the user sees.** Leave out field names, table or column names, permission keys, environment variables, endpoints, error codes and the thresholds a rule keeps internal. Name a role only when the PRD names it.

3. **Link instead of repeating.** The generic behavior of lists and forms (search, filter, columns, save, cancel, toasts) lives in the general chapters. Link them: `[Lists](/manual/general.02-listados)`. To point at another screen, link its chapter or section: `[accounts](/manual/iam.account)` or `[create an account](/manual/iam.account#iam.account.create-an-account)`.

4. **Mark a process.** If a process of `cliter/<bc>/processes.yaml` starts on this screen, narrate it in one H2 and put the marker on its own line right under the heading:

   ```markdown
   ## Grant access to a person

   <!-- process: grant-access -->

   1. ...
   ```

   When the process crosses several screens, narrate the whole sequence here, in the chapter of its first mandatory step, and link the section of each other screen's chapter. The other chapters carry no marker for it.

5. **Optionally, add a screen tour.** Only for what is specific to this screen. Create `cliter/<bc>/manual/<lang>/tours/<module>.yaml`, named like the chapter file:

   ```yaml
   steps:
     - { target: iam.account.main-action, title: Create an account, text: Press here to add a new account. }
   ```

   Each step has exactly `target`, `title` and `text`. The `target` is the full value of a `data-tour` attribute the screen's template already carries: lists carry `header`, `main-action`, `filter` and `table`, forms carry `header` and `save`, each prefixed with `<bc>.<module>.`. Do not invent targets. Quote a `title` or `text` that contains `: `. If every element of the screen is generic, write no tour file.

6. **Never write a menu path.** The compile adds the "Where to find it" line from the navigation tree, so a sentence such as "Open **Accounts** in the **IAM** menu" would drift from the menu. Declare only what the tree cannot know, with a `nav:` marker on its own line inside the section it belongs to:

   ```markdown
   ## Manage the contacts

   <!-- nav: business-partner-portal.legal-entity.Contacts -->
   ```

   In a chapter with a `route`, the marker appends to the path of the screen (a tab). In a general chapter, it declares the full path, as the shell chapter does for the header controls: `<!-- nav: navigation.ProfileMenu, navigation.LogOut -->`. Each key must carry its scope (`navigation.Help`, not `Help`) and have a text in every language. Use at most one marker per section. Do not use a marker for the menu path of the screen itself or for literal text.

7. **Optionally, mark a recorded example.** After the steps and the result of a task of several steps, add `<!-- video: <slug> -->` on its own line and write the steps file `videos/<slug>.yaml`. Use invented demonstration data only, and see the recording notes in `scripts/manual/README.md` of your project.

8. **Compile.** From the project root:

   ```bash
   pnpm manual:compile
   ```

## Verify it worked

- The compile finishes with no error. It fails, naming the file, on a missing or unknown `route`, a link to a chapter or section that does not exist, a tour file without its chapter, a tour step with a missing or extra key, an `active` process with no marker in a language, a duplicate marker, and a marker for an id that is not an `active` process. It also fails on a `nav:` key with no text in a language, a navigation item on the path of a chapter with no `translation`, and two `nav:` markers in one section.
- Run `pnpm dev`, open the screen and press the help action in the site header: the panel opens on your chapter.
- Read the "Where to find it" line at the start of the chapter, and the line each `nav:` marker prints: the path must be the one the sidebar shows, in the language of the chapter.
- Search for a word from the chapter in the help panel: the section appears. A user without the screen's permission does not see it.

## Troubleshooting

- **`declares route "...", which no navigation item has`.** The `route` must equal a url of the navigation tree. Copy it from the `*.navigation.ts` file.
- **The help panel opens on a different chapter.** The panel picks the chapter whose route is the longest match for the address. Check that no other chapter declares a longer matching route.
- **`Translation key "..." has no "<lang>" text`.** A `nav:` key is missing from `frontend/public/i18n/<scope>/<lang>.json`, or it has no scope. Add the text in every language.
- **A tour step does nothing on screen.** A target missing on screen is skipped at runtime. Check the `data-tour` value in the template, and that a permission is not hiding the element.
- **A warning about a bounded context with active processes and no manual.** It is a warning, not a failure, until the first chapter exists.

## Related

- [Concept: The in-app user manual](../../../concepts/frontend/in-app-user-manual/)
- [Concept: Process catalog](../../../concepts/workflow/process-catalog/)
- [Concept: Guided actions and assisted forms](../../../concepts/frontend/guided-actions/)
