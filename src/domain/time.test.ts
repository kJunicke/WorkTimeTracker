import {
  dayKeyFromMs,
  todayKey,
  isWeekend,
  enumerateDays,
  sessionSeconds,
  formatDuration,
  formatSignedDuration,
  formatStopwatch,
  weekKey,
  monthKey,
  formatClock,
  formatDayHeading,
  msToLocalInputValue,
  localInputValueToMs,
  mondayOfWeekKey,
  formatWeekRange,
  formatWeekHeading,
  formatMonthHeading,
  startOfMonth,
  endOfMonth,
  addMonths,
  monthGridDays,
} from './time'
import type { Session } from './types'

function mkSession(startMs: number, endMs: number | null): Session {
  return { id: 'x', kind: 'work', startMs, endMs, autoStopped: false, note: '' }
}

describe('dayKeyFromMs / todayKey', () => {
  it('formats local date components as "YYYY-MM-DD"', () => {
    const ms = new Date(2026, 4, 6, 14, 30, 0).getTime() // 2026-05-06, local
    expect(dayKeyFromMs(ms)).toBe('2026-05-06')
  })

  it('zero-pads single-digit month and day', () => {
    const ms = new Date(2026, 0, 9, 0, 0, 0).getTime() // 2026-01-09, local
    expect(dayKeyFromMs(ms)).toBe('2026-01-09')
  })

  it('todayKey(ms) matches dayKeyFromMs(ms) for an explicit instant', () => {
    const ms = new Date(2026, 6, 13, 9, 0, 0).getTime()
    expect(todayKey(ms)).toBe(dayKeyFromMs(ms))
  })

  it('todayKey() defaults to Date.now()', () => {
    expect(todayKey()).toBe(dayKeyFromMs(Date.now()))
  })
})

describe('isWeekend', () => {
  it('2026-05-09 (Saturday) is a weekend', () => {
    expect(isWeekend('2026-05-09')).toBe(true)
  })

  it('2026-05-10 (Sunday) is a weekend', () => {
    expect(isWeekend('2026-05-10')).toBe(true)
  })

  it('2026-05-11 (Monday) is not a weekend', () => {
    expect(isWeekend('2026-05-11')).toBe(false)
  })
})

describe('enumerateDays', () => {
  it('is inclusive of both endpoints', () => {
    expect(enumerateDays('2026-05-06', '2026-05-10')).toEqual([
      '2026-05-06',
      '2026-05-07',
      '2026-05-08',
      '2026-05-09',
      '2026-05-10',
    ])
  })

  it('returns a single-day array when start === end', () => {
    expect(enumerateDays('2026-05-06', '2026-05-06')).toEqual(['2026-05-06'])
  })

  it('returns an empty array when start > end', () => {
    expect(enumerateDays('2026-05-10', '2026-05-06')).toEqual([])
  })

  it('steps correctly across a month boundary', () => {
    expect(enumerateDays('2026-04-29', '2026-05-02')).toEqual([
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
      '2026-05-02',
    ])
  })
})

describe('sessionSeconds', () => {
  it('computes whole seconds between start and end', () => {
    expect(sessionSeconds(mkSession(0, 90_000))).toBe(90)
  })

  it('is 0 for a still-open session (endMs == null)', () => {
    expect(sessionSeconds(mkSession(0, null))).toBe(0)
  })
})

describe('formatDuration', () => {
  it('0 -> "0m"', () => expect(formatDuration(0)).toBe('0m'))
  it('1800 -> "30m"', () => expect(formatDuration(1800)).toBe('30m'))
  it('27000 -> "7h 30m"', () => expect(formatDuration(27000)).toBe('7h 30m'))
  it('3600 -> "1h 0m"', () => expect(formatDuration(3600)).toBe('1h 0m'))
})

describe('formatSignedDuration', () => {
  it('11700 -> "+3h 15m"', () => expect(formatSignedDuration(11700)).toBe('+3h 15m'))
  it('-6000 -> "−1h 40m" (U+2212 minus)', () =>
    expect(formatSignedDuration(-6000)).toBe('−1h 40m'))
  it('0 -> "±0m"', () => expect(formatSignedDuration(0)).toBe('±0m'))
})

describe('formatStopwatch', () => {
  it('< 1 hour -> "M:SS" (minutes unpadded, seconds zero-padded)', () => {
    expect(formatStopwatch(5)).toBe('0:05')
    expect(formatStopwatch(65)).toBe('1:05')
    expect(formatStopwatch(3599)).toBe('59:59')
  })

  it('>= 1 hour -> "H:MM:SS" (minutes and seconds zero-padded)', () => {
    expect(formatStopwatch(3600)).toBe('1:00:00')
    expect(formatStopwatch(3661)).toBe('1:01:01')
  })

  it('never negative: clamps below 0 to 0', () => {
    expect(formatStopwatch(-5)).toBe('0:00')
  })
})

describe('weekKey / monthKey', () => {
  // Week 2026-W19 runs Mon 2026-05-04 .. Sun 2026-05-10 (ISO Thursday rule).
  it('2026-05-09 (Sat) falls in ISO week 2026-W19', () => {
    expect(weekKey('2026-05-09')).toBe('2026-W19')
  })

  it('2026-05-10 (Sun) is still in ISO week 2026-W19', () => {
    expect(weekKey('2026-05-10')).toBe('2026-W19')
  })

  it('2026-05-11 (Mon) starts the next ISO week, 2026-W20', () => {
    expect(weekKey('2026-05-11')).toBe('2026-W20')
  })

  it('handles the ISO year-boundary rule (2026-01-01, Thu, belongs to W01)', () => {
    expect(weekKey('2026-01-01')).toBe('2026-W01')
  })

  it('handles the ISO year-boundary the other way: 2027-01-01 (Fri) still belongs to 2026-W53', () => {
    expect(weekKey('2027-01-01')).toBe('2026-W53')
  })

  it('monthKey extracts "YYYY-MM"', () => {
    expect(monthKey('2026-05-09')).toBe('2026-05')
    expect(monthKey('2026-01-01')).toBe('2026-01')
  })
})

describe('formatClock', () => {
  it('formats local hours/minutes as zero-padded 24h "HH:MM"', () => {
    expect(formatClock(new Date(2026, 4, 6, 8, 15).getTime())).toBe('08:15')
  })

  it('zero-pads a midnight time', () => {
    expect(formatClock(new Date(2026, 4, 6, 0, 5).getTime())).toBe('00:05')
  })

  it('never renders AM/PM: 23:59 stays "23:59"', () => {
    expect(formatClock(new Date(2026, 4, 6, 23, 59).getTime())).toBe('23:59')
  })
})

describe('formatDayHeading', () => {
  it('renders "Mi., 06.05.2026" for a Wednesday', () => {
    expect(formatDayHeading('2026-05-06')).toBe('Mi., 06.05.2026')
  })

  it('renders the correct short weekday across a full week', () => {
    expect(formatDayHeading('2026-05-04')).toBe('Mo., 04.05.2026')
    expect(formatDayHeading('2026-05-08')).toBe('Fr., 08.05.2026')
    expect(formatDayHeading('2026-05-09')).toBe('Sa., 09.05.2026')
    expect(formatDayHeading('2026-05-10')).toBe('So., 10.05.2026')
  })

  it('zero-pads single-digit day/month', () => {
    expect(formatDayHeading('2026-01-09')).toBe('Fr., 09.01.2026')
  })
})

describe('msToLocalInputValue / localInputValueToMs', () => {
  it('formats an instant as "YYYY-MM-DDTHH:mm" local, zero-padded', () => {
    expect(msToLocalInputValue(new Date(2026, 4, 6, 8, 15).getTime())).toBe('2026-05-06T08:15')
    expect(msToLocalInputValue(new Date(2026, 0, 9, 0, 5).getTime())).toBe('2026-01-09T00:05')
  })

  it('round-trips through localInputValueToMs (whole-minute instants)', () => {
    const ms = new Date(2026, 4, 6, 14, 30).getTime()
    expect(localInputValueToMs(msToLocalInputValue(ms))).toBe(ms)
  })

  it('parses a "YYYY-MM-DDTHH:mm" string as local time (no offset)', () => {
    expect(localInputValueToMs('2026-05-06T08:15')).toBe(new Date(2026, 4, 6, 8, 15).getTime())
  })

  it('returns null for an empty value', () => {
    expect(localInputValueToMs('')).toBeNull()
  })

  it('returns null for an unparseable value', () => {
    expect(localInputValueToMs('garbage')).toBeNull()
  })
})

describe('mondayOfWeekKey (inverse of weekKey)', () => {
  it('2026-W29 starts Monday 2026-07-13 (matches HANDOFF §4.3 "KW 29" example)', () => {
    expect(mondayOfWeekKey('2026-W29')).toBe('2026-07-13')
  })

  it('2026-W19 starts Monday 2026-05-04 (per weekKey\'s own test fixture)', () => {
    expect(mondayOfWeekKey('2026-W19')).toBe('2026-05-04')
  })

  it('handles the ISO year-boundary week: 2026-W53 starts Monday 2026-12-28', () => {
    expect(mondayOfWeekKey('2026-W53')).toBe('2026-12-28')
  })

  it('round-trips with weekKey for an arbitrary Monday', () => {
    expect(mondayOfWeekKey(weekKey('2026-06-01'))).toBe('2026-06-01')
  })
})

describe('formatWeekRange', () => {
  it('"KW 29" example: 2026-W29 -> "13.–19.07.2026"', () => {
    expect(formatWeekRange('2026-W29')).toBe('13.–19.07.2026')
  })

  it('a week spanning a month boundary shows both months', () => {
    // 2026-W31 (Mon 2026-07-27 .. Sun 2026-08-02)
    expect(formatWeekRange('2026-W31')).toBe('27.07.–02.08.2026')
  })

  it('a week spanning a year boundary shows both years in full', () => {
    expect(formatWeekRange('2026-W53')).toBe('28.12.2026–03.01.2027')
  })
})

describe('formatWeekHeading', () => {
  it('matches the HANDOFF §4.3 example exactly', () => {
    expect(formatWeekHeading('2026-W29')).toBe('KW 29 · 13.–19.07.2026')
  })

  it('strips a leading zero from a single-digit week number', () => {
    expect(formatWeekHeading('2026-W05').startsWith('KW 5 ·')).toBe(true)
  })
})

describe('formatMonthHeading', () => {
  it('"2026-07" -> "Juli 2026"', () => {
    expect(formatMonthHeading('2026-07')).toBe('Juli 2026')
  })

  it('renders full German month names for January and December', () => {
    expect(formatMonthHeading('2026-01')).toBe('Januar 2026')
    expect(formatMonthHeading('2026-12')).toBe('Dezember 2026')
  })
})

describe('startOfMonth / endOfMonth / addMonths', () => {
  it('startOfMonth returns the 1st', () => {
    expect(startOfMonth('2026-07')).toBe('2026-07-01')
  })

  it('endOfMonth returns the 30th/31st for 30/31-day months', () => {
    expect(endOfMonth('2026-07')).toBe('2026-07-31')
    expect(endOfMonth('2026-06')).toBe('2026-06-30')
  })

  it('endOfMonth handles February in a non-leap year', () => {
    expect(endOfMonth('2026-02')).toBe('2026-02-28')
  })

  it('endOfMonth handles February in a leap year', () => {
    expect(endOfMonth('2028-02')).toBe('2028-02-29')
  })

  it('addMonths steps forward and backward within a year', () => {
    expect(addMonths('2026-07', 1)).toBe('2026-08')
    expect(addMonths('2026-07', -1)).toBe('2026-06')
  })

  it('addMonths rolls over a year boundary in both directions', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
})

describe('monthGridDays', () => {
  it('pads a month starting mid-week back to the prior Monday (Jul 2026 starts Wed)', () => {
    const days = monthGridDays('2026-07')
    expect(days[0]).toBe('2026-06-29')
    expect(days[days.length - 1]).toBe('2026-08-02')
    expect(days.length).toBe(35)
  })

  it('needs no lead-in days when the month itself starts on a Monday (Jun 2026)', () => {
    const days = monthGridDays('2026-06')
    expect(days[0]).toBe('2026-06-01')
    expect(days[days.length - 1]).toBe('2026-07-05')
    expect(days.length).toBe(35)
  })

  it('every grid is a whole number of Mon-first weeks, starting Mon and ending Sun', () => {
    for (let month = 1; month <= 12; month += 1) {
      const mk = `2026-${String(month).padStart(2, '0')}`
      const days = monthGridDays(mk)
      expect(days.length % 7).toBe(0)
      expect(isWeekend(days[0])).toBe(false) // Monday
      const [y, m, d] = days[0].split('-').map(Number)
      expect(new Date(y, m - 1, d).getDay()).toBe(1) // Monday exactly
      const last = days[days.length - 1]
      const [ly, lm, ld] = last.split('-').map(Number)
      expect(new Date(ly, lm - 1, ld).getDay()).toBe(0) // Sunday exactly
    }
  })

  it('contains every day of the month itself', () => {
    const days = monthGridDays('2026-02')
    expect(days).toEqual(expect.arrayContaining(enumerateDays('2026-02-01', '2026-02-28')))
  })
})
