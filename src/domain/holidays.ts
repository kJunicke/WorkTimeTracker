// Pure Feiertag derivation for Berlin — the single place the public-holiday
// rules live. No I/O, no store, no framework: the store overlays this onto the
// stored Tageskennzeichnungen and the Kalender only *reads* the answers.
//
// Why rules and not a hand-typed date table: four of Berlin's ten recurring
// Feiertage are Easter-derived and move every year, so a table would have to be
// retyped annually and would go silently wrong the first year nobody remembered
// to. The rules never do. The one thing rules cannot express is a one-off
// Feiertag, so those — and only those — stay a table (`EINZELFEIERTAGE`).
//
// What a table *would* have given us is an honest horizon, so that is kept
// explicitly: `FEIERTAGE_GEPRUEFT_BIS` is how far the list has actually been
// checked against the statute, and `feiertagAm` answers `undefined` beyond it
// rather than quietly extrapolating. Extending the window is a deliberate act
// (re-read the sources, move the constant) — see
// `docs/research/berlin-public-holidays.md`, which cites a primary source for
// every date here and lists what would invalidate it.

import { yearKey } from './time'

/** One public holiday: the day it falls on and its German name. */
export interface Feiertag {
  /** Local "YYYY-MM-DD". */
  date: string
  /** German name as the Feiertagsgesetz spells it, e.g. "Christi Himmelfahrt". */
  name: string
}

/** The Bundesland whose Feiertage are baked in. Berlin only — see the spec's "Out of Scope". */
export const FEIERTAGE_LAND = 'Berlin'

/**
 * The window the Feiertage are auto-applied in, inclusive.
 *
 * The end is the honest one: the last day up to which the Berlin list has been
 * verified against primary sources — the statute as in force on 2026-08-10,
 * whose one-off Feiertage are fully enumerated through 18.06.2028, after which
 * none exists in current law. Past this date the app labels nothing rather than
 * asserting dates a further Änderungsgesetz could invalidate; Berlin has
 * enacted one-offs twice, each roughly a year ahead, so the risk is real.
 *
 * The start reaches back before `DEFAULT_BALANCE_START_DATE` on purpose, so the
 * whole tracked history is covered and no already-recorded Feiertag is left
 * counting as a day of undertime.
 *
 * Extending this means re-reading the sources — see
 * `docs/research/berlin-public-holidays.md`, which also lists what to re-check.
 */
export const FEIERTAGE_AB = '2026-01-01'
export const FEIERTAGE_GEPRUEFT_BIS = '2028-12-31'

/**
 * One-off Feiertage: single dates a Änderungsgesetz inserted into § 1 Abs. 1
 * and which repeal themselves the day after. They cannot be derived from any
 * rule, so they are the one thing here that IS a hand-typed table — and the
 * reason the verified window has an end at all.
 *
 * Deliberately absent: the 8. Mai. It was enacted exactly twice, for 2020 and
 * for 2025, and both times the same law repealed it again the following day
 * (Viertes Gesetz vom 10.07.2024, Art. 4 Abs. 2). It is a Gedenktag under § 3
 * Abs. 2 in every other year — commemorated, but not work-free.
 */
const EINZELFEIERTAGE: readonly Feiertag[] = [
  { date: '2028-06-17', name: '17. Juni (75. Jahrestag des Aufstandes von 1953)' },
]

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local "YYYY-MM-DD" for a y/m/d triple, shifted by `deltaDays` (may be negative). */
function dateKey(year: number, month1: number, day: number, deltaDays = 0): string {
  const d = new Date(year, month1 - 1, day + deltaDays)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * Ostersonntag of a Gregorian year, as a local "YYYY-MM-DD".
 *
 * The anonymous Gregorian algorithm (Meeus/Jones/Butcher) — plain integer
 * arithmetic over the Metonic cycle, valid for every Gregorian year, with no
 * table to age out. Ostersonntag itself is not a Feiertag in Berlin; it is the
 * anchor the movable ones are counted from.
 */
export function osterSonntag(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return dateKey(year, month, day)
}

/**
 * Every gesetzlicher Feiertag in Berlin for one calendar year, in calendar
 * order — the ten recurring ones of § 1 Abs. 1 FeiertG BE plus any one-off that
 * year holds, and nothing else. Names follow the statute's wording.
 *
 * Deliberately absent from the recurring ten: Ostersonntag and Pfingstsonntag
 * (Feiertage in Brandenburg, not in Berlin — in Berlin they are covered as
 * Sundays), and Fronleichnam, Reformationstag, Allerheiligen, Buß- und Bettag
 * and Mariä Himmelfahrt, none of which Berlin observes.
 *
 * A Feiertag falling on a weekend is still returned: German law grants no
 * substitute day, and several of these do (08.03.2026, 03.10.2027 and
 * 26.12.2027 are Sundays; 17.06.2028 is a Saturday). Nothing downstream needs
 * to special-case that — a weekend already carries no Soll, so the label
 * changes no figure.
 *
 * Answers for ANY year, including years outside the verified window — this is
 * the arithmetic, not the promise. `feiertagAm` is what applies the horizon.
 */
export function berlinerFeiertage(year: number): Feiertag[] {
  const ostern = osterSonntag(year)
  const [oy, om, od] = ostern.split('-').map(Number)
  const vonOstern = (deltaDays: number): string => dateKey(oy, om, od, deltaDays)

  return [
    { date: dateKey(year, 1, 1), name: 'Neujahrstag' },
    { date: dateKey(year, 3, 8), name: 'Frauentag' },
    { date: vonOstern(-2), name: 'Karfreitag' },
    { date: vonOstern(1), name: 'Ostermontag' },
    { date: dateKey(year, 5, 1), name: 'Tag der Arbeit' },
    { date: vonOstern(39), name: 'Christi Himmelfahrt' },
    { date: vonOstern(50), name: 'Pfingstmontag' },
    { date: dateKey(year, 10, 3), name: 'Tag der Deutschen Einheit' },
    { date: dateKey(year, 12, 25), name: 'Erster Weihnachtstag' },
    { date: dateKey(year, 12, 26), name: 'Zweiter Weihnachtstag' },
    ...EINZELFEIERTAGE.filter((f) => yearKey(f.date) === String(year)),
  ].sort((a, b) => a.date.localeCompare(b.date))
}

/** True while `date` lies inside the verified window the app labels Feiertage in. */
export function imFeiertagsfenster(date: string): boolean {
  return date >= FEIERTAGE_AB && date <= FEIERTAGE_GEPRUEFT_BIS
}

/**
 * The Feiertag falling on `date`, or `undefined` — for a day that is none, and
 * for every day outside the verified window whatever the arithmetic says.
 *
 * Memoized per year because the Kalender asks this for every cell of a month
 * grid on every re-render, and the answer for a year never changes.
 */
const cache = new Map<string, Map<string, Feiertag>>()

export function feiertagAm(date: string): Feiertag | undefined {
  if (!imFeiertagsfenster(date)) return undefined
  const jahr = yearKey(date)
  let byDate = cache.get(jahr)
  if (!byDate) {
    byDate = new Map(berlinerFeiertage(Number(jahr)).map((f) => [f.date, f]))
    cache.set(jahr, byDate)
  }
  return byDate.get(date)
}

/**
 * Every Feiertag inside the verified window, in calendar order — what the
 * Kalender's note counts, and the whole set the store overlays.
 */
export function feiertageImFenster(): Feiertag[] {
  const vonJahr = Number(yearKey(FEIERTAGE_AB))
  const bisJahr = Number(yearKey(FEIERTAGE_GEPRUEFT_BIS))
  const alle: Feiertag[] = []
  for (let jahr = vonJahr; jahr <= bisJahr; jahr += 1) {
    for (const f of berlinerFeiertage(jahr)) {
      if (imFeiertagsfenster(f.date)) alle.push(f)
    }
  }
  return alle
}
