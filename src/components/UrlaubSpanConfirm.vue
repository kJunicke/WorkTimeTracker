<script setup lang="ts">
// Confirmation for marking a span as Urlaub. Presentational only: it states
// what the given plan would write and emits the user's answer. Every rule
// behind the numbers was decided by `planUrlaubSpan` — this component counts
// nothing and decides nothing, it only puts German words around a plan.
//
// Cancelling emits `cancel` and nothing else; no write happens anywhere until
// the caller acts on `confirm`.
import { computed } from 'vue'
import type { UrlaubSpanPlan } from '@/domain/vacation'
import type { DayType } from '@/domain/types'
import { formatDayHeading } from '@/domain/time'

const props = defineProps<{
  plan: UrlaubSpanPlan
}>()

const emit = defineEmits<{
  /**
   * Apply the plan. `mitGleitzeittagen` carries the user's answer to the
   * offer — the app never spends Gleitzeit unless this is explicitly `true`.
   */
  confirm: [mitGleitzeittagen: boolean]
  cancel: []
}>()

/** Singular/plural German nouns for the label a skipped day keeps. */
const SKIP_LABEL_DE: Record<Exclude<DayType, 'work'>, [string, string]> = {
  vacation: ['Urlaubstag', 'Urlaubstage'],
  sick: ['Krank-Tag', 'Krank-Tage'],
  holiday: ['Feiertag', 'Feiertage'],
  gleitzeittag: ['Gleitzeittag', 'Gleitzeittage'],
}
/** Fixed order so the wording is stable whatever order the plan skipped them in. */
const SKIP_ORDER: Exclude<DayType, 'work'>[] = ['holiday', 'sick', 'vacation', 'gleitzeittag']

function formatTage(tage: number): string {
  return `${tage} ${Math.abs(tage) === 1 ? 'Tag' : 'Tage'}`
}

const spanHeading = computed<string>(() =>
  props.plan.start === props.plan.end
    ? formatDayHeading(props.plan.start)
    : `${formatDayHeading(props.plan.start)} – ${formatDayHeading(props.plan.end)}`,
)

/** "1 Feiertag, 2 Krank-Tage" — the skipped days by the label they keep. */
const skippedPhrase = computed<string>(() => {
  const parts: string[] = []
  for (const type of SKIP_ORDER) {
    const count = props.plan.skipped.filter((s) => s.type === type).length
    if (count === 0) continue
    const [one, many] = SKIP_LABEL_DE[type]
    parts.push(`${count} ${count === 1 ? one : many}`)
  }
  return parts.join(', ')
})

/** The headline the ticket asks for: what gets written, and what is skipped. */
const summary = computed<string>(() => {
  const marked = `${formatTage(props.plan.vacation.length)} als Urlaub`
  return skippedPhrase.value ? `${marked}, ${skippedPhrase.value} übersprungen` : marked
})

/** "Do., 13.08.2026 bleibt Feiertag" — one line per day the plan leaves alone. */
function skipLine(skip: UrlaubSpanPlan['skipped'][number]): string {
  if (skip.type === 'work') return formatDayHeading(skip.date)
  return `${formatDayHeading(skip.date)} bleibt ${SKIP_LABEL_DE[skip.type][0]}`
}

/**
 * The span ran past the Urlaubsanspruch and the planner offers the remainder
 * as Gleitzeittage. Presented as two distinct actions rather than a checkbox:
 * spending Gleitzeit has to be something the user says out loud, not something
 * a pre-ticked default does for them.
 */
const hatAngebot = computed<boolean>(() => props.plan.gleitzeittag.length > 0)
</script>

<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="sheet card" role="dialog" aria-modal="true" aria-label="Zeitraum als Urlaub eintragen">
      <header class="sheet-head">
        <h3>Als Urlaub eintragen</h3>
        <button class="close-btn" type="button" aria-label="Schließen" @click="emit('cancel')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <p class="muted span-heading">{{ spanHeading }}</p>

      <p class="summary">{{ summary }}</p>
      <p class="faint detail">
        Kostet {{ formatTage(plan.kosten) }} vom Urlaubskonto – Wochenenden zählen nicht.
      </p>

      <p class="faint detail">Danach übrig: {{ formatTage(plan.uebrigDanach) }}</p>

      <ul v-if="plan.skipped.length > 0" class="skipped-list">
        <li v-for="skip in plan.skipped" :key="skip.date" class="faint">{{ skipLine(skip) }}</li>
      </ul>

      <template v-if="hatAngebot">
        <p class="offer">
          Nicht genug Urlaub übrig: {{ formatTage(plan.gleitzeittag.length) }} passen nicht mehr ins
          Urlaubskonto. Sollen sie als Gleitzeittage eingetragen werden?
        </p>
        <p class="faint detail">
          Gleitzeittage kosten keinen Urlaub – sie gehen von der Gleitzeit ab.
        </p>
        <button class="btn btn-primary btn-block" type="button" @click="emit('confirm', true)">
          Urlaub eintragen und Rest als Gleitzeittage
        </button>
        <button
          class="btn btn-block"
          type="button"
          :disabled="plan.vacation.length === 0"
          @click="emit('confirm', false)"
        >
          Nur Urlaub eintragen
        </button>
      </template>
      <button
        v-else
        class="btn btn-primary btn-block"
        type="button"
        :disabled="plan.vacation.length === 0"
        @click="emit('confirm', false)"
      >
        Eintragen
      </button>
      <button class="btn btn-ghost btn-block" type="button" @click="emit('cancel')">Abbrechen</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(23, 23, 31, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: var(--app-max-width);
  max-height: min(88dvh, 720px);
  overflow-y: auto;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
}

.span-heading {
  margin: 0;
  font-size: 13px;
}
.summary {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}
.detail {
  margin: 0;
  font-size: 12.5px;
}

.skipped-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12.5px;
}

.offer {
  color: var(--under);
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
</style>
