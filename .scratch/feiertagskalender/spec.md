# Feiertagskalender — automatic public holiday labeling

Status: needs-triage

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

## Origin

Raised during the `urlaubskonto` grilling session as an explicit follow-up —
the decision there was to keep holiday labeling manual for now.
