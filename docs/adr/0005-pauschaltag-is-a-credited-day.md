# A Pauschaltag is a credited day, not a target floor

Some days are spent working but cannot be clocked honestly, for example a
Dienstreise, a company celebration or a day spent mostly on the road. The user
wants such a day to count as a full working day without logging sessions. We
added a sixth `DayType`, `pauschal`, and made it a gutgeschriebener Tag: it is
in `isLabeledType`, so it carries no Tagessoll and contributes nothing to the
Gleitzeit, whatever is logged on it.

## Considered Options

**Target as a floor.** Credit the Tagessoll, but let logged work above it earn
Gleitzeit (`delta = max(0, net − Tagessoll)`). We rejected this because the
point of the label is that nobody knows which hours were work. A floor would ask
the user to log the very hours the label exists to skip, and every logged
minute would then become a judgement call about whether it counts.

**A credited day (chosen).** It derives exactly like `vacation`, `sick` and
`holiday`, with no new branch in `deriveDay`. The only thing that separates it
from `vacation` is that the Urlaubskonto counts `vacation` alone, so a
Pauschaltag never costs an Urlaubstag.

## Consequences

- Logged sessions on a Pauschaltag are kept but ignored, the same rule and the
  same hint in the day view as on any credited day. If a long day really should
  earn Plus, the user labels it `work` and logs it instead.
- A Pauschaltag on a weekend is neutral, like any labeled weekend. The weekend
  carries no Tagessoll, so there is nothing to credit.
- `DAY_TYPES` in `src/db/backup.ts` widens. This is additive, so the file format
  stays at version 1. An older app version would reject a backup that contains
  the new label, the same accepted trade-off as for `gleitzeittag`.
