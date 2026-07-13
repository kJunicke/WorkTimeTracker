<script setup lang="ts">
// Settings screen (HANDOFF §4.5): daily target, balance start date, and JSON
// backup export/import. No native alert/confirm/dialog — destructive actions
// use an inline two-step confirm (same convention as SessionEditor.vue's
// delete flow).
import { ref, watch } from 'vue'
import { useStore } from '@/store/useStore'
import { parseBackup } from '@/db/backup'
import type { BackupData } from '@/db/backup'
import { formatDuration, todayKey } from '@/domain/time'

const {
  settings,
  updateSettings,
  exportBackup,
  importBackup,
} = useStore()

// ---------------------------------------------------------------------------
// Tagesziel (Mo–Fr)
// ---------------------------------------------------------------------------

const targetHours = ref(0)
const targetMinutes = ref(0)

// Kept in sync with the store (not just seeded once): a backup "Ersetzen" or
// the legacy importer can change `settings` out from under this screen.
watch(
  () => settings.value.dailyTargetSeconds,
  (sec) => {
    targetHours.value = Math.floor(sec / 3600)
    targetMinutes.value = Math.floor((sec % 3600) / 60)
  },
  { immediate: true },
)

function onTargetChange(): void {
  const h = Math.max(0, Math.min(23, Math.floor(targetHours.value) || 0))
  const m = Math.max(0, Math.min(59, Math.floor(targetMinutes.value) || 0))
  targetHours.value = h
  targetMinutes.value = m
  void updateSettings({ dailyTargetSeconds: h * 3600 + m * 60 })
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
      <h2>Tagesziel (Mo–Fr)</h2>
      <p class="muted">
        Aktuell: <strong class="mono">{{ formatDuration(settings.dailyTargetSeconds) }}</strong> pro
        Arbeitstag. Wochenenden haben kein Soll.
      </p>
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
    </div>

    <div class="card">
      <h2>Startdatum des Saldos</h2>
      <p class="muted">Ab diesem Tag fließen Sitzungen in den Saldo ein.</p>
      <div class="field">
        <label for="balance-start">Startdatum</label>
        <input id="balance-start" v-model="startDateInput" type="date" @change="onStartDateChange" />
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
