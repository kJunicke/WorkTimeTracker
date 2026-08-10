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
  formatTage,
  isWeekend,
  monthGridDays,
  monthKey,
  todayKey,
  yearKey,
} from '@/domain/time'
import { isLabeledType } from '@/domain/calc'
import { THIRTY_MIN } from '@/domain/constants'
import type { DayType } from '@/domain/types'
import { ohneGleitzeittage, planUrlaubSpan } from '@/domain/vacation'
import type { UrlaubSpanPlan } from '@/domain/vacation'
import DayDetail from '@/components/DayDetail.vue'
import HeatCell from '@/components/HeatCell.vue'
import type { DayTone } from '@/components/HeatCell.vue'
import CalendarLegend from '@/components/CalendarLegend.vue'
import StatTile from '@/components/StatTile.vue'
import UrlaubSpanConfirm from '@/components/UrlaubSpanConfirm.vue'

const DAY_TYPE_LABEL_DE: Record<Exclude<DayType, 'work'>, string> = {
  vacation: 'Urlaub',
  sick: 'Krank',
  holiday: 'Feiertag',
  gleitzeittag: 'Gleitzeittag',
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
 * [balanceStartDate..today] (incl. future) are muted; then any explicit
 * non-work label wins (the user set it deliberately — respect it even in the
 * rare case of a labeled weekend, and for a Gleitzeittag even when work was
 * logged on it); then weekend styling; then the heat ramp (empty → under →
 * on-target → over) for an ordinary work day.
 */
function toneFor(date: string): DayTone {
  const derivation = store.derivedDays.value.get(date)
  const type: DayType = derivation?.type ?? store.dayMetaByDay.value.get(date)?.type ?? 'work'
  // An explicit label wins even outside [balanceStartDate..today]: vacation
  // marked for next month is `verplant` in the Urlaubskonto, so a span planned
  // ahead — weekends included — has to read as time away in the grid too.
  if (type !== 'work') return type

  const start = store.settings.value.balanceStartDate
  if (date < start || date > today.value) return 'muted'

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
  const derivation = store.derivedDays.value.get(date)
  const type: DayType = derivation?.type ?? store.dayMetaByDay.value.get(date)?.type ?? 'work'
  // A credited day's hours are meaningless (the label zeroes them out); a
  // Gleitzeittag's are not — it carries a target and counts what was worked.
  if (type !== 'work') {
    if (isLabeledType(type) || !derivation) return `${heading} · ${DAY_TYPE_LABEL_DE[type]}`
    return `${heading} · ${DAY_TYPE_LABEL_DE[type]} · ${formatDuration(derivation.netWorkSeconds)} von ${formatDuration(derivation.expectedSeconds)}`
  }
  if (tone === 'muted' || !derivation) return heading
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
// Urlaubskonto for the displayed month's Urlaubsjahr
// ---------------------------------------------------------------------

// Scoped to the month on screen, so paging from Dezember into Januar swings
// the counter to the next Urlaubsjahr. All three figures come straight from
// the domain module — nothing is decided here.
const urlaubsjahr = computed<string>(() => yearKey(viewMonth.value))
const urlaubskonto = computed(() => store.urlaubskontoFor.value(urlaubsjahr.value))

// ---------------------------------------------------------------------
// Tap-to-open day detail (reuses DayDetail — full session/label editing)
// ---------------------------------------------------------------------

const selectedDate = ref<string | null>(null)

function onCloseDetail(): void {
  selectedDate.value = null
}

// ---------------------------------------------------------------------
// Marking a span as Urlaub
// ---------------------------------------------------------------------
//
// Span selection extends the existing tap-to-select rather than replacing it:
// the same day tap either opens DayDetail (normal mode) or picks an end of the
// span (span mode). Two taps bound the span — the first sets the anchor, the
// second opens the confirmation — so the same gesture works on touch, and
// tapping the anchor twice is simply a single-day span.

const spanMode = ref(false)
const spanAnchor = ref<string | null>(null)
/** The plan awaiting confirmation. Non-null ⇒ the confirmation is on screen. */
const pendingPlan = ref<UrlaubSpanPlan | null>(null)

function startSpanMode(): void {
  spanMode.value = true
  spanAnchor.value = null
  selectedDate.value = null
}

/** Leaves span mode and drops the pending plan — writing nothing at all. */
function cancelSpanMode(): void {
  spanMode.value = false
  spanAnchor.value = null
  pendingPlan.value = null
}

function onSelectDay(date: string): void {
  if (!spanMode.value) {
    selectedDate.value = date
    return
  }
  if (spanAnchor.value === null) {
    spanAnchor.value = date
    return
  }
  // Which Urlaubsjahr's Urlaubskonto a span draws on is the caller's question (the
  // module takes übrig as a number): use the year the span starts in. A span
  // crossing a year boundary is out of scope.
  const [from, to] =
    spanAnchor.value <= date ? [spanAnchor.value, date] : [date, spanAnchor.value]
  pendingPlan.value = planUrlaubSpan({
    start: from,
    end: to,
    dayMetaByDay: store.dayMetaByDay.value,
    uebrig: store.urlaubskontoFor.value(yearKey(from)).uebrig,
  })
}

/**
 * `mitGleitzeittagen` is the user's answer to the confirmation's offer, so a
 * declined offer applies the very same plan minus its candidates — the Urlaub
 * days that fit are still written, the rest stays untouched.
 */
async function onConfirmSpan(mitGleitzeittagen: boolean): Promise<void> {
  const plan = pendingPlan.value
  if (!plan) return
  await store.applyUrlaubSpanPlan(mitGleitzeittagen ? plan : ohneGleitzeittage(plan))
  cancelSpanMode()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return
  if (spanMode.value) cancelSpanMode()
  else onCloseDetail()
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
          :is-span-anchor="cell.date === spanAnchor"
          :title="cell.title"
          @select="onSelectDay"
        />
      </div>
    </section>

    <section class="card urlaubskonto-card">
      <header class="urlaubskonto-head">
        <h3>Urlaubskonto {{ urlaubsjahr }}</h3>
        <span class="muted anspruch">Anspruch: {{ formatTage(urlaubskonto.anspruch) }}</span>
      </header>
      <div class="urlaubskonto-stats">
        <StatTile
          label="Übrig"
          :value="formatTage(urlaubskonto.uebrig)"
          :tone="urlaubskonto.uebrig < 0 ? 'under' : 'default'"
        />
        <StatTile label="Verplant" :value="formatTage(urlaubskonto.verplant)" />
        <StatTile label="Genommen" :value="formatTage(urlaubskonto.genommen)" />
      </div>

      <button v-if="!spanMode" class="btn btn-block span-btn" type="button" @click="startSpanMode">
        Zeitraum als Urlaub eintragen
      </button>
      <template v-else>
        <p class="faint span-hint">
          {{ spanAnchor === null ? 'Ersten Tag antippen.' : 'Letzten Tag antippen.' }}
        </p>
        <button class="btn btn-ghost btn-block" type="button" @click="cancelSpanMode">Abbrechen</button>
      </template>
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

    <UrlaubSpanConfirm
      v-if="pendingPlan"
      :plan="pendingPlan"
      @confirm="onConfirmSpan"
      @cancel="cancelSpanMode"
    />
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

.urlaubskonto-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.urlaubskonto-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.anspruch {
  font-size: 12px;
}
.urlaubskonto-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.span-btn {
  border-style: dashed;
}
.span-hint {
  margin: 0;
  font-size: 12.5px;
  text-align: center;
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
