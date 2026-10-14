<script setup lang="ts">
// Settings screen (HANDOFF §4.5): Tagessoll-Zeitleiste, balance start date, and JSON
// backup export/import. No native alert/confirm/dialog — destructive actions
// use an inline two-step confirm (same convention as SessionEditor.vue's
// delete flow).
import { computed, ref, watch } from 'vue'
import { useStore } from '@/store/useStore'
import { useClock } from '@/store/useClock'
import { parseBackup } from '@/db/backup'
import type { BackupData } from '@/db/backup'
import { formatDuration, formatSignedDuration, todayKey, yearKey } from '@/domain/time'
import { betrifftVergangenheit, setTagessollEintrag } from '@/domain/tagessoll'
import type { TagessollSettings } from '@/domain/tagessoll'
import {
  normalizeUrlaubsanspruch,
  resolveUrlaubsanspruchSettings,
  setUrlaubsanspruchOverride,
} from '@/domain/vacation'

const {
  settings,
  saldoAenderung,
  updateSettings,
  exportBackup,
  importBackup,
} = useStore()

// ---------------------------------------------------------------------------
// Tagessoll (Mo–Fr) — the Tagessoll-Zeitleiste (ADR 0004)
//
// Every edit goes through `proposeTagessoll`: a change that reaches a day up
// to today is held back and shown with its Saldo change first; a change that
// only touches the future saves straight away.
// ---------------------------------------------------------------------------

/** Clamps free-typed hours/minutes to a whole-minute duration in seconds. */
function toSeconds(hours: number, minutes: number): number {
  const h = Math.max(0, Math.min(23, Math.floor(hours) || 0))
  const m = Math.max(0, Math.min(59, Math.floor(minutes) || 0))
  return h * 3600 + m * 60
}

const tagessoll = computed<Required<TagessollSettings>>(() => ({
  dailyTargetSeconds: settings.value.dailyTargetSeconds,
  tagessollAb: settings.value.tagessollAb ?? {},
}))

const targetHours = ref(0)
const targetMinutes = ref(0)

/** Re-seeds the "seit Beginn" inputs from the store, also after a cancelled change. */
function resetTargetInputs(): void {
  const sec = settings.value.dailyTargetSeconds
  targetHours.value = Math.floor(sec / 3600)
  targetMinutes.value = Math.floor((sec % 3600) / 60)
}

// Kept in sync with the store (not just seeded once): a backup "Ersetzen" or
// the legacy importer can change `settings` out from under this screen.
watch(() => settings.value.dailyTargetSeconds, resetTargetInputs, { immediate: true })

/** The dated entries in start order, so the rows read as a timeline. */
const tagessollRows = computed(() =>
  Object.entries(tagessoll.value.tagessollAb)
    .map(([ab, seconds]) => ({ ab, seconds }))
    .sort((a, b) => a.ab.localeCompare(b.ab)),
)

const { now } = useClock()

/** The start date of the entry in force today; `null` while "seit Beginn" still is. */
const aktuellerEintrag = computed<string | null>(() => {
  const today = todayKey(now.value)
  return tagessollRows.value.filter((row) => row.ab <= today).at(-1)?.ab ?? null
})

/**
 * A change held back for confirmation, with how far it moves the Gesamtsaldo.
 * It is a whole new timeline, so it is only valid against the one it was
 * computed from: any other change to the timeline (a later edit, a backup
 * "Ersetzen") drops it rather than letting "Speichern" write a stale copy back.
 */
const pendingTagessoll = ref<{ neu: Required<TagessollSettings>; saldoAenderung: number } | null>(null)
watch(tagessoll, () => {
  pendingTagessoll.value = null
  resetTargetInputs()
})

function proposeTagessoll(neu: Required<TagessollSettings>): void {
  pendingTagessoll.value = null
  if (betrifftVergangenheit(tagessoll.value, neu, todayKey())) {
    pendingTagessoll.value = { neu, saldoAenderung: saldoAenderung(neu) }
  } else {
    void updateSettings(neu)
  }
}

function onConfirmTagessoll(): void {
  const pending = pendingTagessoll.value
  if (!pending) return
  pendingTagessoll.value = null
  void updateSettings(pending.neu)
}

function onCancelTagessoll(): void {
  pendingTagessoll.value = null
  resetTargetInputs()
}

function onTargetChange(): void {
  proposeTagessoll({ ...tagessoll.value, dailyTargetSeconds: toSeconds(targetHours.value, targetMinutes.value) })
}

function writeEintrag(ab: string, seconds: number | null): void {
  proposeTagessoll({
    ...tagessoll.value,
    tagessollAb: setTagessollEintrag(tagessoll.value.tagessollAb, ab, seconds),
  })
}

function onRemoveEintrag(ab: string): void {
  writeEintrag(ab, null)
}

const newEintragAb = ref(todayKey())
const newEintragHours = ref(8)
const newEintragMinutes = ref(0)

/** Saving on a date that already has an entry replaces it (start dates are unique). */
const newEintragErsetzt = computed<boolean>(() => newEintragAb.value in tagessoll.value.tagessollAb)

function onAddEintrag(): void {
  if (!newEintragAb.value) return
  writeEintrag(newEintragAb.value, toSeconds(newEintragHours.value, newEintragMinutes.value))
}

// ---------------------------------------------------------------------------
// Startdatum des Saldos
// ---------------------------------------------------------------------------

const startDateInput = ref('')
watch(
  () => settings.value.balanceStartDate,
  (date) => {
    startDateInput.value = date
  },
  { immediate: true },
)

function onStartDateChange(): void {
  if (!startDateInput.value) return
  void updateSettings({ balanceStartDate: startDateInput.value })
}

// ---------------------------------------------------------------------------
// Urlaubsanspruch (Standard + abweichende Urlaubsjahre)
//
// Purely an editor: every rule — the on-read defaults, what counts as a valid
// figure, "an absent year inherits the standard", and "removing an override
// returns the year to the standard rather than to zero" — lives in
// `@/domain/vacation`.
// ---------------------------------------------------------------------------

const urlaubsanspruch = computed(() => resolveUrlaubsanspruchSettings(settings.value))

const standardTage = ref(0)
watch(
  () => urlaubsanspruch.value.urlaubsanspruchStandard,
  (tage) => {
    standardTage.value = tage
  },
  { immediate: true },
)

function onStandardChange(): void {
  const tage = normalizeUrlaubsanspruch(standardTage.value)
  standardTage.value = tage
  void updateSettings({ urlaubsanspruchStandard: tage })
}

/** The override map as a year-ascending list, so the rows never jump around. */
const overrideRows = computed(() =>
  Object.entries(urlaubsanspruch.value.urlaubsanspruchByYear)
    .map(([urlaubsjahr, tage]) => ({ urlaubsjahr, tage }))
    .sort((a, b) => a.urlaubsjahr.localeCompare(b.urlaubsjahr)),
)

function writeOverride(urlaubsjahr: string, tage: number | null): void {
  void updateSettings({
    urlaubsanspruchByYear: setUrlaubsanspruchOverride(
      urlaubsanspruch.value.urlaubsanspruchByYear,
      urlaubsjahr,
      tage,
    ),
  })
}

function onOverrideChange(urlaubsjahr: string, event: Event): void {
  const raw = Number((event.target as HTMLInputElement).value)
  writeOverride(urlaubsjahr, normalizeUrlaubsanspruch(raw))
}

function onRemoveOverride(urlaubsjahr: string): void {
  writeOverride(urlaubsjahr, null)
}

const newOverrideYear = ref(yearKey(todayKey()))
const newOverrideTage = ref(0)

/** A four-digit year that is not already in the map — the only gate on adding a row. */
const canAddOverride = computed<boolean>(
  () =>
    /^\d{4}$/.test(newOverrideYear.value) &&
    !(newOverrideYear.value in urlaubsanspruch.value.urlaubsanspruchByYear),
)

function onAddOverride(): void {
  if (!canAddOverride.value) return
  writeOverride(newOverrideYear.value, normalizeUrlaubsanspruch(newOverrideTage.value))
  newOverrideTage.value = 0
}

// ---------------------------------------------------------------------------
// Backup exportieren
// ---------------------------------------------------------------------------

function onExportClick(): void {
  const backup = exportBackup()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `arbeitszeit-backup-${todayKey()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Backup importieren
// ---------------------------------------------------------------------------

const importError = ref<string | null>(null)
const pendingImport = ref<BackupData | null>(null)
const confirmingReplace = ref(false)
const importDoneMessage = ref<string | null>(null)
const importBusy = ref(false)

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-selecting the same file again later

  importError.value = null
  pendingImport.value = null
  confirmingReplace.value = false
  importDoneMessage.value = null
  if (!file) return

  const text = await file.text()
  const result = parseBackup(text)
  if (!result.ok) {
    importError.value = result.error
    return
  }
  pendingImport.value = result.data
}

function onChooseReplace(): void {
  confirmingReplace.value = true
}

function onCancelReplace(): void {
  confirmingReplace.value = false
}

function onCancelPendingImport(): void {
  pendingImport.value = null
  confirmingReplace.value = false
}

/** Human-readable "N Sitzung(en) und M Tageskennzeichnung(en)" for the confirmation. */
function importCounts(data: BackupData): string {
  return `${data.sessions.length} Sitzung(en) und ${data.dayMeta.length} Tageskennzeichnung(en)`
}

async function onConfirmReplace(): Promise<void> {
  const data = pendingImport.value
  if (!data || importBusy.value) return
  importBusy.value = true
  importError.value = null
  try {
    await importBackup(data, 'replace')
    importDoneMessage.value = `Backup eingespielt: ${importCounts(data)} ersetzt.`
    pendingImport.value = null
    confirmingReplace.value = false
  } catch (err) {
    importError.value = `Import fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    importBusy.value = false
  }
}

async function onMerge(): Promise<void> {
  const data = pendingImport.value
  if (!data || importBusy.value) return
  importBusy.value = true
  importError.value = null
  try {
    await importBackup(data, 'merge')
    importDoneMessage.value = `Backup zusammengeführt: ${importCounts(data)}.`
    pendingImport.value = null
  } catch (err) {
    importError.value = `Import fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    importBusy.value = false
  }
}
</script>

<template>
  <section class="screen">
    <div class="card">
      <h2>Tagessoll (Mo–Fr)</h2>
      <p class="muted">
        Jeder Eintrag gilt ab seinem Datum, bis der nächste beginnt. Wochenenden haben kein Soll.
      </p>

      <h3 class="sub-heading">
        Seit Beginn
        <span v-if="aktuellerEintrag === null" class="badge current-badge">aktuell</span>
      </h3>
      <div class="field-row">
        <div class="field">
          <label for="target-hours">Stunden</label>
          <input
            id="target-hours"
            v-model.number="targetHours"
            type="number"
            min="0"
            max="23"
            @change="onTargetChange"
          />
        </div>
        <div class="field">
          <label for="target-minutes">Minuten</label>
          <input
            id="target-minutes"
            v-model.number="targetMinutes"
            type="number"
            min="0"
            max="59"
            @change="onTargetChange"
          />
        </div>
      </div>

      <h3 class="sub-heading">Ab Datum</h3>
      <p v-if="tagessollRows.length === 0" class="muted">
        Keine weiteren Einträge — jeder Tag nutzt das Soll seit Beginn.
      </p>
      <div v-for="row in tagessollRows" :key="row.ab" class="list-row">
        <span class="list-key mono">ab {{ row.ab }}</span>
        <strong class="mono">{{ formatDuration(row.seconds) }}</strong>
        <span v-if="row.ab === aktuellerEintrag" class="badge current-badge">aktuell</span>
        <button
          class="btn btn-ghost"
          type="button"
          :aria-label="`Tagessoll ab ${row.ab} entfernen`"
          @click="onRemoveEintrag(row.ab)"
        >
          Entfernen
        </button>
      </div>

      <div class="list-row">
        <input v-model="newEintragAb" class="list-key-input" type="date" aria-label="Gilt ab" />
        <input v-model.number="newEintragHours" type="number" min="0" max="23" aria-label="Stunden" />
        <input v-model.number="newEintragMinutes" type="number" min="0" max="59" aria-label="Minuten" />
        <button class="btn" type="button" :disabled="!newEintragAb" @click="onAddEintrag">
          {{ newEintragErsetzt ? 'Ersetzen' : 'Hinzufügen' }}
        </button>
      </div>

      <div v-if="pendingTagessoll" class="inline-confirm">
        <p class="warning">
          <template v-if="pendingTagessoll.saldoAenderung === 0">
            Diese Änderung betrifft vergangene Tage, ändert deinen Saldo aber nicht. Speichern?
          </template>
          <template v-else>
            Diese Änderung betrifft vergangene Tage und ändert deinen Saldo um
            <strong class="mono">{{ formatSignedDuration(pendingTagessoll.saldoAenderung) }}</strong>.
            Speichern?
          </template>
        </p>
        <div class="action-row">
          <button class="btn btn-ghost" type="button" @click="onCancelTagessoll">Abbrechen</button>
          <button class="btn btn-primary" type="button" @click="onConfirmTagessoll">Speichern</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Startdatum des Saldos</h2>
      <p class="muted">Ab diesem Tag fließen Sitzungen in den Saldo ein.</p>
      <div class="field">
        <label for="balance-start">Startdatum</label>
        <input id="balance-start" v-model="startDateInput" type="date" @change="onStartDateChange" />
      </div>
    </div>

    <div class="card">
      <h2>Urlaubsanspruch</h2>
      <p class="muted">
        Urlaubstage pro Urlaubsjahr. Einzelne Jahre können abweichen — Resturlaub aus dem Vorjahr
        rechnest du selbst in die Zahl des Jahres ein.
      </p>
      <div class="field">
        <label for="urlaub-standard">Standard (Tage pro Jahr)</label>
        <input
          id="urlaub-standard"
          v-model.number="standardTage"
          type="number"
          min="0"
          max="366"
          @change="onStandardChange"
        />
      </div>

      <h3 class="sub-heading">Abweichende Urlaubsjahre</h3>
      <p v-if="overrideRows.length === 0" class="muted">
        Keine Abweichungen — jedes Jahr nutzt den Standard.
      </p>
      <div v-for="row in overrideRows" :key="row.urlaubsjahr" class="list-row">
        <span class="list-key mono">{{ row.urlaubsjahr }}</span>
        <input
          :value="row.tage"
          type="number"
          min="0"
          max="366"
          :aria-label="`Urlaubsanspruch ${row.urlaubsjahr} in Tagen`"
          @change="onOverrideChange(row.urlaubsjahr, $event)"
        />
        <button
          class="btn btn-ghost"
          type="button"
          :aria-label="`Abweichung für ${row.urlaubsjahr} entfernen`"
          @click="onRemoveOverride(row.urlaubsjahr)"
        >
          Entfernen
        </button>
      </div>

      <div class="list-row">
        <input
          v-model="newOverrideYear"
          class="list-key-input"
          type="number"
          min="1970"
          max="9999"
          aria-label="Urlaubsjahr"
        />
        <input
          v-model.number="newOverrideTage"
          type="number"
          min="0"
          max="366"
          aria-label="Urlaubsanspruch in Tagen"
        />
        <button class="btn" type="button" :disabled="!canAddOverride" @click="onAddOverride">
          Hinzufügen
        </button>
      </div>
    </div>

    <div class="card backup-card">
      <h2>Backup</h2>
      <p class="muted">Alle Daten als JSON-Datei sichern oder aus einer Datei wiederherstellen.</p>

      <button class="btn btn-block" type="button" @click="onExportClick">Backup exportieren</button>

      <label class="btn btn-block file-btn" for="backup-file-input">Backup importieren</label>
      <input
        id="backup-file-input"
        class="hidden-file-input"
        type="file"
        accept="application/json"
        @change="onFileSelected"
      />

      <p v-if="importError" class="error">{{ importError }}</p>

      <div v-if="pendingImport" class="inline-confirm">
        <p class="muted">
          Datei enthält {{ pendingImport.sessions.length }} Sitzung(en) und
          {{ pendingImport.dayMeta.length }} Tageskennzeichnung(en). Wie importieren?
        </p>

        <template v-if="!confirmingReplace">
          <div class="action-row">
            <button class="btn btn-primary" type="button" :disabled="importBusy" @click="onChooseReplace">
              Ersetzen
            </button>
            <button class="btn" type="button" :disabled="importBusy" @click="onMerge">
              {{ importBusy ? 'Importiere…' : 'Zusammenführen' }}
            </button>
          </div>
          <button
            class="btn btn-ghost btn-block"
            type="button"
            :disabled="importBusy"
            @click="onCancelPendingImport"
          >
            Abbrechen
          </button>
        </template>
        <template v-else>
          <p class="warning">
            Das ersetzt <strong>alle</strong> vorhandenen Daten unwiderruflich durch den Inhalt dieser
            Datei. Fortfahren?
          </p>
          <div class="action-row">
            <button class="btn btn-ghost" type="button" :disabled="importBusy" @click="onCancelReplace">
              Abbrechen
            </button>
            <button class="btn btn-danger" type="button" :disabled="importBusy" @click="onConfirmReplace">
              {{ importBusy ? 'Importiere…' : 'Ja, ersetzen' }}
            </button>
          </div>
        </template>
      </div>

      <p v-if="importDoneMessage" class="badge success-badge">{{ importDoneMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field-row {
  display: flex;
  gap: 10px;
}
.field-row .field {
  flex: 1;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sub-heading {
  font-size: 13px;
  color: var(--text-muted);
  margin: 4px 0 0;
}
.list-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.list-row input {
  flex: 1;
  min-width: 0;
}
.list-row .btn {
  flex: none;
}
.list-key {
  flex: 1;
  font-weight: 700;
}
.list-key-input {
  flex: 1;
}
.current-badge {
  background: var(--over-weak);
  color: var(--over);
}

.backup-card .btn + .btn {
  margin-top: 0;
}

.hidden-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.file-btn {
  text-align: center;
  display: block;
}

.error {
  color: var(--under);
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
.warning {
  color: var(--under);
  font-size: 13.5px;
  margin: 0;
  line-height: 1.4;
}

.inline-confirm {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.action-row {
  display: flex;
  gap: 8px;
}
.action-row .btn {
  flex: 1;
}

.success-badge {
  background: var(--over-weak);
  color: var(--over);
  white-space: normal;
  line-height: 1.35;
  width: fit-content;
}
</style>
