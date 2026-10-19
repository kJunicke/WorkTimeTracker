# Dienstreise — a work-trip day label

Status: done

## Problem

A business trip is neither an ordinary work day nor a neutral labeled day. Time
spent travelling is not the same as time spent working, but it is also not
vacation, sickness or a public holiday — the four labels `DayType` offers today.

## Sketch

A fifth `DayType`, `worktrip`.

## Open questions

- How does it derive? Does a Dienstreise credit the daily target regardless of
  logged sessions (like `vacation`), count logged sessions normally (like
  `work`), or something in between — e.g. credit the target as a floor but
  allow logged work above it to earn Gleitzeit?
- Do the German break rules (§4 ArbZG) apply to a travel day?
- Adding a `DayType` widens the `DAY_TYPES` validation set in
  `src/db/backup.ts`, so an older app version reading a newer backup will
  reject the file. This needs the backup-compatibility decision resolved first.

## Origin

Raised during the `urlaubskonto` grilling session.

## Comments

Resolved as the broader `pauschal` label (Pauschaltag), which also covers
company celebrations and other days that cannot be clocked. It is a credited
day: no Tagessoll, logged sessions ignored, no Urlaubstag spent. The break-rule
question falls away because nothing is derived from sessions on such a day.
Backup compatibility follows the `gleitzeittag` precedent: an additive widening
that stays at version 1. See ADR 0005.
