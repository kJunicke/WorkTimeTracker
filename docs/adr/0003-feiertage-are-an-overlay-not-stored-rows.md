# Feiertage are an overlay over the stored labels, not `holiday` rows on disk

Berlin's gesetzliche Feiertage are labeled automatically. We considered writing
a `DayMeta` row with `type: 'holiday'` for each one into IndexedDB — a backfill
on app open, plus a top-up whenever a new year comes into range. We rejected it
and derive them instead: `useStore.dayMetaByDay` is now the *stored* labels with
the Feiertage of `src/domain/holidays.ts` filled in underneath, and nothing
synthetic ever reaches the disk.

## Considered Options

**Written rows.** The written row is a copy of a fact that lives somewhere else,
so the two can disagree — and only the copy is durable. Correcting the Feiertag
list (a statute amendment, a one-off Feiertag, a fixed bug in the Easter
arithmetic) then has to *find and rewrite* every stale row it already produced,
which is a migration for something that was never user data. Worse, the rows
are indistinguishable from labels the user set by hand: "was this day
Feiertag because Berlin says so, or because I said so?" has no answer on disk,
so the app cannot tell what it may safely correct. They also land in every JSON
backup, where they read as ten hand-made decisions a year that the user never
made.

**A derived overlay.** The list stays the single source and the day labels stay
purely the user's. A stored row simply wins over the overlay, which is the whole
of the "does an auto label override a manual one?" question answered in one
line — and `clearDayType` puts a day back to *Feiertag* rather than to nothing,
because clearing removes the override, not the fact underneath it.

## Consequences

Past and future days are covered by the same mechanism, since a view has no
"already ran" state to backfill from — which is what settles the spec's third
open question ("retroactive, or only going forward?") without a choice being
needed.

`store.dayMetaByDay` is now the **effective** map and everything that derives —
`deriveRange`, `derivedDays`, `unlabeledPastWeekdays`, `planUrlaubSpan` — reads
it, so a Feiertag inside a marked Urlaub span is skipped and costs no
Urlaubstag, which was the original motivation. The raw stored rows remain
available as `store.explicitDayMetaByDay`, and exactly three callers want them:
the backup export, History's list of days (an auto-Feiertag is not a day the
user recorded anything on), and DayDetail's "Zurücksetzen" button (there is no
stored row to reset).

The list carries an explicit horizon, `FEIERTAGE_GEPRUEFT_BIS`, rather than
extrapolating the rules forever: seven of the ten Feiertage are computed, so the
arithmetic would happily answer for 2094, but only a primary source can say the
statute still lists those ten — and Berlin has twice inserted a self-repealing
one-off Feiertag that no rule predicts (8. Mai 2020, 8. Mai 2025, and the
17. Juni 2028 still in force). Beyond the horizon the app labels nothing and the
Kalender says so. Extending it means re-reading the sources and moving one
constant; `docs/research/berlin-public-holidays.md` records what to re-read.
