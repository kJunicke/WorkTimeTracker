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
      <button class="btn" @click="label('vacation')">Urlaub</button>
      <button class="btn" @click="label('sick')">Krank</button>
      <button class="btn" @click="label('holiday')">Feiertag</button>
      <!-- Spans the row, and is the ONLY way out of this prompt that still
           costs a full day's target. There used to be an "Arbeitstag (leer)"
           button beside it writing `type: 'work'`, but `gleitzeittag` is
           excluded from `isLabeledType` (ADR 0001) and so derives identically
           — same target, same delta, same everything. Two buttons, one
           outcome. This one survives because it also says WHY the day is
           empty; a bare 'work' label said nothing. -->
      <button class="btn wide" @click="label('gleitzeittag')">Gleitzeittag (von der Gleitzeit)</button>
    </div>
  </div>
</template>

<style scoped>
.prompt-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* Three credited labels across the top, Gleitzeittag spanning beneath them —
   with the fourth button gone, a 2-column grid left a hole in the second row. */
.actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.wide {
  grid-column: 1 / -1;
}
</style>
