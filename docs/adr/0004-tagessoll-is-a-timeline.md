# The Tagessoll is a timeline of dated entries, never applied retroactively

The daily target used to be one number applied to the whole history, so a
contract change rewrote every past day's surplus or shortfall. The Tagessoll is
now a timeline: an undated "seit Beginn" value plus entries "ab Datum X", each
holding until the next one starts. A day's target is the entry in force on that
date, and recording a new Tagessoll only ever affects days from its start date
on.

## Considered Options

**A default plus deviation periods with start and end dates** — closer to how a
temporary Aufstockung is described, but changing the default later would again
rewrite the past, and periods need overlap rules. A timeline has neither
problem: an Aufstockung is simply two entries, one for its start and one for
the return.

## Consequences

Correcting a past entry still changes history — deliberately, since that is
what a correction is — so the settings show the resulting Saldo change before
saving any edit that touches a day up to today.
