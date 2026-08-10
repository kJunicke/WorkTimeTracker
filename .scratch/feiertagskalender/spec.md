# Feiertagskalender — automatic public holiday labeling

Status: done

## Problem

`holiday` is an existing `DayType`, but the app has no knowledge of which days
are actually public holidays — the user labels each one by hand. This matters
most inside a vacation block: a Feiertag falling in the middle of two weeks off
must not consume a vacation day, and today that only works because the user
remembers to label it `holiday` instead of `vacation`.

## Sketch

Bake a German public-holiday list into the app and auto-apply the `holiday`
label.

## Open questions

- Which Bundesland? Public holidays differ by state, so this needs a new
  setting. Movable feasts (Ostern, Pfingsten, Fronleichnam) need computing, not
  a static table.
- Does an auto-applied label override a manual one, or only fill in unlabeled
  days? A user who worked on a Feiertag must be able to say so.
- Does it apply retroactively to already-recorded days, or only going forward?

## Resolution

Built as `src/domain/holidays.ts` plus an overlay in the store — see
`docs/adr/0003-feiertage-are-an-overlay-not-stored-rows.md`. The dates and the
verified horizon are sourced in `docs/research/berlin-public-holidays.md`.

Answers to the open questions above:

- **Which Bundesland**: Berlin only, hardcoded — no setting. A second Land would
  need its own verified list, which is a research cost per Land, not a config
  field. `FEIERTAGE_LAND` is the one place that assumption is named.
- **Override or fill in?**: fill in only. A stored `DayMeta` row always beats the
  overlay, so someone who worked on a Feiertag says so once and it sticks;
  clearing the label returns the day to Feiertag rather than to nothing.
- **Retroactive?**: both, and not by choice — the overlay is a view, so it has
  no "already ran" state and covers every day in the verified window. In
  practice nothing moved: the only Feiertage inside the tracked history were
  already labeled by hand.

Deliberately still out of scope: a second Bundesland, and any automatic
extension of the verified window (a new year is a deliberate re-check).

## Origin

Raised during the `urlaubskonto` grilling session as an explicit follow-up —
the decision there was to keep holiday labeling manual for now.
