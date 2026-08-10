---
name: orchestrating
description: Run a long agent-only session as the coordinating instance — dispatch subagents, verify their claims, keep your own context spendable. Use when work outlasts one context window, when several tickets can run at once, or when the user delegates launching agents to you.
---

Your context is the scarce resource: agents are replaceable, you are not. An agent's work reaches you as a **report** — a **claim**, not evidence. Agents state falsehoods confidently, often as the premise for skipping work. So every report ends in an **acceptance pass**.

## Sequencing

Run **alone**, before any fan-out:

- work whose result gates everything else (a measurement tool, a schema, a contract);
- work that must observe an **untouched tree** — a measurement is void if product code landed in the session that measured it.

## Lanes

A **lane** is the directories one agent owns exclusively. Partition so two agents cannot touch one file; name the partition in every brief. Partition by what the work *is*: product code, test data, docs, and each singular resource (a GPU, a device, a port) as its own lane.

**No-man's-land** is where lanes leak: a file no lane owns, broken by a change in the lane that caused it — a test asserting a manifest's shape, a lockfile, a snapshot. Sweep for it yourself; it is yours precisely because it is nobody's.

## The brief

An agent starts with only what you write. Carry:

1. **What to read first**, in order — project instructions, its ticket, the governing method doc.
2. **Hard constraints, verbatim** from the project's own wording. A paraphrased constraint is a weakened one. State them positively: "commit with explicit paths" beats banning `git add -A`.
3. **Its lane**, and who owns the rest.
4. **What done means**, with the gate commands that must pass.
5. **Verify on the real artefact** — the actual binary, the actual UI. Self-verification by unit test alone has shipped broken behaviour.
6. **What to report** — a file dump is not a report.

Include established facts with file:line references; that paragraph saves an agent an hour of searching.

## While they run

Wait for the completion notification. The transcript file holds every tool result the agent produced — reading it spends exactly the context the delegation saved.

Dispatch independent lanes in one message so they run concurrently. Run an agent synchronously only when its report gates your next move.

## The acceptance pass

**One targeted command per claim** — `git log --oneline -N`, a `--stat` on one file, one invocation of the tool it built, a single grep. Not by re-reading the work.

In priority order:

- **Any claim contradicting what you observed earlier**, especially a premise justifying an omission.
- **The headline number** — re-run the measurement.
- **User-facing behaviour**, on the real artefact.
- **A new mechanism touching a gate** — read the mechanism, confirm it narrows nothing.

## Durability

The session ends; the repo persists. Decisions, rejected alternatives and their reasons, environment quirks, what a measurement actually means — land in project files as you go, written to survive being read alone by someone with none of this conversation.

Record what an agent **may not** certify as carefully as what it may. Machine verification's ceiling is narrower than a report implies, and your phrasing becomes the next agent's premise.

## Failure modes

- **False premise for skipping work** — "those directories no longer exist", "the contract did not change": load-bearing, stated as fact, wrong.
- **Broad staging** — an agent stages a directory and sweeps another lane's uncommitted work into its commit.
- **Stale gate numbers** — a threshold quoted from an earlier state of the repo.
- **A verification the environment silently forbade** — a locked session, a missing device. The agent substitutes a nearby check and may not flag the swap. Ask what could not be observed.
- **Your own commit colliding** — an agent owns the repo while you write to it.
