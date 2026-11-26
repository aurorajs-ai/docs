---
title: The board for several developers
description: How the Backlog board of a Catalyst project works when two or more developers share it — one developer per task, a roster, a machine identity, board synchronization on every pass and a graph written only by CI.
---

## Why this exists

A project created with `catalyst new` carries a task board (Backlog.md) and a dispatcher, a process that picks `Queued` tasks and runs them without a person present. With one developer, the board lives in one checkout. With two or three, three things go wrong unless the design prevents them:

- Two dispatchers take the same `Queued` task, because the only lock is a file on each machine.
- One machine's maintenance closes or rewrites a task that belongs to someone else.
- A board change committed on one clone never reaches the others, so a `Done` that should release a dependent task is invisible to them.

The design removes all three with one rule: **every task has one developer, and each machine acts only on its own tasks.**

## How it works

**The roster.** `.backlog/team.yaml` is versioned and shared. It lists the developers of the repository, each with exactly `id`, `name` and `email`. A task's assignee is `@<id>`. Any other key is refused, because the file is committed and a stray `token:` would be a secret in git. A new project starts with `developers: []`.

**The machine identity.** `.backlog/.dispatch/assignee` is local and gitignored. It holds the bare `id` of the developer of this machine, and lives in the main checkout, so a session inside a worktree reads the same file. `pnpm backlog:daemon install --assignee @<id>` writes it. Nothing is inferred from `git config` or from the GitHub login: both change for reasons unrelated to who owns the dispatcher of a checkout. A missing identity, or an id absent from the roster, is a visible error.

**One task, one developer.**

- The dispatcher selects only `Queued` tasks assigned to this machine.
- The maintenance steps that close a merged task, revert a hand-written `Done`, block an orphan `In Progress` or recompute a parent act only on owned tasks.
- The guard that checks dependencies reads the whole board, so a dependency owned by a colleague stays visible. A candidate that waits on an unfinished dependency does not hold the queue: the pass tries the next one.

**Assignee required at two transitions.** A task that enters `Queued` with no assignee, two assignees or an id outside the roster moves to `Blocked` with a comment that names the cause. The interactive Task Gate assigns the task when it sets it `In Progress`, in one edit; if another developer already owns it, the assistant reports the owner and asks before reassigning.

**Board synchronization.** Every pass first commits pending board changes, fetches, rebases `main` onto `origin/main` and pushes, with at most three attempts when the push is rejected. A `Done` from a colleague therefore arrives before the dependency guard reads the board, and the waiting task launches on its own. The pass needs `main` checked out in the main checkout and uses no autostash: a dirty tracked file there stops dispatch visibly until it is cleaned.

**The dependency graph.** One task, labelled `board:graph`, holds the view of open dependencies. Only the GitHub Action `.github/workflows/backlog-graph.yml` writes it, on every push to `main` that touches `.backlog/tasks/**`. A single writer keeps its file free of conflicts between clones. A developer reads the current view with `pnpm backlog:graph`, without `--write`.

**One daemon per repository.** On macOS, one `launchd` agent per repository, labelled `dev.aurora.backlog-dispatch.<repository>`, runs the dispatcher. Two repositories on one machine run two agents with their own lock, slots and logs.

## When it applies

- You add a second developer to a project.
- A task of yours waits on a dependency that belongs to a colleague.
- A task you queued ends in `Blocked` with a comment about its assignee.
- Dispatch stops and reports a dirty main checkout or a rebase conflict.

## Trade-offs and limits

- **If a developer's machine is off**, their merged task does not reach `Done` and a colleague's dependent task keeps waiting. No code path writes a task for its owner; the graph shows the wait and the colleague asks.
- **Latency.** A `Done` takes up to one pass on each side to propagate. A status change triggers a pass at once on the machine where it happens.
- **No branch protection on `main`.** The harness imposes a pull request for code. Board commits, from the dispatchers and from the graph Action, go by direct push, and a rule requiring pull requests would reject all of them. A developer who pushes code to `main` outside the flow owns that risk.
- **No cap across repositories.** The limit of parallel workers is per repository, so several repositories on one machine multiply concurrent workers.
- **A hand edit of a colleague's task** can make the rebase conflict. The pass aborts the rebase, names the paths and selects nothing until a person resolves it.

## Related

- [How-to: Onboard a developer](../../../guides/workflow/onboard-developer/)
- [Reference: Harness](../../../reference/harness/)
