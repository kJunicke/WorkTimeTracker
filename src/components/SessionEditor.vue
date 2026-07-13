<script setup lang="ts">
// Add/edit modal (bottom sheet) for a single session (HANDOFF §4.2).
//
// Deliberately a CLOSED-session-only form: `endMs` is always a concrete
// value, validated `> startMs`. This never emits a null `endMs`, so it can
// never reopen a session — protecting the store's single-open invariant
// without needing to special-case it here. (See SessionRow's header comment:
// the currently-open/live session is therefore never routed into this editor.)
//
// Presentational: emits `save` / `delete` / `cancel`; the caller (DayDetail)
// owns talking to the store. No native `alert`/`confirm` dialogs — delete
// uses an inline two-step confirm instead.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Session, SessionKind } from '@/domain/types'
import { localInputValueToMs, msToLocalInputValue } from '@/domain/time'

const props = defineProps<{
  mode: 'add' | 'edit'
  /** Default calendar day for a new session ("YYYY-MM-DD"). Also used as a fallback in edit mode. */
  date: string
  /** The session being edited; must be non-null when `mode === 'edit'`. */
  session: Session | null
}>()

const emit = defineEmits<{
  save: [input: { kind: SessionKind; startMs: number; endMs: number; note: string }]
  delete: []
  cancel: []
}>()

// Seeded ONCE from props at creation time (same non-reactive-seed pattern as
// ReconcilePrompt.vue's `inputValue`): DayDetail mounts a fresh SessionEditor
// per add/edit invocation (`v-if`/`v-else-if`), so there's no later prop
// change for these to track. A plain local `const` (rather than reading the
// prop through a computed getter) keeps TS's null-narrowing below reliable.
const initialSession: Session | null = props.mode === 'edit' ? props.session : null

/** Local "YYYY-MM-DDTHH:mm" default for a fresh manual add: the viewed day at a given hour. */
function defaultDayInputValue(date: string, hour: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return msToLocalInputValue(new Date(y, m - 1, d, hour, 0, 0, 0).getTime())
}

const kind = ref<SessionKind>(initialSession?.kind ?? 'work')
const startInput = ref<string>(
  initialSession ? msToLocalInputValue(initialSession.startMs) : defaultDayInputValue(props.date, 9),
)
const endInput = ref<string>(
  initialSession && initialSession.endMs != null
    ? msToLocalInputValue(initialSession.endMs)
    : defaultDayInputValue(props.date, 17),
)
const note = ref<string>(initialSession?.note ?? '')
const confirmingDelete = ref(false)

const title = computed<string>(() => (props.mode === 'edit' ? 'Sitzung bearbeiten' : 'Sitzung hinzufügen'))

const parsedStartMs = computed<number | null>(() => localInputValueToMs(startInput.value))
const parsedEndMs = computed<number | null>(() => localInputValueToMs(endInput.value))

const errorMessage = computed<string | null>(() => {
  if (parsedStartMs.value === null || parsedEndMs.value === null) {
    return 'Bitte gültige Start- und Endzeit angeben.'
  }
  if (parsedEndMs.value <= parsedStartMs.value) return 'Das Ende muss nach dem Start liegen.'
  if (parsedEndMs.value > Date.now()) return 'Das Ende darf nicht in der Zukunft liegen.'
  return null
})

function onSave(): void {
  if (errorMessage.value || parsedStartMs.value === null || parsedEndMs.value === null) return
  emit('save', {
    kind: kind.value,
    startMs: parsedStartMs.value,
    endMs: parsedEndMs.value,
    note: note.value.trim(),
  })
}

function onDeleteClick(): void {
  confirmingDelete.value = true
}

function onConfirmDelete(): void {
  emit('delete')
}

function onCancel(): void {
  emit('cancel')
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') onCancel()
}

const firstFieldEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
  firstFieldEl.value?.focus()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="overlay" @click.self="onCancel">
    <div class="sheet card" role="dialog" aria-modal="true" :aria-label="title">
      <header class="sheet-head">
        <h3>{{ title }}</h3>
        <button class="close-btn" type="button" aria-label="Schließen" @click="onCancel">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>

      <div class="field">
        <label id="editor-kind-label">Art</label>
        <div class="kind-toggle" role="group" aria-labelledby="editor-kind-label">
          <button type="button" class="btn" :class="{ active: kind === 'work' }" @click="kind = 'work'">
            Arbeit
          </button>
          <button type="button" class="btn" :class="{ active: kind === 'break' }" @click="kind = 'break'">
            Pause
          </button>
        </div>
      </div>

      <div class="field">
        <label for="editor-start">Start</label>
        <input id="editor-start" ref="firstFieldEl" v-model="startInput" type="datetime-local" />
      </div>

      <div class="field">
        <label for="editor-end">Ende</label>
        <input id="editor-end" v-model="endInput" type="datetime-local" />
      </div>

      <div class="field">
        <label for="editor-note">Notiz</label>
        <textarea id="editor-note" v-model="note" rows="2" maxlength="200" placeholder="Optional"></textarea>
      </div>

      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <div v-if="confirmingDelete" class="confirm-delete">
        <p class="muted">Diese Sitzung wirklich löschen?</p>
        <div class="action-row">
          <button class="btn btn-ghost" type="button" @click="confirmingDelete = false">Abbrechen</button>
          <button class="btn btn-danger" type="button" @click="onConfirmDelete">Ja, löschen</button>
        </div>
      </div>
      <template v-else>
        <button class="btn btn-primary btn-block" type="button" :disabled="!!errorMessage" @click="onSave">
          Speichern
        </button>
        <div class="action-row">
          <button v-if="mode === 'edit'" class="btn btn-danger" type="button" @click="onDeleteClick">
            Löschen
          </button>
          <button class="btn btn-ghost" type="button" @click="onCancel">Abbrechen</button>
        </div>
      </template>
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
  gap: 12px;
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

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kind-toggle {
  display: flex;
  gap: 8px;
}
.kind-toggle .btn {
  flex: 1;
}
.kind-toggle .btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--on-accent);
}

textarea {
  resize: vertical;
}

.error {
  color: var(--under);
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}

.action-row {
  display: flex;
  gap: 8px;
}
.action-row .btn {
  flex: 1;
}

.confirm-delete {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--under-weak);
}
</style>
