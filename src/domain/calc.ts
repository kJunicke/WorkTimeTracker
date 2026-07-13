// Pure §8 domain calculations (HANDOFF.md §3.4, §3.5, §3.6, §8). No I/O.
// Thresholds are inclusive `>=`, computed once from gross work (no iteration).

import type { Session, DayMeta, DayType, DayDerivation } from './types'
import { sessionSeconds, enumerateDays, isWeekend } from './time'
import { SIX_HOURS, NINE_HOURS, THIRTY_MIN, FORTY_FIVE_MIN } from './constants'

/** Label wins: vacation/sick/holiday credit the day regardless of logged work (HANDOFF §3.5). */
function isLabeledType(type: DayType): boolean {
  return type === 'vacation' || type === 'sick' || type === 'holiday'
}

/** German legal break (§4 ArbZG) required for a given gross work total. */
export function requiredBreakSeconds(grossWorkSeconds: number): number {
  if (grossWorkSeconds >= NINE_HOURS) return FORTY_FIVE_MIN
  if (grossWorkSeconds >= SIX_HOURS) return THIRTY_MIN
  return 0
}

/**
 * Derives one calendar day's totals from its sessions + label + target.
 * Pure and synchronous — the caller supplies `isWeekend` and the bucketed
 * `sessions` (already filtered to this day).
 */
export function deriveDay(args: {
  date: string
  type: DayType
  isWeekend: boolean
  sessions: Session[]
  dailyTargetSeconds: number
}): DayDerivation {
  const { date, type, isWeekend: weekend, sessions, dailyTargetSeconds } = args

  const gross = sessions
    .filter((s) => s.kind === 'work')
    .reduce((sum, s) => sum + sessionSeconds(s), 0)
  const loggedBreak = sessions
    .filter((s) => s.kind === 'break')
    .reduce((sum, s) => sum + sessionSeconds(s), 0)

  const labeled = isLabeledType(type)

  // Label wins: vacation/sick/holiday zero out the break-law/net computation
  // entirely, even though gross/loggedBreak keep the real sums for display.
  const required = labeled ? 0 : requiredBreakSeconds(gross)
  const effective = labeled ? 0 : Math.max(loggedBreak, required)
  const autoDeducted = labeled ? 0 : Math.max(0, required - loggedBreak)
  const net = labeled ? 0 : gross - effective

  // Weekends and labeled days carry no target, so an empty one is never
  // undertime. But weekend *work* still counts: with expected = 0 the delta
  // is simply the net worked (pure overtime). Labeled days stay fully neutral.
  const expected = labeled || weekend ? 0 : dailyTargetSeconds
  const delta = labeled ? 0 : net - expected

  return {
    date,
    type,
    isWeekend: weekend,
    grossWorkSeconds: gross,
    loggedBreakSeconds: loggedBreak,
    requiredBreakSeconds: required,
    effectiveBreakSeconds: effective,
    autoDeductedSeconds: autoDeducted,
    netWorkSeconds: net,
    expectedSeconds: expected,
    deltaSeconds: delta,
  }
}

/**
 * Derives every day in [startDate..endDate] (inclusive) and sums the balance.
 * Enumerating every day (rather than only days with data) means an empty
 * past weekday with no label automatically counts as full undertime.
 */
export function deriveRange(args: {
  startDate: string
  endDate: string
  sessionsByDay: Map<string, Session[]>
  dayMetaByDay: Map<string, DayMeta>
  dailyTargetSeconds: number
}): { days: DayDerivation[]; balanceSeconds: number } {
  const { startDate, endDate, sessionsByDay, dayMetaByDay, dailyTargetSeconds } = args

  const days: DayDerivation[] = []
  let balanceSeconds = 0

  for (const date of enumerateDays(startDate, endDate)) {
    const type = dayMetaByDay.get(date)?.type ?? 'work'
    const sessions = sessionsByDay.get(date) ?? []
    const day = deriveDay({
      date,
      type,
      isWeekend: isWeekend(date),
      sessions,
      dailyTargetSeconds,
    })
    days.push(day)
    balanceSeconds += day.deltaSeconds
  }

  return { days, balanceSeconds }
}
