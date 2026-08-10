# 04 — The hard cap and the Gleitzeittag offer

**What to build:** The Urlaubsanspruch becomes a genuine cap — the app never
labels more vacation days than a leave year allows. When the user selects a
range longer than what remains, the days that fit are marked as Urlaub and the
confirmation asks explicitly whether the remainder should become **Gleitzeittage**.
Accepting marks them; declining leaves those days untouched and marks only the
Urlaub that fit.

The app must never spend Gleitzeit without asking.

**Blocked by:** 01, 03.

**Status:** done

Extends the span planner in the pure module to return Gleitzeittag candidates
alongside the vacation days. Rules continue from ticket 03:

4. Once the budget is exhausted, remaining **weekdays** are returned as
   Gleitzeittag candidates — never as Urlaub.

Weekends can never overflow: they never consume budget, so they stay Urlaub
regardless of what remains. A Gleitzeittag on a weekend would cost nothing
anyway, which is the same reason it is harmless rather than forbidden.

- [ ] A range longer than the remaining budget marks exactly the days that fit
      as Urlaub, and no more
- [ ] The confirmation asks separately about the remainder, naming it as
      Gleitzeittage
- [ ] Accepting marks the remainder as Gleitzeittage
- [ ] Declining leaves the remainder untouched and still applies the Urlaub days
- [ ] The split falls at exactly the right boundary — the last day that fits is
      Urlaub, the first that does not is a Gleitzeittag candidate
- [ ] A weekend falling past the budget boundary is still marked Urlaub, never
      offered as a Gleitzeittag
- [ ] A range applied with zero budget remaining offers only Gleitzeittag
      candidates
- [ ] Applying a plan does not change übrig by more than the vacation days in it

## Comments

**Implemented** in `b961ff8 feat(vacation): make the Urlaubsanspruch a hard cap,
offer Gleitzeittage`.

Rule 4 landed in `planUrlaubSpan`: weekends short-circuit to `vacation` before
the budget is consulted, so they can never overflow; weekdays go to `vacation`
while `kosten < budget` and to `gleitzeittag` after. Declining is
`ohneGleitzeittage(plan)`, exported from the pure module rather than spread at
the call site, so "declining" means one thing everywhere and is testable without
a store.

The offer is two explicit buttons, no checkbox and no default: "Urlaub eintragen
und Rest als Gleitzeittage" and "Nur Urlaub eintragen", plus Abbrechen.

**One thing the ticket did not anticipate:** `uebrig` can already be negative
before a span is planned, because `deriveUrlaubskonto` permits an over-drawn
Urlaubsjahr (see ticket 05). The planner therefore clamps its spending budget
with `Math.max(0, uebrig)` — a negative übrig is *no budget*, never a debt the
span must pay off before it may spend a single day.

Not verified by an executed test: the placement of the two new buttons. No
browser run was made.

### Follow-up: the cap on single-day labeling

Implemented in `3aefc1d`, after a `/code-review` found the gap.

This ticket's checkboxes are all span-scoped, so the cap landed span-only — but
the spec is broader ("The app never labels more vacation days than a year
allows", user story 17), and ADR 0001 says the cap is "enforced at the point of
labeling". Tapping Urlaub on one day at a time had no budget check at all and
drove übrig negative day by day, which is exactly the counter lying that user
story 17 forbids. The ticket decomposition, not the spec, was what missed it.

`planTageskennzeichnung(date, type, existing, uebrig)` in the same pure module
answers the question for one day and returns `'kennzeichnen'` or
`'gleitzeittagAnbieten'`. Weekends consume nothing so they are always allowed;
an already-`vacation` day is being re-confirmed rather than newly spent;
otherwise a weekday needs a day of übrig. `nutzbaresUebrig` — the
`Math.max(0, uebrig)` clamp — is now shared with `planUrlaubSpan` rather than
restated.

The offer is `GleitzeittagAngebot.vue`, mirroring `UrlaubSpanConfirm`'s two
explicit buttons with no default. Abbrechen writes nothing, and the select is
put back to the label the day still carries.

Not verified in a running browser: the select-restore path in `DayDetail`. The
repo has no component tests.
