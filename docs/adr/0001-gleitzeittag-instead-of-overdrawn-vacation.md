# Days off beyond the Urlaubsanspruch are a Gleitzeittag, not an over-drawn vacation day

The Urlaubskonto needs an answer for taking a day off with no vacation days
left. We considered letting `vacation` days go past the entitlement and making
the excess ones cost their daily target against the Gleitzeit. We rejected it
and added a fifth `DayType`, `gleitzeittag`, instead: the app refuses to label
more vacation days than the year's Urlaubsanspruch allows, and a day off beyond
that is labeled a Gleitzeittag.

## Considered Options

**Over-drawn vacation days.** Whether a given `vacation` day is over-drawn is
not a property of that day — it depends on how many vacation days precede it in
the leave year and on that year's entitlement. That has two costs. `deriveDay`
stops being a pure function of a single day and needs the whole year threaded
through it. Worse, labeling an *earlier* day as vacation shifts the boundary and
silently flips a day in the settled past from neutral to a full day's shortfall,
rewriting Gleitzeit history after the fact.

**A distinct Gleitzeittag label.** The label *is* the decision, made once when
the day is marked, so nothing is ever recomputed and no history is rewritten.

## Consequences

`gleitzeittag` is deliberately **not** a credited day — it is excluded from
`isLabeledType` in `src/domain/calc.ts`. It therefore derives exactly like an
ordinary work day: it carries the full daily target, logged sessions count
normally, and an empty one yields `deltaSeconds === -dailyTargetSeconds` with no
new branch in the calculation. The label's only job is to record that the
shortfall was deliberate, which is what distinguishes it from a day someone
simply forgot to track.

The Urlaubsanspruch becomes a hard cap enforced at the point of labeling rather
than a soft figure reported after the fact.
