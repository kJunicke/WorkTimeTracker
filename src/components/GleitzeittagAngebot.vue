<script setup lang="ts">
// The single-day counterpart to UrlaubSpanConfirm's Gleitzeittag offer.
// Presentational only: it decides nothing and writes nothing — whether the
// offer is due at all was decided by `planTageskennzeichnung` in
// `@/domain/vacation`; this component only puts German words around it.
//
// Two explicit buttons rather than a checkbox or a pre-selected default, the
// same idiom UrlaubSpanConfirm uses: spending Gleitzeit has to be something
// the user says out loud. Abbrechen emits `cancel` and nothing is written —
// not the Urlaub day the cap refused, and not a Gleitzeittag either.
import { computed } from 'vue'
import { formatDayHeading, yearKey } from '@/domain/time'

const props = defineProps<{
  /** The day the user tried to label as Urlaub, local "YYYY-MM-DD". */
  date: string
}>()

const emit = defineEmits<{
  /** Enter the day as a Gleitzeittag instead. */
  confirm: []
  cancel: []
}>()

const urlaubsjahr = computed<string>(() => yearKey(props.date))
</script>

<template>
  <div class="overlay" @click.self="emit('cancel')">
    <div class="sheet card" role="dialog" aria-modal="true" aria-label="Kein Urlaub mehr übrig">
      <header class="sheet-head">
        <h3>Kein Urlaub mehr übrig</h3>
        <button class="close-btn" type="button" aria-label="Schließen" @click="emit('cancel')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <p class="muted span-heading">{{ formatDayHeading(date) }}</p>

      <p class="offer">
        Das Urlaubskonto {{ urlaubsjahr }} ist aufgebraucht – dieser Tag passt nicht mehr hinein.
        Soll er stattdessen als Gleitzeittag eingetragen werden?
      </p>
      <p class="faint detail">
        Gleitzeittage kosten keinen Urlaub – sie gehen von der Gleitzeit ab.
      </p>

      <button class="btn btn-primary btn-block" type="button" @click="emit('confirm')">
        Als Gleitzeittag eintragen
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
.offer {
  color: var(--under);
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
.detail {
  margin: 0;
  font-size: 12.5px;
}
</style>
