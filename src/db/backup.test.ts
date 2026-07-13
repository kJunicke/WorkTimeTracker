import { buildBackup, parseBackup } from './backup'
import type { Session, DayMeta, Settings } from '@/domain/types'
import { DEFAULT_BALANCE_START_DATE, DEFAULT_DAILY_TARGET_SECONDS, SCHEMA_VERSION } from '@/domain/constants'

function mkSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
    balanceStartDate: DEFAULT_BALANCE_START_DATE,
    schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(),
    onboarded: true,
    ...overrides,
  }
}

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    kind: 'work',
    startMs: Date.parse('2026-05-06T08:00:00Z'),
    endMs: Date.parse('2026-05-06T16:00:00Z'),
    autoStopped: false,
    note: '',
    ...overrides,
  }
}

describe('buildBackup', () => {
  it('produces the exact §6 shape', () => {
    const settings = mkSettings({ dailyTargetSeconds: 21300, balanceStartDate: '2026-05-06' })
    const sessions = [mkSession()]
    const dayMeta: DayMeta[] = [{ date: '2026-05-14', type: 'holiday', note: '' }]

    const backup = buildBackup({ settings, sessions, dayMeta })

    expect(backup.schemaVersion).toBe(1)
    expect(typeof backup.exportedAt).toBe('string')
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false)
    expect(backup.settings).toEqual({ dailyTargetSeconds: 21300, balanceStartDate: '2026-05-06' })
    expect(backup.sessions).toEqual(sessions)
    expect(backup.dayMeta).toEqual(dayMeta)
  })

  it('drops any internal fields beyond the canonical Session shape (e.g. a stored `dayKey`)', () => {
    const sessionWithExtra = { ...mkSession(), dayKey: '2026-05-06' } as Session
    const backup = buildBackup({ settings: mkSettings(), sessions: [sessionWithExtra], dayMeta: [] })
    expect(backup.sessions[0]).not.toHaveProperty('dayKey')
    expect(backup.sessions[0]).toEqual(mkSession())
  })

  it('only carries dailyTargetSeconds/balanceStartDate from settings (not schemaVersion/createdAt/onboarded)', () => {
    const backup = buildBackup({ settings: mkSettings(), sessions: [], dayMeta: [] })
    expect(Object.keys(backup.settings).sort()).toEqual(['balanceStartDate', 'dailyTargetSeconds'])
  })
})

describe('parseBackup', () => {
  it('round-trips build -> stringify -> parse', () => {
    const settings = mkSettings({ dailyTargetSeconds: 18000, balanceStartDate: '2026-06-01' })
    const sessions = [mkSession({ id: 'a' }), mkSession({ id: 'b', kind: 'break', endMs: null })]
    const dayMeta: DayMeta[] = [{ date: '2026-06-02', type: 'vacation', note: 'Urlaub' }]

    const backup = buildBackup({ settings, sessions, dayMeta })
    const result = parseBackup(JSON.stringify(backup))

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok:true')
    expect(result.data.settings).toEqual({ dailyTargetSeconds: 18000, balanceStartDate: '2026-06-01' })
    expect(result.data.sessions).toEqual(sessions)
    expect(result.data.dayMeta).toEqual(dayMeta)
  })

  it('accepts an open session (endMs: null)', () => {
    const backup = buildBackup({ settings: mkSettings(), sessions: [mkSession({ endMs: null })], dayMeta: [] })
    const result = parseBackup(JSON.stringify(backup))
    expect(result.ok).toBe(true)
  })

  it('rejects invalid JSON with a German error, without throwing', () => {
    const result = parseBackup('{ this is not json')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected ok:false')
    expect(result.error).toMatch(/JSON/)
  })

  it('rejects a non-object JSON value', () => {
    expect(parseBackup('42').ok).toBe(false)
    expect(parseBackup('null').ok).toBe(false)
    expect(parseBackup('[1,2,3]').ok).toBe(false)
  })

  it('rejects the wrong schemaVersion', () => {
    const backup = buildBackup({ settings: mkSettings(), sessions: [], dayMeta: [] })
    const tampered = { ...backup, schemaVersion: 2 }
    const result = parseBackup(JSON.stringify(tampered))
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected ok:false')
    expect(result.error.length).toBeGreaterThan(0)
  })

  it('rejects malformed settings (wrong type)', () => {
    const backup = buildBackup({ settings: mkSettings(), sessions: [], dayMeta: [] })
    const tampered = { ...backup, settings: { dailyTargetSeconds: '21300', balanceStartDate: '2026-05-06' } }
    expect(parseBackup(JSON.stringify(tampered)).ok).toBe(false)
  })

  it('rejects a missing settings key entirely', () => {
    const backup = buildBackup({ settings: mkSettings(), sessions: [], dayMeta: [] })
    const { settings: _settings, ...withoutSettings } = backup
    expect(parseBackup(JSON.stringify(withoutSettings)).ok).toBe(false)
  })

  it('rejects sessions that are not an array', () => {
    const backup = buildBackup({ settings: mkSettings(), sessions: [], dayMeta: [] })
    const tampered = { ...backup, sessions: 'nope' }
    expect(parseBackup(JSON.stringify(tampered)).ok).toBe(false)
  })

  it('rejects a session with an invalid kind', () => {
    const backup = buildBackup({ settings: mkSettings(), sessions: [mkSession()], dayMeta: [] })
    const tampered = { ...backup, sessions: [{ ...backup.sessions[0], kind: 'lunch' }] }
    expect(parseBackup(JSON.stringify(tampered)).ok).toBe(false)
  })

  it('rejects a session missing a required field', () => {
    const backup = buildBackup({ settings: mkSettings(), sessions: [mkSession()], dayMeta: [] })
    const { autoStopped: _autoStopped, ...incomplete } = backup.sessions[0]
    const tampered = { ...backup, sessions: [incomplete] }
    expect(parseBackup(JSON.stringify(tampered)).ok).toBe(false)
  })

  it('rejects dayMeta with an invalid type value', () => {
    const backup = buildBackup({
      settings: mkSettings(),
      sessions: [],
      dayMeta: [{ date: '2026-05-14', type: 'holiday', note: '' }],
    })
    const tampered = { ...backup, dayMeta: [{ date: '2026-05-14', type: 'nope', note: '' }] }
    expect(parseBackup(JSON.stringify(tampered)).ok).toBe(false)
  })
})
