# 05 — Lowering an Urlaubsanspruch below the days already labeled

**What to build:** Nothing yet. Deferred during the design session and recorded
so the gap is documented rather than silently assumed.

**Blocked by:** 02.

**Status:** needs-triage

The Urlaubsanspruch is a hard cap enforced at the moment a day is labeled, but
the entitlement can be edited afterwards. Lowering 2026 from 20 to 15 when 18
days are already marked produces a state the labeling rule would have refused.

Interim behaviour, deliberately chosen: the edit is allowed, übrig simply reads
negative, and there is no warning and no block.

## Options considered

- **Block the edit.** Rejected as infuriating — refusing a settings change
  because of past data.
- **Auto-convert the excess days to Gleitzeittage.** Rejected because it
  rewrites history, which is exactly what ADR 0001 designed the Gleitzeittag to
  avoid.
- **Allow it and warn.** The likely resolution: a visible negative übrig styled
  as a warning, telling the user to go fix specific days themselves.

## Comments

**Still deferred — nothing was built for this ticket.** Recording what tickets
02 and 04 settled, since both touched the negative-übrig state.

The interim behaviour is in place as designed: lowering an Urlaubsanspruch below
the days already labeled is allowed, and übrig simply reads negative. Two things
went slightly beyond "no warning at all", and both lean toward the
**allow-it-and-warn** option this ticket named as the likely resolution:

- The Kalender's Übrig tile renders with the `under` tone when the figure is
  negative (`CalendarView.vue`), so an over-drawn year is at least visible
  rather than silent. There is still no text telling the user *which* days to go
  fix, which is the part that remains unbuilt.
- `planUrlaubSpan` clamps its spending budget with `Math.max(0, uebrig)`
  (ticket 04). A negative übrig therefore offers no vacation days at all and the
  whole span comes back as a Gleitzeittag offer. It is explicitly **not** treated
  as a debt to be worked off before the year may spend again — that would have
  compounded one edit into a second surprise.

What is still open, unchanged: no warning naming the specific over-drawn days,
and no path from the settings screen to fixing them.
