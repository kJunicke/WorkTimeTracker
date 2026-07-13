<script setup lang="ts">
// Summary screen (HANDOFF §4.3): weekly and monthly totals, each a sum of
// in-window days, plus the running balance as of that period's end. Never
// recomputes the break law itself — reads `netWorkSeconds`/`expectedSeconds`/
// `deltaSeconds` straight off the store's per-day derivations and only sums
// them (CLAUDE.md "aggregation basis": the balance is defined over
// [balanceStartDate..today], so only days in that window count).
import { computed } from 'vue'
import { useStore } from '@/store/useStore'
import { useClock } from '@/store/useClock'
import {
  formatDayHeading,
  formatMonthHeading,
  formatSignedDuration,
  formatWeekHeading,
  monthKey,
  todayKey,
  weekKey,
} from '@/domain/time'
import type { DayDerivation } from '@/domain/types'
import PeriodSummaryCard from '@/components/PeriodSummaryCard.vue'

interface PeriodSummary {
  key: string
  heading: string
  netSeconds: number
  expectedSeconds: number
  deltaSeconds: number
  /** Running balance through this period's last in-window day. */
  balanceAtEnd: number
}

const store = useStore()
const { now } = useClock()

/**
 * In-window days (HANDOFF §3.6: [balanceStartDate..today]), ascending by
 * date. `derivedDays` also carries days outside this range (e.g. sessions
 * dated before the balance start date) — filtering to the window means
 * these sums match exactly what `balanceSeconds` itself is built from.
 */
const inWindowDaysAsc = computed<DayDerivation[]>(() => {
  const start = store.settings.value.balanceStartDate
  const end = todayKey(now.value)
  return [...store.derivedDays.value.values()]
    .filter((d) => d.date >= start && d.date <= end)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
})

/**
 * Groups the in-window days (already ascending) by `groupKeyFn`, summing
 * Netto/Soll/Differenz per group while threading a running balance across
 * ALL in-window days — so each group's `balanceAtEnd` is the cumulative
 * balance through its last (chronologically) in-window day, not just that
 * group's own delta sum. Returned newest-period-first.
 */
function buildPeriods(
  groupKeyFn: (date: string) => string,
  headingFn: (key: string) => string,
): PeriodSummary[] {
  const byKey = new Map<string, PeriodSummary>()
  let running = 0
  for (const day of inWindowDaysAsc.value) {
    running += day.deltaSeconds
    const key = groupKeyFn(day.date)
    const entry = byKey.get(key) ?? {
      key,
      heading: headingFn(key),
      netSeconds: 0,
      expectedSeconds: 0,
      deltaSeconds: 0,
      balanceAtEnd: 0,
    }
    entry.netSeconds += day.netWorkSeconds
    entry.expectedSeconds += day.expectedSeconds
    entry.deltaSeconds += day.deltaSeconds
    entry.balanceAtEnd = running
    byKey.set(key, entry)
  }
  return [...byKey.values()].reverse()
}

const weeklyPeriods = computed<PeriodSummary[]>(() => buildPeriods(weekKey, formatWeekHeading))
const monthlyPeriods = computed<PeriodSummary[]>(() => buildPeriods(monthKey, formatMonthHeading))

const totalBalance = computed<number>(() => store.balanceSeconds.value)
const balanceTone = computed<'over' | 'under'>(() => (totalBalance.value >= 0 ? 'over' : 'under'))
const balanceStartHeading = computed<string>(() => formatDayHeading(store.settings.value.balanceStartDate))
const hasData = computed<boolean>(() => weeklyPeriods.value.length > 0)
</script>

<template>
  <section class="screen">
    <section class="card balance-hero">
      <span class="balance-kicker">Gesamtsaldo</span>
      <span class="balance-value mono" :class="balanceTone">{{ formatSignedDuration(totalBalance) }}</span>
      <span class="muted balance-sub">seit {{ balanceStartHeading }}</span>
    </section>

    <div v-if="!hasData" class="card empty-state">
      <p class="muted">Noch keine Tage im Betrachtungszeitraum seit {{ balanceStartHeading }}.</p>
    </div>

    <template v-else>
      <section class="group">
        <h2 class="group-title">Wochen</h2>
        <PeriodSummaryCard
          v-for="p in weeklyPeriods"
          :key="`w-${p.key}`"
          :heading="p.heading"
          :net-seconds="p.netSeconds"
          :expected-seconds="p.expectedSeconds"
          :delta-seconds="p.deltaSeconds"
          :balance-at-end="p.balanceAtEnd"
          balance-label="Saldo zum Wochenende"
          :show-bar="true"
        />
      </section>

      <section class="group">
        <h2 class="group-title">Monate</h2>
        <PeriodSummaryCard
          v-for="p in monthlyPeriods"
          :key="`m-${p.key}`"
          :heading="p.heading"
          :net-seconds="p.netSeconds"
          :expected-seconds="p.expectedSeconds"
          :delta-seconds="p.deltaSeconds"
          :balance-at-end="p.balanceAtEnd"
          balance-label="Saldo zum Monatsende"
        />
      </section>
    </template>
  </section>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.balance-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 22px 16px;
  text-align: center;
}
.balance-kicker {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.balance-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--neutral-bal);
}
.balance-value.over {
  color: var(--over);
}
.balance-value.under {
  color: var(--under);
}
.balance-sub {
  font-size: 12.5px;
}

.empty-state {
  text-align: center;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.group-title {
  font-size: 15px;
  padding-left: 2px;
}
</style>
