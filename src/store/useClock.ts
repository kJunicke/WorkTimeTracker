// Shared ticking clock (CLAUDE.md store/useClock.ts contract).
// A single module-level `now` ref, updated by a single `setInterval`, drives
// every live timer / live total in the app. Framework-adjacent (uses Vue's
// `ref`) but deliberately tiny and dependency-free otherwise.

import { ref } from 'vue'
import type { Ref } from 'vue'

const now = ref(Date.now())
let intervalId: ReturnType<typeof setInterval> | undefined

/** Starts the single shared interval on first use; safe to call repeatedly. */
function ensureTicking(): void {
  if (intervalId !== undefined) return
  intervalId = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

/** Shared ticking clock. Lazily starts one 1s interval on first call; never more than one. */
export function useClock(): { now: Ref<number> } {
  ensureTicking()
  return { now }
}
