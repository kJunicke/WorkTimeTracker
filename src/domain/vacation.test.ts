import {
  deriveUrlaubskonto,
  resolveUrlaubsanspruchSettings,
  setUrlaubsanspruchOverride,
  urlaubsanspruchFor,
} from './vacation'
import type { UrlaubsanspruchSettings } from './vacation'
import type { DayMeta, DayType } from './types'
import { DEFAULT_URLAUBSANSPRUCH } from './constants'

/** Day label fixture; the note never matters to the Urlaubskonto. */
function mkMeta(date: string, type: DayType): DayMeta {
  return { date, type, note: '' }
}

// 2026-08-10 is a Monday, so the surrounding weekdays/weekends below are stable.
const TODAY = '2026-08-10'

describe('urlaubsanspruchFor — a year absent from the map inherits the standard figure', () => {
  it('uses the explicit override for a year that has one', () => {
    const settings: UrlaubsanspruchSettings = {
      urlaubsanspruchStandard: 30,
      urlaubsanspruchByYear: { '2026': 18 },
    }
    expect(urlaubsanspruchFor('2026', settings)).toBe(18)
  })

  it('inherits the standard figure for a year absent from the map', () => {
    const settings: UrlaubsanspruchSettings = {
      urlaubsanspruchStandard: 30,
      urlaubsanspruchByYear: { '2026': 18 },
    }
    expect(urlaubsanspruchFor('2027', settings)).toBe(30)
  })

  it('an override of 0 is a real figure, not an absent year', () => {
    const settings: UrlaubsanspruchSettings = {
      urlaubsanspruchStandard: 30,
      urlaubsanspruchByYear: { '2026': 0 },
    }
    expect(urlaubsanspruchFor('2026', settings)).toBe(0)
  })

  it('falls back to the default when neither field was ever persisted (older settings record)', () => {
    expect(urlaubsanspruchFor('2026', {})).toBe(DEFAULT_URLAUBSANSPRUCH)
  })
})

describe('resolveUrlaubsanspruchSettings — the on-read defaults, applied in one place', () => {
  it('fills in both fields when a persisted record predates them', () => {
    expect(resolveUrlaubsanspruchSettings({})).toEqual({
      urlaubsanspruchStandard: DEFAULT_URLAUBSANSPRUCH,
      urlaubsanspruchByYear: {},
    })
  })

  it('passes through what is already set', () => {
    expect(
      resolveUrlaubsanspruchSettings({
        urlaubsanspruchStandard: 26,
        urlaubsanspruchByYear: { '2026': 18 },
      }),
    ).toEqual({ urlaubsanspruchStandard: 26, urlaubsanspruchByYear: { '2026': 18 } })
  })
})

describe('setUrlaubsanspruchOverride — add, edit, remove', () => {
  const standard: UrlaubsanspruchSettings = { urlaubsanspruchStandard: 30 }

  it('adds an override for a year that had none', () => {
    const map = setUrlaubsanspruchOverride(undefined, '2026', 18)
    expect(map).toEqual({ '2026': 18 })
    expect(urlaubsanspruchFor('2026', { ...standard, urlaubsanspruchByYear: map })).toBe(18)
  })

  it('edits an existing override without disturbing the other years', () => {
    const map = setUrlaubsanspruchOverride({ '2026': 18, '2027': 24 }, '2026', 20)
    expect(map).toEqual({ '2026': 20, '2027': 24 })
  })

  it('removing an override returns that year to the standard figure rather than setting it to zero', () => {
    const map = setUrlaubsanspruchOverride({ '2026': 18, '2027': 24 }, '2026', null)
    expect(map).toEqual({ '2027': 24 })
    expect(urlaubsanspruchFor('2026', { ...standard, urlaubsanspruchByYear: map })).toBe(30)
  })

  it('removing a year that has no override is a no-op', () => {
    expect(setUrlaubsanspruchOverride({ '2027': 24 }, '2026', null)).toEqual({ '2027': 24 })
  })

  it('never mutates the map it was given', () => {
    const original = { '2026': 18 }
    setUrlaubsanspruchOverride(original, '2026', 20)
    setUrlaubsanspruchOverride(original, '2026', null)
    expect(original).toEqual({ '2026': 18 })
  })
})

describe('deriveUrlaubskonto — genommen/verplant split at today', () => {
  it('strictly before today is genommen, today and later is verplant', () => {
    const konto = deriveUrlaubskonto({
      urlaubsjahr: '2026',
      dayMeta: [
        mkMeta('2026-08-05', 'vacation'), // Mi, past
        mkMeta('2026-08-06', 'vacation'), // Do, past
        mkMeta('2026-08-07', 'vacation'), // Fr, past
        mkMeta('2026-08-11', 'vacation'), // Di, future
        mkMeta('2026-08-12', 'vacation'), // Mi, future
      ],
      anspruch: 30,
      today: TODAY,
    })
    expect(konto.genommen).toBe(3)
    expect(konto.verplant).toBe(2)
    expect(konto.uebrig).toBe(25)
  })

  it('a vacation day dated exactly today counts as verplant, not genommen', () => {
    const konto = deriveUrlaubskonto({
      urlaubsjahr: '2026',
      dayMeta: [mkMeta(TODAY, 'vacation')],
      anspruch: 30,
      today: TODAY,
    })
    expect(konto.genommen).toBe(0)
    expect(konto.verplant).toBe(1)
    expect(konto.uebrig).toBe(29)
  })

  it('an empty year consumes nothing and leaves the whole Urlaubsanspruch übrig', () => {
    const konto = deriveUrlaubskonto({ urlaubsjahr: '2026', dayMeta: [], anspruch: 30, today: TODAY })
    expect(konto).toEqual({
      urlaubsjahr: '2026',
      anspruch: 30,
      genommen: 0,
      verplant: 0,
      uebrig: 30,
    })
  })
})

describe('deriveUrlaubskonto — what does and does not consume the Urlaubsanspruch', () => {
  it('a vacation day on a weekend consumes nothing, past or future', () => {
    const konto = deriveUrlaubskonto({
      urlaubsjahr: '2026',
      dayMeta: [
        mkMeta('2026-08-08', 'vacation'), // Sa, past
        mkMeta('2026-08-09', 'vacation'), // So, past
        mkMeta('2026-08-15', 'vacation'), // Sa, future
        mkMeta('2026-08-16', 'vacation'), // So, future
      ],
      anspruch: 30,
      today: TODAY,
    })
    expect(konto.genommen).toBe(0)
    expect(konto.verplant).toBe(0)
    expect(konto.uebrig).toBe(30)
  })

  describe('only `vacation` counts — every other label counts for nothing', () => {
    // `gleitzeittag` is deliberately absent from the Urlaubskonto (ADR 0001):
    // its cost already shows up in the Gleitzeit balance.
    const otherTypes: DayType[] = ['work', 'sick', 'holiday', 'gleitzeittag']
    for (const type of otherTypes) {
      it(`${type} consumes nothing, before or after today`, () => {
        const konto = deriveUrlaubskonto({
          urlaubsjahr: '2026',
          dayMeta: [mkMeta('2026-08-06', type), mkMeta('2026-08-12', type)],
          anspruch: 30,
          today: TODAY,
        })
        expect(konto.genommen).toBe(0)
        expect(konto.verplant).toBe(0)
        expect(konto.uebrig).toBe(30)
      })
    }
  })

  it('vacation days in a neighbouring Urlaubsjahr never count toward this one', () => {
    const dayMeta = [
      mkMeta('2025-12-31', 'vacation'), // Mi, previous year
      mkMeta('2026-01-01', 'vacation'), // Do, this year
      mkMeta('2026-12-31', 'vacation'), // Do, this year
      mkMeta('2027-01-01', 'vacation'), // Fr, next year
    ]

    const konto2026 = deriveUrlaubskonto({ urlaubsjahr: '2026', dayMeta, anspruch: 30, today: TODAY })
    expect(konto2026.genommen).toBe(1) // 2026-01-01 only
    expect(konto2026.verplant).toBe(1) // 2026-12-31 only

    const konto2025 = deriveUrlaubskonto({ urlaubsjahr: '2025', dayMeta, anspruch: 30, today: TODAY })
    expect(konto2025.genommen).toBe(1)
    expect(konto2025.verplant).toBe(0)

    const konto2027 = deriveUrlaubskonto({ urlaubsjahr: '2027', dayMeta, anspruch: 30, today: TODAY })
    expect(konto2027.genommen).toBe(0)
    expect(konto2027.verplant).toBe(1)
  })
})

describe('deriveUrlaubskonto — übrig against the Urlaubsanspruch', () => {
  it('reads the explicit override for a year that has one, and the standard for one that does not', () => {
    const settings: UrlaubsanspruchSettings = {
      urlaubsanspruchStandard: 30,
      urlaubsanspruchByYear: { '2026': 18 },
    }
    const dayMeta = [mkMeta('2026-08-06', 'vacation'), mkMeta('2027-08-06', 'vacation')]

    const overridden = deriveUrlaubskonto({
      urlaubsjahr: '2026',
      dayMeta,
      anspruch: urlaubsanspruchFor('2026', settings),
      today: TODAY,
    })
    expect(overridden.anspruch).toBe(18)
    expect(overridden.uebrig).toBe(17)

    const inherited = deriveUrlaubskonto({
      urlaubsjahr: '2027',
      dayMeta,
      anspruch: urlaubsanspruchFor('2027', settings),
      today: TODAY,
    })
    expect(inherited.anspruch).toBe(30)
    expect(inherited.uebrig).toBe(29)
  })

  it('übrig goes negative when labeled days exceed the Urlaubsanspruch', () => {
    // Mon–Fri of two consecutive weeks in March 2026 — ten weekdays against a
    // three-day Urlaubsanspruch. No carry-over is modelled, so this is simply
    // an over-drawn year (see spec "Out of Scope").
    const dayMeta = [
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
    ].map((date) => mkMeta(date, 'vacation'))

    const konto = deriveUrlaubskonto({ urlaubsjahr: '2026', dayMeta, anspruch: 3, today: TODAY })
    expect(konto.genommen).toBe(5)
    expect(konto.verplant).toBe(0)
    expect(konto.uebrig).toBe(-2)
  })
})
