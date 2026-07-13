<script setup lang="ts">
// Static legend for the Calendar heatmap (HANDOFF §4.4): maps each cell color
// to its meaning so identity is never color-only. Purely presentational — no
// props, no store access. The color rules mirror HeatCell.vue's tones.
const entries = [
  { tone: 'empty', label: 'Leer' },
  { tone: 'under', label: 'Unter Soll' },
  { tone: 'on', label: 'Soll erfüllt' },
  { tone: 'over', label: 'Über Soll' },
  { tone: 'vacation', label: 'Urlaub' },
  { tone: 'sick', label: 'Krank' },
  { tone: 'holiday', label: 'Feiertag' },
  { tone: 'weekend', label: 'Wochenende' },
] as const
</script>

<template>
  <section class="card legend">
    <h3 class="legend-title">Legende</h3>
    <ul class="legend-list">
      <li v-for="entry in entries" :key="entry.tone" class="legend-item">
        <span class="swatch" :class="`tone-${entry.tone}`" aria-hidden="true"></span>
        <span class="legend-label">{{ entry.label }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.legend-title {
  font-size: 14px;
}
.legend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 14px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swatch {
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
}
.legend-label {
  font-size: 13px;
  color: var(--text-muted);
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
</style>
