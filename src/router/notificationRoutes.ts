import type { RouteRecordRaw } from 'vue-router';
import { loadNotificationsView } from '@/router/route-components';

export const notificationRoutes: RouteRecordRaw[] = [
  {
    path: '/notifications',
    name: 'notifications',
    component: loadNotificationsView,
    meta: {
      navigationDepth: 0,
      requiresAuth: true,
    },
  },
];
