<script setup lang="ts">
// One session row (HANDOFF §4.2). Purely presentational — props in, `edit`
// event out — so it works unchanged inside DayDetail for both History and
// (wave 5) Calendar's reused day view.
//
// The currently-OPEN session (endMs === null) is rendered read-only: the
// SessionEditor contract only ever writes closed sessions (see its header
// comment), so editing the live timer here would either silently stop it or
// require reopening it later — both risk the store's single-open invariant.
// Fixing/stopping the live session belongs on the Heute screen; once stopped
// it becomes a normal closed row and is fully editable here.
import { computed } from 'vue'
import type { Session } from '@/domain/types'
import { formatClock, formatDuration, sessionSeconds } from '@/domain/time'

const props = defineProps<{
  session: Session
  /** Shared live clock tick (ms); only used to live-update an open session's duration. */
  now: number
}>()

const emit = defineEmits<{
  edit: [id: string]
}>()

const isOpen = computed<boolean>(() => props.session.endMs === null)

const kindLabel = computed<string>(() => (props.session.kind === 'work' ? 'Arbeit' : 'Pause'))

const durationSeconds = computed<number>(() =>
  isOpen.value
    ? Math.max(0, Math.floor((props.now - props.session.startMs) / 1000))
    : sessionSeconds(props.session),
)

function onActivate(): void {
  if (isOpen.value) return
  emit('edit', props.session.id)
}
</script>

<template>
  <div
    class="session-row"
    :class="[`kind-${session.kind}`, { clickable: !isOpen }]"
    :role="isOpen ? undefined : 'button'"
    :tabindex="isOpen ? undefined : 0"
    @click="onActivate"
    @keydown.enter="onActivate"
    @keydown.space.prevent="onActivate"
  >
    <span class="kind-dot" aria-hidden="true"></span>
    <div class="session-main">
      <div class="session-top">
        <span class="kind-label">{{ kindLabel }}</span>
        <span class="times mono" :class="{ 'is-open': isOpen }">
          {{ formatClock(session.startMs) }}–<template v-if="isOpen">läuft</template
          ><template v-else>{{ formatClock(session.endMs as number) }}</template>
        </span>
      </div>
      <div class="session-bottom">
        <span class="duration mono muted">{{ formatDuration(durationSeconds) }}</span>
        <span v-if="session.autoStopped" class="badge autostop-badge">12h-Stopp</span>
        <span v-if="session.note" class="note faint">{{ session.note }}</span>
      </div>
    </div>
    <span v-if="!isOpen" class="chevron" aria-hidden="true">›</span>
  </div>
</template>

<style scoped>
.session-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 4px;
  border-top: 1px solid var(--border);
  text-align: left;
}
.session-row.clickable {
  cursor: pointer;
}
.session-row.clickable:active {
  background: var(--surface-2);
}

.kind-dot {
  flex: none;
  width: 9px;
  height: 9px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--text-faint);
}
.kind-work .kind-dot {
  background: var(--work);
}

.session-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.session-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.kind-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.times {
  font-size: 13.5px;
  color: var(--text-muted);
}
.times.is-open {
  color: var(--accent-strong);
  font-weight: 700;
}
.session-bottom {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.duration {
  font-size: 13px;
}
.note {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.autostop-badge {
  background: var(--under-weak);
  color: var(--under);
}

.chevron {
  flex: none;
  color: var(--text-faint);
  font-size: 18px;
  line-height: 1.6;
}
</style>
