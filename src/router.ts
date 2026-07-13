import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from 'vue-router'
import TodayView from './screens/TodayView.vue'

// Hash history: zero server config, bulletproof for an offline PWA served as
// static files (no SPA-fallback needed).
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/heute' },
  { path: '/heute', name: 'today', component: TodayView, meta: { title: 'Heute' } },
  {
    path: '/verlauf',
    name: 'history',
    component: () => import('./screens/HistoryView.vue'),
    meta: { title: 'Verlauf' },
  },
  {
    path: '/uebersicht',
    name: 'summary',
    component: () => import('./screens/SummaryView.vue'),
    meta: { title: 'Übersicht' },
  },
  {
    path: '/kalender',
    name: 'calendar',
    component: () => import('./screens/CalendarView.vue'),
    meta: { title: 'Kalender' },
  },
  {
    path: '/einstellungen',
    name: 'settings',
    component: () => import('./screens/SettingsView.vue'),
    meta: { title: 'Einstellungen' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/heute' },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
