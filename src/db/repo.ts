// Async CRUD repository over IndexedDB (HANDOFF.md §5; CLAUDE.md db/repo.ts contract).
// Thin persistence layer only — no domain logic here.

import { getDb, SETTINGS_KEY, toStoredSession } from './db'
import type { StoredSession } from './db'
import type { Session, DayMeta, Settings } from '@/domain/types'
import {
  DEFAULT_DAILY_TARGET_SECONDS,
  DEFAULT_BALANCE_START_DATE,
  SCHEMA_VERSION,
} from '@/domain/constants'

/** Drops the internal `dayKey` field so callers only ever see the canonical Session shape. */
function stripDayKey({ dayKey: _dayKey, ...session }: StoredSession): Session {
  return session
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDb()
  const stored = await db.getAll('sessions')
  return stored.map(stripDayKey)
}

/** Upsert. Recomputes the stored `dayKey` from `session.startMs` every time. */
export async function putSession(session: Session): Promise<void> {
  const db = await getDb()
  await db.put('sessions', toStoredSession(session))
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('sessions', id)
}

/** The currently-running session, if any (endMs === null). */
export async function getOpenSession(): Promise<Session | undefined> {
  const db = await getDb()
  const all = await db.getAll('sessions')
  const open = all.find((s) => s.endMs === null)
  return open ? stripDayKey(open) : undefined
}

export async function getAllDayMeta(): Promise<DayMeta[]> {
  const db = await getDb()
  return db.getAll('dayMeta')
}

export async function putDayMeta(meta: DayMeta): Promise<void> {
  const db = await getDb()
  await db.put('dayMeta', meta)
}

export async function deleteDayMeta(date: string): Promise<void> {
  const db = await getDb()
  await db.delete('dayMeta', date)
}

/**
 * Returns the persisted settings, creating+persisting first-run defaults if
 * absent. A record written before the `onboarded` field existed (wave 4)
 * simply lacks that key at runtime despite the `Settings` type claiming it's
 * always a `boolean` — normalize it to `false` here so every other caller can
 * trust the field without its own `?? false`.
 */
export async function getSettings(): Promise<Settings> {
  const db = await getDb()
  const existing = await db.get('settings', SETTINGS_KEY)
  if (existing) return { ...existing, onboarded: existing.onboarded ?? false }

  const defaults: Settings = {
    dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    balanceStartDate: DEFAULT_BALANCE_START_DATE,
    schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(),
    onboarded: false,
  }
  await db.put('settings', defaults, SETTINGS_KEY)
  return defaults
}

export async function putSettings(settings: Settings): Promise<void> {
  const db = await getDb()
  await db.put('settings', settings, SETTINGS_KEY)
}

/** Clears all three stores (used by import-replace). */
export async function wipeAll(): Promise<void> {
  const db = await getDb()
  await Promise.all([db.clear('sessions'), db.clear('dayMeta'), db.clear('settings')])
}

/**
 * Upserts a batch of records (legacy import / backup restore). This is NOT
 * wipe-then-load — call `wipeAll` first if replace semantics are needed. A
 * partial `settings` patch is merged into the current settings record.
 */
export async function bulkImport(data: {
  sessions: Session[]
  dayMeta: DayMeta[]
  settings?: Partial<Settings>
}): Promise<void> {
  await Promise.all(data.sessions.map((s) => putSession(s)))
  await Promise.all(data.dayMeta.map((m) => putDayMeta(m)))
  if (data.settings) {
    const current = await getSettings()
    await putSettings({ ...current, ...data.settings })
  }
}

/**
 * Backup "Ersetzen": atomically clears every store and writes the new settings
 * + sessions + day labels in ONE transaction. Doing clear + all writes in a
 * single transaction is deliberate:
 *  - **All-or-nothing:** if any write fails the whole transaction aborts and
 *    the *existing* data is left intact — never a half-wiped DB (the old
 *    wipe-then-load could leave the database empty on a mid-import failure).
 *  - **Mobile-safe:** one transaction instead of ~N concurrent auto-commit
 *    `put`s avoids the mobile-Safari/IndexedDB flakiness that was silently
 *    dropping the day-label records while the sessions went through.
 */
export async function replaceAllData(data: {
  settings: Settings
  sessions: Session[]
  dayMeta: DayMeta[]
}): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['sessions', 'dayMeta', 'settings'], 'readwrite')
  const sessionStore = tx.objectStore('sessions')
  const dayMetaStore = tx.objectStore('dayMeta')
  const settingsStore = tx.objectStore('settings')
  sessionStore.clear()
  dayMetaStore.clear()
  settingsStore.clear()
  for (const s of data.sessions) sessionStore.put(toStoredSession(s))
  for (const m of data.dayMeta) dayMetaStore.put(m)
  settingsStore.put(data.settings, SETTINGS_KEY)
  await tx.done
}

/**
 * Backup "Zusammenführen": upserts sessions (by id) + day labels (by date) in
 * ONE transaction, overwriting on collision. Atomic + mobile-safe for the same
 * reasons as `replaceAllData`; `settings` are left untouched.
 */
export async function mergeImport(data: {
  sessions: Session[]
  dayMeta: DayMeta[]
}): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['sessions', 'dayMeta'], 'readwrite')
  const sessionStore = tx.objectStore('sessions')
  const dayMetaStore = tx.objectStore('dayMeta')
  for (const s of data.sessions) sessionStore.put(toStoredSession(s))
  for (const m of data.dayMeta) dayMetaStore.put(m)
  await tx.done
}
