<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import { useStore } from './store/useStore'

const route = useRoute()
const title = computed(() => (route.meta.title as string) ?? 'Arbeitszeit')
const onSettings = computed(() => route.name === 'settings')

const { ready, init } = useStore()

// Reconciliation (HANDOFF §3.3) must run "before rendering normal UI", so the
// whole chrome (app bar + BottomNav) waits behind the `ready` gate below, not
// just the router-view.
onMounted(() => {
  init()
})
</script>

<template>
  <div class="app-shell">
    <template v-if="ready">
      <header class="app-bar">
        <h1 class="app-title">{{ title }}</h1>
        <router-link
          to="/einstellungen"
          class="gear"
          :class="{ active: onSettings }"
          aria-label="Einstellungen"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </router-link>
      </header>

      <main class="app-main">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </main>

      <BottomNav />
    </template>

    <div v-else class="splash">
      <div class="splash-inner">
        <h1 class="splash-title">Arbeitszeit</h1>
        <div class="spinner" aria-hidden="true" />
        <p class="muted">Wird geladen …</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  max-width: var(--app-max-width);
  margin: 0 auto;
  min-height: 100dvh;
  background: var(--bg);
}

.app-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  height: calc(var(--appbar-height) + env(safe-area-inset-top));
  padding: env(safe-area-inset-top) 16px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: var(--app-max-width);
  margin: 0 auto;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  backdrop-filter: saturate(1.4) blur(10px);
  border-bottom: 1px solid var(--border);
}

.app-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.gear {
  margin-left: auto;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  text-decoration: none;
}
.gear.active {
  color: var(--accent);
  background: var(--accent-weak);
}

.app-main {
  padding-top: calc(var(--appbar-height) + env(safe-area-inset-top) + 8px);
  padding-bottom: calc(var(--nav-height) + env(safe-area-inset-bottom) + 12px);
  padding-left: 14px;
  padding-right: 14px;
  min-height: 100dvh;
}

.splash {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.splash-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}
.splash-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent-strong);
  letter-spacing: -0.01em;
}
.spinner {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid var(--accent-weak-2);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
