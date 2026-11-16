---
title: Publish a screen context to the assistant
description: "Let the help assistant answer about the record open on a hand-written screen: contribute sections with pure builders, stay inside the limits and check what is sent."
---

## Goal

Make a hand-written screen tell the help assistant what it shows (state, issues, actions, facts and warned rows), so the assistant can answer questions about the open record.

## Before you start

- A hand-written screen made of one or more components. Generated screens do not publish a context.
- An application with the `tools` package, the assistant switched on and a role that can ask. See [Access and cost](../../../concepts/frontend/guided-actions/#access-and-cost).
- The screen id, `<bc>.<module>` in lowercase (for example `iam.account`), and a clear owner for each section: only one component can contribute a given section.

## Steps

1. **Write pure builders.** Put the logic that turns the screen's data into a section in a plain function that receives a `translate` function, so you can test it without Angular. Read the same sources the template renders from and reuse the functions that build the template's texts, so the context never says more or less than the screen.

   ```ts
   export function accountScreenStatus(account: Account | null): ScreenStatus | null {
     return account ? { label: account.state } : null;
   }
   ```

   Return `null` while the data is not loaded yet.

2. **Contribute from the injection context.** In the constructor (or a field initializer) of each component, inject `ScreenContextService` and call `contribute` with the sections that component owns. Readers are functions, evaluated when the question is sent:

   ```ts
   private readonly screenContext = inject(ScreenContextService);

   constructor() {
     this.screenContext.contribute('iam.account', {
       status: () => accountScreenStatus(this.account()),
       issues: () => accountScreenIssues(this.account(), this.translate),
     });
   }
   ```

   If the data lives in two components (a detail and its child form), each one calls `contribute` with its own sections. The contributions are withdrawn when the components are destroyed; you write no cleanup.

3. **Describe actions with named conditions.** For `actions`, return every button the screen can show, each with `available` and, when it is not available, its `missingConditions` as translated text. Decide availability once, in one function that the toolbar and the context both read; two functions that decide the same thing drift apart.

4. **Stay inside the limits.** For tables, send the total `count` and only the rows that have warnings. The limits (`TOOLS_ASSISTANT_SCREEN_LIMITS` in the backend) reject and never truncate, so a screen that exceeds one fails the question with an error naming the section.

5. **Publish only what the screen shows.** Leave out data that is not on screen, and free text that comes from external documents unless a label really needs it.

### Worked example

The purchase invoice review screen of the `business-partner-portal` bounded context does exactly this, with the screen id `business-partner-portal.purchase-invoice-header`. The detail component contributes `status`, `issues` and `actions`, because the invoice and the mode live there. The child form contributes `facts` and `rows` (totals, dates, and the lines and tax rows that carry warnings), because it owns the preview. The builders are pure functions in one `purchase-invoice-review-context.derive.ts` file and are tested without rendering the screen.

## Verify it worked

- In a unit test, call your builders with a record and check the section they return, including the `null` case and the missing conditions of an unavailable action.
- In a test of the registry, inject `ScreenContextService`, contribute, and check that `snapshot()` returns `{ screenId, ...sections }`.
- Open the screen and ask the assistant something only the screen can answer, such as why an action is not shown. The answer names the missing condition and cites no manual section.

## Troubleshooting

- **`contribute` throws that the section is already contributed.** Two components claim the same section. Decide which one owns it and remove the other.
- **`contribute` throws about another screen id.** A screen with a different id is still registered. Check that every component of this screen uses the same id.
- **The question is refused naming a section.** The screen exceeds a limit. Reduce what the reader returns (warned rows only, shorter texts); do not expect truncation.
- **The assistant ignores the screen.** The screen sent nothing: the readers returned `null`, or no component contributed. Check that the contribution runs in an injection context.

## Related

- [Concept: Screen context for the assistant](../../../concepts/frontend/screen-context/)
- [How-to: Enable the assistant on a module](../enable-the-assistant-on-a-module/) — the form side of the assistant, for creation forms.
- [Concept: Guided actions and assisted forms](../../../concepts/frontend/guided-actions/)
