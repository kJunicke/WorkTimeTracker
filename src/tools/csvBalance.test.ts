// One-off migration harness: TrackAndGraph CSV → Arbeitszeit Tracker JSON backup.
// NOT a unit test of app behaviour — it is a throwaway conversion + audit that
// happens to live in vitest so it can import the REAL domain code (`deriveRange`,
// `dayKeyFromMs`) instead of reimplementing it and drifting.
//
// Run:
//   npx vitest run src/tools/csvBalance.test.ts --disable-console-intercept --reporter=verbose
//
// Output: `arbeitszeit-backup-from-trackandgraph.json`, importable via
// Einstellungen → „Backup importieren" → Ersetzen.
//
// WHY THE PREVIOUS IMPORT GOT HOLIDAYS WRONG — the CSV is a single flat list of
// duration rows, but the app has TWO different concepts behind those rows:
//
//   Work / Break      → `Session` records (real spans of time)
//   Urlaub / Feiertag → `DayMeta` labels (NOT time; a per-day credit)
//
// Every Urlaub/Feiertag row in this file carries a Value of exactly 5:55:00 =
// 21300s = DEFAULT_DAILY_TARGET_SECONDS. That is the legacy tracker's way of
// saying "this day is neutral": credit exactly one day's target. Treating those
// rows as work sessions inflates gross work AND leaves the day unlabeled;
// dropping them silently turns each into a full day of undertime. Both are
// wrong. They must become `dayMeta` entries with NO session, which makes
// `deriveDay` return delta 0 for the day — the same neutral outcome the legacy
// tracker produced, arrived at properly.

import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Session, DayMeta, DayType, BackupFile } from '@/domain/types'
import { deriveRange } from '@/domain/calc'
import { parseBackup } from '@/db/backup'
import {
  dayKeyFromMs,
  enumerateDays,
  isWeekend,
  formatDuration,
  formatSignedDuration,
} from '@/domain/time'
import { DEFAULT_DAILY_TARGET_SECONDS, DEFAULT_BALANCE_START_DATE } from '@/domain/constants'

// vitest runs with the repo root as cwd (jsdom env has no file:// import.meta.url).
const CSV_PATH = resolve(process.cwd(), 'TrackAndGraph-20260810-113626.csv')
const OUT_PATH = resolve(process.cwd(), 'arbeitszeit-backup-from-trackandgraph.json')

/**
 * ASSUMPTION: TrackAndGraph stamps a duration row at the moment it is recorded,
 * so `Timestamp` is the END of the span and `start = timestamp − duration`.
 * Only affects Work/Break rows; flip this to `false` to treat it as the start.
 */
const TIMESTAMP_IS_END = true

/** Labels that are per-day credits, not spans of time. */
const DAY_LABEL_TYPES: Record<string, DayType> = {
  Urlaub: 'vacation',
  Feiertag: 'holiday',
}

/** "H:MM:SS" (TrackAndGraph's duration Value column) → whole seconds. */
function durationToSeconds(value: string): number {
  const [h, m, s] = value.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

/**
 * Splits one CSV line, honouring double-quoted fields. The Note column is
 * user-typed free text (`"Pfingsten "`, `"Hüseyn PHD defense"`) and a naive
 * `split(',')` silently shifts every field after a note that contains a comma.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++ } else inQuotes = false
      } else current += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { fields.push(current); current = '' }
    else current += ch
  }
  fields.push(current)
  return fields
}

interface CsvRow {
  timestampMs: number
  seconds: number
  label: string
  note: string
}

function parseCsv(text: string): CsvRow[] {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => {
      const [, timestamp, value, label, note] = splitCsvLine(line)
      return {
        timestampMs: new Date(timestamp).getTime(),
        seconds: durationToSeconds(value),
        label: label ?? '',
        note: (note ?? '').trim(),
      }
    })
}

/** Work/Break rows → sessions. Everything else is a day label (or dropped). */
function toSessions(rows: CsvRow[]): Session[] {
  return rows
    .filter((r) => r.label === 'Work' || r.label === 'Break' || r.label === 'Event')
    .map((r, i) => ({
      id: `tg-${i}`,
      // "Event" was real time spent (a PhD defense at uni) that the legacy
      // tracker counted as work, so it stays work — the note preserves what it was.
      kind: r.label === 'Break' ? ('break' as const) : ('work' as const),
      startMs: TIMESTAMP_IS_END ? r.timestampMs - r.seconds * 1000 : r.timestampMs,
      endMs: TIMESTAMP_IS_END ? r.timestampMs : r.timestampMs + r.seconds * 1000,
      autoStopped: false,
      note: r.label === 'Event' ? (r.note ? `Event: ${r.note}` : 'Event') : r.note,
    }))
}

/**
 * Urlaub/Feiertag rows → day labels. Keyed off the RAW timestamp, not a
 * derived start: these rows are credits, not spans, so subtracting their
 * 5h55m "value" from the timestamp would be meaningless (and could push the
 * label onto the previous day for any row stamped before 05:55).
 */
function toDayMeta(rows: CsvRow[]): Map<string, DayMeta> {
  const map = new Map<string, DayMeta>()
  for (const r of rows) {
    const type = DAY_LABEL_TYPES[r.label]
    if (!type) continue
    const date = dayKeyFromMs(r.timestampMs)
    map.set(date, { date, type, note: r.note })
  }
  return map
}

function bucketByDay(sessions: Session[]): Map<string, Session[]> {
  const byDay = new Map<string, Session[]>()
  for (const s of sessions) {
    // Same rule as the app: a session belongs to the local day it STARTED on.
    const key = dayKeyFromMs(s.startMs)
    const bucket = byDay.get(key)
    if (bucket) bucket.push(s)
    else byDay.set(key, [s])
  }
  return byDay
}

// ---------------------------------------------------------------------------
// CLEANUP PASS
//
// The raw CSV has three defects that make the times (not the totals) nonsense:
// work sessions that overlap each other, one session that straddles midnight,
// and a handful of start times that are clearly typos. This pass normalises
// them. It is deliberately NOT the rule the app will use for live editing —
// that is a separate, still-undecided design (see the handoff).
//
// Per day, in order:
//   1. ANCHOR    — keep the day's own first work start if it falls in
//                  [08:00, 13:00); otherwise rewrite it to 10:00. Four days
//                  have starts (03:28, 07:09, 13:34, 15:39) that are lazy
//                  logging rather than real, unusual days.
//   2. COLLAPSE  — lay every work session of that day end-to-end from the
//                  anchor, preserving each duration and their original order.
//                  This is what removes the overlaps and the midnight straddle
//                  WITHOUT discarding a single logged minute: an overlapping
//                  block is pushed back, never dropped.
//   3. TRIM      — anything past 10h (§3 ArbZG hard ceiling) is cut off the
//                  day's tail, splitting a session if the ceiling falls inside
//                  one, and queued for redistribution.
//
// Queued excess then fills empty unlabeled weekdays chronologically, 09:00
// onward, max 3h per day, each block noting where it came from.
//
// NOTE ON AUDITABILITY: this makes the emitted JSON no longer a faithful
// transcription of the CSV. That is a deliberate, user-made tradeoff. The
// audit section of the report is what preserves the trail — every changed day
// and every moved block is printed, so the output still reconciles even though
// the file does not.

/** Start times inside [08:00, 13:00) are believed; anything else is a typo. */
const ANCHOR_FROM_HOUR = 8
const ANCHOR_UNTIL_HOUR = 13
const ANCHOR_TO_HOUR = 10

/** §3 ArbZG: 10h is a hard per-day ceiling (the 8h AVERAGE is what may be averaged). */
const MAX_DAY_MS = 10 * 3600_000

/** Redistribution window on a receiving day: 09:00–12:00, so 3h of capacity. */
const FILL_START_HOUR = 9
const FILL_END_HOUR = 12

/** Local epoch-millis for `hour:00` on a "YYYY-MM-DD" day key. */
function atLocalHour(dateKey: string, hour: number): number {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0, 0, 0).getTime()
}

/** "HH:MM" local clock, for audit lines. */
function clock(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface DayChange {
  date: string
  anchored: boolean
  startBeforeMs: number
  startAfterMs: number
  grossBeforeMs: number
  grossAfterMs: number
  movedMs: number
}

interface Move {
  from: string
  to: string
  startMs: number
  ms: number
}

function cleanUpSessions(
  sessions: Session[],
  spareDays: string[],
): { sessions: Session[]; dayChanges: DayChange[]; moves: Move[] } {
  const byDay = bucketByDay(sessions)
  // Breaks are never anchored, collapsed, trimmed or moved (they change no
  // derived number — `effectiveBreak = max(logged, required)` is position-blind).
  const out: Session[] = sessions.filter((s) => s.kind === 'break')
  const dayChanges: DayChange[] = []
  const pending: { from: string; ms: number }[] = []

  for (const day of [...byDay.keys()].sort()) {
    const work = byDay
      .get(day)!
      .filter((s) => s.kind === 'work')
      .sort((a, b) => a.startMs - b.startMs)
    if (work.length === 0) continue

    const startBeforeMs = work[0].startMs
    const startedAt = new Date(startBeforeMs)
    const hour = startedAt.getHours() + startedAt.getMinutes() / 60
    const anchored = !(hour >= ANCHOR_FROM_HOUR && hour < ANCHOR_UNTIL_HOUR)
    const startAfterMs = anchored ? atLocalHour(day, ANCHOR_TO_HOUR) : startBeforeMs

    const grossBeforeMs = work.reduce((n, s) => n + (s.endMs! - s.startMs), 0)
    let cursor = startAfterMs
    let used = 0
    let movedMs = 0

    for (const s of work) {
      const duration = s.endMs! - s.startMs
      const keep = Math.max(0, Math.min(duration, MAX_DAY_MS - used))
      if (keep > 0) {
        out.push({ ...s, startMs: cursor, endMs: cursor + keep })
        cursor += keep
        used += keep
      }
      if (keep < duration) {
        const excess = duration - keep
        pending.push({ from: day, ms: excess })
        movedMs += excess
      }
    }

    if (anchored || movedMs > 0) {
      dayChanges.push({
        date: day,
        anchored,
        startBeforeMs,
        startAfterMs,
        grossBeforeMs,
        grossAfterMs: used,
        movedMs,
      })
    }
  }

  // Place the queued excess. `capacity <= 0` forces the first allocation, and
  // one pending block may span several receiving days if it exceeds 3h.
  const moves: Move[] = []
  let dayIdx = 0
  let target = ''
  let cursor = 0
  let capacity = 0

  for (const p of pending) {
    let remaining = p.ms
    while (remaining > 0) {
      if (capacity <= 0) {
        target = spareDays[dayIdx++]
        if (!target) throw new Error('ran out of empty weekdays to absorb moved work')
        cursor = atLocalHour(target, FILL_START_HOUR)
        capacity = (FILL_END_HOUR - FILL_START_HOUR) * 3600_000
      }
      const take = Math.min(remaining, capacity)
      out.push({
        id: `tg-moved-${moves.length}`,
        kind: 'work',
        startMs: cursor,
        endMs: cursor + take,
        autoStopped: false,
        note: `verschoben von ${p.from} (§3 ArbZG, 10h-Grenze)`,
      })
      moves.push({ from: p.from, to: target, startMs: cursor, ms: take })
      cursor += take
      capacity -= take
      remaining -= take
    }
  }

  return { sessions: out.sort((a, b) => a.startMs - b.startMs), dayChanges, moves }
}

describe('TrackAndGraph CSV → Arbeitszeit Tracker backup', () => {
  const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'))
  const dayMetaByDay = toDayMeta(rows)

  // RAW = the faithful transcription. The "flags ..." tests below report the
  // source defects against this, so the report still documents what the CSV
  // actually contained after the cleanup has hidden it.
  const rawSessions = toSessions(rows)
  const rawSessionsByDay = bucketByDay(rawSessions)

  const startDate = DEFAULT_BALANCE_START_DATE
  const rawDayKeys = [...rawSessionsByDay.keys(), ...dayMetaByDay.keys()].sort()
  const endDate = rawDayKeys[rawDayKeys.length - 1]

  // Redistribution targets: weekdays in range with no label and no work at all.
  // Computed from the RAW data so the pass cannot pick a day it just filled.
  const spareDays = enumerateDays(startDate, endDate).filter(
    (d) =>
      !isWeekend(d) &&
      !dayMetaByDay.has(d) &&
      !(rawSessionsByDay.get(d) ?? []).some((s) => s.kind === 'work'),
  )

  const { sessions, dayChanges, moves } = cleanUpSessions(rawSessions, spareDays)
  const sessionsByDay = bucketByDay(sessions)

  it('parses every row', () => {
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => Number.isFinite(r.timestampMs) && Number.isFinite(r.seconds))).toBe(true)
  })

  it('accounts for every label — nothing silently dropped', () => {
    const counts = new Map<string, { n: number; seconds: number }>()
    for (const r of rows) {
      const c = counts.get(r.label) ?? { n: 0, seconds: 0 }
      c.n++
      c.seconds += r.seconds
      counts.set(r.label, c)
    }
    console.log('\nLabels in CSV:')
    for (const [label, c] of [...counts].sort()) {
      const target =
        label === 'Work' || label === 'Event'
          ? "session kind 'work'"
          : label === 'Break'
            ? "session kind 'break'"
            : DAY_LABEL_TYPES[label]
              ? `dayMeta type '${DAY_LABEL_TYPES[label]}'`
              : '??? UNMAPPED — WOULD BE DROPPED'
      console.log(
        `  ${label.padEnd(9)} ${String(c.n).padStart(3)} rows  ${formatDuration(c.seconds).padStart(9)}  → ${target}`,
      )
    }
    const mapped = rawSessions.length + [...rows].filter((r) => DAY_LABEL_TYPES[r.label]).length
    expect(mapped).toBe(rows.length)
  })

  it('confirms every day-label row is exactly one daily target (the legacy neutral-day credit)', () => {
    const labelRows = rows.filter((r) => DAY_LABEL_TYPES[r.label])
    const offenders = labelRows.filter((r) => r.seconds !== DEFAULT_DAILY_TARGET_SECONDS)
    console.log(
      `\nUrlaub/Feiertag rows: ${labelRows.length}, all == ${formatDuration(DEFAULT_DAILY_TARGET_SECONDS)}? ${offenders.length === 0}`,
    )
    expect(offenders).toEqual([])
  })

  it('flags labeled days that ALSO have work logged (the app zeroes their delta)', () => {
    const collisions = [...dayMetaByDay.keys()].filter((d) =>
      (rawSessionsByDay.get(d) ?? []).some((s) => s.kind === 'work'),
    )
    console.log(`\nLabeled days that also have work sessions: ${collisions.length}`)
    for (const d of collisions) console.log(`  ${d} (${dayMetaByDay.get(d)!.type}) — work on this day will NOT affect the balance`)
  })

  it('flags entries whose start/end straddle midnight (day-assignment ambiguity)', () => {
    const straddling = rawSessions.filter((s) => dayKeyFromMs(s.startMs) !== dayKeyFromMs(s.endMs!))
    console.log(`\nCross-midnight entries: ${straddling.length}`)
    for (const s of straddling) {
      console.log(
        `  ${new Date(s.startMs).toISOString()} → ${new Date(s.endMs!).toISOString()} ` +
          `(${s.kind}, ${formatDuration((s.endMs! - s.startMs) / 1000)}) ` +
          `→ counted on ${dayKeyFromMs(s.startMs)}`,
      )
    }
  })

  it('flags overlapping work entries on the same day (double-counted time)', () => {
    const overlaps: string[] = []
    for (const [day, list] of rawSessionsByDay) {
      const work = list.filter((s) => s.kind === 'work').sort((a, b) => a.startMs - b.startMs)
      for (let i = 1; i < work.length; i++) {
        if (work[i].startMs < work[i - 1].endMs!) {
          const dup = Math.round((Math.min(work[i].endMs!, work[i - 1].endMs!) - work[i].startMs) / 1000)
          overlaps.push(`  ${day}: ${formatDuration(dup)} counted twice`)
        }
      }
    }
    console.log(`\nOverlapping work pairs: ${overlaps.length}`)
    for (const o of overlaps) console.log(o)
  })

  it('audits every change the cleanup pass made (the JSON no longer matches the CSV)', () => {
    console.log(`\n─── Cleanup audit ─────────────────────────────────────────`)
    console.log(`Days changed: ${dayChanges.length} of ${rawSessionsByDay.size} with data`)
    for (const c of dayChanges) {
      const parts: string[] = []
      if (c.anchored) parts.push(`start ${clock(c.startBeforeMs)} → ${clock(c.startAfterMs)}`)
      if (c.movedMs > 0)
        parts.push(
          `gross ${formatDuration(c.grossBeforeMs / 1000)} → ${formatDuration(c.grossAfterMs / 1000)} ` +
            `(${formatDuration(c.movedMs / 1000)} moved out)`,
        )
      console.log(`  ${c.date}  ${parts.join(', ')}`)
    }
    console.log(`\nRedistributed blocks: ${moves.length}  (spare weekdays available: ${spareDays.length})`)
    for (const m of moves) {
      console.log(
        `  ${formatDuration(m.ms / 1000)} from ${m.from} → ${m.to} ` +
          `${clock(m.startMs)}–${clock(m.startMs + m.ms)}`,
      )
    }
    console.log(`───────────────────────────────────────────────────────────`)

    // Not a single logged minute may be discarded — only relocated.
    const rawWorkMs = rawSessions
      .filter((s) => s.kind === 'work')
      .reduce((n, s) => n + (s.endMs! - s.startMs), 0)
    const cleanWorkMs = sessions
      .filter((s) => s.kind === 'work')
      .reduce((n, s) => n + (s.endMs! - s.startMs), 0)
    expect(cleanWorkMs).toBe(rawWorkMs)
  })

  it('leaves no overlap, no midnight straddle and no day over 10h', () => {
    const straddling = sessions.filter((s) => dayKeyFromMs(s.startMs) !== dayKeyFromMs(s.endMs!))
    expect(straddling).toEqual([])

    const overlapping: string[] = []
    const overLimit: string[] = []
    for (const [day, list] of sessionsByDay) {
      const work = list.filter((s) => s.kind === 'work').sort((a, b) => a.startMs - b.startMs)
      for (let i = 1; i < work.length; i++) {
        if (work[i].startMs < work[i - 1].endMs!) overlapping.push(day)
      }
      const gross = work.reduce((n, s) => n + (s.endMs! - s.startMs), 0)
      if (gross > MAX_DAY_MS) overLimit.push(`${day} (${formatDuration(gross / 1000)})`)
    }
    expect(overlapping).toEqual([])
    expect(overLimit).toEqual([])
  })

  // §5 ArbZG: 11h uninterrupted rest between the end of one working day and the
  // start of the next. Reported, not asserted — a residual violation is a fact
  // about the record, not a bug in the conversion.
  it('reports rest periods shorter than 11h between consecutive days (§5 ArbZG)', () => {
    const workDays = [...sessionsByDay.keys()]
      .filter((d) => (sessionsByDay.get(d) ?? []).some((s) => s.kind === 'work'))
      .sort()
    const short: string[] = []
    for (let i = 1; i < workDays.length; i++) {
      const prev = sessionsByDay.get(workDays[i - 1])!.filter((s) => s.kind === 'work')
      const cur = sessionsByDay.get(workDays[i])!.filter((s) => s.kind === 'work')
      const restMs = Math.min(...cur.map((s) => s.startMs)) - Math.max(...prev.map((s) => s.endMs!))
      if (restMs < 11 * 3600_000) {
        short.push(
          `  ${workDays[i - 1]} → ${workDays[i]}: ${formatDuration(restMs / 1000)} rest` +
            (enumerateDays(workDays[i - 1], workDays[i]).length === 2 ? '' : ' (non-consecutive days)'),
        )
      }
    }
    console.log(`\nRest periods under 11h (§5 ArbZG): ${short.length}`)
    for (const s of short) console.log(s)
  })

  it('writes the backup JSON and reports the balance it will show', () => {
    const backup: BackupFile = {
      schemaVersion: 1,
      exportedAt: new Date(0).toISOString(),
      settings: { dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS, balanceStartDate: startDate },
      sessions,
      dayMeta: [...dayMetaByDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    }
    writeFileSync(OUT_PATH, JSON.stringify(backup, null, 2), 'utf8')

    const { days, balanceSeconds } = deriveRange({
      startDate,
      endDate,
      sessionsByDay,
      dayMetaByDay,
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    })

    const rawWork = rows.filter((r) => r.label === 'Work').reduce((n, r) => n + r.seconds, 0)
    const derivedGross = days.reduce((n, d) => n + d.grossWorkSeconds, 0)
    const emptyWeekdays = days.filter(
      (d) => !d.isWeekend && d.type === 'work' && d.grossWorkSeconds === 0,
    )

    console.log(`
─── Import report ─────────────────────────────────────────
CSV rows                 : ${rows.length}
Sessions written         : ${backup.sessions.length}
Day labels written       : ${backup.dayMeta.length}
Raw work total (CSV)     : ${formatDuration(rawWork)}
Gross work after convert : ${formatDuration(derivedGross)}
Auto-deducted breaks     : ${formatDuration(days.reduce((n, d) => n + d.autoDeductedSeconds, 0))}  (§4 ArbZG)

Range                    : ${startDate} … ${endDate}  (${days.length} days)
Daily target             : ${formatDuration(DEFAULT_DAILY_TARGET_SECONDS)}
Days with logged work    : ${days.filter((d) => d.grossWorkSeconds > 0).length}
Empty unlabeled weekdays : ${emptyWeekdays.length}  (${formatDuration(emptyWeekdays.length * DEFAULT_DAILY_TARGET_SECONDS)} of undertime — the Fridays still to fill in)
  ${emptyWeekdays.map((d) => d.date).join(', ')}

BALANCE                  : ${formatSignedDuration(balanceSeconds)}
Backup written to        : ${OUT_PATH}
───────────────────────────────────────────────────────────`)

    expect(backup.sessions.length + backup.dayMeta.length).toBeGreaterThan(0)
  })

  // The whole point of emitting JSON is to ride the app's existing, tested
  // import path — so prove the file actually survives it before touching a phone.
  it('the emitted file passes the app’s own parseBackup()', () => {
    const result = parseBackup(readFileSync(OUT_PATH, 'utf8'))
    if (!result.ok) console.log(`\nparseBackup REJECTED the file: ${result.error}`)
    expect(result.ok).toBe(true)
  })
})
