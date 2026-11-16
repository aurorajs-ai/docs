---
title: The in-app user manual
description: How an Aurora application ships an end-user manual written as one Markdown chapter per screen and language, compiled at build time, read inside the application, searched by permission and complemented by guided tours.
---

## Why this exists

A manual that lives in a PDF or a wiki drifts from the application it describes, and the user has to leave the screen to read it. The in-app manual keeps the text in the repository, beside the code of each bounded context, compiles it on every build and shows it in a help panel over the screen the user is on.

It is written for the **end user**, never for a developer. It describes tasks, steps and visible results, with the labels the screen shows, and leaves out field names, permission keys, thresholds and error codes.

## How it works

### Sources

| Source | Path | Content |
| --- | --- | --- |
| Screen chapter | `cliter/<bc>/manual/<lang>/<module>.md` | One chapter per module screen and language. The frontmatter declares the screen `route`. |
| General chapter | `docs/manual/<lang>/*.md` | Behavior shared by every generated list and form, with no route. Listed first, in file-name order. |
| Tour | `cliter/<bc>/manual/<lang>/tours/<chapter>.yaml` | A guided tour of a screen. |
| Video steps | `cliter/<bc>/manual/<lang>/videos/<slug>.yaml` | A script that records a looping example. |
| Guided actions | `cliter/<bc>/actions.yaml` | The buttons the assistant and the command palette offer. One file per bounded context, beside the module YAML. |

A chapter has one H1 and one H2 per user task. The H2 text becomes the section id, so renaming a heading changes the target of links and search results. A chapter's id is `<bc>.<module>` and a section link is `/manual/<chapterId>#<chapterId>.<slug>`. Generic behavior is written once in the general chapters, and screen chapters link to them instead of repeating it.

`catalyst new` ships the general chapters (lists, forms, the assistant), their tours and their videos, in English and Spanish. Installable packages ship their chapters with them, so an installed package appears in the manual without a hand-maintained menu.

### Compile

Every build compiles the chapters, per language, into two derived outputs: one with every section (id, route, permission, title, sanitized HTML, plain text) and one with the reading order. They are build outputs: never edited by hand and never committed. `pnpm manual:compile` runs them, and `pnpm dev` and the backend build run it for you.

- A chapter whose `route` is missing, or that the navigation tree does not contain, fails the compile naming the file. The chapter inherits its permission from the navigation tree, so the manual keeps no second copy.
- The HTML is sanitized once, at compile time.
- The reading order follows the navigation tree: general chapters first, then each bounded context and module in the order the menu shows them.
- Every `active` process of the [process catalog](../../workflow/process-catalog/) must be narrated by exactly one chapter section per language, marked with `<!-- process: <id> -->` on its own line. The compile fails otherwise.
- Links to a chapter or section that does not exist fail the compile.

### Reading it

- The `/manual` page shows the index beside the selected chapter and its table of contents. The index and the chapter scroll independently, and every chapter the user opens is a browser navigation, so back and forward work.
- A help action in the site header opens a help panel over the current screen. It opens on the chapter whose route is the longest one that matches the address (`/iam/account/edit/<id>` opens the `/iam/account` chapter; `/iam/accounting` does not). With no chapter for the screen, it opens with the search box focused. The panel offers the help assistant, described in [Guided actions and assisted forms](../guided-actions/).
- The user menu offers a "User manual" entry. Both entries appear only when the user's index has at least one chapter.
- The manual has no permission of its own. A chapter is listed, shown and searchable only if the user holds the permission of its screen.

### Search

The backend loads the compiled sections at boot and answers a lexical search, with no database table and no migration. It tolerates inflected forms of a word and ignores accents. Results are ordered by relevance and never include a section whose screen the user cannot open. Searches a user submits that return nothing, or whose results receive no click, are recorded with the text, language and time but never the identity of the user. The command palette's incremental searches and the assistant's questions are not recorded.

### Guided tours

A screen can open a short tour of its main elements on the user's first visit. A tour file's name is its chapter's base name, and a tour file without its chapter fails the compile. Each step has a `target`, a `title` and a `text`. In a bounded-context tour, `target` is the full value of a `data-tour` attribute the screen's template already carries. Generated templates carry `header`, `main-action`, `filter` and `table` on lists, and `header` and `save` on forms.

**General tours** explain every list and every form once. They live in `docs/manual/<lang>/tours/`, declare `screen: list` or `screen: form`, and target bare roles (`header`, `help`, `main-action`, `filter`, `table`, `save`), so one tour fits every generated screen of its kind.

A tour runs once per user, on any device: a screen starts the general tour and its own tour together, and a later screen starts only its own. A target missing on screen, for instance hidden by a permission, is skipped. The "Guided tours" section of the help panel lists the tours that apply to the current screen and replays the chosen one from its first step.

### Recorded examples

A task of several steps can carry a `<!-- video: <slug> -->` marker. A script records the video from a steps file, never by hand, and the manual plays it as a silent, looping clip without a player. Recording needs Playwright's Chromium, `ffmpeg` and `psql`.

## When it applies

- You write or update the manual of a bounded context, or review a chapter.
- The help panel opens on the wrong chapter, or a search finds nothing: the route and permission of the chapter decide both.
- You wonder why the build fails after a process was marked `active`: the compile enforces its marker.

## Trade-offs and limits

- It is a lexical search, not a semantic one.
- It is not a PDF: the manual is read in the application, with the session, theme and language of the user.
- The process catalog is not an input of the assistant. The assistant reads the manual.

## Related

- [How-to: Write a manual chapter](../../../guides/frontend/write-a-manual-chapter/)
- [Process catalog](../../workflow/process-catalog/)
- [Guided actions and assisted forms](../guided-actions/)
