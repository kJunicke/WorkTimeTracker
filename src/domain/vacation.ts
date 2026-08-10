// Pure Urlaubskonto derivation — the single place every vacation rule lives.
// No I/O, no store, no framework: the settings screen, the store getter and
// the Kalender tile are all thin pass-throughs over this module. If a rule is
// being decided outside this file, it is in the wrong place.
//
// Carry-over / Resturlaub is deliberately NOT modelled (see spec "Out of
// Scope"): the user folds last year's remainder into a year's Urlaubsanspruch
// by hand, which sidesteps every expiry rule.

import type { DayMeta, Settings } from './types'
import { isWeekend, yearKey } from './time'
import { DEFAULT_URLAUBSANSPRUCH } from './constants'

/** The two entitlement settings fields, both optional-with-default on read. */
export type UrlaubsanspruchSettings = Pick<
  Settings,
  'urlaubsanspruchStandard' | 'urlaubsanspruchByYear'
>

/** The Urlaubskonto of one Urlaubsjahr — entitlement, what it has been drawn against, and what remains. */
export interface Urlaubskonto {
  /** Four-digit Urlaubsjahr ("2026"). */
  urlaubsjahr: string
  /** That year's Urlaubsanspruch, in whole days. */
  anspruch: number
  /** Vacation weekdays strictly before today — days actually spent. */
  genommen: number
  /** Vacation weekdays today or later — committed, not yet spent. */
  verplant: number
  /** anspruch − genommen − verplant. May be negative; see `deriveUrlaubskonto`. */
  uebrig: number
}

/**
 * Applies the on-read defaults to both entitlement fields. The one place those
 * defaults exist, so an older settings record (or an older backup) is
 * answerable everywhere without each caller inventing its own fallback.
 */
export function resolveUrlaubsanspruchSettings(
  settings: UrlaubsanspruchSettings,
): Required<UrlaubsanspruchSettings> {
  return {
    urlaubsanspruchStandard: settings.urlaubsanspruchStandard ?? DEFAULT_URLAUBSANSPRUCH,
    urlaubsanspruchByYear: settings.urlaubsanspruchByYear ?? {},
  }
}

/**
 * The Urlaubsanspruch of one Urlaubsjahr: its explicit override if the map
 * holds one, otherwise the standard figure. Every year is therefore
 * answerable, including years the user has never configured.
 */
export function urlaubsanspruchFor(urlaubsjahr: string, settings: UrlaubsanspruchSettings): number {
  const resolved = resolveUrlaubsanspruchSettings(settings)
  return resolved.urlaubsanspruchByYear[urlaubsjahr] ?? resolved.urlaubsanspruchStandard
}

/**
 * Returns a new override map with `urlaubsjahr` set to `tage`, or — for
 * `tage === null` — with that year's entry *deleted*. Deleting rather than
 * zeroing is the whole point: an absent year inherits the standard figure, so
 * removing an override returns the year to the standard rather than to zero.
 */
export function setUrlaubsanspruchOverride(
  overrides: Record<string, number> | undefined,
  urlaubsjahr: string,
  tage: number | null,
): Record<string, number> {
  const next = { ...(overrides ?? {}) }
  if (tage === null) delete next[urlaubsjahr]
  else next[urlaubsjahr] = tage
  return next
}

/**
 * Derives one Urlaubsjahr's Urlaubskonto from the day labels.
 *
 * Only `vacation` counts — `sick`/`holiday` are credited days that cost no
 * entitlement, and a `gleitzeittag` draws on the Gleitzeit instead (ADR 0001),
 * so it is deliberately invisible here. Weekend days never count even when
 * labeled, so a two-week block costs ten days and not fourteen. A day strictly
 * before `today` is genommen, today and later verplant.
 *
 * `uebrig` is allowed to go negative: lowering an Urlaubsanspruch below the
 * days already labeled for that year is out of scope, and the interim
 * behaviour is to show the truth rather than block or clamp it.
 */
export function deriveUrlaubskonto(args: {
  urlaubsjahr: string
  dayMeta: readonly DayMeta[]
  anspruch: number
  /** Local "YYYY-MM-DD" for today — passed in, never read from the clock here. */
  today: string
}): Urlaubskonto {
  const { urlaubsjahr, dayMeta, anspruch, today } = args

  let genommen = 0
  let verplant = 0
  for (const meta of dayMeta) {
    if (meta.type !== 'vacation') continue
    if (yearKey(meta.date) !== urlaubsjahr) continue
    if (isWeekend(meta.date)) continue
    if (meta.date < today) genommen += 1
    else verplant += 1
  }

  return { urlaubsjahr, anspruch, genommen, verplant, uebrig: anspruch - genommen - verplant }
}
