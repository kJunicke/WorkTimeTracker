# Arbeitszeit Tracker

Offline-first tracking of one person's working time against a contractual daily
target, plus the vacation budget that time is measured around.

## Language

### Working time

**Session**:
A continuous span of a single kind — work or break — with a start and an end.
_Avoid_: Entry, block, interval

**Tag** (day):
One local calendar day, the unit everything is derived and displayed per.

**Tageskennzeichnung** (day label):
The single, mutually exclusive label a day carries: `work`, `vacation`, `sick`,
`holiday` or `gleitzeittag`. Absence means an ordinary work day.
_Avoid_: Day status, day flag, marker

**Gutgeschriebener Tag** (credited day):
A day whose label makes it fully neutral — `vacation`, `sick` and `holiday`.
It neither carries a target nor contributes to the Gleitzeit, whatever is
logged on it. A Gleitzeittag is explicitly not one of these.
_Avoid_: Labeled day, off day

**Gleitzeit** (balance):
The running sum of every day's surplus or shortfall against the daily target,
accumulated from the balance start date onward.
_Avoid_: Overtime, flex time, Überstunden

### Vacation

**Urlaubskonto**:
The vacation budget for one leave year: an entitlement, the days drawn against
it, and what remains.
_Avoid_: Holiday counter, vacation balance

**Urlaubsjahr** (leave year):
The calendar year an Urlaubskonto covers. Each one carries its own entitlement.

**Urlaubsanspruch** (entitlement):
The number of vacation days available in a given Urlaubsjahr. Set by hand per
year, so carry-over from the previous year is folded into the number rather
than modelled separately.
_Avoid_: Allowance, quota, budget

**Genommen** (taken):
Vacation days already in the past. Days that have actually been spent.

**Verplant** (planned):
Vacation days labeled but still in the future. Committed, not yet spent.
_Avoid_: Booked, scheduled

**Übrig** (remaining):
Urlaubsanspruch minus genommen minus verplant. The answer to "can I still book
something?".
_Avoid_: Left, available

**Gleitzeittag** (flex day):
A day taken off that draws on the Gleitzeit rather than the Urlaubskonto. It is
not a credited day: it carries the full daily target and so costs its hours
against the Gleitzeit, to be made up on other days. Distinct from an untracked
day only by intent — the label says the shortfall was deliberate.
_Avoid_: Overtime day, comp day, unpaid leave, over-drawn vacation
