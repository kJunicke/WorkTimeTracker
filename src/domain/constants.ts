// Domain constants — single source of truth (see HANDOFF.md §8).
// All durations are in SECONDS unless a name says otherwise.

export const HOUR = 3600
export const MINUTE = 60

/** Break-law + auto-stop thresholds (HANDOFF §3.4, §3.3). */
export const SIX_HOURS = 6 * HOUR //  21600 — >= triggers 30m break
export const NINE_HOURS = 9 * HOUR // 32400 — >= triggers 45m break
export const THIRTY_MIN = 30 * MINUTE // 1800
export const FORTY_FIVE_MIN = 45 * MINUTE // 2700
export const TWELVE_HOURS = 12 * HOUR // 43200 — auto-stop cap

/** IndexedDB schema version; bump when store shapes change. */
export const SCHEMA_VERSION = 1

/**
 * First-run onboarding defaults (HANDOFF §7.3). Prefilled but user-editable.
 * 21300s = 5h 55m, derived from the legacy Urlaub/Feiertag credit value.
 */
export const DEFAULT_DAILY_TARGET_SECONDS = 21300
export const DEFAULT_BALANCE_START_DATE = '2026-05-06'
