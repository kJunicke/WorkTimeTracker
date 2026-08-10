// Throwaway report: print every Feiertag the app will auto-apply, and check
// them against the days already labeled by hand in the imported data.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BackupFile } from '@/domain/types'
import {
  feiertageImFenster,
  FEIERTAGE_LAND,
  FEIERTAGE_AB,
  FEIERTAGE_GEPRUEFT_BIS,
} from '@/domain/holidays'
import { isWeekend } from '@/domain/time'

const BACKUP_PATH = resolve(process.cwd(), 'arbeitszeit-backup-from-trackandgraph.json')

function heading(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

describe('Feiertage the app applies', () => {
  it('lists them all', () => {
    const alle = feiertageImFenster()
    const byYear = new Map<string, typeof alle>()
    for (const f of alle) {
      const y = f.date.slice(0, 4)
      byYear.set(y, [...(byYear.get(y) ?? []), f])
    }

    const lines: string[] = []
    for (const [year, list] of byYear) {
      lines.push(`\n${year}  (${list.length} Feiertage)`)
      for (const f of list) {
        const wknd = isWeekend(f.date) ? '   ← Wochenende, ändert keine Zahl' : ''
        lines.push(`  ${heading(f.date).padEnd(20)} ${f.name}${wknd}`)
      }
    }

    console.log(`
Bundesland      : ${FEIERTAGE_LAND}
Geprüftes Fenster: ${FEIERTAGE_AB} … ${FEIERTAGE_GEPRUEFT_BIS}
Gesamt          : ${alle.length}
${lines.join('\n')}
`)
    expect(alle.length).toBeGreaterThan(0)
  })

  it('cross-checks against the Feiertage labeled by hand in the legacy data', () => {
    if (!existsSync(BACKUP_PATH)) {
      console.log('\n(no backup JSON — run csvBalance.test.ts first)')
      return
    }
    const backup: BackupFile = JSON.parse(readFileSync(BACKUP_PATH, 'utf8'))
    const auto = new Map(feiertageImFenster().map((f) => [f.date, f.name]))
    const manuell = backup.dayMeta.filter((m) => m.type === 'holiday')

    console.log('\nHandgesetzte Feiertage aus dem Alt-Export:')
    for (const m of manuell) {
      const match = auto.get(m.date)
      console.log(
        `  ${heading(m.date).padEnd(20)} ${match ? `stimmt überein: ${match}` : 'KEIN Feiertag laut Kalender'}`,
      )
    }

    // Which auto-Feiertage fall inside the tracked range but were NOT labeled?
    const dates = backup.sessions.map((s) => new Date(s.startMs).toISOString().slice(0, 10)).sort()
    const von = backup.settings.balanceStartDate
    const bis = dates[dates.length - 1]
    const verpasst = [...auto.entries()].filter(
      ([d]) => d >= von && d <= bis && !isWeekend(d) && !backup.dayMeta.some((m) => m.date === d),
    )
    console.log(`\nFeiertage im erfassten Zeitraum (${von} … ${bis}), die im Alt-Export FEHLTEN:`)
    if (!verpasst.length) console.log('  keine')
    for (const [d, name] of verpasst) console.log(`  ${heading(d).padEnd(20)} ${name}`)

    expect(manuell.length).toBeGreaterThan(0)
  })
})
