import { betrifftVergangenheit, setTagessollEintrag, tagessollAm } from './tagessoll'
import type { TagessollSettings } from './tagessoll'

const EIGHT_HOURS = 8 * 3600
const TEILZEIT = 21300 // 5h55m

// The Aufstockung from the spec: full time from October, back at New Year.
const AUFSTOCKUNG: TagessollSettings = {
  dailyTargetSeconds: TEILZEIT,
  tagessollAb: { '2026-10-01': EIGHT_HOURS, '2027-01-01': TEILZEIT },
}

describe('tagessollAm — the entry in force on a date', () => {
  it('uses the "seit Beginn" value before the first dated entry', () => {
    expect(tagessollAm('2026-09-30', AUFSTOCKUNG)).toBe(TEILZEIT)
  })

  it('switches on the start date itself', () => {
    expect(tagessollAm('2026-10-01', AUFSTOCKUNG)).toBe(EIGHT_HOURS)
  })

  it('keeps an entry in force until the next one starts', () => {
    expect(tagessollAm('2026-12-31', AUFSTOCKUNG)).toBe(EIGHT_HOURS)
    expect(tagessollAm('2027-01-01', AUFSTOCKUNG)).toBe(TEILZEIT)
  })

  it('runs the last entry on indefinitely', () => {
    const settings: TagessollSettings = { dailyTargetSeconds: TEILZEIT, tagessollAb: { '2026-10-01': EIGHT_HOURS } }
    expect(tagessollAm('2031-06-15', settings)).toBe(EIGHT_HOURS)
  })

  it('answers every date from the "seit Beginn" value when there is no timeline', () => {
    expect(tagessollAm('2026-10-01', { dailyTargetSeconds: TEILZEIT })).toBe(TEILZEIT)
  })

  it('honours a Tagessoll of 0', () => {
    const settings: TagessollSettings = { dailyTargetSeconds: TEILZEIT, tagessollAb: { '2026-10-01': 0 } }
    expect(tagessollAm('2026-10-02', settings)).toBe(0)
  })
})

describe('setTagessollEintrag — adding, replacing and deleting dated entries', () => {
  it('adds an entry on a new start date', () => {
    expect(setTagessollEintrag({ '2026-10-01': EIGHT_HOURS }, '2027-01-01', TEILZEIT)).toEqual({
      '2026-10-01': EIGHT_HOURS,
      '2027-01-01': TEILZEIT,
    })
  })

  it('replaces the entry when the start date already has one', () => {
    expect(setTagessollEintrag({ '2026-10-01': EIGHT_HOURS }, '2026-10-01', 7 * 3600)).toEqual({
      '2026-10-01': 7 * 3600,
    })
  })

  it('deletes the entry for null, so its days fall back to the preceding one', () => {
    const tagessollAb = setTagessollEintrag(AUFSTOCKUNG.tagessollAb, '2026-10-01', null)
    expect(tagessollAb).toEqual({ '2027-01-01': TEILZEIT })
    expect(tagessollAm('2026-11-02', { dailyTargetSeconds: TEILZEIT, tagessollAb })).toBe(TEILZEIT)
  })

  it('starts a timeline from a settings record that has none', () => {
    expect(setTagessollEintrag(undefined, '2026-10-01', EIGHT_HOURS)).toEqual({ '2026-10-01': EIGHT_HOURS })
  })

  it('leaves the given map untouched', () => {
    const before = { '2026-10-01': EIGHT_HOURS }
    setTagessollEintrag(before, '2027-01-01', TEILZEIT)
    expect(before).toEqual({ '2026-10-01': EIGHT_HOURS })
  })
})

describe('betrifftVergangenheit — does a change move any day up to today?', () => {
  const HEUTE = '2026-10-14'

  it('is false for an entry that starts tomorrow or later', () => {
    const neu = { ...AUFSTOCKUNG, tagessollAb: setTagessollEintrag(AUFSTOCKUNG.tagessollAb, '2026-11-01', 0) }
    expect(betrifftVergangenheit(AUFSTOCKUNG, neu, HEUTE)).toBe(false)
  })

  it('is true for an entry added today', () => {
    const neu = { ...AUFSTOCKUNG, tagessollAb: setTagessollEintrag(AUFSTOCKUNG.tagessollAb, HEUTE, 0) }
    expect(betrifftVergangenheit(AUFSTOCKUNG, neu, HEUTE)).toBe(true)
  })

  it('is true for an entry added in the past', () => {
    const neu = { ...AUFSTOCKUNG, tagessollAb: setTagessollEintrag(AUFSTOCKUNG.tagessollAb, '2026-06-01', 0) }
    expect(betrifftVergangenheit(AUFSTOCKUNG, neu, HEUTE)).toBe(true)
  })

  it('is true for deleting an entry that has already started', () => {
    const neu = { ...AUFSTOCKUNG, tagessollAb: setTagessollEintrag(AUFSTOCKUNG.tagessollAb, '2026-10-01', null) }
    expect(betrifftVergangenheit(AUFSTOCKUNG, neu, HEUTE)).toBe(true)
  })

  it('is false for deleting an entry that has not started yet', () => {
    const neu = { ...AUFSTOCKUNG, tagessollAb: setTagessollEintrag(AUFSTOCKUNG.tagessollAb, '2027-01-01', null) }
    expect(betrifftVergangenheit(AUFSTOCKUNG, neu, HEUTE)).toBe(false)
  })

  it('is true for changing the "seit Beginn" value', () => {
    expect(betrifftVergangenheit(AUFSTOCKUNG, { ...AUFSTOCKUNG, dailyTargetSeconds: 0 }, HEUTE)).toBe(true)
  })

  it('is false when a past entry is re-saved with the value it already had', () => {
    const neu = { ...AUFSTOCKUNG, tagessollAb: setTagessollEintrag(AUFSTOCKUNG.tagessollAb, '2026-10-01', EIGHT_HOURS) }
    expect(betrifftVergangenheit(AUFSTOCKUNG, neu, HEUTE)).toBe(false)
  })
})
