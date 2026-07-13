// JSON backup export/import (HANDOFF §6). Pure functions — no I/O; the store
// (`useStore.exportBackup`/`importBackup`) wires these into persistence, and
// SettingsView wires file save/load around them.

import type { BackupFile, DayMeta, DayType, Session, SessionKind } from '@/domain/types'

/** The JSON backup FILE FORMAT version (HANDOFF §6) — independent of the
 *  IndexedDB `SCHEMA_VERSION` in `domain/constants.ts`, even though both
 *  happen to be `1` today. */
const CURRENT_SCHEMA_VERSION = 1

const SESSION_KINDS = new Set<SessionKind>(['work', 'break'])
const DAY_TYPES = new Set<DayType>(['work', 'vacation', 'sick', 'holiday'])

/** Re-shapes to exactly the canonical `Session` fields, dropping any stray extra (e.g. a persisted `dayKey`). */
function toCanonicalSession(s: Session): Session {
  return { id: s.id, kind: s.kind, startMs: s.startMs, endMs: s.endMs, autoStopped: s.autoStopped, note: s.note }
}

/** Re-shapes to exactly the canonical `DayMeta` fields. */
function toCanonicalDayMeta(m: DayMeta): DayMeta {
  return { date: m.date, type: m.type, note: m.note }
}

/** Builds the exact §6 JSON shape from the current in-memory state. */
export function buildBackup(args: {
  settings: { dailyTargetSeconds: number; balanceStartDate: string }
  sessions: Session[]
  dayMeta: DayMeta[]
}): BackupFile {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      dailyTargetSeconds: args.settings.dailyTargetSeconds,
      balanceStartDate: args.settings.balanceStartDate,
    },
    sessions: args.sessions.map(toCanonicalSession),
    dayMeta: args.dayMeta.map(toCanonicalDayMeta),
  }
}

/** The validated, ready-to-use payload of a successfully parsed backup file. */
export interface BackupData {
  settings: { dailyTargetSeconds: number; balanceStartDate: string }
  sessions: Session[]
  dayMeta: DayMeta[]
}

export type ParseBackupResult = { ok: true; data: BackupData } | { ok: false; error: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidSession(value: unknown): value is Session {
  if (!isPlainObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    SESSION_KINDS.has(value.kind as SessionKind) &&
    typeof value.startMs === 'number' &&
    (value.endMs === null || typeof value.endMs === 'number') &&
    typeof value.autoStopped === 'boolean' &&
    typeof value.note === 'string'
  )
}

function isValidDayMeta(value: unknown): value is DayMeta {
  if (!isPlainObject(value)) return false
  return (
    typeof value.date === 'string' &&
    typeof value.type === 'string' &&
    DAY_TYPES.has(value.type as DayType) &&
    typeof value.note === 'string'
  )
}

/** Validates every element of an unknown array against a type guard; `null` if any element fails. */
function parseArray<T>(value: unknown, isValid: (v: unknown) => v is T): T[] | null {
  if (!Array.isArray(value)) return null
  for (const item of value) {
    if (!isValid(item)) return null
  }
  return value as T[]
}

/**
 * Parses + validates a backup JSON string (HANDOFF §6). Never throws to the
 * caller — any malformation (invalid JSON, wrong schema version, missing or
 * wrong-typed fields) yields a friendly German `error` string instead.
 */
export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Die Datei enthält kein gültiges JSON.' }
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'Ungültiges Backup-Format.' }
  }
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: 'Nicht unterstützte Backup-Version.' }
  }

  const settingsRaw = parsed.settings
  if (
    !isPlainObject(settingsRaw) ||
    typeof settingsRaw.dailyTargetSeconds !== 'number' ||
    typeof settingsRaw.balanceStartDate !== 'string'
  ) {
    return { ok: false, error: 'Backup enthält keine gültigen Einstellungen.' }
  }

  const sessions = parseArray(parsed.sessions, isValidSession)
  if (!sessions) {
    return { ok: false, error: 'Backup enthält fehlerhafte Sitzungsdaten.' }
  }

  const dayMeta = parseArray(parsed.dayMeta, isValidDayMeta)
  if (!dayMeta) {
    return { ok: false, error: 'Backup enthält fehlerhafte Tageskennzeichnungen.' }
  }

  return {
    ok: true,
    data: {
      settings: {
        dailyTargetSeconds: settingsRaw.dailyTargetSeconds,
        balanceStartDate: settingsRaw.balanceStartDate,
      },
      sessions,
      dayMeta,
    },
  }
}
