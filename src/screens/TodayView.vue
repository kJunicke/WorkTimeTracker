<script setup lang="ts">
// Today / hero screen (HANDOFF §4.1). Surfaces the two on-open prompts first
// (12h reconciliation, unlabeled past weekdays), then the live timer + Saldo,
// the primary state-action button(s), and today's totals.
import { computed, ref } from 'vue'
import { useStore } from '@/store/useStore'
import { formatDuration, formatSignedDuration, formatStopwatch } from '@/domain/time'
import type { DayType } from '@/domain/types'
import StatTile from '@/components/StatTile.vue'
import ReconcilePrompt from '@/components/ReconcilePrompt.vue'
import UnlabeledWeekdayPrompt from '@/components/UnlabeledWeekdayPrompt.vue'
import OnboardingPrompt from '@/components/OnboardingPrompt.vue'

const {
  pendingReconciliation,
  unlabeledPastWeekdays,
  needsOnboarding,
  timerState,
  elapsedSeconds,
  balanceSeconds,
  todayDerivation,
  startWork,
  startBreak,
  resume,
  stop,
  applyReconciliation,
  setDayType,
} = useStore()

// Seeded once (HANDOFF §7.3 "dismissible" first-run prompt): finishing
// onboarding flips `needsOnboarding` to false, so a live `v-if="needsOnboarding"`
// could yank the prompt mid-interaction. Latching the initial value instead
// means OnboardingPrompt owns its own exit (`close`).
// Re-navigating to Today re-seeds this from the then-current value.
const showOnboarding = ref(needsOnboarding.value)

// Disables the action buttons while a transition's persist-then-sync round
// trip is in flight, so a fast double-tap can't fire the same action twice
// (e.g. opening two work sessions).
const busy = ref(false)
async function guarded(action: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await action()
  } finally {
    busy.value = false
  }
}

const stateLabel = computed<string>(() => {
  if (timerState.value === 'working') return 'Arbeit läuft'
  if (timerState.value === 'onbreak') return 'Pause läuft'
  return 'Bereit'
})

const timerDisplay = computed<string>(() =>
  timerState.value === 'idle' ? '–:–' : formatStopwatch(elapsedSeconds.value),
)

const balanceTone = computed<'over' | 'under'>(() => (balanceSeconds.value >= 0 ? 'over' : 'under'))

const deltaTone = computed<'over' | 'under'>(() =>
  todayDerivation.value.deltaSeconds >= 0 ? 'over' : 'under',
)

function onApplyReconciliation(realEndMs: number): void {
  void applyReconciliation(realEndMs)
}

function onLabelDay(date: string, type: DayType): void {
  void setDayType(date, type)
}
</script>

<template>
  <section class="screen">
    <OnboardingPrompt v-if="showOnboarding" @close="showOnboarding = false" />

    <ReconcilePrompt
      v-if="pendingReconciliation"
      :session="pendingReconciliation.session"
      :cap-ms="pendingReconciliation.capMs"
      @apply="onApplyReconciliation"
    />

    <UnlabeledWeekdayPrompt
      v-if="unlabeledPastWeekdays.length"
      :dates="unlabeledPastWeekdays"
      @label="onLabelDay"
    />

    <section class="card hero">
      <div class="hero-state">
        <span class="kicker">{{ stateLabel }}</span>
        <span class="timer mono">{{ timerDisplay }}</span>
      </div>
      <div class="balance-block">
        <span class="balance-label">Saldo</span>
        <span class="balance-value mono" :class="balanceTone">
          {{ formatSignedDuration(balanceSeconds) }}
        </span>
      </div>
    </section>

    <div class="actions">
      <button
        v-if="timerState === 'idle'"
        class="btn btn-primary btn-lg"
        :disabled="busy"
        @click="guarded(startWork)"
      >
        Arbeit starten
      </button>
      <template v-else-if="timerState === 'working'">
        <button class="btn btn-lg" :disabled="busy" @click="guarded(startBreak)">Pause</button>
        <button class="btn btn-danger btn-lg" :disabled="busy" @click="guarded(stop)">Stopp</button>
      </template>
      <template v-else>
        <button class="btn btn-primary btn-lg" :disabled="busy" @click="guarded(resume)">
          Weiter
        </button>
        <button class="btn btn-danger btn-lg" :disabled="busy" @click="guarded(stop)">Stopp</button>
      </template>
    </div>

    <section class="card totals">
      <h3>Heute</h3>
      <div class="stat-grid">
        <StatTile label="Brutto" :value="formatDuration(todayDerivation.grossWorkSeconds)" />
        <StatTile label="Netto" :value="formatDuration(todayDerivation.netWorkSeconds)" />
        <StatTile
          label="Pause (erfasst)"
          :value="formatDuration(todayDerivation.loggedBreakSeconds)"
        />
        <StatTile label="Soll" :value="formatDuration(todayDerivation.expectedSeconds)" />
      </div>
      <StatTile
        label="Differenz heute"
        :value="formatSignedDuration(todayDerivation.deltaSeconds)"
        :tone="deltaTone"
      />
      <p v-if="todayDerivation.autoDeductedSeconds > 0" class="badge auto-badge">
        {{ formatDuration(todayDerivation.autoDeductedSeconds) }} automatisch abgezogen
        (gesetzliche Pause)
      </p>
    </section>
  </section>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 28px 16px;
  text-align: center;
}
.hero-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.kicker {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.timer {
  font-size: 44px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}
.balance-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  width: 100%;
}
.balance-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.balance-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--neutral-bal);
}
.balance-value.over {
  color: var(--over);
}
.balance-value.under {
  color: var(--under);
}

.actions {
  display: flex;
  gap: 10px;
}
.actions .btn {
  flex: 1;
}
.btn-lg {
  min-height: 56px;
  font-size: 17px;
  padding: 16px 18px;
}

.totals {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.auto-badge {
  background: var(--accent-weak);
  color: var(--accent-strong);
  white-space: normal;
  line-height: 1.35;
  width: fit-content;
}
</style>
