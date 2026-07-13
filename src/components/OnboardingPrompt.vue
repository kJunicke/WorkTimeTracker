<script setup lang="ts">
// First-run onboarding (HANDOFF §7.3). Shown on Today when the store's
// `needsOnboarding` is true. Lets the owner set the daily target and balance
// start date before the first session; both remain editable later in Settings.
// Existing data (e.g. a restored backup) is brought in via Settings →
// "Backup importieren", not here.
import { ref } from 'vue'
import { useStore } from '@/store/useStore'

const { settings, updateSettings, completeOnboarding } = useStore()

const emit = defineEmits<{ close: [] }>()

const busy = ref(false)

// Seeded once from the current (default-or-persisted) settings — the same
// "seed once at creation" pattern as SessionEditor.vue's `initialSession`.
const hours = ref(Math.floor(settings.value.dailyTargetSeconds / 3600))
const minutes = ref(Math.floor((settings.value.dailyTargetSeconds % 3600) / 60))
const startDate = ref(settings.value.balanceStartDate)

/** Clamps the two number inputs to sane ranges and combines them to seconds. */
function targetSeconds(): number {
  const h = Math.max(0, Math.min(23, Math.floor(hours.value) || 0))
  const m = Math.max(0, Math.min(59, Math.floor(minutes.value) || 0))
  return h * 3600 + m * 60
}

async function onStart(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await updateSettings({ dailyTargetSeconds: targetSeconds(), balanceStartDate: startDate.value })
    await completeOnboarding()
    emit('close')
  } finally {
    busy.value = false
  }
}

function onDismiss(): void {
  emit('close')
}
</script>

<template>
  <div class="card onboarding-card">
    <header class="onboarding-head">
      <h3>Willkommen bei Arbeitszeit Tracker</h3>
      <button class="close-btn" type="button" aria-label="Später" @click="onDismiss">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </header>
    <p class="muted">
      Bevor es losgeht: Tagesziel und Startdatum des Saldos festlegen. Beides lässt sich später
      jederzeit in den Einstellungen ändern. Vorhandene Daten kannst du unter „Einstellungen →
      Backup importieren“ einspielen.
    </p>

    <div class="field-row">
      <div class="field">
        <label for="ob-hours">Tagesziel – Std.</label>
        <input id="ob-hours" v-model.number="hours" type="number" min="0" max="23" />
      </div>
      <div class="field">
        <label for="ob-minutes">Min.</label>
        <input id="ob-minutes" v-model.number="minutes" type="number" min="0" max="59" />
      </div>
    </div>
    <div class="field">
      <label for="ob-start">Startdatum des Saldos</label>
      <input id="ob-start" v-model="startDate" type="date" />
    </div>

    <div class="actions">
      <button class="btn btn-primary btn-block" type="button" :disabled="busy" @click="onStart">
        Los geht's
      </button>
    </div>
  </div>
</template>

<style scoped>
.onboarding-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-color: var(--accent-weak-2);
}
.onboarding-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.close-btn {
  appearance: none;
  border: none;
  background: var(--surface-2);
  color: var(--text-muted);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-pill);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
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
.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
