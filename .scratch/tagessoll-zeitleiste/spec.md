# Tagessoll-Zeitleiste — a daily target that changes over time

Status: done

## Problem

The daily target is a single number, `Settings.dailyTargetSeconds`, applied to
every day of the history. Changing it in the settings re-derives the whole
Gleitzeit with the new value — so a contract change (here: Aufstockung to full
time for three months from October 2026) cannot be recorded without turning
every past part-time day into undertime.

## Decisions

Settled in a grilling session; the rule itself is recorded in
`docs/adr/0004-tagessoll-is-a-timeline.md`.

- **Shape: a timeline, not default-plus-overrides.** The Tagessoll-Zeitleiste
  is one undated entry "seit Beginn" plus any number of entries "ab Datum X".
  Each entry holds until the next one starts; the last one runs on
  indefinitely. There is no end date and therefore no overlap to handle.
- **The "seit Beginn" entry** always exists and cannot be deleted, only its
  value changed. Today's `dailyTargetSeconds` becomes this entry — no data
  migration. It covers every day before the first dated entry, including days
  before the balance start date that the Kalender still derives.
- **One value per entry, Mon–Fri.** No per-weekday model yet. Weekends,
  gutgeschriebene Tage and Feiertage stay at 0 as today; a Gleitzeittag costs
  the Tagessoll in force on that day.
- **Any start day, future allowed.** An entry may start on any date, including
  in the future (so the end of an Aufstockung can be entered up front).
- **Start dates are unique.** Saving an entry on a date that already has one
  replaces it (an edit, with the warning below).
- **0 is allowed** (e.g. Elternzeit, unpaid leave): every worked minute counts
  as surplus.
- **Changing the past is allowed, but announced.** Any change that affects a
  day up to and including today — editing or deleting a past entry, adding an
  entry dated in the past, changing the "seit Beginn" value — shows before
  saving how the Gesamtsaldo moves (e.g. "Ändert deinen Saldo um −12h 30m").
  Changes that only affect future days save without a warning.
- **Backup:** the timeline is a new optional field; no format version bump
  (same pattern as `urlaubsanspruchByYear`). An old backup without it imports
  as a timeline with only the "seit Beginn" entry. Restore must copy the new
  field (`useStore.ts` restore path copies fields one by one).
- **UI:** the "Tagesziel (Mo–Fr)" card in `SettingsView.vue` becomes
  "Tagessoll (Mo–Fr)": the "seit Beginn" value, then a list of dated entries
  modelled on "Abweichende Urlaubsjahre", with the entry in force today
  marked. Onboarding keeps setting the "seit Beginn" value. Every other view
  (Day Soll tile, week/month bars, Kalender colours) picks up the right value
  automatically once derivation reads the timeline.

## Out of scope

- Urlaubskonto: the Urlaubsanspruch is counted in days and stays a manual
  per-year number; a change in hours does not touch it.
- A per-weekday model (different hours per weekday, fewer work days).
- A hint in the week/month summaries when the Tagessoll changes inside the
  period.

## Implementation notes

Facts from the codebase, not decisions:

- Storage suggestion: keep `dailyTargetSeconds` as the "seit Beginn" value and
  add a sparse `tagessollAb?: Record<'YYYY-MM-DD', number>` on the settings
  record, mirroring `urlaubsanspruchByYear` / `urlaubsanspruchFor`
  (`src/domain/vacation.ts:62-81`). A lookup `tagessollAm(date, settings)`
  returns the entry with the latest start date ≤ `date`, else the "seit
  Beginn" value. Remember the deep-copy in `toStoredSettings`
  (`src/db/db.ts:63-70`).
- `deriveDay` / `deriveRange` (`src/domain/calc.ts:62`, `:85-112`) take one
  scalar target; they need the per-day value instead.
- Callers passing the scalar today: `useStore.ts:159-217` (balance,
  `derivedDays`, `todayDerivation`), `DayDetail.vue:51-53`.
- Write path: `updateSettings` (`useStore.ts:468-478`); onboarding in
  `OnboardingPrompt.vue:18-33`.
- Backup: `src/db/backup.ts:133-155`, `BackupFile` in `src/domain/types.ts:92-105`.
- The one-off tools in `src/tools/` use the scalar too; they are audit scripts,
  not behaviour, and can keep passing a constant.
- The Saldo-delta warning can be computed by deriving the balance with the old
  and the new timeline and subtracting.

## Acceptance

- Entering "ab 2026-10-01: 8h" leaves every day before 1 October at the old
  Tagessoll and the Gesamtsaldo up to 30 September unchanged.
- Entering "ab 2027-01-01: 5h 55m" in advance makes 2027 days use 5h 55m with
  no further action.
- A Gleitzeittag inside the 8h period costs 8h.
- Deleting a past entry shows the Saldo change before saving; the days it
  covered fall back to the preceding entry.
- Exporting and re-importing a backup round-trips the timeline; importing an
  old backup yields only the "seit Beginn" entry.

## Resolution

Built as `src/domain/tagessoll.ts` (`tagessollAm`, `setTagessollEintrag`,
`betrifftVergangenheit`) with the timeline stored as the optional
`Settings.tagessollAb` next to `dailyTargetSeconds` ("seit Beginn"), as the
implementation notes suggested. `deriveRange` reads it per day; the settings
card holds back any change that reaches a day up to today until the Saldo
change is confirmed, and drops a held-back change if the timeline changes
underneath it.
