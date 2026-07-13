// Pure date/format helpers (HANDOFF.md §3, §8; CLAUDE.md domain/time.ts contract).
// No framework, no I/O. All "dateKey"/"dayKey" values are local "YYYY-MM-DD" strings.

import type { Session } from './types'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Local (device tz) "YYYY-MM-DD" for an epoch-millis instant. Uses
 * getFullYear/getMonth/getDate — never UTC — so a session belongs to the
 * calendar day it started on the device's own clock (HANDOFF §3.1).
 */
export function dayKeyFromMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Today's local day key. */
export function todayKey(nowMs: number = Date.now()): string {
  return dayKeyFromMs(nowMs)
}

/**
 * True for Saturday/Sunday. Parses `dateKey` as LOCAL date components.
 * PITFALL: never `new Date("YYYY-MM-DD")` — that's parsed as UTC midnight
 * and can shift the apparent weekday depending on the device timezone.
 */
export function isWeekend(dateKey: string): boolean {
  const [y, m, d] = dateKey.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return day === 0 || day === 6
}

/**
 * Inclusive list of "YYYY-MM-DD" keys from startKey to endKey, stepping one
 * local calendar day at a time. Empty array if startKey is after endKey.
 */
export function enumerateDays(startKey: string, endKey: string): string[] {
  const [sy, sm, sd] = startKey.split('-').map(Number)
  const [ey, em, ed] = endKey.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  if (start.getTime() > end.getTime()) return []

  const days: string[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    days.push(dayKeyFromMs(cursor.getTime()))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

/** Whole seconds spanned by a session; 0 while running (endMs == null); never negative. */
export function sessionSeconds(s: Session): number {
  if (s.endMs == null) return 0
  return Math.max(0, Math.round((s.endMs - s.startMs) / 1000))
}

/** "7h 30m" | "30m" | "0m" — floors to whole minutes. Never a decimal-hour display. */
export function formatDuration(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** "+3h 15m" | "−1h 40m" (U+2212 minus sign) | "±0m" for balance/delta display. */
export function formatSignedDuration(totalSeconds: number): string {
  if (totalSeconds === 0) return '±0m'
  const sign = totalSeconds > 0 ? '+' : '−'
  return `${sign}${formatDuration(Math.abs(totalSeconds))}`
}

/**
 * Live stopwatch display for the running timer: "H:MM:SS" once past an hour,
 * else "M:SS" (minutes unpadded, seconds always 2 digits) — the conventional
 * media-player stopwatch format. Never negative.
 */
export function formatStopwatch(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${m}:${pad2(sec)}`
}

/**
 * ISO-8601 week key ("YYYY-Www"), e.g. "2026-W19". Implements the Thursday
 * rule: the ISO week (and its year) is the one containing that week's
 * Thursday. Done via Date.UTC throughout — this is a pure calendar
 * computation (not an instant conversion), so working in UTC sidesteps
 * local DST-transition edge cases entirely.
 */
export function weekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const isoDayNum = date.getUTCDay() || 7 // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - isoDayNum) // Thursday of this ISO week
  const isoYear = date.getUTCFullYear()
  const yearStart = Date.UTC(isoYear, 0, 1)
  const weekNo = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${isoYear}-W${pad2(weekNo)}`
}

/** Calendar month ("YYYY-MM") that a day key belongs to. */
export function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

// ---------------------------------------------------------------------------
// Display helpers added in wave 3 (History screen — CLAUDE.md domain/time.ts
// contract: "display helpers as needed"). Additive only.
// ---------------------------------------------------------------------------

/** "HH:MM" 24h local clock time for an epoch-millis instant (never AM/PM). */
export function formatClock(ms: number): string {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * "Mi., 06.05.2026" — German short weekday + zero-padded date, for a local
 * "YYYY-MM-DD" day key. Parses the key as LOCAL date components (see the
 * `isWeekend` pitfall note above) so the displayed weekday always matches.
 */
export function formatDayHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * "YYYY-MM-DDTHH:mm" local time, matching the value format of a native
 * `<input type="datetime-local">`. Used to prefill session-edit forms from
 * an epoch-millis instant (History/Calendar session editing).
 */
export function msToLocalInputValue(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Parses a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm", no
 * offset) back to epoch millis. Per spec such a string is interpreted as
 * LOCAL time (unlike a date-only "YYYY-MM-DD" string, which is UTC — see the
 * `isWeekend` pitfall note above). Returns `null` for an empty/unparseable value.
 */
export function localInputValueToMs(value: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

// ---------------------------------------------------------------------------
// Display helpers added in wave 5 (Summary/Calendar screens). Additive only.
// ---------------------------------------------------------------------------

/** Local calendar-day arithmetic: shifts a "YYYY-MM-DD" key by `deltaDays` (may be negative). */
function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + deltaDays)
  return dayKeyFromMs(date.getTime())
}

/**
 * Inverse of `weekKey`: the local "YYYY-MM-DD" of the Monday that starts the
 * given ISO week ("YYYY-Www"). Jan 4th always falls in ISO week 1 (ISO 8601),
 * so week 1's Monday is derived from it, then shifted by `(weekNo - 1)` weeks.
 * Uses Date.UTC throughout, mirroring `weekKey`'s pure-calendar-computation
 * approach (sidesteps local DST edge cases); read back via UTC getters for
 * the same reason.
 */
export function mondayOfWeekKey(weekKeyStr: string): string {
  const [isoYearStr, weekNoStr] = weekKeyStr.split('-W')
  const isoYear = Number(isoYearStr)
  const weekNo = Number(weekNoStr)

  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4IsoDow = jan4.getUTCDay() || 7 // Mon=1..Sun=7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4IsoDow - 1))

  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (weekNo - 1) * 7)
  return `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`
}

/** "13.–19.07.2026" style short range for two "YYYY-MM-DD" keys (German dotted-date order). */
function formatDateRangeShort(startKey: string, endKey: string): string {
  const [sy, sm, sd] = startKey.split('-').map(Number)
  const [ey, em, ed] = endKey.split('-').map(Number)
  if (sy === ey && sm === em) return `${pad2(sd)}.–${pad2(ed)}.${pad2(em)}.${ey}`
  if (sy === ey) return `${pad2(sd)}.${pad2(sm)}.–${pad2(ed)}.${pad2(em)}.${ey}`
  return `${pad2(sd)}.${pad2(sm)}.${sy}–${pad2(ed)}.${pad2(em)}.${ey}`
}

/**
 * "13.–19.07.2026" — the Mon–Sun date range for an ISO week key ("YYYY-Www"),
 * German short-date style. Handles a week that straddles a month or year
 * boundary gracefully (e.g. "28.12.2026–03.01.2027").
 */
export function formatWeekRange(weekKeyStr: string): string {
  const monday = mondayOfWeekKey(weekKeyStr)
  const sunday = shiftDateKey(monday, 6)
  return formatDateRangeShort(monday, sunday)
}

/** "KW 29 · 13.–19.07.2026" — ISO week number + its Mon–Sun range, for a week key ("YYYY-Www"). */
export function formatWeekHeading(weekKeyStr: string): string {
  const weekNo = Number(weekKeyStr.slice(6))
  return `KW ${weekNo} · ${formatWeekRange(weekKeyStr)}`
}

/** "Juli 2026" — German full month name + year, from a "YYYY-MM" month key. */
export function formatMonthHeading(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

/** Local "YYYY-MM-DD" for the 1st of a "YYYY-MM" month key. */
export function startOfMonth(monthKeyStr: string): string {
  return `${monthKeyStr}-01`
}

/** Local "YYYY-MM-DD" for the last day of a "YYYY-MM" month key (handles leap Februaries). */
export function endOfMonth(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate() // day 0 of next month = last day of this one
  return `${monthKeyStr}-${pad2(lastDay)}`
}

/** Shifts a "YYYY-MM" month key by `delta` months (may be negative); rolls over year boundaries. */
export function addMonths(monthKeyStr: string, delta: number): string {
  const [y, m] = monthKeyStr.split('-').map(Number)
  const shifted = new Date(y, m - 1 + delta, 1)
  return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}`
}

/**
 * Mon-first calendar grid covering a whole month for Calendar's month view:
 * every day from the Monday on/before the 1st through the Sunday on/after
 * the last day, so the result length is always a multiple of 7 (4-6 rows
 * depending on the month), including the leading/trailing days borrowed
 * from adjacent months.
 */
export function monthGridDays(monthKeyStr: string): string[] {
  const first = startOfMonth(monthKeyStr)
  const last = endOfMonth(monthKeyStr)

  const [fy, fm, fd] = first.split('-').map(Number)
  const firstIsoDow = new Date(fy, fm - 1, fd).getDay() || 7 // Mon=1..Sun=7
  const gridStart = shiftDateKey(first, -(firstIsoDow - 1))

  const [ly, lm, ld] = last.split('-').map(Number)
  const lastIsoDow = new Date(ly, lm - 1, ld).getDay() || 7
  const gridEnd = shiftDateKey(last, 7 - lastIsoDow)

  return enumerateDays(gridStart, gridEnd)
}
