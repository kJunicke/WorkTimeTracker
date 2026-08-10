# 02 — Urlaubskonto for a leave year

**What to build:** The user sets a standard yearly **Urlaubsanspruch** in the
settings screen, plus an override for any individual **Urlaubsjahr** that
differs. The Kalender then shows the **Urlaubskonto** for the leave year of the
month on screen: **übrig · verplant · genommen**. Labeling a day as Urlaub moves
those numbers; labeling a Gleitzeittag, Krank or Feiertag does not. Navigating
from December into January swings the counter to the next year's Konto.

This is the feature as originally asked for, complete and usable without span
selection.

**Blocked by:** 01 — the derivation must ignore `gleitzeittag`, so the label has
to exist first.

**Status:** done

**This ticket introduces the feature's single test seam:** one new pure module in
the domain layer, beside the existing calculation module, exporting the
Urlaubskonto derivation. All the rules live there. The settings screen, the
store getter and the Kalender tile carry no logic of their own — if a rule is
being decided outside the pure module, it is in the wrong place. Mirror the
existing calculation test file: pure functions, no I/O, exhaustive tabulated
cases.

Rules for the derivation, given a leave year, the day labels, that year's
Urlaubsanspruch and today's date:

- Only `vacation` counts. Every other label counts for nothing.
- Weekend days never count, even when labeled `vacation`.
- Strictly before today ⇒ **genommen**. Today or later ⇒ **verplant**.
- **übrig** = anspruch − genommen − verplant, and is allowed to go negative.
- Days outside the given year never count.

Entitlement storage is two settings fields: a standard figure, and a sparse map
from four-digit year string to that year's override. A year absent from the map
inherits the standard figure, so every year is answerable. Both are
optional-with-default on read, following the precedent set by the `onboarded`
field, and both go into the backup payload with `schemaVersion` held at 1. The
store's settings-update action currently accepts a patch narrowed to two
specific keys and needs widening.

Carry-over is deliberately not modelled — the user folds `Resturlaub` into a
year's figure by hand.

Gleitzeittage are deliberately **not** shown on the Urlaubskonto. Their cost
already appears in the Gleitzeit balance, and mixing them in invites reading them
as something drawn from the entitlement.

- [ ] A standard Urlaubsanspruch can be set, and a per-year override added,
      edited and removed
- [ ] Removing an override returns that year to the standard figure rather than
      setting it to zero
- [ ] The Kalender shows übrig, verplant and genommen for the displayed month's year
- [ ] Scrolling from December to January swings the counter to the next year
- [ ] A vacation day before today counts as genommen; one dated exactly today
      counts as verplant
- [ ] A vacation day on a weekend consumes nothing
- [ ] `sick`, `holiday` and `gleitzeittag` days consume nothing
- [ ] Vacation days in a neighbouring year never count toward this one
- [ ] übrig goes negative when labeled days exceed the entitlement
- [ ] Both settings fields round-trip through backup; a backup lacking them still
      imports with defaults applied
- [ ] Pure-module tests cover every rule above

## Comments

**Implemented** in `b02d006 feat(vacation): Urlaubskonto for a leave year` and
`c393441 fix(db): normalize reactive proxies at the persistence boundary`.

The seam is `src/domain/vacation.ts` with `src/domain/vacation.test.ts` beside
it. Exports: `Urlaubskonto`, `deriveUrlaubskonto`, `urlaubsanspruchFor`,
`resolveUrlaubsanspruchSettings`, `setUrlaubsanspruchOverride`. Settings fields
are `urlaubsanspruchStandard?: number` and
`urlaubsanspruchByYear?: Record<string, number>`, with
`DEFAULT_URLAUBSANSPRUCH = 30` in `domain/constants.ts` and a new `yearKey`
helper in `domain/time.ts`.

Both fields are spelled **optional** (`?`) rather than copying `onboarded`'s
non-optional declaration. `onboarded` gets away with non-optionality only
because `repo.getSettings` normalizes it on read; spelling these optional makes
TypeScript enforce the defaulting at every call site instead, which is why
every read goes through `resolveUrlaubsanspruchSettings`.

**The gap this ticket nearly shipped with:** `toStoredSettings` in
`src/db/db.ts` whitelists settings fields one by one, so both new fields were
silently dropped on every persist — the entitlement would not have survived a
reload, with a clean typecheck and a green suite throughout. That whitelist is
now the one place that must be kept in step with the `Settings` type, and the
Urlaubsanspruch round-trip is pinned by a test in `src/db/repo.test.ts`, because
these figures are hand-typed and cannot be re-derived from anything else on disk.

Not verified by an executed test: the settings screen and the Kalender tile. The
rules behind them are covered by the pure module; the Vue layer is a
pass-through, verified by typecheck and reading only.
