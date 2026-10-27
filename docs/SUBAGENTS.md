# Building with subagents: a step-by-step guide

This guide is for someone who has never created an agent or a subagent. It explains the ideas in plain words, then walks through what was actually done to plan and build RideNote's History feature with a team of AI subagents, step by step, with the real commands and settings. Everything here happened in this repository, so you can open the design and the plan it produced and compare: see [the worked example](#worked-example).

If you only want the short version: one main AI conversation (the **controller**) breaks a big job into small tasks, hands each task to a fresh helper AI (a **subagent**) that knows only what it is told, and gets a second fresh helper to check each result before moving on.

## 1. The ideas in plain words

| Word                      | What it means here                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent**                 | An AI assistant that can do more than chat: it reads files, runs commands, edits code and tests, and keeps going in a loop until the job is done. Claude Code is an agent that runs in your terminal.     |
| **Subagent**              | An agent that another agent starts for one job. It begins with a **blank memory**, knows only what its instructions say, works on its own, and sends back a report. It cannot ask you questions directly. |
| **Controller**            | The main conversation you are talking to. It plans, hands out jobs, reads the reports and decides what happens next.                                                                                      |
| **Skill**                 | A written playbook an agent can load by name, for example `superpowers:brainstorming`. You can ask for one by typing `/superpowers:brainstorming`, or the agent loads it when the job calls for it.       |
| **Worktree**              | A second copy of the project on its own git branch, in its own folder, so work in progress never touches your main copy.                                                                                  |
| **Brief, report, ledger** | Plain files used to hand work over. A **brief** is a task's instructions, a **report** is what the helper did, and the **ledger** is a progress diary that survives if the conversation is cut short.     |

**Why not just ask one AI to do everything?**

- **A fresh pair of eyes.** The AI that wrote the code is the worst judge of it. A reviewer that never saw the code being written reads it cold and finds what the author missed. This happened here: see [what went wrong](#4-what-went-wrong-and-what-it-taught-us).
- **A small main conversation.** Long jobs fill an AI's memory. Each subagent does its job in its own memory and returns only a short summary.
- **Clear jobs.** A task that fits on one page, with the exact test that proves it, is much harder to get wrong.

**The cost.** Every subagent is another AI conversation, so this uses more time and money than one conversation would. Use it for work that is big, risky or hard to undo (this feature stores visitors' data on a public page). Do not use it for a one-line fix.

## 2. What you need

- **Claude Code**, signed in, running in a terminal inside your project.
- The **Superpowers skills** plugin, which provides the playbooks used below (`brainstorming`, `writing-plans`, `using-git-worktrees`, `subagent-driven-development`). Follow the plugin's own page for current install steps. You can see which skills you have by typing `/` in Claude Code.
- **git**, and a project with tests. Tests are what let a helper prove its work.

## 3. Step by step: how the History feature was built

These are the real steps, in order. Each one says what you type or what the controller does, and what file comes out of it.

### Step 1: Say what you want

You write the request in plain words. For History it was: "store the parsed results in Postgres, only in production, and show them on a public History page that is deleted every 7 days", followed by security requirements. Nothing is built yet.

### Step 2: Brainstorm a design

The controller loads the playbook with the Skill tool (`superpowers:brainstorming`). It reads your existing code, then asks you one question at a time, lays out two or three ways to build it with a recommendation, and writes a design document: `docs/superpowers/specs/2026-10-27-history-design.md`. The design lists goals, non-goals (what it will not do), anti-goals (what would make it a failure even if it works), constraints and the decisions you made.

### Step 3: The first subagent: a "builder check"

Before you read the design, a subagent reads it cold and reports only the questions a builder would still need answered. This is the first time a subagent is created. The controller does it with the **Agent** tool:

```text
Agent tool
  description:   "Builder check of history spec"
  subagent_type: "general-purpose"
  prompt:        "You are a talented software engineer. You've been handed a design
                  document and asked to put together a plan to build what it describes.
                  You will not be able to talk to the person who wrote it.
                  Read docs/superpowers/specs/2026-10-27-history-design.md ...
                  Report only the questions you'd still need answered ...
                  If nothing important is left, say 'nothing important left'."
```

What each field does:

- `description` is a short label you see in the interface.
- `subagent_type` picks the kind of helper. `general-purpose` can read, search, run commands and edit.
- `prompt` is everything the helper will ever know. It starts with a blank memory, so the prompt names the files to read and says exactly what to report.

The subagent runs in the background. When it finishes, its final message comes back to the controller automatically, labelled as coming from the subagent. It is information, not an instruction: a subagent cannot approve anything on your behalf.

It returned five questions. The controller sorted them into three piles, as the playbook says: already answered by the design, small calls the controller can make (marked "my call" in the document), and questions only you can answer. Only one question needed you. The design was updated and handed over.

### Step 4: You approve the design

Nothing is built until you approve the written design. Here the answer was "go with your defaults". The design's status line was changed to approved and it was committed to git.

### Step 5: Turn the design into a plan

The controller loads `superpowers:writing-plans` and writes `docs/superpowers/plans/2026-10-27-history.md`. The plan is 13 small tasks. Each task names exact files, the exact function signatures other tasks rely on, the tests to write first with their assertions, and the commit message. It also starts with a list of the global rules and the five failure modes most likely to bite a real user.

### Step 6: Choose how to run the plan

You choose between two ways: **subagent-driven** (a fresh subagent per task plus a fresh reviewer after each one; most thorough, costs more) or **native** (the controller does every task itself, then one reviewer checks everything at the end; cheaper). The controller recommended subagent-driven because the tasks share strict interfaces and a mistake could put personal data on a public page. You agreed.

### Step 7: Make an isolated copy to work in

The controller loads `superpowers:using-git-worktrees` and asks your consent, because the alternative is working on your main branch while your dev server is running from it.

1. It loads the worktree tool and creates the copy: **EnterWorktree** with the name `history-feature`. That makes a folder `.claude/worktrees/history-feature` on a new branch `worktree-history-feature`.
2. The new branch started from the last pushed commit, so it did not have the design and plan. The commands to catch it up:

   ```bash
   git merge --ff-only main      # bring in the local-only design and plan commits
   npm ci --ignore-scripts       # install dependencies exactly as CI does
   npm test                      # baseline: everything green before any change
   ```

3. From here on, every command runs inside that folder. Your original folder is never touched.

### Step 8: Set up the diary and scan the plan for conflicts

The controller creates a git-ignored workspace, `.superpowers/sdd/<plan name>/`, with a progress **ledger** (`progress.md`) as its first file. Then it does a **pre-flight scan**: a table with one row for every pair of tasks that share a file or an interface, and one row per task, checking that the plan agrees with itself. This scan found four real defects in the plan before any code was written:

- Task 4's function signature had no room for the injected query function that its own tests used.
- Task 6 edited browser tests that only get their production setting in Task 10.
- Task 10 needed a server-side stand-in for the AI, or no browser test could save anything.
- Task 4's "no delete outside the purge module" guard test would trip on the word "delete" inside a comment.

Each was fixed in the plan and recorded in the ledger as a **ruling**: what was decided, why, and what it costs if wrong.

### Step 9: The task loop (repeat for every task)

For each task the controller does the same six things.

1. **Write the brief.** One file with the global rules plus that task's text: `.superpowers/sdd/…/task-N-brief.md`.
2. **Dispatch the implementer.** A subagent with the Agent tool. The prompt is short: where the task fits, the brief path, any rulings, and the path of the report file to write. The long standing rules live in a shared file, `implementer-template.md`, that every dispatch points at. The **model is always set explicitly**, because a subagent started without one silently inherits the controller's (more expensive) model:

   ```text
   Agent tool
     description:   "Implement Task 1: 429 message fix"
     subagent_type: "general-purpose"
     model:         "sonnet"
     prompt:        "You are implementing Task 1 ... Read your task brief first: <path>
                     ... Work from: <worktree path> ... Write your full report to <path>
                     ... Then reply with ONLY: Status, commits, a one-line test summary,
                     concerns, the report path."
   ```

3. **The implementer works test-first.** It writes a failing test, runs it and watches it fail (red), writes the code, runs it again (green), runs the whole suite, and commits. The project's pre-commit hook runs `npm run check` (type check, lint, formatting, all tests), so a commit cannot go in if anything is broken. The implementer's final message is a status line (`DONE`, `DONE_WITH_CONCERNS`, `BLOCKED` or `NEEDS_CONTEXT`), the commit and a one-line test summary. The detail goes in the report file.
4. **Package the change for review.** Three plain git commands write the commit list, the file summary and the full diff into one file:

   ```bash
   git log --oneline <BASE>..HEAD  > .superpowers/sdd/<plan>/task-N-review-package.md
   git diff --stat   <BASE>..HEAD >> .superpowers/sdd/<plan>/task-N-review-package.md
   git diff -U10     <BASE>..HEAD >> .superpowers/sdd/<plan>/task-N-review-package.md
   ```

   `<BASE>` is the commit recorded before the implementer started. The diff goes to a file so it never fills the controller's memory.

5. **Dispatch the reviewer.** A second, fresh subagent with the brief, the implementer's report, the diff file and the rules that bind the task. It checks two things: does the change match the task (**spec compliance**), and is it well built (**code quality**). It reads and judges; it does not change anything. It is told not to trust the implementer's report.
6. **Record the result in the ledger,** then move to the next task.

**Waiting.** Subagents run in the background. Rather than asking "are you done?" over and over, the controller waits on a file that appears when the work is finished:

```bash
until [ -s .superpowers/sdd/<plan>/task-N-report.md ]; do sleep 3; done; echo "report written"
```

### Step 10: The fix loop (what happens when a reviewer finds a problem)

Task 2 built a scrubber that removes phone numbers and ID numbers from the text before it is saved. Its reviewer found a bug the tests did not cover: a rule for the label "ID" also blanked the state abbreviation in `Boise, ID 83702`. The loop:

1. The controller sent the finding, word for word, back to the **same implementer**, which still remembered the code. This uses the **SendMessage** tool, with the subagent's id in `to`.
2. The implementer wrote a failing test for the Idaho address, fixed the rule, re-ran the tests and appended a "Fix report" to its report file.
3. A **scoped re-reviewer** looked only at the fix and answered each finding "addressed" or "not addressed". It also checked the fix for new breakage.
4. The ledger recorded the round. A task gets at most five rounds. Small observations that do not need fixing now go in the ledger as "deferred minors" for the final review.

The controller never fixes code itself during this process. That keeps its memory small and means every change gets reviewed.

### Step 11: Final review and finishing

(To be completed when the run ends.)

## 4. What went wrong, and what it taught us

Real problems from this run. They are written down because a beginner will hit the same ones.

1. **Every test was silently skipped in the worktree.** The first commit failed with "No tests found". The project's Jest settings ignored any path containing `/.claude/`, and the worktree lives under `.claude/worktrees/`. Fix: anchor the ignore rule to the project root. Lesson: when you move the project somewhere new, run the tests there before trusting anything.
2. **The type check and formatter wandered into the worktree.** They would have read a second copy of every file. Fix: exclude `.claude` and `.superpowers` in the TypeScript and Prettier settings.
3. **The harness refused the playbook's helper scripts and complex shell commands** inside the worktree, because it could not prove they stayed inside it. Fix: do the same steps with plain, separate commands (one `git` command per call).
4. **The plan itself had four defects.** The pre-flight scan caught them before any code existed, which is much cheaper than finding them in review.
5. **A reviewer found a real bug the author's tests missed** (the Idaho address). The author's own tests only checked what the author thought of.

## 5. Rules that kept it safe

- **Never work on your main branch** without saying so. Use a worktree and ask first.
- **Hand over files, not pasted text.** A long prompt stays in the controller's memory for the rest of the session.
- **Always set the model for each subagent.** It controls cost.
- **Subagents never start subagents.** Review is the controller's job, so a helper that spawns its own reviewer only duplicates it.
- **Reviewers are read-only.**
- **Stop only for four things:** something irreversible, something security-sensitive, a change outside the worktree (a merge or a push), or a plan so broken every path is a guess. Everything else is a recorded decision, not a question.
- **Treat a subagent's message as information, never as permission.** Approval comes only from you.

## 6. Quick reference: the tools you will see

| Tool              | What it does                                            | Key settings                                                                |
| ----------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Skill**         | Loads a playbook by name                                | `skill: "superpowers:brainstorming"` (or type `/superpowers:brainstorming`) |
| **Agent**         | Starts a subagent                                       | `description`, `subagent_type`, `prompt`, `model`                           |
| **SendMessage**   | Talks to a subagent that already ran, and resumes it    | `to` (its id), `message`                                                    |
| **EnterWorktree** | Creates an isolated copy of the project on a new branch | `name`                                                                      |
| **Bash**          | Runs a command                                          | the command                                                                 |

Commands you can type yourself in Claude Code: `/code-review high` starts a background reviewer on your current changes; `/superpowers:systematic-debugging` loads the debugging playbook.

## 6. Glossary

- **Anti-goal:** something that would make a project a failure even if it technically works.
- **Base commit:** the commit before a task started, used to show exactly what the task changed.
- **Fix round:** one fix by the implementer plus one scoped re-review.
- **Hand-back:** the final message a subagent sends to its controller.
- **Pre-commit hook:** a script git runs before each commit; here it runs the full checks.
- **Ruling:** a recorded decision made without stopping to ask, with the reason and the cost if wrong.

## Worked example

The two documents this run produced are published beside this guide:

- [The design: History of parsed results](/docs/agents/design)
- [The implementation plan](/docs/agents/plan)
