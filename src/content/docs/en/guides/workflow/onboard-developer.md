---
title: Onboard a developer
description: Bring a developer onto a Catalyst project, new or existing — roster entry, SOPS key, local environment, dispatcher daemon and the first task from assignment to pull request.
---

## Goal

Get one developer working on the shared task board: listed in the roster, with a decrypted local environment, a dispatcher daemon of their own and a first task taken to a pull request.

## Before you start

- Read [The board for several developers](../../../concepts/workflow/multi-developer-board/) once. This guide does not repeat why each file exists.
- A macOS machine. The dispatcher daemon is a `launchd` agent.
- Node 26 and `pnpm`.
- The `catalyst` CLI, installed as in [Install Aurora Catalyst CLI](../../../tutorials/getting-started/install-cli/).
- The board CLI, pinned to the version the graph workflow uses, and a GitHub login:

  ```bash
  npm i -g backlog.md@1.57.4
  gh auth login
  ```

  `gh auth login` is the one credential the dispatcher uses for its GitHub calls. The daemon also needs `npx`, `claude`, `openspec` (`pnpm add -g @fission-ai/openspec`) and `catalyst` on the PATH; `pnpm backlog:daemon install` names any binary that is missing and stops. Path B also needs `sops` and `age`.

## Steps

Choose the path that matches your situation, then continue with **Both paths**.

### Path A — a new project

A1. **Create the project.** Follow [Install Aurora Catalyst](../../../tutorials/getting-started/install-aurora/) (`catalyst new my-project`). The command ships the graph workflow and an empty roster, and creates the `board:graph` task after the install. It fails if the `backlog` binary is not installed.

A2. **Add yourself to the roster, create the remote and push.** Replace `developers: []` in `.backlog/team.yaml`:

   ```yaml
   developers:
     - id: ana
       name: Ana Pérez
       email: ana@example.com
   ```

   Each entry has exactly `id`, `name` and `email`; any other key is refused. Then create the GitHub repository and push `main`, including `.backlog/`:

   ```bash
   git add .backlog
   git commit -m "chore(backlog): add the first developer"
   gh repo create my-org/my-project --private --source . --remote origin
   git push -u origin main
   ```

   That first push touches `.backlog/tasks/**`, so it starts the `backlog graph` workflow of the repository. Make sure GitHub Actions is enabled on it.

### Path B — an existing repository

B1. **Clone the repository.**

   ```bash
   git clone git@github.com:my-org/my-project.git
   cd my-project
   ```

B2. **Set up `backend/.keys`.** The folder is gitignored (`backend/.gitignore` ignores `/.keys`), so its files are never committed. It holds three files:

   - `oauth-private.key` and `oauth-public.key`: the OAuth signing pair of the team. Do not generate a new one: a teammate gives you theirs, so every developer has the same pair in development. Put both files in `backend/.keys/`.
   - `age.txt`: your own `age` identity for SOPS. Create it from the project root:

     ```bash
     mkdir -p backend/.keys
     age-keygen -o backend/.keys/age.txt
     ```

     `age-keygen` writes the file and prints your public key (`age1...`); the CLI has no command that creates it. Send the **public** `age1...` key to a teammate. Never send or commit `age.txt`.

B3. **Open the onboarding pull request, with your roster entry.** Add yourself to `.backlog/team.yaml`, as in step A2, and open the pull request with `gh pr create`. A teammate who already decrypts the project finishes it:

   - Adds your public key to the `age:` recipients of `backend/.sops.yaml`, whose rule is `path_regex: '(\.env(\..+)?|\.env)$'`. A comment line beside each key names its owner; add yours.
   - Re-encrypts the existing `backend/.env.<env>.enc` files so your key can read them, with `sops updatekeys <file>`, and pushes that to the same pull request.

   Adding a recipient does not change files that are already encrypted, which is why the teammate re-encrypts. Once the pull request is merged, `git pull`.

### Both paths — the local environment

1. **Install the dependencies.**

   ```bash
   pnpm install
   ```

2. **Create `backend/.env`.** A project created in path A already has it. In a clone, decrypt the `dev` environment and copy the result as `backend/.env`. From `backend/`:

   ```bash
   cd backend
   catalyst env decrypt --env dev --config ../aurora.yaml
   cp .env.dev .env
   ```

   The command reads `.env.dev.enc` and your key from `.keys/age.txt`, and writes `backend/.env.dev`. Then point the `DATABASE_*` block of `.env` at your own database, as in [Install Aurora Catalyst](../../../tutorials/getting-started/install-aurora/).

   Run the project with `pnpm dev` from the root. See [Add IAM + OAuth](../../../tutorials/getting-started/add-iam-oauth/) for the first login.

3. **Install your dispatcher daemon.** From the main checkout, with `main` checked out and a clean tracked tree:

   ```bash
   pnpm backlog:daemon install --assignee @ana
   pnpm backlog:daemon status
   ```

   `install` checks the id against `.backlog/team.yaml` (an unknown id exits non-zero and writes nothing), writes `.backlog/.dispatch/assignee` and loads one agent for this repository. `status` prints the identity, the label `dev.aurora.backlog-dispatch.<repository>`, whether it is loaded and its working directory.

4. **Take your first task.** A task is yours when its assignee is `@<id>`:

   ```bash
   backlog task edit T-12 -a @ana
   ```

   Then choose how it runs:

   - **Dispatched.** Move it to `Queued` (`backlog task edit T-12 -s Queued`). Your daemon picks it up on its next pass, within five minutes or at once after the status change, and works it in a worktree on the branch `task/T-12`. A queued task without exactly one assignee from the roster goes to `Blocked` with a comment.
   - **Interactive.** In Claude Code, run `/task T-12`. The Task Gate sets it `In Progress` and assigns it to you in one edit, creates the worktree on `task/T-12`, and you work it there. If the task belongs to another developer, the assistant asks before reassigning it.

   Either way the work closes with a pull request to `main`. When it merges, your daemon moves the task to `Done`.

## Verify it worked

- `pnpm backlog:daemon status` shows your id, `loaded` and the working directory of this checkout.
- `pnpm backlog:graph` prints the current dependency view without writing anything.
- Your first task reaches `In Progress`, with `@<id>` as its only assignee, and then `Done` after its pull request merges.
- The `backlog graph` workflow of the repository ran after your first push to `main`.

## Troubleshooting

- **`install` stops on a missing binary.** Install it, open a new shell where it is on the PATH and run `install` again. The same applies after a Node upgrade or after renaming the checkout.
- **Dispatch stops and reports the main checkout.** The synchronization needs `main` checked out and refuses a dirty tracked file. Commit or discard the change; work happens in worktrees, never in the main checkout.
- **A queued task is `Blocked`.** Read its comment. It names the cause: no assignee, two assignees or an id outside the roster. Fix the assignee and move the task to `Queued` again.
- **`sops` cannot decrypt after the onboarding pull request merged.** A teammate has not re-encrypted the files for your key yet; ask for `sops updatekeys`.

## Related

- [Concept: The board for several developers](../../../concepts/workflow/multi-developer-board/)
- [Install and upgrade packages](../install-and-upgrade-packages/)
