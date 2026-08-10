# 01 — Gleitzeittag, end to end

**What to build:** The user can mark any day as a **Gleitzeittag** — a day taken
off that draws on the Gleitzeit rather than the Urlaubskonto. It appears as a
choice in the day-label UI alongside Urlaub and Krank, shows in the Kalender in
its own colour with a legend entry explaining it, and costs its full daily
target against the Gleitzeit balance. It survives a backup export and import.

**Blocked by:** None — can start immediately.

**Status:** done

A Gleitzeittag is deliberately **not** a gutgeschriebener Tag. Leave it out of
the credited-day predicate in the calculation module and it derives exactly like
an ordinary work day for free: full daily target, logged sessions counted
normally under the break rules, an empty one yielding a delta of minus one daily
target.

This should need **no new branch** in the per-day derivation. If it seems to,
the label has been put in the credited-day set by mistake — re-read
`docs/adr/0001-gleitzeittag-instead-of-overdrawn-vacation.md`, which exists
precisely because the rejected alternative would have required that branch.

Widen the accepted day-type set in the backup parser. Keep the backup format at
`schemaVersion: 1` — the change is additive and nothing forces a bump.

- [ ] `gleitzeittag` can be set and cleared on a single day from the day-label UI
- [ ] An empty Gleitzeittag on a weekday reduces the Gleitzeit balance by exactly
      one daily target
- [ ] A Gleitzeittag with logged work derives identically to the same day labeled
      `work` — same net, same auto-deducted break, same delta
- [ ] An empty Gleitzeittag on a weekend costs nothing, as any weekend does
- [ ] It is visually distinct from Urlaub in the Kalender and appears in the legend
- [ ] A Gleitzeittag round-trips through backup export and import
- [ ] Existing calculation tests are extended to cover the derivation cases above

## Comments

**Implemented** in `8269404 feat(calc): add the Gleitzeittag day label`.

No new branch was needed in `deriveDay`, as the ticket predicted — the entire
change to `src/domain/calc.ts` is a comment plus exporting `isLabeledType` so
the UI can ask the domain the credited-day question instead of re-listing the
members. `gleitzeittag` stays out of that set.

Decisions the ticket left open:

- Colour is teal `#14b8a6` (`--gleitzeittag` in `src/styles/tokens.css`), backed
  by a `G` badge in `HeatCell` so it never rests on teal-vs-sky discrimination
  against Urlaub.
- It sits last in the label select and last in the legend, so nothing existing
  moved.
- It was also added to `UnlabeledWeekdayPrompt` — that prompt is where an
  untracked past weekday gets resolved, and "the shortfall was deliberate" is
  exactly the answer it was missing.
- Fixed a latent bug found on the way: `DayDetail`'s `labelIgnoresWork` tested
  `type !== 'work'`, which would have falsely told the user their logged work
  was ignored on a Gleitzeittag. It now calls `isLabeledType`.

Not verified by an executed test: the day-label UI interaction and the Kalender
colour. The repo has no component tests, and no browser run was made — these
rest on a clean typecheck and on reading the code.
