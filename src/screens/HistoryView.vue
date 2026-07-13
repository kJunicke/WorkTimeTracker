<script setup lang="ts">
// History screen (HANDOFF §4.2): a scrollable list of past days — newest
// first — each rendered by the reusable `DayDetail` component (which also
// backs Calendar's day view in wave 5). This screen itself only computes
// *which* days to show and hosts the global "add a forgotten session" entry
// point; all reading/editing of a given day's data lives in DayDetail.
import { computed, ref } from 'vue'
import { useStore } from '@/store/useStore'
import { todayKey } from '@/domain/time'
import type { SessionKind } from '@/domain/types'
import DayDetail from '@/components/DayDetail.vue'
import SessionEditor from '@/components/SessionEditor.vue'

const store = useStore()

/**
 * Days to list: anything with sessions OR a day label, newest first.
 * Empty unlabeled days are deliberately excluded (that's the Today screen's
 * unlabeled-weekday prompt's job, HANDOFF §3.5) — which also means a day
 * with zero data has no card here, hence the *global* add entry point below
 * (a per-day add button alone couldn't reach such a day).
 */
const dateKeys = computed<string[]>(() => {
  const keys = new Set<string>()
  for (const key of store.sessionsByDay.value.keys()) keys.add(key)
  for (const key of store.dayMetaByDay.value.keys()) keys.add(key)
  return [...keys].sort().reverse()
})

const showGlobalAdd = ref(false)

function onGlobalAdd(input: { kind: SessionKind; startMs: number; endMs: number; note: string }): void {
  void store.addSession(input)
  showGlobalAdd.value = false
}
</script>

<template>
  <section class="screen">
    <div class="toolbar">
      <button class="btn btn-primary" type="button" @click="showGlobalAdd = true">+ Sitzung hinzufügen</button>
    </div>

    <div v-if="dateKeys.length === 0" class="card empty-state">
      <p class="muted">
        Noch keine Einträge. Starte die Zeiterfassung auf „Heute“ oder füge oben manuell eine
        Sitzung hinzu.
      </p>
    </div>

    <DayDetail v-for="date in dateKeys" :key="date" :date="date" />

    <SessionEditor
      v-if="showGlobalAdd"
      mode="add"
      :date="todayKey()"
      :session="null"
      @save="onGlobalAdd"
      @cancel="showGlobalAdd = false"
    />
  </section>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  justify-content: flex-end;
}
.empty-state {
  text-align: center;
}
</style>
