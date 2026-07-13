// Reactive singleton store (HANDOFF.md §3.2–§3.6, §4.1, §5; CLAUDE.md
// store/useStore.ts contract). Plain Vue reactivity only — NO Pinia.
//
// One instance for the whole app (module-level singleton, created once).
// Every mutating action persists to IndexedDB via `@/db/repo` first, then
// mirrors the change into the in-memory refs (single user ⇒ the in-memory
// copy of all sessions/dayMeta is trivially small). Screens call `useStore()`
// and read/act through the returned object.

import { computed, ref } from 'vue'
import type {
  BackupFile,
  DayDerivation,
  DayMeta,
  DayType,
  Session,
  SessionKind,
  Settings,
  TimerState,
} from '@/domain/types'
import { dayKeyFromMs, enumerateDays, isWeekend, todayKey } from '@/domain/time'
import { deriveDay, deriveRange } from '@/domain/calc'
import {
  DEFAULT_BALANCE_START_DATE,
  DEFAULT_DAILY_TARGET_SECONDS,
  SCHEMA_VERSION,
  TWELVE_HOURS,
} from '@/domain/constants'
import * as repo from '@/db/repo'
import { buildBackup } from '@/db/backup'
import type { BackupData } from '@/db/backup'
import { useClock } from './useClock'

const TWELVE_HOURS_MS = TWELVE_HOURS * 1000

export interface PendingReconciliation {
  session: Session
  capMs: number
}

/** Input for a manually-added session (HANDOFF §4.2 "manual add"). */
export interface AddSessionInput {
  kind: SessionKind
  startMs: number
  endMs: number | null
  note?: string
}

const { now } = useClock()

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const ready = ref(false)
const sessions = ref<Session[]>([])
const dayMeta = ref<DayMeta[]>([])
const settings = ref<Settings>({
  dailyTargetSeconds: DEFAULT_DAILY_TARGET_SECONDS,
  balanceStartDate: DEFAULT_BALANCE_START_DATE,
  schemaVersion: SCHEMA_VERSION,
  createdAt: Date.now(),
  onboarded: false,
})
const pendingReconciliation = ref<PendingReconciliation | null>(null)

// ---------------------------------------------------------------------------
// Computed derivations
// ---------------------------------------------------------------------------

const dayMetaByDay = computed<Map<string, DayMeta>>(() => {
  const map = new Map<string, DayMeta>()
  for (const m of dayMeta.value) map.set(m.date, m)
  return map
})

/** The one session with `endMs === null`, if any (HANDOFF §3.2). */
const openSession = computed<Session | null>(() => sessions.value.find((s) => s.endMs === null) ?? null)

const timerState = computed<TimerState>(() => {
  const open = openSession.value
  if (!open) return 'idle'
  return open.kind === 'work' ? 'working' : 'onbreak'
})

/** Live elapsed time of the open session; 0 when idle. */
const elapsedSeconds = computed<number>(() => {
  const open = openSession.value
  if (!open) return 0
  return Math.max(0, Math.floor((now.value - open.startMs) / 1000))
})

/** RAW sessions bucketed by their start day — for History/display (no virtualization). */
const sessionsByDay = computed<Map<string, Session[]>>(() => {
  const map = new Map<string, Session[]>()
  for (const s of sessions.value) {
    const key = dayKeyFromMs(s.startMs)
    const bucket = map.get(key)
    if (bucket) bucket.push(s)
    else map.set(key, [s])
  }
  return map
})

/**
 * Same buckets as `sessionsByDay`, except the day holding the open session
 * gets a clone of it with `endMs = now` spliced in, so that day's gross/net
 * totals (and the running balance) tick live while a timer is running.
 */
const virtualizedSessionsByDay = computed<Map<string, Session[]>>(() => {
  const open = openSession.value
  const base = sessionsByDay.value
  if (!open) return base

  const key = dayKeyFromMs(open.startMs)
  const bucket = base.get(key) ?? []
  const virtualBucket = bucket.map((s) => (s.id === open.id ? { ...s, endMs: now.value } : s))
  const map = new Map(base)
  map.set(key, virtualBucket)
  return map
})

/** `deriveRange` over [balanceStartDate .. today], fed the virtualized buckets so today ticks live. */
const range = computed(() =>
  deriveRange({
    startDate: settings.value.balanceStartDate,
    endDate: todayKey(now.value),
    sessionsByDay: virtualizedSessionsByDay.value,
    dayMetaByDay: dayMetaByDay.value,
    dailyTargetSeconds: settings.value.dailyTargetSeconds,
  }),
)

const balanceSeconds = computed<number>(() => range.value.balanceSeconds)

/**
 * `range.days` only covers [balanceStartDate .. today]. History/Calendar also
 * need days outside that window (pre-start sessions, or a manually-labeled
 * day outside the range) — derive those individually and merge them in, so
 * every day that has *any* data is represented.
 */
const derivedDays = computed<Map<string, DayDerivation>>(() => {
  const map = new Map<string, DayDerivation>()
  for (const day of range.value.days) map.set(day.date, day)

  const today = todayKey(now.value)
  const candidates = new Set<string>(sessionsByDay.value.keys())
  for (const m of dayMeta.value) candidates.add(m.date)

  for (const date of candidates) {
    if (map.has(date)) continue
    const isToday = date === today
    const bucket = isToday ? virtualizedSessionsByDay.value : sessionsByDay.value
    map.set(
      date,
      deriveDay({
        date,
        type: dayMetaByDay.value.get(date)?.type ?? 'work',
        isWeekend: isWeekend(date),
        sessions: bucket.get(date) ?? [],
        dailyTargetSeconds: settings.value.dailyTargetSeconds,
      }),
    )
  }
  return map
})

/** Today's derivation, virtualized so it ticks live. */
const todayDerivation = computed<DayDerivation>(() => {
  const today = todayKey(now.value)
  const existing = derivedDays.value.get(today)
  if (existing) return existing
  // Only reachable if balanceStartDate is after today AND today has no
  // sessions/dayMeta yet (so it wasn't added as an "extra" day above either).
  return deriveDay({
    date: today,
    type: dayMetaByDay.value.get(today)?.type ?? 'work',
    isWeekend: isWeekend(today),
    sessions: virtualizedSessionsByDay.value.get(today) ?? [],
    dailyTargetSeconds: settings.value.dailyTargetSeconds,
  })
})

/**
 * Past (strictly before today) weekdays in [balanceStartDate .. today) that
 * have zero logged work and carry no `DayMeta` row at all (HANDOFF §3.5).
 * Any dayMeta row — even `type: 'work'` — means the user already
 * acknowledged the day, so it drops off this list. Sorted ascending.
 */
const unlabeledPastWeekdays = computed<string[]>(() => {
  const today = todayKey(now.value)
  const start = settings.value.balanceStartDate
  const result: string[] = []
  for (const date of enumerateDays(start, today)) {
    if (date >= today) continue
    if (isWeekend(date)) continue
    if (dayMetaByDay.value.has(date)) continue
    const grossWork = derivedDays.value.get(date)?.grossWorkSeconds ?? 0
    if (grossWork > 0) continue
    result.push(date)
  }
  return result
})

/**
 * First-run gate (HANDOFF §7.3): true only while the store is truly empty
 * (no sessions, no day labels) AND the user hasn't already finished
 * onboarding. Once the user finishes onboarding (or restores a backup),
 * `settings.onboarded` flips true and this permanently stops matching — it
 * does NOT re-trigger just because a later action clears all data again.
 */
const needsOnboarding = computed<boolean>(
  () => !settings.value.onboarded && sessions.value.length === 0 && dayMeta.value.length === 0,
)

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null

/**
 * Idempotent app-open sequence (HANDOFF §3.3, §5): load persisted state, cap
 * (and flag for reconciliation) any session left open for >= 12h, request
 * durable storage, then flip `ready` so the UI gate in App.vue opens.
 */
function init(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const [loadedSettings, loadedDayMeta, loadedSessions] = await Promise.all([
      repo.getSettings(),
      repo.getAllDayMeta(),
      repo.getAllSessions(),
    ])
    settings.value = loadedSettings
    dayMeta.value = loadedDayMeta
    sessions.value = loadedSessions

    const open = sessions.value.find((s) => s.endMs === null)
    if (open && Date.now() - open.startMs >= TWELVE_HOURS_MS) {
      const capMs = open.startMs + TWELVE_HOURS_MS
      const capped: Session = { ...open, endMs: capMs, autoStopped: true }
      await repo.putSession(capped)
      const idx = sessions.value.findIndex((s) => s.id === capped.id)
      if (idx !== -1) sessions.value[idx] = capped
      pendingReconciliation.value = { session: capped, capMs }
    }

    if (navigator.storage?.persist) {
      try {
        const persisted = await navigator.storage.persist()
        console.log('navigator.storage.persist():', persisted)
      } catch (err) {
        console.log('navigator.storage.persist() failed:', err)
      }
    }

    ready.value = true
  })()
  return initPromise
}

/** Idle -> Working. No-op unless currently idle. */
async function startWork(): Promise<void> {
  if (timerState.value !== 'idle') return
  const session: Session = {
    id: crypto.randomUUID(),
    kind: 'work',
    startMs: Date.now(),
    endMs: null,
    autoStopped: false,
    note: '',
  }
  await repo.putSession(session)
  sessions.value.push(session)
}

/** Working -> OnBreak: ends the open work session, opens a break session. No-op unless working. */
async function startBreak(): Promise<void> {
  if (timerState.value !== 'working') return
  const open = openSession.value
  if (!open) return

  const splitMs = Date.now()
  const closed: Session = { ...open, endMs: splitMs }
  await repo.putSession(closed)
  const idx = sessions.value.findIndex((s) => s.id === closed.id)
  if (idx !== -1) sessions.value[idx] = closed

  const breakSession: Session = {
    id: crypto.randomUUID(),
    kind: 'break',
    startMs: splitMs,
    endMs: null,
    autoStopped: false,
    note: '',
  }
  await repo.putSession(breakSession)
  sessions.value.push(breakSession)
}

/** OnBreak -> Working: ends the open break session, opens a fresh work session. No-op unless onbreak. */
async function resume(): Promise<void> {
  if (timerState.value !== 'onbreak') return
  const open = openSession.value
  if (!open) return

  const splitMs = Date.now()
  const closed: Session = { ...open, endMs: splitMs }
  await repo.putSession(closed)
  const idx = sessions.value.findIndex((s) => s.id === closed.id)
  if (idx !== -1) sessions.value[idx] = closed

  const workSession: Session = {
    id: crypto.randomUUID(),
    kind: 'work',
    startMs: splitMs,
    endMs: null,
    autoStopped: false,
    note: '',
  }
  await repo.putSession(workSession)
  sessions.value.push(workSession)
}

/** Working|OnBreak -> Idle: ends whichever session is open. No-op if already idle. */
async function stop(): Promise<void> {
  const open = openSession.value
  if (!open) return
  const closed: Session = { ...open, endMs: Date.now() }
  await repo.putSession(closed)
  const idx = sessions.value.findIndex((s) => s.id === closed.id)
  if (idx !== -1) sessions.value[idx] = closed
}

/** Manual add (HANDOFF §4.2). Guards the never-two-open invariant if `endMs` is null. */
async function addSession(input: AddSessionInput): Promise<void> {
  if (input.endMs === null && openSession.value) return
  const session: Session = {
    id: crypto.randomUUID(),
    kind: input.kind,
    startMs: input.startMs,
    endMs: input.endMs,
    autoStopped: false,
    note: input.note ?? '',
  }
  await repo.putSession(session)
  sessions.value.push(session)
}

async function updateSession(id: string, patch: Partial<Omit<Session, 'id'>>): Promise<void> {
  const idx = sessions.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  const current = sessions.value[idx]

  // Guard the never-two-open invariant if this edit would reopen a closed session.
  if (patch.endMs === null && current.endMs !== null) {
    const otherOpen = sessions.value.some((s) => s.id !== id && s.endMs === null)
    if (otherOpen) return
  }

  const updated: Session = { ...current, ...patch }
  await repo.putSession(updated)
  sessions.value[idx] = updated
}

async function deleteSession(id: string): Promise<void> {
  const idx = sessions.value.findIndex((s) => s.id === id)
  if (idx === -1) return
  await repo.deleteSession(id)
  sessions.value.splice(idx, 1)
}

async function setDayType(date: string, type: DayType, note = ''): Promise<void> {
  const meta: DayMeta = { date, type, note }
  await repo.putDayMeta(meta)
  const idx = dayMeta.value.findIndex((m) => m.date === date)
  if (idx !== -1) dayMeta.value[idx] = meta
  else dayMeta.value.push(meta)
}

async function clearDayType(date: string): Promise<void> {
  await repo.deleteDayMeta(date)
  const idx = dayMeta.value.findIndex((m) => m.date === date)
  if (idx !== -1) dayMeta.value.splice(idx, 1)
}

async function updateSettings(
  patch: Partial<Pick<Settings, 'dailyTargetSeconds' | 'balanceStartDate'>>,
): Promise<void> {
  const updated: Settings = { ...settings.value, ...patch }
  await repo.putSettings(updated)
  settings.value = updated
}

/** Resolves the pending 12h-cap prompt with the user's real stop time (HANDOFF §3.3). */
async function applyReconciliation(realEndMs: number): Promise<void> {
  const pending = pendingReconciliation.value
  if (!pending) return
  const updated: Session = { ...pending.session, endMs: realEndMs, autoStopped: true }
  await repo.putSession(updated)
  const idx = sessions.value.findIndex((s) => s.id === updated.id)
  if (idx !== -1) sessions.value[idx] = updated
  pendingReconciliation.value = null
}

// ---------------------------------------------------------------------------
// Backup / legacy import (HANDOFF §6, §7) — additive, wave 4
// ---------------------------------------------------------------------------

/** Marks onboarding complete, persisting the flag. No-op (no extra write) if already set. */
async function markOnboarded(): Promise<void> {
  if (settings.value.onboarded) return
  const updated: Settings = { ...settings.value, onboarded: true }
  await repo.putSettings(updated)
  settings.value = updated
}

/** Builds the exportable JSON backup from the current in-memory state (HANDOFF §6). */
function exportBackup(): BackupFile {
  return buildBackup({ settings: settings.value, sessions: sessions.value, dayMeta: dayMeta.value })
}

/**
 * Restores an already-parsed backup (HANDOFF §6; SettingsView calls
 * `parseBackup` first and only passes on its `data` once `ok:true`).
 * `replace` wipes first and adopts the file's settings; `merge` dedupes
 * sessions by `id` and dayMeta by `date` (incoming records win on collision)
 * and keeps the CURRENT settings untouched. Either way flips `onboarded`
 * (restoring a backup is never an "empty" first run).
 */
async function importBackup(data: BackupData, mode: 'replace' | 'merge'): Promise<void> {
  if (mode === 'replace') {
    await repo.wipeAll()
    const restoredSettings: Settings = {
      dailyTargetSeconds: data.settings.dailyTargetSeconds,
      balanceStartDate: data.settings.balanceStartDate,
      schemaVersion: SCHEMA_VERSION,
      createdAt: Date.now(),
      onboarded: true,
    }
    await repo.putSettings(restoredSettings)
    await repo.bulkImport({ sessions: data.sessions, dayMeta: data.dayMeta })
    settings.value = restoredSettings
    sessions.value = [...data.sessions]
    dayMeta.value = [...data.dayMeta]
    return
  }

  const sessionMap = new Map<string, Session>(sessions.value.map((s) => [s.id, s]))
  for (const s of data.sessions) sessionMap.set(s.id, s)
  const dayMetaMap = new Map<string, DayMeta>(dayMeta.value.map((m) => [m.date, m]))
  for (const m of data.dayMeta) dayMetaMap.set(m.date, m)

  await repo.bulkImport({ sessions: data.sessions, dayMeta: data.dayMeta })
  await markOnboarded()

  sessions.value = [...sessionMap.values()]
  dayMeta.value = [...dayMetaMap.values()]
}

/** "Start empty" onboarding choice (HANDOFF §7.3): just marks onboarding complete. */
async function completeOnboarding(): Promise<void> {
  await markOnboarded()
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const store = {
  // state
  ready,
  sessions,
  dayMeta,
  settings,
  pendingReconciliation,
  // computed
  dayMetaByDay,
  openSession,
  timerState,
  elapsedSeconds,
  sessionsByDay,
  balanceSeconds,
  derivedDays,
  todayDerivation,
  unlabeledPastWeekdays,
  needsOnboarding,
  // actions
  init,
  startWork,
  startBreak,
  resume,
  stop,
  addSession,
  updateSession,
  deleteSession,
  setDayType,
  clearDayType,
  updateSettings,
  applyReconciliation,
  exportBackup,
  importBackup,
  completeOnboarding,
}

export type Store = typeof store

/** The reactive singleton store. Always returns the same instance. */
export function useStore(): Store {
  return store
}
