<script setup lang="ts">
// Small labeled stat display for the Today screen's totals grid.
withDefaults(
  defineProps<{
    label: string
    value: string
    tone?: 'default' | 'over' | 'under'
  }>(),
  { tone: 'default' },
)
</script>

<template>
  <div class="stat-tile" :class="`tone-${tone}`">
    <span class="stat-label">{{ label }}</span>
    <span class="stat-value mono">{{ value }}</span>
  </div>
</template>

<style scoped>
.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
.stat-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.stat-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
}
.tone-over .stat-value {
  color: var(--over);
}
.tone-under .stat-value {
  color: var(--under);
}
</style>
