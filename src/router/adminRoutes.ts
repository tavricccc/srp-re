import type { RouteRecordRaw } from 'vue-router';
import { loadAdministrationView, loadDashboardView, loadSetupView } from '@/router/route-components';

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/setup', name: 'setup', component: loadSetupView,
    meta: { navigationDepth: 0, requiresAuth: true, setupAllowed: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: loadDashboardView,
    meta: { navigationDepth: 1, requiresAuth: true, requiredPermission: 'dashboard.view' },
  },
  {
    path: '/admin/management', name: 'administration', component: loadAdministrationView,
    meta: { navigationDepth: 1, requiresAuth: true, requiredPermission: 'role.manage' },
  },
  {
    path: '/admin/access', name: 'access-management',
    redirect: (to) => ({ name: 'administration', query: { ...to.query, tab: 'members' } }),
    meta: { requiresAuth: true, requiredPermission: 'role.manage' },
  },
  {
    path: '/admin/categories', name: 'category-management',
    redirect: (to) => ({ name: 'administration', query: { ...to.query, tab: 'categories' } }),
    meta: { requiresAuth: true, requiredPermission: 'category.manage' },
  },
];
