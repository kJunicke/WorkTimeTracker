<script setup lang="ts">
// 12h auto-stop reconciliation prompt (HANDOFF §3.3). Shown on Today when the
// store caps a session that ran past 12h while the app was closed; the user
// enters the real stop time, defaulting to the cap time.
import { computed, ref } from 'vue'
import type { Session } from '@/domain/types'
import { formatDuration } from '@/domain/time'

const props = defineProps<{
  session: Session
  capMs: number
}>()

const emit = defineEmits<{
  apply: [realEndMs: number]
}>()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** "YYYY-MM-DDTHH:mm" in local time, matching a native datetime-local input's value format. */
function msToLocalInputValue(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const inputValue = ref(msToLocalInputValue(props.capMs))

const parsedMs = computed<number | null>(() => {
  if (!inputValue.value) return null
  // A "YYYY-MM-DDTHH:mm" string (no offset) parses as local time per spec.
  const ms = new Date(inputValue.value).getTime()
  return Number.isNaN(ms) ? null : ms
})

const errorMessage = computed<string | null>(() => {
  const ms = parsedMs.value
  if (ms === null) return 'Bitte eine gültige Zeit eingeben.'
  if (ms <= props.session.startMs) return 'Die Zeit muss nach dem Start liegen.'
  if (ms > Date.now()) return 'Die Zeit darf nicht in der Zukunft liegen.'
  return null
})

function apply(): void {
  if (errorMessage.value || parsedMs.value === null) return
  emit('apply', parsedMs.value)
}
</script>

<template>
  <div class="card reconcile-card">
    <h3>Sitzung automatisch gestoppt</h3>
    <p class="muted">
      Deine Sitzung lief länger als 12 Stunden und wurde automatisch gestoppt. Wann hast du
      tatsächlich aufgehört?
    </p>
    <p class="faint context">
      Start: {{ new Date(session.startMs).toLocaleString('de-DE') }} · automatisch gestoppt nach
      {{ formatDuration(Math.round((capMs - session.startMs) / 1000)) }}
    </p>
    <label for="reconcile-end">Tatsächliches Ende</label>
    <input id="reconcile-end" v-model="inputValue" type="datetime-local" />
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <button class="btn btn-primary btn-block" :disabled="!!errorMessage" @click="apply">
      Übernehmen
    </button>
  </div>
</template>

<style scoped>
.reconcile-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-color: var(--under-weak);
}
.context {
  font-size: 12.5px;
}
.error {
  color: var(--under);
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
</style>
