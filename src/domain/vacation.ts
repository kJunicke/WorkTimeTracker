// Pure Urlaubskonto derivation — the single place every vacation rule lives.
// No I/O, no store, no framework: the settings screen, the store getter and
// the Kalender tile are all thin pass-throughs over this module. If a rule is
// being decided outside this file, it is in the wrong place.
//
// Carry-over / Resturlaub is deliberately NOT modelled (see spec "Out of
// Scope"): the user folds last year's remainder into a year's Urlaubsanspruch
// by hand, which sidesteps every expiry rule.

import type { DayMeta, DayType, Settings } from './types'
import { enumerateDays, isWeekend, yearKey } from './time'
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
  /** Übrig: anspruch − genommen − verplant. May be negative; see `deriveUrlaubskonto`. */
  uebrig: number
}

/**
 * Übrig floored at zero — the Urlaubstage a year still has to give.
 *
 * Übrig is allowed to go negative (`deriveUrlaubskonto`), but an over-drawn
 * Urlaubsjahr is simply a year with nothing left, never a debt the next Urlaub
 * day is asked to pay off before it may draw anything. Shared by every rule
 * that spends übrig so that reading is stated exactly once.
 */
function nutzbaresUebrig(uebrig: number): number {
  return Math.max(0, uebrig)
}

/**
 * A hand-typed Urlaubsanspruch reduced to a figure the domain accepts: whole
 * days, never negative, never more than a calendar year holds. What counts as
 * a valid entitlement is a vacation rule, so it is decided here rather than in
 * whichever input field happens to collect the number — an unparseable or
 * empty input reads as zero.
 */
export function normalizeUrlaubsanspruch(tage: number): number {
  return Math.max(0, Math.min(366, Math.floor(tage) || 0))
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

// ---------------------------------------------------------------------------
// Planning a span of Urlaub
// ---------------------------------------------------------------------------

/** One day the plan will NOT write, and what it keeps instead. */
export interface UrlaubSpanSkip {
  date: string
  /**
   * The Tageskennzeichnung the day already carries and keeps. Never `work`:
   * an explicit `work` row is not a label in the skipping sense and is
   * overwritten like an unlabeled day, so it can never appear here.
   */
  type: Exclude<DayType, 'work'>
}

/**
 * What marking a span would write — pure data, applied only once the user
 * confirms it. Nothing in here has been persisted.
 */
export interface UrlaubSpanPlan {
  /** Inclusive span the plan covers, normalized so `start` <= `end`. */
  start: string
  end: string
  /** Days to be written as `vacation`, in calendar order. */
  vacation: string[]
  /**
   * Weekdays the Urlaubsanspruch no longer covers, in calendar order — an
   * **offer**, not a decision.
   * Writing these spends Gleitzeit, so the caller must ask before applying
   * them; `ohneGleitzeittage` is the declined form of the same plan.
   */
  gleitzeittag: string[]
  /** Days left untouched, in calendar order, each with the label it keeps. */
  skipped: UrlaubSpanSkip[]
  /** Vacation days this plan draws from the Urlaubskonto — weekdays only. */
  kosten: number
  /**
   * `uebrig` minus `kosten`. Never below zero for a fresh plan — the cap
   * moves the overflow into `gleitzeittag` rather than overdrawing — except
   * when the year was *already* over-drawn, where it simply reports that.
   */
  uebrigDanach: number
}

/**
 * Plans marking a continuous span as Urlaub. **It writes nothing** — the
 * caller applies the returned plan only after the user confirms it, so
 * cancelling the confirmation costs nothing at all.
 *
 * Rules, in order:
 *  1. A day already carrying a non-`work` label was set deliberately: it is
 *     skipped, keeps that label, and consumes no vacation day. An explicit
 *     `work` row is not a label in that sense and is overwritten like a day
 *     that carries no row at all.
 *  2. Weekends always become Urlaub — so the whole period reads as time away
 *     in the Kalender — but never cost an Urlaubstag: a weekend carries no
 *     daily target, so there is nothing to be credited for.
 *  3. Every remaining weekday becomes Urlaub and costs one day.
 *  4. Once nothing is übrig, every further weekday comes back as a
 *     Gleitzeittag *candidate* — never as Urlaub. That is what makes the
 *     Urlaubsanspruch a hard cap (ADR 0001): the plan can no longer overdraw
 *     it, so `uebrigDanach` cannot be driven below zero by marking a span.
 *
 * The candidates are an offer, never a decision: a Gleitzeittag costs its
 * daily target against the Gleitzeit, and the app must never spend Gleitzeit
 * without asking. The caller applies `gleitzeittag` only if the user says yes,
 * and `ohneGleitzeittage` is the declined form of the same plan.
 *
 * `uebrig` is passed in rather than derived, because whose Urlaubskonto a span
 * draws on is the caller's question (a span crossing a Urlaubsjahr boundary is
 * not modelled — see spec "Out of Scope").
 */
export function planUrlaubSpan(args: {
  /** Either end of the span; the two are swapped if given in reverse order. */
  start: string
  end: string
  /** Existing labels by "YYYY-MM-DD", as held by the store. Never mutated. */
  dayMetaByDay: ReadonlyMap<string, DayMeta>
  /** Übrig — the Urlaubstage of that Urlaubsjahr the span draws on. */
  uebrig: number
}): UrlaubSpanPlan {
  const { dayMetaByDay, uebrig } = args
  // "YYYY-MM-DD" sorts lexicographically, so this is the whole normalization.
  const [start, end] = args.start <= args.end ? [args.start, args.end] : [args.end, args.start]

  const vacation: string[] = []
  const gleitzeittag: string[] = []
  const skipped: UrlaubSpanSkip[] = []
  let kosten = 0

  const urlaubstage = nutzbaresUebrig(uebrig)

  for (const date of enumerateDays(start, end)) {
    const existing = dayMetaByDay.get(date)
    if (existing && existing.type !== 'work') {
      skipped.push({ date, type: existing.type })
      continue
    }
    // Weekends can never overflow: they cost no Urlaubstag, so there is
    // nothing for them to run out of and they stay Urlaub whatever remains.
    if (isWeekend(date)) {
      vacation.push(date)
      continue
    }
    if (kosten < urlaubstage) {
      vacation.push(date)
      kosten += 1
    } else {
      gleitzeittag.push(date)
    }
  }

  return { start, end, vacation, gleitzeittag, skipped, kosten, uebrigDanach: uebrig - kosten }
}

/**
 * The same plan with the Gleitzeittag offer declined: the overflow weekdays
 * are dropped, so applying it leaves them untouched while every Urlaub day the
 * Urlaubsanspruch covered is still written. The plan given is never mutated.
 *
 * It lives here rather than at the call site so that "declining" means exactly
 * one thing everywhere, and so the rule stays testable without a store.
 */
export function ohneGleitzeittage(plan: UrlaubSpanPlan): UrlaubSpanPlan {
  return { ...plan, gleitzeittag: [] }
}

// ---------------------------------------------------------------------------
// Labeling one single day
// ---------------------------------------------------------------------------

/**
 * What labeling one day resolves to: either write the Tageskennzeichnung as
 * asked, or — for an Urlaub day the Urlaubsanspruch no longer covers — ask the
 * user first whether the day should become a Gleitzeittag instead. There is
 * deliberately no third answer that writes anything past the cap.
 */
export type TageskennzeichnungPlan = 'kennzeichnen' | 'gleitzeittagAnbieten'

/**
 * Whether one day may simply be labeled as the user asked. **It writes
 * nothing** — the caller labels the day only for `kennzeichnen`, and for
 * `gleitzeittagAnbieten` puts the offer on screen and writes nothing at all
 * unless the user accepts it.
 *
 * The Urlaubsanspruch is a hard cap enforced at the point of labeling (ADR
 * 0001), and a span is not the only way to label a day. Without this, übrig
 * could be driven negative one single-day tap at a time and the Urlaubskonto
 * would stop being a figure the user can book against.
 *
 * Rules:
 *  1. Every label other than `vacation` is unaffected: `sick`/`holiday` are
 *     credited days that cost no Urlaubstag, and a `gleitzeittag` deliberately
 *     draws on the Gleitzeit instead (so it is the very thing offered here).
 *  2. A weekend carries no daily target, so marking it Urlaub costs nothing
 *     and is allowed however little is übrig — the same rule that keeps
 *     weekends inside a span from ever overflowing.
 *  3. A day that already carries `vacation` is being re-confirmed, not newly
 *     spent: it was drawn from the Urlaubskonto once already and re-labeling
 *     it must not be refused for a day it is itself paying for.
 *  4. Otherwise a weekday needs at least one Urlaubstag übrig. With none, the
 *     answer is the Gleitzeittag offer — the app neither labels vacation past
 *     the cap nor spends Gleitzeit without asking.
 */
export function planTageskennzeichnung(args: {
  /** The day being labeled, local "YYYY-MM-DD". */
  date: string
  /** The Tageskennzeichnung the user picked. */
  type: DayType
  /** The label the day already carries, or `undefined` for an unlabeled day. */
  existing: DayType | undefined
  /** Übrig of that day's Urlaubsjahr, as `deriveUrlaubskonto` reports it. */
  uebrig: number
}): TageskennzeichnungPlan {
  const { date, type, existing, uebrig } = args
  if (type !== 'vacation') return 'kennzeichnen'
  if (isWeekend(date)) return 'kennzeichnen'
  if (existing === 'vacation') return 'kennzeichnen'
  return nutzbaresUebrig(uebrig) >= 1 ? 'kennzeichnen' : 'gleitzeittagAnbieten'
}
