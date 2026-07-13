<script setup lang="ts">
// Primary navigation between the four screens (HANDOFF §4). Settings is
// reached via the gear in the app bar.
const items = [
  { to: '/heute', label: 'Heute' },
  { to: '/verlauf', label: 'Verlauf' },
  { to: '/uebersicht', label: 'Übersicht' },
  { to: '/kalender', label: 'Kalender' },
] as const
</script>

<template>
  <nav class="bottom-nav">
    <router-link
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="nav-item"
    >
      <span class="icon" aria-hidden="true">
        <!-- Heute: clock -->
        <svg v-if="item.to === '/heute'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        <!-- Verlauf: list -->
        <svg v-else-if="item.to === '/verlauf'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" /></svg>
        <!-- Übersicht: bar chart -->
        <svg v-else-if="item.to === '/uebersicht'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V10M12 21V4M19 21v-7" /></svg>
        <!-- Kalender: calendar -->
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
      </span>
      <span class="label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  max-width: var(--app-max-width);
  margin: 0 auto;
  height: calc(var(--nav-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  text-decoration: none;
  color: var(--text-faint);
  font-size: 11.5px;
  font-weight: 600;
  transition: color 0.15s var(--ease);
}
.nav-item .icon svg {
  width: 24px;
  height: 24px;
  display: block;
}
.nav-item.router-link-active {
  color: var(--accent);
}
</style>
