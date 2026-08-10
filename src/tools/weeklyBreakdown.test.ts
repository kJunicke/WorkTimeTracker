// Reporting harness: where does the balance actually come from, week by week?
//
// Reads the emitted backup (run csvBalance.test.ts first) and re-derives
// everything through the REAL domain code, then splits each week's delta into
// its two very different causes:
//
//   MISSING  — empty, unlabeled past weekdays. Each is a full daily target of
//              undertime for a day with no data at all. Not "worked too little";
//              "never recorded". These are the ones to fill in.
//   WORKED   — the net over/under on days that DO have sessions.
//
// Run:
//   npx vitest run src/tools/weeklyBreakdown.test.ts --disable-console-intercept --reporter=verbose

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Session, DayMeta, BackupFile } from '@/domain/types'
import { deriveRange } from '@/domain/calc'
import { dayKeyFromMs, weekKey, formatWeekHeading, formatSignedDuration, formatDuration } from '@/domain/time'

const BACKUP_PATH = resolve(process.cwd(), 'arbeitszeit-backup-from-trackandgraph.json')

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}
function padStart(s: string, n: number): string {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s
}

describe('weekly breakdown of the balance', () => {
  const backup: BackupFile = JSON.parse(readFileSync(BACKUP_PATH, 'utf8'))

  const sessionsByDay = new Map<string, Session[]>()
  for (const s of backup.sessions) {
    const key = dayKeyFromMs(s.startMs)
    const bucket = sessionsByDay.get(key)
    if (bucket) bucket.push(s)
    else sessionsByDay.set(key, [s])
  }
  const dayMetaByDay = new Map<string, DayMeta>(backup.dayMeta.map((m) => [m.date, m]))

  it('prints the week-by-week rundown', () => {
    const startDate = backup.settings.balanceStartDate
    const endDate = [...sessionsByDay.keys()].sort().pop()!

    const { days, balanceSeconds } = deriveRange({
      startDate,
      endDate,
      sessionsByDay,
      dayMetaByDay,
      dailyTargetSeconds: backup.settings.dailyTargetSeconds,
    })

    interface Week {
      key: string
      delta: number
      missingDelta: number
      workedDelta: number
      missingDates: string[]
    }
    const weeks = new Map<string, Week>()

    for (const d of days) {
      const k = weekKey(d.date)
      const w = weeks.get(k) ?? {
        key: k,
        delta: 0,
        missingDelta: 0,
        workedDelta: 0,
        missingDates: [],
      }
      w.delta += d.deltaSeconds

      // A day with no sessions, no label, not a weekend, and a target it failed
      // to meet is a HOLE in the data — not a short working day.
      const isMissing =
        !d.isWeekend && d.type === 'work' && d.grossWorkSeconds === 0 && d.expectedSeconds > 0
      if (isMissing) {
        w.missingDelta += d.deltaSeconds
        w.missingDates.push(d.date)
      } else {
        w.workedDelta += d.deltaSeconds
      }
      weeks.set(k, w)
    }

    const ordered = [...weeks.values()].sort((a, b) => a.key.localeCompare(b.key))

    let running = 0
    const lines: string[] = []
    lines.push(
      `${pad('Woche', 26)} ${padStart('WOCHE', 9)} ${padStart('davon FEHLT', 12)} ${padStart('davon GEARB.', 13)} ${padStart('SALDO', 10)}`,
    )
    lines.push('─'.repeat(75))
    for (const w of ordered) {
      running += w.delta
      lines.push(
        `${pad(formatWeekHeading(w.key), 26)} ${padStart(formatSignedDuration(w.delta), 9)} ` +
          `${padStart(w.missingDelta ? formatSignedDuration(w.missingDelta) : '·', 12)} ` +
          `${padStart(formatSignedDuration(w.workedDelta), 13)} ` +
          `${padStart(formatSignedDuration(running), 10)}`,
      )
      if (w.missingDates.length) {
        lines.push(`${' '.repeat(26)}   fehlende Tage: ${w.missingDates.join(', ')}`)
      }
    }

    const totalMissing = ordered.reduce((n, w) => n + w.missingDelta, 0)
    const totalWorked = ordered.reduce((n, w) => n + w.workedDelta, 0)
    const missingCount = ordered.reduce((n, w) => n + w.missingDates.length, 0)

    console.log(`
${lines.join('\n')}

─── Woher der Saldo kommt ─────────────────────────────────
Fehlende Tage (${missingCount} Stück)      : ${formatSignedDuration(totalMissing)}
Tatsächlich gearbeitete Tage    : ${formatSignedDuration(totalWorked)}
                                  ${'─'.repeat(12)}
GESAMTSALDO                     : ${formatSignedDuration(balanceSeconds)}

Ohne die ${missingCount} fehlenden Tage stünde der Saldo bei ${formatSignedDuration(totalWorked)}.
Jeder nachgetragene Tag verbessert den Saldo um bis zu ${formatDuration(backup.settings.dailyTargetSeconds)}.
───────────────────────────────────────────────────────────`)

    expect(Math.round(totalMissing + totalWorked)).toBe(Math.round(balanceSeconds))
  })
})
