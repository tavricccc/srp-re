import type { RouteRecordRaw } from 'vue-router';
import { loadAnnouncementDetailView, loadAnnouncementsView } from '@/router/route-components';

export const announcementRoutes: RouteRecordRaw[] = [
  {
    path: '/announcements',
    name: 'announcements',
    component: loadAnnouncementsView,
    meta: { navigationDepth: 0, requiresAuth: true },
  },
  {
    path: '/announcements/:announcementId',
    name: 'announcement-detail',
    component: loadAnnouncementDetailView,
    meta: { navigationDepth: 1, requiresAuth: true },
  },
];
