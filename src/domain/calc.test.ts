import { requiredBreakSeconds, deriveDay, deriveRange } from './calc'
import type { Session, DayMeta, DayType, SessionKind } from './types'
import {
  SIX_HOURS,
  NINE_HOURS,
  THIRTY_MIN,
  FORTY_FIVE_MIN,
  HOUR,
  MINUTE,
  DEFAULT_DAILY_TARGET_SECONDS,
} from './constants'

let idCounter = 0
/** Session with an exact duration in seconds, so sums in these tests are exact. */
function mkSession(kind: SessionKind, seconds: number, startMs = 0): Session {
  idCounter += 1
  return {
    id: `s${idCounter}`,
    kind,
    startMs,
    endMs: startMs + seconds * 1000,
    autoStopped: false,
    note: '',
  }
}

describe('requiredBreakSeconds (§4 ArbZG thresholds, inclusive >=, from gross only)', () => {
  it('exactly 6h00m00s -> 30m required', () => {
    expect(requiredBreakSeconds(SIX_HOURS)).toBe(THIRTY_MIN)
  })
  it('exactly 9h00m00s -> 45m required', () => {
    expect(requiredBreakSeconds(NINE_HOURS)).toBe(FORTY_FIVE_MIN)
  })
  it('5h59m59s -> 0 required (just under the 6h threshold)', () => {
    expect(requiredBreakSeconds(SIX_HOURS - 1)).toBe(0)
  })
  it('8h59m59s -> 30m required (just under the 9h threshold, not yet 45m)', () => {
    expect(requiredBreakSeconds(NINE_HOURS - 1)).toBe(THIRTY_MIN)
  })
})

describe('deriveDay — break law + net/expected/delta', () => {
  it('8h work, no break: net = 7h30m, autoDeducted = 30m', () => {
    const result = deriveDay({
      date: '2026-05-06',
      type: 'work',
      isWeekend: false,
      sessions: [mkSession('work', 8 * HOUR)],
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    })
    expect(result.grossWorkSeconds).toBe(8 * HOUR)
    expect(result.loggedBreakSeconds).toBe(0)
    expect(result.requiredBreakSeconds).toBe(THIRTY_MIN)
    expect(result.autoDeductedSeconds).toBe(1800)
    expect(result.netWorkSeconds).toBe(27000)
  })

  it('8h work + 10m logged break: net = 7h30m, autoDeducted = 20m (topped up)', () => {
    const result = deriveDay({
      date: '2026-05-06',
      type: 'work',
      isWeekend: false,
      sessions: [mkSession('work', 8 * HOUR), mkSession('break', 10 * MINUTE)],
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    })
    expect(result.netWorkSeconds).toBe(27000)
    expect(result.autoDeductedSeconds).toBe(1200)
  })

  it('logged break >= required (8h work + 40m break): no double-count, net = gross - loggedBreak', () => {
    const result = deriveDay({
      date: '2026-05-06',
      type: 'work',
      isWeekend: false,
      sessions: [mkSession('work', 8 * HOUR), mkSession('break', 40 * MINUTE)],
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    })
    expect(result.autoDeductedSeconds).toBe(0)
    expect(result.netWorkSeconds).toBe(8 * HOUR - 40 * MINUTE)
  })

  it('weekend day with 8h work: no target, so the net worked counts as pure overtime', () => {
    const result = deriveDay({
      date: '2026-05-09', // Saturday
      type: 'work',
      isWeekend: true,
      sessions: [mkSession('work', 8 * HOUR)],
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    })
    expect(result.expectedSeconds).toBe(0)
    expect(result.netWorkSeconds).toBe(27000) // 8h gross − 30m legal break
    expect(result.deltaSeconds).toBe(27000) // +net, not zeroed out
  })

  it('empty weekend day: expected = 0 and delta = 0 (never undertime)', () => {
    const result = deriveDay({
      date: '2026-05-09', // Saturday
      type: 'work',
      isWeekend: true,
      sessions: [],
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    })
    expect(result.expectedSeconds).toBe(0)
    expect(result.deltaSeconds).toBe(0)
  })

  describe('labeled days (vacation/sick/holiday) — label wins over any logged work', () => {
    const labeledTypes: DayType[] = ['vacation', 'sick', 'holiday']
    for (const type of labeledTypes) {
      it(`${type}: net = 0, expected = 0, delta = 0, autoDeducted = 0, even with 8h logged work`, () => {
        const result = deriveDay({
          date: '2026-05-06',
          type,
          isWeekend: false,
          sessions: [mkSession('work', 8 * HOUR)],
          dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
        })
        expect(result.netWorkSeconds).toBe(0)
        expect(result.expectedSeconds).toBe(0)
        expect(result.deltaSeconds).toBe(0)
        expect(result.autoDeductedSeconds).toBe(0)
        // Real sums are still kept for display purposes.
        expect(result.grossWorkSeconds).toBe(8 * HOUR)
      })
    }
  })

  describe('gleitzeittag — NOT a credited day, derives exactly like an ordinary work day (ADR 0001)', () => {
    it('empty weekday: carries the full target, so delta = −1 daily target', () => {
      const result = deriveDay({
        date: '2026-05-06',
        type: 'gleitzeittag',
        isWeekend: false,
        sessions: [],
        dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
      })
      expect(result.netWorkSeconds).toBe(0)
      expect(result.expectedSeconds).toBe(DEFAULT_DAILY_TARGET_SECONDS)
      expect(result.deltaSeconds).toBe(-DEFAULT_DAILY_TARGET_SECONDS)
    })

    it('with logged work: derives identically to the same day labeled `work`', () => {
      const args = {
        date: '2026-05-06',
        isWeekend: false,
        // 8h gross + 10m logged break -> 30m required, 20m topped up.
        sessions: [mkSession('work', 8 * HOUR), mkSession('break', 10 * MINUTE)],
        dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
      }
      const flex = deriveDay({ ...args, type: 'gleitzeittag' })
      const work = deriveDay({ ...args, type: 'work' })

      // The label is the ONLY difference — same net, same auto-deducted break, same delta.
      expect({ ...flex, type: 'work' }).toEqual(work)
      expect(flex.netWorkSeconds).toBe(27000)
      expect(flex.autoDeductedSeconds).toBe(1200)
      expect(flex.deltaSeconds).toBe(27000 - DEFAULT_DAILY_TARGET_SECONDS)
    })

    it('empty weekend: costs nothing, as any weekend does', () => {
      const result = deriveDay({
        date: '2026-05-09', // Saturday
        type: 'gleitzeittag',
        isWeekend: true,
        sessions: [],
        dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
      })
      expect(result.expectedSeconds).toBe(0)
      expect(result.deltaSeconds).toBe(0)
    })
  })

  it('normal workday, net below target -> negative delta', () => {
    const result = deriveDay({
      date: '2026-05-06',
      type: 'work',
      isWeekend: false,
      sessions: [mkSession('work', 4 * HOUR)], // < 6h, so no break deduction
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS, // 21300s = 5h55m
    })
    expect(result.netWorkSeconds).toBe(4 * HOUR)
    expect(result.deltaSeconds).toBe(4 * HOUR - DEFAULT_DAILY_TARGET_SECONDS)
    expect(result.deltaSeconds).toBeLessThan(0)
  })

  it('normal workday, net above target -> positive delta', () => {
    const result = deriveDay({
      date: '2026-05-06',
      type: 'work',
      isWeekend: false,
      sessions: [mkSession('work', 9 * HOUR)], // >= 9h -> 45m required break
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    })
    const expectedNet = 9 * HOUR - FORTY_FIVE_MIN
    expect(result.netWorkSeconds).toBe(expectedNet)
    expect(result.deltaSeconds).toBe(expectedNet - DEFAULT_DAILY_TARGET_SECONDS)
    expect(result.deltaSeconds).toBeGreaterThan(0)
  })

  it('fills every DayDerivation field (8h work, no break, custom target)', () => {
    const result = deriveDay({
      date: '2026-05-06',
      type: 'work',
      isWeekend: false,
      sessions: [mkSession('work', 8 * HOUR)],
      dailyTargetSeconds: 18000,
    })
    expect(result).toEqual({
      date: '2026-05-06',
      type: 'work',
      isWeekend: false,
      grossWorkSeconds: 28800,
      loggedBreakSeconds: 0,
      requiredBreakSeconds: 1800,
      effectiveBreakSeconds: 1800,
      autoDeductedSeconds: 1800,
      netWorkSeconds: 27000,
      expectedSeconds: 18000,
      deltaSeconds: 9000,
    })
  })
})

describe('deriveRange — enumerates every day, sums the balance', () => {
  it('empty weekdays undertake, empty weekends and labeled days are neutral, pre-start days are excluded', () => {
    const dailyTargetSeconds = 18000 // 5h, a round number for this test

    const sessionsByDay = new Map<string, Session[]>([
      // Before the range start — must be excluded from both `days` and the balance.
      ['2026-05-05', [mkSession('work', 3 * HOUR)]],
      // 2026-05-08 (Friday): 6h work -> required 30m -> net 5h30m -> delta +1800s.
      ['2026-05-08', [mkSession('work', 6 * HOUR)]],
    ])
    const dayMetaByDay = new Map<string, DayMeta>([
      ['2026-05-07', { date: '2026-05-07', type: 'vacation', note: '' }],
    ])

    const { days, balanceSeconds } = deriveRange({
      startDate: '2026-05-06', // Wednesday
      endDate: '2026-05-11', // Monday
      sessionsByDay,
      dayMetaByDay,
      dailyTargetSeconds,
    })

    expect(days.map((d) => d.date)).toEqual([
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
      '2026-05-11',
    ])
    // The pre-start session must not leak a day into the derived range.
    expect(days.find((d) => d.date === '2026-05-05')).toBeUndefined()

    const wed = days.find((d) => d.date === '2026-05-06')! // empty weekday, no label
    expect(wed.type).toBe('work')
    expect(wed.isWeekend).toBe(false)
    expect(wed.netWorkSeconds).toBe(0)
    expect(wed.deltaSeconds).toBe(-dailyTargetSeconds)

    const thu = days.find((d) => d.date === '2026-05-07')! // labeled vacation
    expect(thu.type).toBe('vacation')
    expect(thu.deltaSeconds).toBe(0)

    const fri = days.find((d) => d.date === '2026-05-08')! // 6h work
    expect(fri.deltaSeconds).toBe(1800)

    const sat = days.find((d) => d.date === '2026-05-09')! // empty weekend
    expect(sat.isWeekend).toBe(true)
    expect(sat.deltaSeconds).toBe(0)

    const sun = days.find((d) => d.date === '2026-05-10')! // empty weekend
    expect(sun.isWeekend).toBe(true)
    expect(sun.deltaSeconds).toBe(0)

    const mon = days.find((d) => d.date === '2026-05-11')! // empty weekday, no label
    expect(mon.deltaSeconds).toBe(-dailyTargetSeconds)

    const expectedBalance = -dailyTargetSeconds + 0 + 1800 + 0 + 0 + -dailyTargetSeconds
    expect(balanceSeconds).toBe(expectedBalance)
    expect(balanceSeconds).toBe(-34200)
  })
})

describe('deriveRange — each day against the Tagessoll in force on it (ADR 0004)', () => {
  it('measures the days before an Aufstockung at the old Tagessoll and those after at the new one', () => {
    const { days, balanceSeconds } = deriveRange({
      startDate: '2026-09-30', // Wednesday, still part time
      endDate: '2026-10-02', // Friday
      sessionsByDay: new Map([
        // 8h work -> required 30m -> net 7h30m, half an hour short of full time.
        ['2026-10-01', [mkSession('work', 8 * HOUR)]],
      ]),
      dayMetaByDay: new Map([['2026-10-02', { date: '2026-10-02', type: 'gleitzeittag', note: '' }]]),
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS, // 5h55m
      tagessollAb: { '2026-10-01': 8 * HOUR },
    })

    expect(days.map((d) => d.expectedSeconds)).toEqual([21300, 28800, 28800])
    // Empty part-time Wednesday, 30m short on Thursday, and a Gleitzeittag
    // that costs the full-time Tagessoll.
    expect(days.map((d) => d.deltaSeconds)).toEqual([-21300, -1800, -28800])
    expect(balanceSeconds).toBe(-51900)
  })
})
