# 03 — Marking a span of days as Urlaub

**What to build:** The user selects a continuous range of days on the Kalender
and marks the whole range as Urlaub in one action. Before anything is written, a
confirmation states exactly what will happen — "10 Tage als Urlaub, 1 Feiertag
übersprungen". Cancelling writes nothing. Weekends inside the range are marked
and shown in the vacation colour so the whole period reads as time away, but
they do not reduce übrig. A day already carrying a non-work label — a Feiertag
in the middle of the block, a Krank day — keeps what it has and is reported as
skipped.

This ticket covers only the case that fits within the remaining budget. The
over-long case is ticket 04.

**Blocked by:** 02.

**Status:** done

The planning logic belongs in the same pure module as the Urlaubskonto
derivation — one seam for the feature. It takes a start date, an end date, the
existing day labels and the remaining budget, and returns the days to become
Urlaub plus the skipped days each with a reason. **It writes nothing**; the
caller applies the result only after the user confirms.

Rules, in order:

1. A day already carrying a non-`work` label is skipped and keeps its label.
2. Weekends always become Urlaub and never consume budget.
3. Remaining weekdays become Urlaub.

The Kalender already tracks a selected date; span selection extends that rather
than replacing it.

- [ ] A continuous range can be selected on the Kalender and marked as Urlaub
- [ ] The confirmation states the number of days to be marked and the number
      skipped, before anything is written
- [ ] Cancelling the confirmation writes nothing at all
- [ ] Weekends inside the range are marked and shown in the vacation colour
- [ ] Weekends inside the range do not reduce übrig
- [ ] A Feiertag inside the range keeps its label, is reported as skipped, and
      consumes no vacation day
- [ ] Applying the range writes exactly what the confirmation said
- [ ] The Urlaubskonto updates immediately after the range is applied
- [ ] Pure-module tests cover: a range fitting within budget, a single-day range,
      a range given with start and end reversed, and a range containing a
      pre-existing label

## Comments

**Implemented** in `7f070a4 feat(vacation): mark a continuous span of days as
Urlaub`.

`planUrlaubSpan` lives beside `deriveUrlaubskonto` in the same pure module and
returns `UrlaubSpanPlan { start, end, vacation, gleitzeittag, skipped, kosten,
uebrigDanach }`. It writes nothing; `store.applyUrlaubSpanPlan` is a thin batch
write the caller only reaches after the user confirms.

**The interaction, which the ticket left open:** the Urlaubskonto card gained a
"Zeitraum als Urlaub eintragen" button. That puts the Kalender into span mode,
where the *same* day tap that normally opens `DayDetail` instead picks an end of
the span — first tap sets the anchor, second builds the plan and opens
`UrlaubSpanConfirm`. Span mode ends on confirm, on either Abbrechen, on backdrop
click, or on Escape; all of those write nothing. Tapping the anchor twice is a
single-day span, and taps in either calendar order are normalized by the planner.

**One change beyond the ticket's wording, deliberately.** `toneFor` in
`CalendarView` muted every date after today *before* checking the label, so a
span planned for a future month rendered grey rather than in the Urlaub colour —
which made "weekends inside the range are shown in the vacation colour"
unsatisfiable in the ordinary forward-planning case. The label check now runs
first. Side effect: future `sick`/`holiday`/`gleitzeittag` days now show their
colour too.

**Known limit:** a span crossing an Urlaubsjahr boundary draws on the übrig of
the year the span *starts* in. Multi-year spans are out of scope in the spec;
noted at the call site.
