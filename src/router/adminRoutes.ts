import type { RouteRecordRaw } from 'vue-router';
import { loadAccessManagementView, loadDashboardView } from '@/router/route-components';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    name: 'dashboard',
    component: loadDashboardView,
    meta: { requiresAuth: true, requiredPermission: 'dashboard.view' },
  },
  {
    path: '/admin/access', name: 'access-management', component: loadAccessManagementView,
    meta: { requiresAuth: true, requiredPermission: 'role.manage' },
  },
];
