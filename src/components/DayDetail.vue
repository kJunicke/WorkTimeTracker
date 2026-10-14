<script setup lang="ts">
// Self-contained per-day view (HANDOFF §4.2 History, §4.4 Calendar reuse).
//
// Renders ONE calendar day given just a `date` key: the day header (German
// heading, editable label chip + reset, net work + delta, auto-deduct
// badge), that day's session rows, and an "add session" affordance. Reads
// and writes the store itself by `date` — a caller only ever needs
// `<DayDetail :date="someDateKey" />`, nothing else, so History can list
// many of these and (wave 5) Calendar can mount exactly one for a tapped day.
import { computed, ref } from 'vue'
import { useStore } from '@/store/useStore'
import { useClock } from '@/store/useClock'
import { deriveDay, isLabeledType } from '@/domain/calc'
import { formatDayHeading, formatDuration, formatSignedDuration, isWeekend, yearKey } from '@/domain/time'
import { planTageskennzeichnung } from '@/domain/vacation'
import { FEIERTAGE_LAND, feiertagAm } from '@/domain/holidays'
import { tagessollAm } from '@/domain/tagessoll'
import type { DayDerivation, DayType, Session, SessionKind } from '@/domain/types'
import SessionRow from '@/components/SessionRow.vue'
import SessionEditor from '@/components/SessionEditor.vue'
import StatTile from '@/components/StatTile.vue'
import GleitzeittagAngebot from '@/components/GleitzeittagAngebot.vue'

const props = defineProps<{
  /** Local "YYYY-MM-DD" calendar day to render. */
  date: string
}>()

const store = useStore()
const { now } = useClock()

const TYPE_COLOR_VAR: Record<DayType, string> = {
  work: 'var(--work)',
  vacation: 'var(--vacation)',
  sick: 'var(--sick)',
  holiday: 'var(--holiday)',
  gleitzeittag: 'var(--gleitzeittag)',
}

/**
 * `store.derivedDays` only covers [balanceStartDate..today] plus any date
 * that already holds a session or a label (see useStore.ts). Fall back to
 * deriving on the fly for any other date so this component stays correct
 * for whatever a caller passes in (e.g. Calendar tapping a day with no data).
 */
const derivation = computed<DayDerivation>(() => {
  const existing = store.derivedDays.value.get(props.date)
  if (existing) return existing
  return deriveDay({
    date: props.date,
    type: store.dayMetaByDay.value.get(props.date)?.type ?? 'work',
    isWeekend: isWeekend(props.date),
    sessions: store.sessionsByDay.value.get(props.date) ?? [],
    dailyTargetSeconds: tagessollAm(props.date, store.settings.value),
  })
})

/** This day's sessions, earliest first. */
const daySessions = computed<Session[]>(() =>
  [...(store.sessionsByDay.value.get(props.date) ?? [])].sort((a, b) => a.startMs - b.startMs),
)

// Only a *stored* label can be reset — resetting an auto-applied Feiertag
// would write nothing and change nothing, so the button stays hidden for one.
const hasExplicitDayMeta = computed<boolean>(() => store.explicitDayMetaByDay.value.has(props.date))

/**
 * The Feiertag this day is, when it carries no stored label of its own — so the
 * day says *which* Feiertag it is, and that the label came from the app rather
 * than from the user (who can still override it with the select above).
 */
const autoFeiertag = computed<string | null>(() => {
  if (hasExplicitDayMeta.value) return null
  return feiertagAm(props.date)?.name ?? null
})
const deltaTone = computed<'over' | 'under'>(() => (derivation.value.deltaSeconds >= 0 ? 'over' : 'under'))
const chipColor = computed<string>(() => TYPE_COLOR_VAR[derivation.value.type])

/** HANDOFF §3.5 "label wins" — surfaced so logged work that's excluded from the balance isn't a silent surprise. */
const labelIgnoresWork = computed<boolean>(
  () => isLabeledType(derivation.value.type) && derivation.value.grossWorkSeconds > 0,
)

/** A Gleitzeittag looks like an untracked day in the numbers, so say why it costs a full target (ADR 0001). */
const isGleitzeittag = computed<boolean>(() => derivation.value.type === 'gleitzeittag')

/** Non-null while the "kein Urlaub mehr übrig" offer is on screen. */
const gleitzeittagAngebotOffen = ref(false)

/**
 * The Urlaubsanspruch is a hard cap enforced at the point of labeling (ADR
 * 0001), so a single tap answers to the same rule a span does — otherwise
 * übrig could be driven negative one day at a time. The rule itself lives in
 * `@/domain/vacation`; all this does is act on its answer.
 */
function onTypeChange(event: Event): void {
  const select = event.target as HTMLSelectElement
  const value = select.value as DayType
  const plan = planTageskennzeichnung({
    date: props.date,
    type: value,
    existing: store.dayMetaByDay.value.get(props.date)?.type,
    uebrig: store.urlaubskontoFor.value(yearKey(props.date)).uebrig,
  })
  if (plan === 'gleitzeittagAnbieten') {
    // Nothing was written, so put the select back to the label the day still
    // carries rather than leaving it showing a choice that never happened.
    select.value = derivation.value.type
    gleitzeittagAngebotOffen.value = true
    return
  }
  void store.setDayType(props.date, value)
}

/** The offer accepted: the day the Urlaubskonto could not pay for becomes a Gleitzeittag. */
function onAcceptGleitzeittag(): void {
  gleitzeittagAngebotOffen.value = false
  void store.setDayType(props.date, 'gleitzeittag')
}

function onClearType(): void {
  void store.clearDayType(props.date)
}

// ---------------------------------------------------------------------
// Add / edit modal
// ---------------------------------------------------------------------

const addingOpen = ref(false)
const editingSession = ref<Session | null>(null)

type SessionSave = { kind: SessionKind; startMs: number; endMs: number; note: string }

function onEditRequest(id: string): void {
  editingSession.value = daySessions.value.find((s) => s.id === id) ?? null
}

function onAddSave(input: SessionSave): void {
  void store.addSession(input)
  addingOpen.value = false
}

function onEditSave(input: SessionSave): void {
  const current = editingSession.value
  if (!current) return
  void store.updateSession(current.id, input)
  editingSession.value = null
}

function onEditDelete(): void {
  const current = editingSession.value
  if (!current) return
  void store.deleteSession(current.id)
  editingSession.value = null
}
</script>

<template>
  <section class="card day-card">
    <header class="day-head">
      <h3 class="day-heading">{{ formatDayHeading(date) }}</h3>
      <div class="day-label">
        <select
          class="type-select"
          :style="{ '--chip-color': chipColor }"
          :value="derivation.type"
          aria-label="Kennzeichnung für diesen Tag"
          @change="onTypeChange"
        >
          <option value="work">Arbeit</option>
          <option value="vacation">Urlaub</option>
          <option value="sick">Krank</option>
          <option value="holiday">Feiertag</option>
          <option value="gleitzeittag">Gleitzeittag</option>
        </select>
        <button
          v-if="hasExplicitDayMeta"
          class="reset-btn"
          type="button"
          title="Kennzeichnung zurücksetzen"
          @click="onClearType"
        >
          Zurücksetzen
        </button>
      </div>
    </header>

    <p v-if="autoFeiertag" class="faint hint-note">
      {{ autoFeiertag }} – gesetzlicher Feiertag in {{ FEIERTAGE_LAND }}, automatisch gekennzeichnet.
      Oben änderbar, falls doch gearbeitet wurde.
    </p>
    <p v-if="derivation.isWeekend" class="faint hint-note">Wochenende – kein Soll, zählt nicht für den Saldo.</p>
    <p v-if="labelIgnoresWork" class="faint hint-note">
      Kennzeichnung zählt – erfasste Arbeitszeit wird nicht angerechnet.
    </p>
    <p v-if="isGleitzeittag && !derivation.isWeekend" class="faint hint-note">
      Gleitzeittag – volles Soll, geht von der Gleitzeit ab. Erfasste Arbeitszeit zählt normal.
    </p>

    <div class="day-stats">
      <StatTile label="Netto" :value="formatDuration(derivation.netWorkSeconds)" />
      <StatTile label="Soll" :value="formatDuration(derivation.expectedSeconds)" />
      <StatTile
        label="Differenz"
        :value="formatSignedDuration(derivation.deltaSeconds)"
        :tone="deltaTone"
      />
    </div>
    <p v-if="derivation.autoDeductedSeconds > 0" class="badge auto-badge">
      {{ formatDuration(derivation.autoDeductedSeconds) }} automatisch abgezogen (gesetzliche Pause)
    </p>

    <div class="sessions">
      <p v-if="daySessions.length === 0" class="muted empty-day">Keine Sitzungen an diesem Tag.</p>
      <SessionRow v-for="s in daySessions" :key="s.id" :session="s" :now="now" @edit="onEditRequest" />
    </div>

    <button class="btn btn-block add-btn" type="button" @click="addingOpen = true">
      + Sitzung hinzufügen
    </button>
  </section>

  <GleitzeittagAngebot
    v-if="gleitzeittagAngebotOffen"
    :date="date"
    @confirm="onAcceptGleitzeittag"
    @cancel="gleitzeittagAngebotOffen = false"
  />

  <SessionEditor
    v-if="addingOpen"
    mode="add"
    :date="date"
    :session="null"
    @save="onAddSave"
    @cancel="addingOpen = false"
  />
  <SessionEditor
    v-else-if="editingSession"
    mode="edit"
    :date="date"
    :session="editingSession"
    @save="onEditSave"
    @delete="onEditDelete"
    @cancel="editingSession = null"
  />
</template>

<style scoped>
.day-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.day-heading {
  font-size: 16px;
}

.day-label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.type-select {
  width: auto;
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in srgb, var(--chip-color) 50%, var(--border-strong));
  background: color-mix(in srgb, var(--chip-color) 14%, white);
  color: color-mix(in srgb, var(--chip-color) 70%, black);
  font-weight: 700;
  font-size: 13.5px;
  padding: 6px 10px;
}
.reset-btn {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  padding: 4px 2px;
}

.hint-note {
  margin: -4px 0 0;
  font-size: 12.5px;
}

.day-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.auto-badge {
  background: var(--accent-weak);
  color: var(--accent-strong);
  white-space: normal;
  line-height: 1.35;
  width: fit-content;
}

.sessions {
  display: flex;
  flex-direction: column;
}
.empty-day {
  padding: 10px 4px;
}

.add-btn {
  border-style: dashed;
}
</style>
