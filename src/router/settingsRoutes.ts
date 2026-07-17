import type { RouteRecordRaw } from 'vue-router';
import { loadSettingsView } from '@/router/route-components';

export const settingsRoutes: RouteRecordRaw[] = [
  {
    path: '/settings',
    name: 'settings',
    component: loadSettingsView,
    meta: {
      navigationDepth: 0,
      requiresAuth: true,
    },
  },
];
