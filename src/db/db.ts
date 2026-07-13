// IndexedDB schema + lazy singleton connection (HANDOFF.md §5; CLAUDE.md db/db.ts contract).
// Owns the store/index shapes; `repo.ts` builds the CRUD contract on top.

import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Session, DayMeta, Settings } from '@/domain/types'
import { dayKeyFromMs } from '@/domain/time'
import { SCHEMA_VERSION } from '@/domain/constants'

export const DB_NAME = 'arbeitszeit'

/** Fixed out-of-line key under which the single settings record is stored. */
export const SETTINGS_KEY = 'app'

/**
 * Session as persisted: `Session` has no `dayKey` field, so we add the local
 * calendar day of `startMs` at write time and index on it (HANDOFF §5 requires
 * a `by-day` index so history/derivation can bucket sessions per day).
 */
export type StoredSession = Session & { dayKey: string }

/** Builds the on-disk representation of a Session (adds the derived dayKey). */
export function toStoredSession(session: Session): StoredSession {
  return { ...session, dayKey: dayKeyFromMs(session.startMs) }
}

export interface ArbeitszeitDB extends DBSchema {
  sessions: {
    key: string
    value: StoredSession
    indexes: { 'by-day': string }
  }
  dayMeta: {
    key: string
    value: DayMeta
  }
  settings: {
    key: string
    value: Settings
  }
}

let dbPromise: Promise<IDBPDatabase<ArbeitszeitDB>> | undefined

/** Lazily opens (once) and returns the shared IndexedDB connection. */
export function getDb(): Promise<IDBPDatabase<ArbeitszeitDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ArbeitszeitDB>(DB_NAME, SCHEMA_VERSION, {
      upgrade(db) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
        sessions.createIndex('by-day', 'dayKey')
        db.createObjectStore('dayMeta', { keyPath: 'date' })
        // Out-of-line keys: settings has no keyPath; the single record lives
        // under the fixed key SETTINGS_KEY.
        db.createObjectStore('settings')
      },
    })
  }
  return dbPromise
}
