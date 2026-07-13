<script setup lang="ts">
// Calendar / heatmap screen (HANDOFF §4.4). A Mon-first month grid where
// each day cell is colored by net work vs. that day's target — reusing the
// same per-day derivations History/Summary read from the store (the break
// law is never recomputed here, only its already-derived fields are read).
// Tapping a day opens `DayDetail` for that date in a dismissible sheet — the
// same reusable per-day view History uses (full session/label editing).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useStore } from '@/store/useStore'
import { useClock } from '@/store/useClock'
import {
  addMonths,
  formatDayHeading,
  formatDuration,
  formatMonthHeading,
  isWeekend,
  monthGridDays,
  monthKey,
  todayKey,
} from '@/domain/time'
import { THIRTY_MIN } from '@/domain/constants'
import type { DayType } from '@/domain/types'
import DayDetail from '@/components/DayDetail.vue'
import HeatCell from '@/components/HeatCell.vue'
import CalendarLegend from '@/components/CalendarLegend.vue'

type DayTone = 'empty' | 'under' | 'on' | 'over' | 'weekend' | 'vacation' | 'sick' | 'holiday' | 'muted'

const DAY_TYPE_LABEL_DE: Record<'vacation' | 'sick' | 'holiday', string> = {
  vacation: 'Urlaub',
  sick: 'Krank',
  holiday: 'Feiertag',
}
const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

interface CellData {
  date: string
  dayNumber: number
  tone: DayTone
  inMonth: boolean
  isToday: boolean
  title: string
}

const store = useStore()
const { now } = useClock()

const today = computed<string>(() => todayKey(now.value))
const viewMonth = ref<string>(monthKey(today.value))
const monthHeading = computed<string>(() => formatMonthHeading(viewMonth.value))
const isCurrentMonth = computed<boolean>(() => viewMonth.value === monthKey(today.value))

function goPrevMonth(): void {
  viewMonth.value = addMonths(viewMonth.value, -1)
}
function goNextMonth(): void {
  viewMonth.value = addMonths(viewMonth.value, 1)
}
function goToday(): void {
  viewMonth.value = monthKey(today.value)
}

/**
 * Which tone a date's cell gets (HANDOFF §4.4). Precedence: days outside
 * [balanceStartDate..today] (incl. future) are muted; then an explicit
 * vacation/sick/holiday label wins (the user set it deliberately — respect it
 * even in the rare case of a labeled weekend); then weekend styling; then the
 * heat ramp (empty → under → on-target → over) for an ordinary work day.
 */
function toneFor(date: string): DayTone {
  const start = store.settings.value.balanceStartDate
  if (date < start || date > today.value) return 'muted'

  const derivation = store.derivedDays.value.get(date)
  const type: DayType = derivation?.type ?? store.dayMetaByDay.value.get(date)?.type ?? 'work'
  if (type === 'vacation' || type === 'sick' || type === 'holiday') return type

  if (isWeekend(date)) return 'weekend'

  const net = derivation?.netWorkSeconds ?? 0
  const target = derivation?.expectedSeconds ?? 0
  if (net === 0) return 'empty'
  if (net < target) return 'under'
  if (net <= target + THIRTY_MIN) return 'on'
  return 'over'
}

/** Native title/aria-label: the day heading plus a short status, never gating info behind it. */
function titleFor(date: string, tone: DayTone): string {
  const heading = formatDayHeading(date)
  if (tone === 'muted') return heading
  const derivation = store.derivedDays.value.get(date)
  if (!derivation) return heading
  if (derivation.type !== 'work') return `${heading} · ${DAY_TYPE_LABEL_DE[derivation.type]}`
  return `${heading} · ${formatDuration(derivation.netWorkSeconds)} von ${formatDuration(derivation.expectedSeconds)}`
}

const gridCells = computed<CellData[]>(() =>
  monthGridDays(viewMonth.value).map((date): CellData => {
    const tone = toneFor(date)
    return {
      date,
      dayNumber: Number(date.slice(8, 10)),
      tone,
      inMonth: monthKey(date) === viewMonth.value,
      isToday: date === today.value,
      title: titleFor(date, tone),
    }
  }),
)

// ---------------------------------------------------------------------
// Tap-to-open day detail (reuses DayDetail — full session/label editing)
// ---------------------------------------------------------------------

const selectedDate = ref<string | null>(null)

function onSelectDay(date: string): void {
  selectedDate.value = date
}
function onCloseDetail(): void {
  selectedDate.value = null
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') onCloseDetail()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="screen">
    <section class="card month-card">
      <header class="month-head">
        <button class="btn nav-btn" type="button" aria-label="Vorheriger Monat" @click="goPrevMonth">‹</button>
        <div class="month-title-wrap">
          <h2 class="month-title">{{ monthHeading }}</h2>
          <button v-if="!isCurrentMonth" class="today-link" type="button" @click="goToday">Heute</button>
        </div>
        <button class="btn nav-btn" type="button" aria-label="Nächster Monat" @click="goNextMonth">›</button>
      </header>

      <div class="weekday-row">
        <span v-for="wd in WEEKDAY_LABELS" :key="wd" class="weekday-label">{{ wd }}</span>
      </div>

      <div class="month-grid">
        <HeatCell
          v-for="cell in gridCells"
          :key="cell.date"
          :date="cell.date"
          :day-number="cell.dayNumber"
          :tone="cell.tone"
          :in-month="cell.inMonth"
          :is-today="cell.isToday"
          :title="cell.title"
          @select="onSelectDay"
        />
      </div>
    </section>

    <CalendarLegend />

    <div v-if="selectedDate" class="overlay" @click.self="onCloseDetail">
      <div class="sheet">
        <div class="sheet-head">
          <button class="close-btn" type="button" aria-label="Schließen" @click="onCloseDetail">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <DayDetail :date="selectedDate ?? ''" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.month-card {
  display: flex;
  flex-direction: column;
}

.month-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav-btn {
  flex: none;
  width: 44px;
  padding: 0;
  font-size: 20px;
  line-height: 1;
}
.month-title-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.month-title {
  font-size: 17px;
  text-align: center;
}
.today-link {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 12px;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-top: 12px;
}
.weekday-label {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-faint);
  text-transform: uppercase;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-top: 6px;
}

.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
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
  background: var(--bg);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg);
  padding: 10px 14px calc(16px + env(safe-area-inset-bottom));
}
.sheet-head {
  display: flex;
  justify-content: flex-end;
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
</style>
