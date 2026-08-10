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

/**
 * Builds the on-disk representation of a Session (adds the derived dayKey).
 * The spread is also what makes this write-safe — see `toStoredDayMeta`.
 */
export function toStoredSession(session: Session): StoredSession {
  return { ...session, dayKey: dayKeyFromMs(session.startMs) }
}

/**
 * Builds the on-disk representation of a DayMeta.
 *
 * It looks like a pointless copy — DayMeta is stored exactly as-is — but it is
 * NOT optional. Anything reaching this layer may be a **Vue reactive proxy**:
 * `ref(someObject).value` returns a `reactive()` Proxy, and IndexedDB's
 * structured-clone algorithm cannot clone a Proxy. Writing one throws
 * `DataCloneError: #<Object> could not be cloned` and aborts the whole
 * transaction. Sessions were accidentally immune because `toStoredSession`
 * spreads them into a plain object; day labels went in raw, which is why
 * importing a backup containing Urlaub/Feiertag labels failed while the
 * sessions in the same file looked fine. Normalize at the boundary so no
 * caller has to know.
 */
export function toStoredDayMeta(meta: DayMeta): DayMeta {
  return { date: meta.date, type: meta.type, note: meta.note }
}

/**
 * Same structured-clone protection for the single settings record.
 *
 * Spread rather than a hand-listed whitelist, matching `toStoredSession`: a
 * whitelist has to be kept in step with `Settings` by hand, and a field it
 * forgets is dropped on EVERY persist, not just the release that added it.
 * The Urlaubsanspruch figures are hand-typed and cannot be re-derived from
 * anything else on disk, so that failure would be unrecoverable and silent.
 *
 * `reactive()` is DEEP, so the top-level spread is not enough on its own —
 * `urlaubsanspruchByYear` is a Proxy of its own and needs copying too, or
 * structured-clone still throws. Kept `undefined` when absent rather than
 * defaulted to `{}`: the field is optional-with-default on read, and writing
 * an empty map here would claim the user had configured one.
 */
export function toStoredSettings(settings: Settings): Settings {
  return {
    ...settings,
    urlaubsanspruchByYear: settings.urlaubsanspruchByYear
      ? { ...settings.urlaubsanspruchByYear }
      : undefined,
  }
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
