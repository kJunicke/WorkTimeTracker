<script setup lang="ts">
// Presentational weekly/monthly summary card (HANDOFF §4.3). The caller
// (SummaryView) does all the grouping/summing over already-derived days —
// this component only formats and renders one already-computed period, plus
// the optional "net vs target" bar (nice-to-have, no chart library).
import { computed } from 'vue'
import { formatDuration, formatSignedDuration } from '@/domain/time'
import StatTile from '@/components/StatTile.vue'

const props = withDefaults(
  defineProps<{
    heading: string
    netSeconds: number
    expectedSeconds: number
    deltaSeconds: number
    /** Running balance through this period's last in-window day. */
    balanceAtEnd: number
    /** e.g. "Saldo zum Wochenende" / "Saldo zum Monatsende". */
    balanceLabel: string
    showBar?: boolean
  }>(),
  { showBar: false },
)

const deltaTone = computed<'over' | 'under'>(() => (props.deltaSeconds >= 0 ? 'over' : 'under'))
const balanceTone = computed<'over' | 'under'>(() => (props.balanceAtEnd >= 0 ? 'over' : 'under'))

/** Net work as a % of target, capped at 100 so the fill never overflows the track. */
const barWidthPct = computed<number>(() => {
  if (props.expectedSeconds <= 0) return 0
  return Math.min(100, Math.max(0, (props.netSeconds / props.expectedSeconds) * 100))
})
</script>

<template>
  <article class="card period-card">
    <header class="period-head">
      <h3>{{ heading }}</h3>
    </header>

    <div class="period-stats">
      <StatTile label="Netto" :value="formatDuration(netSeconds)" />
      <StatTile label="Soll" :value="formatDuration(expectedSeconds)" />
      <StatTile label="Differenz" :value="formatSignedDuration(deltaSeconds)" :tone="deltaTone" />
    </div>

    <div v-if="showBar && expectedSeconds > 0" class="bar-track" :class="`track-${deltaTone}`">
      <div class="bar-fill" :class="`fill-${deltaTone}`" :style="{ width: barWidthPct + '%' }" />
    </div>

    <p class="muted balance-end">
      {{ balanceLabel }}:
      <strong class="mono" :class="balanceTone">{{ formatSignedDuration(balanceAtEnd) }}</strong>
    </p>
  </article>
</template>

<style scoped>
.period-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.period-head h3 {
  font-size: 15px;
}
.period-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.bar-track {
  height: 8px;
  border-radius: var(--radius-pill);
  overflow: hidden;
}
.track-over {
  background: var(--over-weak);
}
.track-under {
  background: var(--under-weak);
}
.bar-fill {
  height: 100%;
  border-radius: var(--radius-pill);
}
.fill-over {
  background: var(--over);
}
.fill-under {
  background: var(--under);
}

.balance-end {
  font-size: 13px;
  margin: 0;
}
.balance-end .over {
  color: var(--over);
}
.balance-end .under {
  color: var(--under);
}
</style>
