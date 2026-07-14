import type { RouteLocationRaw } from 'vue-router';
import type { AppIconName } from '@/components/ui/AppIcon.vue';

export interface AppNavigationItem {
  icon: AppIconName;
  isActive: boolean;
  key: string;
  label: string;
  to: RouteLocationRaw;
}
