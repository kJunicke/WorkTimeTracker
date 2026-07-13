<script setup lang="ts">
// Presentational calendar day cell (HANDOFF §4.4). CalendarView computes
// which "tone" applies to a date (weekend/label precedence, heat-ramp
// thresholds, window/future muting) — this component only renders a given
// tone; it never touches the store or re-derives anything.
import { computed } from 'vue'

type DayTone = 'empty' | 'under' | 'on' | 'over' | 'weekend' | 'vacation' | 'sick' | 'holiday' | 'muted'

const props = withDefaults(
  defineProps<{
    date: string
    dayNumber: number
    tone: DayTone
    inMonth?: boolean
    isToday?: boolean
    title?: string
  }>(),
  { inMonth: true, isToday: false, title: '' },
)

const emit = defineEmits<{
  select: [date: string]
}>()

/**
 * Vacation/Sick/Holiday additionally carry a short letter badge, so the
 * category is never conveyed by color alone (a11y: identity isn't
 * color-only — weekend/heat tones already read from grid position/day
 * number + the legend).
 */
const BADGE_BY_TONE: Partial<Record<DayTone, string>> = {
  vacation: 'U',
  sick: 'K',
  holiday: 'F',
}
const badge = computed<string | undefined>(() => BADGE_BY_TONE[props.tone])

function onClick(): void {
  emit('select', props.date)
}
</script>

<template>
  <button
    type="button"
    class="heat-cell"
    :class="[`tone-${tone}`, { 'out-month': !inMonth, today: isToday }]"
    :title="title || undefined"
    :aria-label="title || undefined"
    @click="onClick"
  >
    <span class="day-num">{{ dayNumber }}</span>
    <span v-if="badge" class="badge-letter" aria-hidden="true">{{ badge }}</span>
  </button>
</template>

<style scoped>
.heat-cell {
  appearance: none;
  border: none;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  padding: 5px 6px;
  font-family: inherit;
  background: var(--heat-empty);
  color: var(--text);
  transition: transform 0.06s var(--ease);
}
.heat-cell:active {
  transform: scale(0.94);
}

.day-num {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.badge-letter {
  position: absolute;
  top: 3px;
  right: 4px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.tone-empty {
  background: var(--heat-empty);
}
.tone-under {
  background: var(--heat-under);
}
.tone-on {
  background: var(--heat-on);
}
.tone-over {
  background: var(--heat-over);
}
.tone-weekend {
  background: var(--weekend);
}
.tone-vacation {
  background: var(--vacation);
}
.tone-sick {
  background: var(--sick);
}
.tone-holiday {
  background: var(--holiday);
}
.tone-muted {
  background: transparent;
  color: var(--text-faint);
}

.out-month {
  opacity: 0.42;
}

.today {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
