<script setup lang="ts">
// Unlabeled-past-weekday prompt (HANDOFF §3.5). Surfaces one date at a time
// (the earliest) so the queue drains as the user labels days; `dates` is
// expected to be sorted ascending (as `store.unlabeledPastWeekdays` is).
import { computed } from 'vue'
import type { DayType } from '@/domain/types'

const props = defineProps<{
  dates: string[]
}>()

const emit = defineEmits<{
  label: [date: string, type: DayType]
}>()

const current = computed<string | null>(() => props.dates[0] ?? null)
const remaining = computed<number>(() => Math.max(0, props.dates.length - 1))

/** Local display like "Mi., 06.05.2026" from a "YYYY-MM-DD" local date key. */
function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function label(type: DayType): void {
  if (current.value) emit('label', current.value, type)
}
</script>

<template>
  <div v-if="current" class="card prompt-card">
    <h3>Tag ohne Eintrag</h3>
    <p class="muted">
      <strong>{{ formatDateKey(current) }}</strong> hat keine erfasste Arbeitszeit und noch keine
      Kennzeichnung. Wie soll dieser Tag gezählt werden?
    </p>
    <p v-if="remaining > 0" class="faint">und {{ remaining }} weitere Tag(e)</p>
    <div class="actions">
      <button class="btn" @click="label('work')">Arbeitstag (leer)</button>
      <button class="btn" @click="label('vacation')">Urlaub</button>
      <button class="btn" @click="label('sick')">Krank</button>
      <button class="btn" @click="label('holiday')">Feiertag</button>
    </div>
  </div>
</template>

<style scoped>
.prompt-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
</style>
