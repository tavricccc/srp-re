import type { RouteRecordRaw } from 'vue-router';
import { loadFacilitiesView, loadFacilityDetailView } from '@/router/route-components';

export const facilityRoutes: RouteRecordRaw[] = [
  { path: '/facilities', name: 'facilities', component: loadFacilitiesView, meta: { requiresAuth: true } },
  { path: '/facilities/:facilityId', name: 'facility-detail', component: loadFacilityDetailView, meta: { requiresAuth: true } },
];
