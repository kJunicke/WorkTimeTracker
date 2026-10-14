// The Tagessoll-Zeitleiste (ADR 0004). Pure; no I/O.

/**
 * The slice of `Settings` the Tagessoll is read from: the undated "seit
 * Beginn" value plus sparse entries keyed by their local "YYYY-MM-DD" start
 * date. `tagessollAb` is optional-with-default on read — a settings record or
 * backup from before the timeline simply lacks it.
 */
export interface TagessollSettings {
  dailyTargetSeconds: number
  tagessollAb?: Record<string, number>
}

/**
 * The Tagessoll in force on `date`: the entry with the latest start date on or
 * before it, otherwise the "seit Beginn" value. ISO dates compare correctly as
 * strings, so no parsing is needed. This is the timeline's value only — that a
 * weekend or a gutgeschriebener Tag carries none is `deriveDay`'s business.
 */
export function tagessollAm(date: string, settings: TagessollSettings): number {
  let start = ''
  let seconds = settings.dailyTargetSeconds
  for (const [ab, value] of Object.entries(settings.tagessollAb ?? {})) {
    if (ab <= date && ab > start) {
      start = ab
      seconds = value
    }
  }
  return seconds
}

/**
 * Returns a new entry map with `ab` set to `seconds`, or — for `seconds ===
 * null` — with that entry deleted. Start dates are unique, so setting a date
 * that already has an entry replaces it; deleting hands its days back to the
 * preceding entry.
 */
export function setTagessollEintrag(
  tagessollAb: Record<string, number> | undefined,
  ab: string,
  seconds: number | null,
): Record<string, number> {
  const next = { ...(tagessollAb ?? {}) }
  if (seconds === null) delete next[ab]
  else next[ab] = seconds
  return next
}

/**
 * Whether going from `alt` to `neu` changes the Tagessoll of any day up to and
 * including `heute` — the question that decides whether the settings show the
 * Saldo change before saving. The "seit Beginn" value always reaches some past
 * day (the past is unbounded); beyond that both timelines are constant between
 * start dates, so comparing them at every start date up to `heute` suffices.
 */
export function betrifftVergangenheit(alt: TagessollSettings, neu: TagessollSettings, heute: string): boolean {
  if (alt.dailyTargetSeconds !== neu.dailyTargetSeconds) return true
  const starts = [...Object.keys(alt.tagessollAb ?? {}), ...Object.keys(neu.tagessollAb ?? {})]
  return starts.some((ab) => ab <= heute && tagessollAm(ab, alt) !== tagessollAm(ab, neu))
}
