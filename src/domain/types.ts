// Canonical domain types (see HANDOFF.md §3, §5, §6).
// NOTE: tsconfig uses `erasableSyntaxOnly` — do NOT use `enum`/namespaces.
// Use string-literal unions + interfaces only.

export type SessionKind = 'work' | 'break'

/** A continuous span of a single kind — the timer's output (HANDOFF §3.1). */
export interface Session {
  id: string
  kind: SessionKind
  /** epoch millis, UTC */
  startMs: number
  /** epoch millis, UTC; null while running, set on stop */
  endMs: number | null
  /** true if closed by the 12h cap (HANDOFF §3.3) */
  autoStopped: boolean
  note: string
}

/** Exactly one label per calendar day, mutually exclusive (HANDOFF §3.5). */
export type DayType = 'work' | 'vacation' | 'sick' | 'holiday'

/** Per-day metadata, stored separately from sessions. Absence ⇒ ordinary work day. */
export interface DayMeta {
  /** local calendar day, "YYYY-MM-DD" */
  date: string
  type: DayType
  note: string
}

/** Single settings record (HANDOFF §5). */
export interface Settings {
  dailyTargetSeconds: number
  /** local "YYYY-MM-DD"; balance accumulates from this day onward */
  balanceStartDate: string
  schemaVersion: number
  createdAt: number
  /**
   * True once first-run onboarding (legacy import or "start empty") has been
   * completed (HANDOFF §7.3). A settings record persisted before this field
   * existed simply lacks it — callers MUST treat a missing value as `false`.
   */
  onboarded: boolean
}

/** Timer machine state, derived from the open session (HANDOFF §3.2). */
export type TimerState = 'idle' | 'working' | 'onbreak'

/**
 * Per-day derivation result (HANDOFF §3.4, §8). Pure function of a day's
 * sessions + label + the daily target. `autoDeductedSeconds > 0` MUST be
 * surfaced in the UI as the legally topped-up break.
 */
export interface DayDerivation {
  date: string
  type: DayType
  isWeekend: boolean
  grossWorkSeconds: number
  loggedBreakSeconds: number
  requiredBreakSeconds: number
  effectiveBreakSeconds: number
  autoDeductedSeconds: number
  netWorkSeconds: number
  /** target contribution for the day; 0 on weekends and labeled days */
  expectedSeconds: number
  /** balance contribution: netWork − expected, or 0 when credited/weekend */
  deltaSeconds: number
}

/** JSON backup file shape (HANDOFF §6). */
export interface BackupFile {
  schemaVersion: number
  exportedAt: string
  settings: {
    dailyTargetSeconds: number
    balanceStartDate: string
  }
  sessions: Session[]
  dayMeta: DayMeta[]
}
