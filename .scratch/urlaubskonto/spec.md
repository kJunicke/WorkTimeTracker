# Urlaubskonto — vacation budget and Gleitzeittag

Status: done — see each issue's Comments section

## Problem Statement

The app already knows which days are vacation — `vacation` is one of the day
labels, and a labeled day is correctly neutral against the Gleitzeit. What it
cannot answer is the question the user actually asks before booking anything:
*how many vacation days do I have left?*

Today that means counting labeled days by hand across the calendar and
subtracting from a number held in the user's head. There is also no way to say
"these two weeks are Urlaub" in one gesture — each day has to be labeled
individually.

A third gap only becomes visible once a budget exists: a day taken off when no
vacation days remain is not vacation at all. It is time drawn from the
Gleitzeit, to be made up on other days. The app has no way to express that, so
such a day is indistinguishable from a day the user simply forgot to track.

## Solution

An **Urlaubskonto** on the Kalender showing three numbers for the leave year of
the month on screen: **übrig**, **verplant**, **genommen**.

The **Urlaubsanspruch** is set by hand. A standard figure covers the normal
case, and any individual Urlaubsjahr can override it. Carry-over from the
previous year (`Resturlaub`) is not modelled — the user folds it into that
year's number themselves, which also sidesteps every expiry rule.

Vacation can be marked across a continuous span of days in one action, with a
confirmation showing exactly what will be written before it is applied.

The Urlaubsanspruch is a **hard cap**. The app never labels more vacation days
than a year allows. A day off beyond the entitlement is a **Gleitzeittag** — a
new day label that is deliberately *not* a credited day: it carries the full
daily target and so costs its hours against the Gleitzeit. See
`docs/adr/0001-gleitzeittag-instead-of-overdrawn-vacation.md` for why this is a
distinct label rather than an over-drawn vacation day.

## User Stories

1. As the user, I want to see how many vacation days I have left in the current
   Urlaubsjahr, so that I know whether I can still book time off.
2. As the user, I want to see how many vacation days I have already taken
   (genommen), so that I can tell how much of the year I have used.
3. As the user, I want to see how many vacation days I have labeled but not yet
   reached (verplant), so that a fully-booked year does not look free.
4. As the user, I want übrig to account for both genommen and verplant, so that
   the remaining figure is one I can actually book against.
5. As the user, I want the Urlaubskonto to follow the month I am looking at in
   the Kalender, so that scrolling into January shows me next year's budget.
6. As the user, I want to set a standard yearly Urlaubsanspruch once, so that I
   do not have to configure every year individually.
7. As the user, I want to override the Urlaubsanspruch for an individual
   Urlaubsjahr, so that a partial first year of employment is counted correctly.
8. As the user, I want a year I have never configured to fall back to the
   standard figure, so that the app always has an answer.
9. As the user, I want to fold last year's Resturlaub into a year's figure
   myself, so that the app does not need carry-over or expiry rules I would
   have to keep correct.
10. As the user, I want to mark a single day as Urlaub as I do today, so that
    nothing I already rely on changes.
11. As the user, I want to mark a continuous span of days as Urlaub in one
    action, so that booking two weeks off is not fourteen separate actions.
12. As the user, I want to see what a span will write before it is applied, so
    that I am not surprised by the result.
13. As the user, I want weekends inside a span to be marked as Urlaub too, so
    that the Kalender clearly shows the whole period I am away.
14. As the user, I want weekends never to consume vacation days, so that a
    two-week block costs me ten days and not fourteen.
15. As the user, I want a day inside a span that already carries a non-work
    label to keep it, so that a Feiertag in the middle of my holiday is not
    overwritten and does not cost me a vacation day.
16. As the user, I want to be told which days a span skipped and why, so that I
    can trust the confirmation figure.
17. As the user, I want the app to refuse to label more vacation days than my
    Urlaubsanspruch allows, so that the counter can never lie to me.
18. As the user, I want to be asked whether the remainder of an over-long span
    should become Gleitzeittage, so that the app never spends my Gleitzeit
    without asking.
19. As the user, I want to decline that offer and have only the days that fit be
    marked as Urlaub, so that I stay in control.
20. As the user, I want to mark a Gleitzeittag directly without exhausting my
    vacation first, so that I can take a Friday off against accumulated overtime.
21. As the user, I want a Gleitzeittag to cost its full daily target against the
    Gleitzeit, so that the balance reflects time I still owe.
22. As the user, I want a Gleitzeittag to be visually distinct from Urlaub in
    the Kalender, so that I can see at a glance which account a day off came
    from.
23. As the user, I want a Gleitzeittag not to appear in the Urlaubskonto's three
    numbers, so that I never mistake it for something drawn from my entitlement.
24. As the user, I want the Kalender legend to explain the Gleitzeittag colour,
    so that the new label is discoverable.
25. As the user, I want work I happen to log on a Gleitzeittag to count normally,
    so that a day I partly worked reduces what I owe.
26. As the user, I want my Urlaubsanspruch figures included in backups, so that
    restoring does not lose numbers I typed in by hand and cannot re-derive.
27. As the user, I want an older backup without those figures to still import,
    so that the backups I already hold remain usable.
28. As the user, I want a restored backup to bring its Urlaubsanspruch figures
    with it, so that the Urlaubskonto reads the same after a restore.

## Implementation Decisions

### A new day label

`DayType` gains a fifth member, `gleitzeittag`. It is deliberately **excluded**
from the credited-day set (`isLabeledType` in the calculation module), which is
what makes it derive exactly like an ordinary work day: it carries the full
daily target, logged sessions count normally under the break rules, and an empty
one yields a delta of minus one daily target with **no new branch in
`deriveDay`**. The label's only job is to record that the shortfall was
deliberate.

A Gleitzeittag on a weekend is a harmless no-op — a weekend already carries no
target — and is not forbidden.

### Entitlement settings

Two new `Settings` fields: a standard yearly figure, and a sparse map from
four-digit year string to that year's override. A year absent from the map
inherits the standard figure, so every year is answerable. Both are added as
optional-with-default on read, following the precedent already set by the
`onboarded` field.

The store's settings-update action currently accepts a narrowed patch of two
specific keys and must be widened to carry the new fields.

### The pure vacation module

One new module in the domain layer, alongside the existing calculation module,
holding all logic. It exports two pure functions and no state.

**Deriving the Urlaubskonto.** Given a leave year, the day labels, that year's
Urlaubsanspruch and today's date, it returns anspruch, genommen, verplant and
übrig. Only `vacation` labels count. Weekend days never count. A day strictly
before today is genommen; today and later are verplant. Übrig is anspruch minus
genommen minus verplant, and is allowed to go negative (see Out of Scope).

**Planning a span.** Given a start and end date, the existing day labels and the
remaining budget, it returns the days that would become `vacation`, the days
that would become `gleitzeittag`, and the days skipped with a reason for each.
It writes nothing and touches no store — the caller applies the result only
after the user confirms.

Rules, in order: a day already carrying a non-`work` label is skipped and keeps
what it has. Every remaining day in the span becomes `vacation` while budget
remains. Weekends always become `vacation` and never consume budget, so they can
never overflow. Once the budget is exhausted, remaining **weekdays** are
returned as the Gleitzeittag candidates rather than as vacation.

### Store

A computed Urlaubskonto for a given year, and an action applying a confirmed
span plan as a batch of day-label writes. Both are thin pass-throughs over the
pure module.

### UI

The Urlaubskonto reads on the Kalender, scoped to the leave year of the month
currently displayed, using the existing stat-tile idiom. The entitlement inputs
— standard figure plus per-year overrides — live in the settings screen.

Span selection is initiated from the Kalender and resolves through a
confirmation summarising the plan ("10 Tage als Urlaub, 1 Feiertag
übersprungen"). When the plan contains Gleitzeittag candidates, the confirmation
asks explicitly whether to mark them; declining applies only the vacation days.

`gleitzeittag` becomes a first-class choice in the day-label UI, gets its own
Kalender colour distinct from `vacation`, and gets a legend entry.

### Persistence

The backup file format keeps `schemaVersion: 1`. Nothing forces a bump: the
parser ignores unknown keys, so the new settings fields are added to the backup
payload and read as optional-with-default. Widening the accepted day-type set to
include `gleitzeittag` is likewise additive for reading older files. The
version is being held at 1 because nothing requires otherwise, not for
compatibility guarantees — the app has a single user and no released versions in
the field.

Restore must carry the entitlement figures through, defaulting them when a file
predates the fields.

## Testing Decisions

A good test here asserts only externally observable behaviour: given day labels,
an entitlement and a date, what does the Urlaubskonto read; given a span and a
remaining budget, which days does the plan write and which does it skip. Tests
must not reach into how the functions are structured internally.

**The single new seam is the pure vacation module**, with one new test file
beside it. This is the highest available seam — the Vue layer and the store
carry no logic of their own once the module exists, and the repo has no
component or store tests to extend. Prior art is the existing calculation test
file, which drives pure functions through exhaustive tabulated cases, and its
small local factory helpers for building fixtures.

Cases the vacation module's tests must cover:

- Genommen/verplant split across the today boundary, including a vacation day
  dated exactly today counting as verplant.
- Weekend vacation days consuming nothing while still being labeled.
- `sick`, `holiday` and `gleitzeittag` labels never consuming budget.
- Days from a neighbouring Urlaubsjahr never counting toward this one.
- A year with an explicit override versus a year inheriting the standard figure.
- Übrig going negative when labeled days exceed the entitlement.
- A span that fits entirely within the remaining budget.
- A span that overflows, splitting into vacation days plus Gleitzeittag
  candidates at exactly the right boundary.
- A span whose overflow lands on a weekend, confirming weekends stay vacation
  and never become Gleitzeittag candidates.
- A span containing a pre-existing `holiday`, confirming it is skipped, keeps
  its label and does not consume budget.
- A span with zero remaining budget, yielding only Gleitzeittag candidates.
- A single-day span, and a span whose start and end are given in reverse order.

The existing backup test file is extended in place for the new settings fields
and the widened day-type set — an existing seam, not a new one.

Existing calculation tests must be extended to cover `gleitzeittag` deriving as
an ordinary work day: an empty one yielding minus one daily target, and one with
logged sessions being treated under the normal break rules.

## Out of Scope

- **Carry-over and Resturlaub expiry.** Deliberately not modelled; folded into
  each year's hand-set figure.
- **Half-days.** The day-label model is one label per whole day and stays that
  way.
- **Pro-rating a partial employment year.** The user computes the figure and
  types it in; no legal rule is encoded.
- **Lowering an Urlaubsanspruch below the days already labeled for that year.**
  Deferred. Interim behaviour is that übrig simply goes negative, with no
  warning and no block — a state the labeling rule itself would have refused.
  Tracked as its own issue.
- **Automatic public holiday labeling.** Tracked separately under
  `feiertagskalender`.
- **A Dienstreise day label.** Tracked separately under `dienstreise-label`.
- **Any Gleitzeittag budget or cap.** Gleitzeittage are bounded only by the
  Gleitzeit balance itself, which is already displayed.

## Further Notes

The Gleitzeittag decision is the load-bearing one and is recorded as ADR 0001.
The rejected alternative — letting vacation days run past the entitlement and
charging the excess against the Gleitzeit — would have made a day's delta depend
on every other vacation day in the year, breaking the per-day purity of the
calculation and silently rewriting settled Gleitzeit history whenever an earlier
day was labeled.

Domain vocabulary for this feature is recorded in the repo glossary:
Urlaubskonto, Urlaubsjahr, Urlaubsanspruch, genommen, verplant, übrig,
Gleitzeittag, and gutgeschriebener Tag for the neutral-day set a Gleitzeittag
sits outside of.

The user's employment begins 2026-05-06, which is also the balance start date.
There is therefore no vacation before that date and no backfill is required —
2026 simply gets a hand-set, pro-rated Urlaubsanspruch override.
