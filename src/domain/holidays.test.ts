import { describe, it, expect } from 'vitest'
import {
  FEIERTAGE_AB,
  FEIERTAGE_GEPRUEFT_BIS,
  berlinerFeiertage,
  feiertagAm,
  feiertageImFenster,
  imFeiertagsfenster,
  osterSonntag,
} from './holidays'
import { isWeekend } from './time'

// Dates transcribed from docs/research/berlin-public-holidays.md §3, which took
// 2026/2027 verbatim off berlin.de and derived 2028 from § 1 Abs. 1 FeiertG BE.
// Hand-typed on purpose: a fixture computed the same way the code computes them
// would agree with any bug the code has.
const ERWARTET_2026: Array<[string, string]> = [
  ['2026-01-01', 'Neujahrstag'],
  ['2026-03-08', 'Frauentag'],
  ['2026-04-03', 'Karfreitag'],
  ['2026-04-06', 'Ostermontag'],
  ['2026-05-01', 'Tag der Arbeit'],
  ['2026-05-14', 'Christi Himmelfahrt'],
  ['2026-05-25', 'Pfingstmontag'],
  ['2026-10-03', 'Tag der Deutschen Einheit'],
  ['2026-12-25', 'Erster Weihnachtstag'],
  ['2026-12-26', 'Zweiter Weihnachtstag'],
]

const ERWARTET_2027: Array<[string, string]> = [
  ['2027-01-01', 'Neujahrstag'],
  ['2027-03-08', 'Frauentag'],
  ['2027-03-26', 'Karfreitag'],
  ['2027-03-29', 'Ostermontag'],
  ['2027-05-01', 'Tag der Arbeit'],
  ['2027-05-06', 'Christi Himmelfahrt'],
  ['2027-05-17', 'Pfingstmontag'],
  ['2027-10-03', 'Tag der Deutschen Einheit'],
  ['2027-12-25', 'Erster Weihnachtstag'],
  ['2027-12-26', 'Zweiter Weihnachtstag'],
]

/** Eleven, not ten: 2028 carries the one-off 17. Juni (Viertes Gesetz vom 10.07.2024). */
const ERWARTET_2028: Array<[string, string]> = [
  ['2028-01-01', 'Neujahrstag'],
  ['2028-03-08', 'Frauentag'],
  ['2028-04-14', 'Karfreitag'],
  ['2028-04-17', 'Ostermontag'],
  ['2028-05-01', 'Tag der Arbeit'],
  ['2028-05-25', 'Christi Himmelfahrt'],
  ['2028-06-05', 'Pfingstmontag'],
  ['2028-06-17', '17. Juni (75. Jahrestag des Aufstandes von 1953)'],
  ['2028-10-03', 'Tag der Deutschen Einheit'],
  ['2028-12-25', 'Erster Weihnachtstag'],
  ['2028-12-26', 'Zweiter Weihnachtstag'],
]

describe('osterSonntag', () => {
  // Spot dates from the Gregorian Easter table; 2026/2027 are the two years
  // the app actually labels, the rest pin the algorithm's edges.
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2038, '2038-04-25'], // latest possible date
    [2285, '2285-03-22'], // earliest possible date
  ])('Ostersonntag %i is %s', (year, expected) => {
    expect(osterSonntag(year)).toBe(expected)
  })

  it('always falls on a Sunday', () => {
    for (let year = 2020; year <= 2100; year += 1) {
      expect(isWeekend(osterSonntag(year))).toBe(true)
      const [y, m, d] = osterSonntag(year).split('-').map(Number)
      expect(new Date(y, m - 1, d).getDay()).toBe(0)
    }
  })
})

describe('berlinerFeiertage', () => {
  it('lists exactly the ten Feiertage of 2026, in calendar order', () => {
    expect(berlinerFeiertage(2026).map((f) => [f.date, f.name])).toEqual(ERWARTET_2026)
  })

  it('lists exactly the ten Feiertage of 2027, in calendar order', () => {
    expect(berlinerFeiertage(2027).map((f) => [f.date, f.name])).toEqual(ERWARTET_2027)
  })

  it('adds the one-off 17. Juni to 2028 — and to no other year', () => {
    expect(berlinerFeiertage(2028).map((f) => [f.date, f.name])).toEqual(ERWARTET_2028)
    for (const year of [2026, 2027, 2029, 2030]) {
      expect(berlinerFeiertage(year).map((f) => f.date)).not.toContain(`${year}-06-17`)
      expect(berlinerFeiertage(year)).toHaveLength(10)
    }
  })

  it('never includes days that are Feiertage only in other Länder', () => {
    for (let year = 2026; year <= 2030; year += 1) {
      const dates = new Set(berlinerFeiertage(year).map((f) => f.date))
      const ostern = osterSonntag(year)
      const [y, m, d] = ostern.split('-').map(Number)
      const plus = (n: number): string => {
        const shifted = new Date(y, m - 1, d + n)
        return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`
      }
      expect(dates.has(ostern)).toBe(false) // Ostersonntag — Brandenburg, not Berlin
      expect(dates.has(plus(49))).toBe(false) // Pfingstsonntag — likewise
      expect(dates.has(plus(60))).toBe(false) // Fronleichnam
      // Enacted as a self-repealing one-off for 2020 and 2025 only; a Gedenktag
      // under § 3 Abs. 2 in every other year, which is not work-free.
      expect(dates.has(`${year}-05-08`)).toBe(false)
      expect(dates.has(`${year}-08-15`)).toBe(false) // Mariä Himmelfahrt
      expect(dates.has(`${year}-10-31`)).toBe(false) // Reformationstag
      expect(dates.has(`${year}-11-01`)).toBe(false) // Allerheiligen
    }
  })

  it('answers for years outside the verified window — the arithmetic has no horizon', () => {
    expect(berlinerFeiertage(2035)).toHaveLength(10)
  })
})

describe('feiertagAm', () => {
  it('names the Feiertag falling on a date', () => {
    expect(feiertagAm('2026-05-14')?.name).toBe('Christi Himmelfahrt')
    expect(feiertagAm('2027-03-26')?.name).toBe('Karfreitag')
  })

  it('is undefined for an ordinary day', () => {
    expect(feiertagAm('2026-05-15')).toBeUndefined()
  })

  it('is undefined past the verified horizon, even for a date the rules would name', () => {
    const nachhorizont = berlinerFeiertage(Number(FEIERTAGE_GEPRUEFT_BIS.slice(0, 4)) + 1)
    for (const f of nachhorizont) expect(feiertagAm(f.date)).toBeUndefined()
  })

  it('is undefined before the window starts', () => {
    expect(feiertagAm('2025-12-25')).toBeUndefined()
  })

  it('returns the same answer on a repeated call (memoization is not observable)', () => {
    expect(feiertagAm('2026-12-25')).toEqual(feiertagAm('2026-12-25'))
  })
})

describe('imFeiertagsfenster', () => {
  it('includes both bounds', () => {
    expect(imFeiertagsfenster(FEIERTAGE_AB)).toBe(true)
    expect(imFeiertagsfenster(FEIERTAGE_GEPRUEFT_BIS)).toBe(true)
  })

  it('excludes the days just outside', () => {
    expect(imFeiertagsfenster('2025-12-31')).toBe(false)
    expect(imFeiertagsfenster('2029-01-01')).toBe(false)
  })
})

describe('feiertageImFenster', () => {
  const alle = feiertageImFenster()

  it('covers 2026 through 2028 completely and nothing else', () => {
    expect(alle.map((f) => [f.date, f.name])).toEqual([
      ...ERWARTET_2026,
      ...ERWARTET_2027,
      ...ERWARTET_2028,
    ])
  })

  it('keeps the Feiertage that fall on a weekend — German law grants no substitute day', () => {
    const amWochenende = alle.filter((f) => isWeekend(f.date)).map((f) => f.date)
    expect(amWochenende).toContain('2026-03-08') // Sonntag
    expect(amWochenende).toContain('2027-10-03') // Sonntag
    expect(amWochenende).toContain('2028-06-17') // Samstag
  })

  it('agrees with feiertagAm on every entry', () => {
    for (const f of alle) expect(feiertagAm(f.date)).toEqual(f)
  })
})
