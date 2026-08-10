// Throwaway verification: what happens when a day's label is CHANGED, rather
// than set for the first time? Relabeling is the case a derived model gets
// right for free and a stateful one gets wrong — so prove it rather than
// assume it.

import { describe, it, expect } from 'vitest'
import type { DayMeta, Session } from '@/domain/types'
import { deriveDay } from '@/domain/calc'
import { deriveUrlaubskonto } from '@/domain/vacation'

const TARGET = 21300 // 5h55m

function session(startMs: number, hours: number): Session {
  return {
    id: `s-${startMs}`,
    kind: 'work',
    startMs,
    endMs: startMs + hours * 3600_000,
    autoStopped: false,
    note: '',
  }
}

describe('changing a day label that was already something else', () => {
  // A Wednesday with 8h of logged work.
  const sessions = [session(Date.parse('2026-06-17T09:00:00'), 8)]
  const derive = (type: DayMeta['type']) =>
    deriveDay({ date: '2026-06-17', type, isWeekend: false, sessions, dailyTargetSeconds: TARGET })

  it('re-derives from the CURRENT label only — no residue from the old one', () => {
    const asWork = derive('work')
    const asVacation = derive('vacation')
    const asHoliday = derive('holiday')

    // work -> vacation -> holiday -> back to work all land on the same numbers
    // as if that label had been the first one ever set.
    expect(derive('work')).toEqual(asWork)
    expect(derive('holiday')).toEqual(asHoliday)

    // A credited label zeroes the day's contribution to the balance...
    expect(asVacation.deltaSeconds).toBe(0)
    expect(asHoliday.deltaSeconds).toBe(0)
    expect(asHoliday.expectedSeconds).toBe(0)

    // ...but the logged work is still REPORTED, not erased. This is the bit
    // worth checking: flagging a worked day as Feiertag silently drops 8h out
    // of the balance, and the only reason that is not a data-loss bug is that
    // the gross figure survives for the UI to warn with.
    expect(asHoliday.grossWorkSeconds).toBe(8 * 3600)
    expect(asWork.grossWorkSeconds).toBe(8 * 3600)

    // Going back to 'work' restores the full contribution — nothing latched.
    expect(asWork.expectedSeconds).toBe(TARGET)
    expect(asWork.deltaSeconds).toBe(asWork.netWorkSeconds - TARGET)
  })

  it('gives an Urlaubstag BACK when a vacation day is relabeled Feiertag', () => {
    const konto = (type: DayMeta['type']) =>
      deriveUrlaubskonto({
        urlaubsjahr: '2026',
        dayMeta: [
          { date: '2026-06-15', type: 'vacation', note: '' },
          { date: '2026-06-16', type: 'vacation', note: '' },
          { date: '2026-06-17', type, note: '' },
        ],
        anspruch: 30,
        today: '2026-08-10',
      })

    expect(konto('vacation').genommen).toBe(3)
    expect(konto('vacation').uebrig).toBe(27)

    // Relabeled to Feiertag: the day is still credited, but it no longer costs
    // an Urlaubstag. The entitlement comes back.
    expect(konto('holiday').genommen).toBe(2)
    expect(konto('holiday').uebrig).toBe(28)

    // Same for sick and gleitzeittag — neither draws on the Urlaubskonto.
    expect(konto('sick').uebrig).toBe(28)
    expect(konto('gleitzeittag').uebrig).toBe(28)

    // And back again.
    expect(konto('vacation').uebrig).toBe(27)
  })
})
