import 'fake-indexeddb/auto'

import {
  getAllSessions,
  putSession,
  deleteSession,
  getOpenSession,
  getAllDayMeta,
  putDayMeta,
  deleteDayMeta,
  getSettings,
  putSettings,
  wipeAll,
  bulkImport,
  replaceAllData,
  mergeImport,
} from './repo'
import { getDb, SETTINGS_KEY } from './db'
import { dayKeyFromMs } from '@/domain/time'
import {
  DEFAULT_DAILY_TARGET_SECONDS,
  DEFAULT_BALANCE_START_DATE,
  SCHEMA_VERSION,
} from '@/domain/constants'
import type { Session, DayMeta, Settings } from '@/domain/types'

let idCounter = 0
function mkSession(overrides: Partial<Session> = {}): Session {
  idCounter += 1
  return {
    id: `sess-${idCounter}`,
    kind: 'work',
    startMs: Date.parse('2026-05-06T08:00:00'),
    endMs: Date.parse('2026-05-06T16:00:00'),
    autoStopped: false,
    note: '',
    ...overrides,
  }
}

// Every test starts from a clean database so tests are independent of order.
beforeEach(async () => {
  await wipeAll()
})

describe('getSettings', () => {
  it('creates and persists first-run defaults when none exist', async () => {
    const settings = await getSettings()
    expect(settings.dailyTargetSeconds).toBe(DEFAULT_DAILY_TARGET_SECONDS)
    expect(settings.balanceStartDate).toBe(DEFAULT_BALANCE_START_DATE)
    expect(settings.schemaVersion).toBe(SCHEMA_VERSION)
    expect(typeof settings.createdAt).toBe('number')
    expect(settings.onboarded).toBe(false)

    // Persisted: the raw store already holds the defaults, not just the return value.
    const db = await getDb()
    const raw = await db.get('settings', SETTINGS_KEY)
    expect(raw).toEqual(settings)
  })

  it('returns the existing record on a second call instead of re-creating it', async () => {
    const first = await getSettings()
    const second = await getSettings()
    expect(second).toEqual(first)
  })

  it('normalizes a pre-wave-4 settings record that lacks `onboarded` to false (Wave 4)', async () => {
    const db = await getDb()
    // Simulate a settings row persisted before the `onboarded` field existed:
    // the raw record genuinely has no such key, even though `Settings` says it must.
    const legacyShape = {
      dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
      balanceStartDate: DEFAULT_BALANCE_START_DATE,
      schemaVersion: SCHEMA_VERSION,
      createdAt: 123,
    }
    await db.put('settings', legacyShape as Settings, SETTINGS_KEY)

    const settings = await getSettings()
    expect(settings.onboarded).toBe(false)
  })
})

describe('putSession / getAllSessions / deleteSession', () => {
  it('round-trips a session and stores the derived dayKey on the raw record', async () => {
    const session = mkSession({ id: 'sess-1', startMs: Date.parse('2026-05-06T08:00:00') })
    await putSession(session)

    const all = await getAllSessions()
    expect(all).toEqual([session])

    const db = await getDb()
    const raw = await db.get('sessions', 'sess-1')
    expect(raw?.dayKey).toBe(dayKeyFromMs(session.startMs))
  })

  it('upserts on a repeated put with the same id', async () => {
    const session = mkSession({ id: 'sess-upsert', note: 'first' })
    await putSession(session)
    await putSession({ ...session, note: 'second' })

    const all = await getAllSessions()
    expect(all).toHaveLength(1)
    expect(all[0]?.note).toBe('second')
  })

  it('deleteSession removes it', async () => {
    const session = mkSession({ id: 'sess-del' })
    await putSession(session)
    await deleteSession('sess-del')

    const all = await getAllSessions()
    expect(all.find((s) => s.id === 'sess-del')).toBeUndefined()
  })
})

describe('getOpenSession', () => {
  it('finds the session whose endMs is null among closed ones', async () => {
    await putSession(mkSession({ id: 'closed', endMs: Date.parse('2026-05-06T12:00:00') }))
    await putSession(mkSession({ id: 'open', endMs: null }))

    const found = await getOpenSession()
    expect(found?.id).toBe('open')
    expect(found?.endMs).toBeNull()
  })

  it('returns undefined when no session is open', async () => {
    await putSession(mkSession({ id: 'closed', endMs: Date.parse('2026-05-06T12:00:00') }))
    expect(await getOpenSession()).toBeUndefined()
  })
})

describe('putDayMeta / getAllDayMeta / deleteDayMeta', () => {
  it('round-trips a day label', async () => {
    const meta: DayMeta = { date: '2026-05-14', type: 'holiday', note: 'Feiertag' }
    await putDayMeta(meta)
    expect(await getAllDayMeta()).toEqual([meta])
  })

  it('deleteDayMeta removes it', async () => {
    await putDayMeta({ date: '2026-05-15', type: 'vacation', note: '' })
    await deleteDayMeta('2026-05-15')
    expect(await getAllDayMeta()).toEqual([])
  })
})

describe('putSettings', () => {
  it('persists an updated settings record', async () => {
    const current = await getSettings()
    await putSettings({ ...current, dailyTargetSeconds: 18000 })
    expect((await getSettings()).dailyTargetSeconds).toBe(18000)
  })
})

describe('bulkImport', () => {
  it('upserts sessions and dayMeta, and merges a partial settings patch', async () => {
    await bulkImport({
      sessions: [mkSession({ id: 'bulk-1' })],
      dayMeta: [{ date: '2026-05-20', type: 'sick', note: '' }],
      settings: { dailyTargetSeconds: 19800 },
    })

    const sessions = await getAllSessions()
    const dayMeta = await getAllDayMeta()
    const settings = await getSettings()

    expect(sessions.map((s) => s.id)).toContain('bulk-1')
    expect(dayMeta).toEqual([{ date: '2026-05-20', type: 'sick', note: '' }])
    expect(settings.dailyTargetSeconds).toBe(19800)
    // Untouched fields of the partial patch keep their previous (default) value.
    expect(settings.balanceStartDate).toBe(DEFAULT_BALANCE_START_DATE)
  })
})

describe('wipeAll', () => {
  it('empties sessions, dayMeta, and settings', async () => {
    await putSession(mkSession({ id: 'to-wipe' }))
    await putDayMeta({ date: '2026-05-16', type: 'vacation', note: '' })
    await getSettings()

    await wipeAll()

    expect(await getAllSessions()).toEqual([])
    expect(await getAllDayMeta()).toEqual([])
    const db = await getDb()
    expect(await db.get('settings', SETTINGS_KEY)).toBeUndefined()
  })
})

describe('replaceAllData (backup "Ersetzen")', () => {
  const importSettings: Settings = {
    dailyTargetSeconds: 21300,
    balanceStartDate: '2026-05-06',
    schemaVersion: SCHEMA_VERSION,
    createdAt: 123,
    onboarded: true,
  }

  it('atomically replaces sessions AND day labels (regression: labels must not be dropped)', async () => {
    // Pre-existing data that must be fully replaced.
    await putSession(mkSession({ id: 'old' }))
    await putDayMeta({ date: '2026-01-01', type: 'holiday', note: 'old' })

    await replaceAllData({
      settings: importSettings,
      sessions: [mkSession({ id: 'new-1' }), mkSession({ id: 'new-2' })],
      dayMeta: [
        { date: '2026-05-14', type: 'holiday', note: '' },
        { date: '2026-05-26', type: 'vacation', note: '' },
      ],
    })

    const sessions = await getAllSessions()
    const dayMeta = await getAllDayMeta()
    expect(sessions.map((s) => s.id).sort()).toEqual(['new-1', 'new-2'])
    // The whole point of the fix: labels persist alongside sessions.
    expect(dayMeta).toEqual([
      { date: '2026-05-14', type: 'holiday', note: '' },
      { date: '2026-05-26', type: 'vacation', note: '' },
    ])
    expect((await getSettings()).dailyTargetSeconds).toBe(21300)
  })

  it('persists a realistic 90-session + 8-label batch (both stores in full)', async () => {
    const sessions = Array.from({ length: 90 }, (_, i) => mkSession({ id: `s-${i}` }))
    const dayMeta: DayMeta[] = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-05-${String(i + 10).padStart(2, '0')}`,
      type: 'vacation',
      note: '',
    }))
    await replaceAllData({ settings: importSettings, sessions, dayMeta })
    expect((await getAllSessions()).length).toBe(90)
    expect((await getAllDayMeta()).length).toBe(8)
  })
})

describe('mergeImport (backup "Zusammenführen")', () => {
  it('upserts sessions + labels without touching settings', async () => {
    await putSession(mkSession({ id: 'keep' }))
    await putDayMeta({ date: '2026-02-02', type: 'sick', note: 'keep' })

    await mergeImport({
      sessions: [mkSession({ id: 'add' })],
      dayMeta: [{ date: '2026-05-14', type: 'holiday', note: '' }],
    })

    expect((await getAllSessions()).map((s) => s.id).sort()).toEqual(['add', 'keep'])
    const dayMeta = await getAllDayMeta()
    expect(dayMeta).toHaveLength(2)
    expect(dayMeta).toContainEqual({ date: '2026-05-14', type: 'holiday', note: '' })
  })
})
