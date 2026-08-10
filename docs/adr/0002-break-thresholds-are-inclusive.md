# ADR 0002 — §4 break thresholds are inclusive, the statute's are strict

**Status:** accepted, with a known deviation deferred
**Date:** 2026-08-10

## Context

`requiredBreakSeconds` in `src/domain/calc.ts` decides the legally required
break from a day's gross work:

```ts
if (grossWorkSeconds >= NINE_HOURS) return FORTY_FIVE_MIN
if (grossWorkSeconds >= SIX_HOURS) return THIRTY_MIN
return 0
```

Both comparisons are inclusive, and the file header states this deliberately
("Thresholds are inclusive `>=`").

§4 ArbZG is strict. The operative wording is *"bei einer Arbeitszeit von **mehr
als** sechs bis zu neun Stunden"* and *"mehr als neun Stunden"* — **more than**,
not at least. See `docs/research/arbzg-working-time-limits.md`.

So a day of exactly 6h 00m 00s legally requires no break, but the app deducts
30 minutes from it. Same at exactly 9h 00m 00s for the 45-minute step.

## Decision

Leave the inclusive comparisons in place for now. Record the deviation here so
it is understood to be deferred rather than overlooked.

## Consequences

- The app is stricter than the law at exactly two instants. Being stricter is
  safe with respect to §4 itself (which binds the employer), but it understates
  the balance by 30 or 45 minutes on any day that lands exactly on a threshold.
- The error can only ever move the balance against the user, never in their
  favour.
- On stopwatch-recorded data this will effectively never fire — a session
  measured to the second does not land on 6h 00m 00s. It becomes reachable
  through **manual entry**, where round durations are exactly what people type.
  If manual entry becomes the dominant input path, this should be revisited.

## When revisiting

Change both comparisons to `>`, and add cases to `src/domain/calc.test.ts` at
exactly `SIX_HOURS` and `NINE_HOURS` asserting `0` and `THIRTY_MIN`
respectively, plus one second above each asserting the step has engaged. The
header comment in `calc.ts` must be updated too — it currently documents the
inclusive choice as intentional.
