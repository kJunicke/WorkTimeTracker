import {
  deriveUrlaubskonto,
  normalizeUrlaubsanspruch,
  ohneGleitzeittage,
  planTageskennzeichnung,
  planUrlaubSpan,
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

/** The by-day label map the planner reads, mirroring `store.dayMetaByDay`. */
function mkMetaMap(...metas: DayMeta[]): Map<string, DayMeta> {
  return new Map(metas.map((m) => [m.date, m]))
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

describe('normalizeUrlaubsanspruch — what counts as a valid figure', () => {
  const cases: [label: string, input: number, expected: number][] = [
    ['keeps an ordinary figure', 30, 30],
    ['keeps zero — a year with no Urlaubsanspruch at all is a real answer', 0, 0],
    ['keeps the widest a year can be', 366, 366],
    ['clamps a negative figure to zero', -5, 0],
    ['clamps beyond a whole year to 366', 400, 366],
    ['drops the fraction of a typed part-day', 12.7, 12],
    ['floors towards zero before clamping', -0.5, 0],
    ['reads an empty/unparseable input as zero', Number.NaN, 0],
  ]
  for (const [label, input, expected] of cases) {
    it(`${label} (${input} → ${expected})`, () => {
      expect(normalizeUrlaubsanspruch(input)).toBe(expected)
    })
  }
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
    const otherTypes: DayType[] = ['work', 'sick', 'holiday', 'gleitzeittag', 'pauschal']
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

// ---------------------------------------------------------------------------
// planUrlaubSpan
//
// Every span below sits in August 2026, where 2026-08-10 is a Monday — so
// 10.–14. and 17.–21. are weekdays and 15./16. and 22./23. are the weekends
// between and after them.
// ---------------------------------------------------------------------------

const TWO_WEEK_BLOCK = { start: '2026-08-10', end: '2026-08-23' } // Mo through the second So

describe('planUrlaubSpan — a span that fits within the übrig it was given', () => {
  it('marks every day of a two-week block, but only the ten weekdays cost a day', () => {
    const plan = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig: 30 })

    expect(plan.vacation).toHaveLength(14)
    expect(plan.vacation[0]).toBe('2026-08-10')
    expect(plan.vacation[13]).toBe('2026-08-23')
    expect(plan.skipped).toEqual([])
    expect(plan.gleitzeittag).toEqual([])
    expect(plan.kosten).toBe(10)
    expect(plan.uebrigDanach).toBe(20)
  })

  it('reports the span it actually covers', () => {
    const plan = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig: 30 })
    expect(plan.start).toBe('2026-08-10')
    expect(plan.end).toBe('2026-08-23')
  })

  it('writes nothing — the labels it was given come back untouched', () => {
    const labels = mkMetaMap(mkMeta('2026-08-13', 'holiday'))
    planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: labels, uebrig: 30 })
    expect([...labels.values()]).toEqual([mkMeta('2026-08-13', 'holiday')])
  })

  it('a day inside the span that is not in the map is an ordinary work day and becomes Urlaub', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-10',
      end: '2026-08-12',
      dayMetaByDay: mkMetaMap(mkMeta('2026-08-11', 'work')),
      uebrig: 30,
    })
    // An explicit `work` row is not a label in the rule-1 sense — it is
    // overwritten exactly like a day that carries no row at all.
    expect(plan.vacation).toEqual(['2026-08-10', '2026-08-11', '2026-08-12'])
    expect(plan.skipped).toEqual([])
    expect(plan.kosten).toBe(3)
  })
})

describe('planUrlaubSpan — a single-day span', () => {
  it('a single weekday becomes Urlaub and costs one day', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-11',
      end: '2026-08-11',
      dayMetaByDay: new Map(),
      uebrig: 30,
    })
    expect(plan.vacation).toEqual(['2026-08-11'])
    expect(plan.kosten).toBe(1)
    expect(plan.uebrigDanach).toBe(29)
  })

  it('a single weekend day becomes Urlaub and costs nothing', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-15', // Sa
      end: '2026-08-15',
      dayMetaByDay: new Map(),
      uebrig: 30,
    })
    expect(plan.vacation).toEqual(['2026-08-15'])
    expect(plan.kosten).toBe(0)
    expect(plan.uebrigDanach).toBe(30)
  })

  it('a single day that already carries a label is skipped, leaving nothing to write', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-11',
      end: '2026-08-11',
      dayMetaByDay: mkMetaMap(mkMeta('2026-08-11', 'sick')),
      uebrig: 30,
    })
    expect(plan.vacation).toEqual([])
    expect(plan.skipped).toEqual([{ date: '2026-08-11', type: 'sick' }])
    expect(plan.kosten).toBe(0)
  })
})

describe('planUrlaubSpan — start and end given in reverse order', () => {
  it('plans the same span as the forward order', () => {
    const forward = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig: 30 })
    const reversed = planUrlaubSpan({
      start: TWO_WEEK_BLOCK.end,
      end: TWO_WEEK_BLOCK.start,
      dayMetaByDay: new Map(),
      uebrig: 30,
    })
    expect(reversed).toEqual(forward)
  })

  it('normalizes the reported span rather than echoing the order it was given', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-23',
      end: '2026-08-10',
      dayMetaByDay: new Map(),
      uebrig: 30,
    })
    expect(plan.start).toBe('2026-08-10')
    expect(plan.end).toBe('2026-08-23')
  })
})

describe('planUrlaubSpan — a day inside the span that already carries a label', () => {
  it('a Feiertag keeps its label, is reported as skipped, and consumes no vacation day', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-10', // Mo
      end: '2026-08-14', // Fr
      dayMetaByDay: mkMetaMap(mkMeta('2026-08-13', 'holiday')), // Do
      uebrig: 30,
    })
    expect(plan.vacation).toEqual(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-14'])
    expect(plan.skipped).toEqual([{ date: '2026-08-13', type: 'holiday' }])
    expect(plan.kosten).toBe(4)
    expect(plan.uebrigDanach).toBe(26)
  })

  describe('every non-work label is skipped and keeps what it has', () => {
    const labels: Exclude<DayType, 'work'>[] = ['vacation', 'sick', 'holiday', 'gleitzeittag', 'pauschal']
    for (const type of labels) {
      it(`${type} is skipped and costs nothing`, () => {
        const plan = planUrlaubSpan({
          start: '2026-08-10',
          end: '2026-08-12',
          dayMetaByDay: mkMetaMap(mkMeta('2026-08-11', type)),
          uebrig: 30,
        })
        expect(plan.vacation).toEqual(['2026-08-10', '2026-08-12'])
        expect(plan.skipped).toEqual([{ date: '2026-08-11', type }])
        expect(plan.kosten).toBe(2)
      })
    }
  })

  it('a day already labeled Urlaub is not counted a second time', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-10',
      end: '2026-08-14',
      dayMetaByDay: mkMetaMap(mkMeta('2026-08-10', 'vacation'), mkMeta('2026-08-11', 'vacation')),
      uebrig: 30,
    })
    // Those two days are already drawn from the Urlaubskonto, so re-marking
    // them would double-charge an Urlaubskonto they have already been paid out of.
    expect(plan.kosten).toBe(3)
    expect(plan.uebrigDanach).toBe(27)
  })

  it('reports skipped days in calendar order alongside the days to be written', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-10',
      end: '2026-08-14',
      dayMetaByDay: mkMetaMap(mkMeta('2026-08-13', 'holiday'), mkMeta('2026-08-11', 'sick')),
      uebrig: 30,
    })
    expect(plan.skipped.map((s) => s.date)).toEqual(['2026-08-11', '2026-08-13'])
  })
})

describe('planUrlaubSpan — weekends inside the span', () => {
  it('become Urlaub so the whole period reads as time away', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-14', // Fr
      end: '2026-08-17', // Mo
      dayMetaByDay: new Map(),
      uebrig: 30,
    })
    expect(plan.vacation).toEqual(['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17'])
  })

  it('never reduce übrig — a weekend-only span costs nothing even with nothing übrig', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-15', // Sa
      end: '2026-08-16', // So
      dayMetaByDay: new Map(),
      uebrig: 0,
    })
    expect(plan.vacation).toEqual(['2026-08-15', '2026-08-16'])
    expect(plan.kosten).toBe(0)
    expect(plan.uebrigDanach).toBe(0)
  })

  it('a labeled weekend day is still skipped and keeps its label', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-14',
      end: '2026-08-17',
      dayMetaByDay: mkMetaMap(mkMeta('2026-08-15', 'holiday')),
      uebrig: 30,
    })
    expect(plan.vacation).toEqual(['2026-08-14', '2026-08-16', '2026-08-17'])
    expect(plan.skipped).toEqual([{ date: '2026-08-15', type: 'holiday' }])
    expect(plan.kosten).toBe(2)
  })
})

describe('planUrlaubSpan — a span longer than the übrig it was given', () => {
  it('splits at exactly the Urlaubsanspruch boundary: the last day that fits is Urlaub, the first that does not is a Gleitzeittag candidate', () => {
    const plan = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig: 3 })

    // Mo/Di/Mi fit the three remaining days; Do is the first weekday that does not.
    expect(plan.vacation).toContain('2026-08-12') // Mi — last that fits
    expect(plan.gleitzeittag[0]).toBe('2026-08-13') // Do — first that does not
    expect(plan.vacation).not.toContain('2026-08-13')
    expect(plan.gleitzeittag).not.toContain('2026-08-12')
  })

  it('marks exactly the days that fit as Urlaub and offers every further weekday as a Gleitzeittag', () => {
    const plan = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig: 3 })

    expect(plan.vacation).toEqual([
      '2026-08-10', // Mo
      '2026-08-11', // Di
      '2026-08-12', // Mi
      '2026-08-15', // Sa — weekends never overflow
      '2026-08-16', // So
      '2026-08-22', // Sa
      '2026-08-23', // So
    ])
    expect(plan.gleitzeittag).toEqual([
      '2026-08-13',
      '2026-08-14',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
    ])
    expect(plan.kosten).toBe(3)
    expect(plan.uebrigDanach).toBe(0)
  })

  it('a weekend falling past the boundary is still Urlaub and is never offered as a Gleitzeittag', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-14', // Fr — the one weekday the Urlaubskonto still covers
      end: '2026-08-17', // Mo — the first weekday past it
      dayMetaByDay: new Map(),
      uebrig: 1,
    })
    expect(plan.vacation).toEqual(['2026-08-14', '2026-08-15', '2026-08-16'])
    expect(plan.gleitzeittag).toEqual(['2026-08-17'])
    expect(plan.kosten).toBe(1)
  })

  it('with nothing übrig, every weekday is a Gleitzeittag candidate and only the weekends are Urlaub', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-10', // Mo
      end: '2026-08-16', // So
      dayMetaByDay: new Map(),
      uebrig: 0,
    })
    expect(plan.vacation).toEqual(['2026-08-15', '2026-08-16'])
    expect(plan.gleitzeittag).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
    ])
    expect(plan.kosten).toBe(0)
    expect(plan.uebrigDanach).toBe(0)
  })

  it('an already over-drawn Urlaubsjahr buys nothing back — every weekday is a candidate', () => {
    // übrig is allowed to be negative (`deriveUrlaubskonto`); a negative übrig
    // is simply nothing left, never a debt the span is asked to pay off first.
    const plan = planUrlaubSpan({
      start: '2026-08-10',
      end: '2026-08-12',
      dayMetaByDay: new Map(),
      uebrig: -2,
    })
    expect(plan.vacation).toEqual([])
    expect(plan.gleitzeittag).toEqual(['2026-08-10', '2026-08-11', '2026-08-12'])
    expect(plan.kosten).toBe(0)
  })

  it('a day that already carries a label is skipped rather than offered as a Gleitzeittag', () => {
    const plan = planUrlaubSpan({
      start: '2026-08-10',
      end: '2026-08-14',
      dayMetaByDay: mkMetaMap(mkMeta('2026-08-13', 'holiday')),
      uebrig: 1,
    })
    expect(plan.vacation).toEqual(['2026-08-10'])
    expect(plan.gleitzeittag).toEqual(['2026-08-11', '2026-08-12', '2026-08-14'])
    expect(plan.skipped).toEqual([{ date: '2026-08-13', type: 'holiday' }])
  })

  it('never plans more vacation days than the übrig it was given — the Urlaubsanspruch is a hard cap', () => {
    for (const uebrig of [0, 1, 2, 3, 5, 9, 10, 11, 30]) {
      const plan = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig })
      expect(plan.kosten).toBeLessThanOrEqual(uebrig)
      expect(plan.uebrigDanach).toBeGreaterThanOrEqual(0)
      // Nothing is lost or duplicated between the two buckets.
      expect(plan.vacation.length + plan.gleitzeittag.length).toBe(14)
    }
  })
})

describe('ohneGleitzeittage — declining the offer', () => {
  it('drops the candidates and still applies every Urlaub day the Urlaubsanspruch covered', () => {
    const plan = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig: 3 })
    const declined = ohneGleitzeittage(plan)

    expect(declined.gleitzeittag).toEqual([])
    expect(declined.vacation).toEqual(plan.vacation)
    expect(declined.kosten).toBe(3)
    expect(declined.uebrigDanach).toBe(0)
  })

  it('leaves the plan it was given untouched', () => {
    const plan = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig: 3 })
    ohneGleitzeittage(plan)
    expect(plan.gleitzeittag).toHaveLength(7)
  })

  it('is a no-op for a plan that fits', () => {
    const plan = planUrlaubSpan({ ...TWO_WEEK_BLOCK, dayMetaByDay: new Map(), uebrig: 30 })
    expect(ohneGleitzeittage(plan)).toEqual(plan)
  })
})

// ---------------------------------------------------------------------------
// planTageskennzeichnung
//
// The same hard cap as planUrlaubSpan, on the single-day labeling path:
// 2026-08-11 is a Dienstag, 2026-08-15 a Samstag.
// ---------------------------------------------------------------------------

const WEEKDAY = '2026-08-11'
const WEEKEND = '2026-08-15'

describe('planTageskennzeichnung — the Urlaubsanspruch caps single days too', () => {
  const cases: [
    label: string,
    args: Parameters<typeof planTageskennzeichnung>[0],
    expected: ReturnType<typeof planTageskennzeichnung>,
  ][] = [
    [
      'a weekday with nothing übrig is offered as a Gleitzeittag instead',
      { date: WEEKDAY, type: 'vacation', existing: undefined, uebrig: 0 },
      'gleitzeittagAnbieten',
    ],
    [
      'a weekday with one day übrig is labeled',
      { date: WEEKDAY, type: 'vacation', existing: undefined, uebrig: 1 },
      'kennzeichnen',
    ],
    [
      'a weekend is labeled however little is übrig — it costs no Urlaubstag',
      { date: WEEKEND, type: 'vacation', existing: undefined, uebrig: 0 },
      'kennzeichnen',
    ],
    [
      'a day already labeled Urlaub is re-confirmed, not newly spent',
      { date: WEEKDAY, type: 'vacation', existing: 'vacation', uebrig: 0 },
      'kennzeichnen',
    ],
    [
      'an over-drawn Urlaubsjahr is simply nothing übrig, never a debt',
      { date: WEEKDAY, type: 'vacation', existing: undefined, uebrig: -3 },
      'gleitzeittagAnbieten',
    ],
    [
      'a day carrying some other label still needs an Urlaubstag to become Urlaub',
      { date: WEEKDAY, type: 'vacation', existing: 'holiday', uebrig: 0 },
      'gleitzeittagAnbieten',
    ],
    [
      'an explicit work row is not a label and still needs an Urlaubstag',
      { date: WEEKDAY, type: 'vacation', existing: 'work', uebrig: 0 },
      'gleitzeittagAnbieten',
    ],
  ]
  for (const [label, args, expected] of cases) {
    it(label, () => {
      expect(planTageskennzeichnung(args)).toBe(expected)
    })
  }

  describe('every label other than Urlaub is unaffected by the Urlaubskonto', () => {
    const others: DayType[] = ['work', 'sick', 'holiday', 'gleitzeittag', 'pauschal']
    for (const type of others) {
      it(`${type} is labeled even with nothing übrig`, () => {
        for (const date of [WEEKDAY, WEEKEND]) {
          expect(
            planTageskennzeichnung({ date, type, existing: undefined, uebrig: -3 }),
          ).toBe('kennzeichnen')
        }
      })
    }
  })

  it('agrees with planUrlaubSpan on a single-day span — one rule, two entry points', () => {
    for (const uebrig of [-2, 0, 1, 30]) {
      for (const date of [WEEKDAY, WEEKEND]) {
        const span = planUrlaubSpan({ start: date, end: date, dayMetaByDay: new Map(), uebrig })
        const single = planTageskennzeichnung({ date, type: 'vacation', existing: undefined, uebrig })
        expect(single === 'kennzeichnen').toBe(span.vacation.length === 1)
      }
    }
  })
})
