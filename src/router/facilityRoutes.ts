import type { RouteRecordRaw } from 'vue-router';
import { loadFacilitiesView, loadFacilityDetailView } from '@/router/route-components';

export const facilityRoutes: RouteRecordRaw[] = [
  { path: '/facilities', name: 'facilities', component: loadFacilitiesView, meta: { navigationDepth: 0, requiresAuth: true } },
  { path: '/facilities/:facilityId', name: 'facility-detail', component: loadFacilityDetailView, meta: { navigationDepth: 1, requiresAuth: true } },
];
