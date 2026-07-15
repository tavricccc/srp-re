import { computed, onMounted, onScopeDispose, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { deleteFacility, getFacility, toggleFacilityAffected, updateFacilityStatus } from '@/services/facilities';
import type { FacilityStatus } from '@/types';
import { subscribeContentRevisionChanges } from '@/services/content-revisions';

export function useFacilityDetail() {
  const route = useRoute();
  const router = useRouter();
  const facility = ref<Awaited<ReturnType<typeof getFacility>> | null>(null);
  const loading = ref(true);
  const error = ref('');
  const facilityId = computed(() => String(route.params.facilityId ?? ''));

  async function load() {
    loading.value = true; error.value = '';
    try { facility.value = await getFacility(facilityId.value); }
    catch (caught) { error.value = caught instanceof Error ? caught.message : '設備載入失敗。'; }
    finally { loading.value = false; }
  }
  async function toggleAffected() {
    if (!facility.value || facility.value.isOwnFacility) return;
    const result = await toggleFacilityAffected(facility.value.id);
    facility.value.currentUserAffected = result.affected;
    facility.value.affected_count = result.affected_count;
  }
  async function changeStatus(status: FacilityStatus, resultContent?: string) {
    if (!facility.value) return;
    facility.value = await updateFacilityStatus(facility.value.id, status, resultContent);
  }
  async function remove() {
    if (!facility.value) return;
    await deleteFacility(facility.value.id);
    await router.push({ name: 'facilities' });
  }
  const unsubscribeRevision = subscribeContentRevisionChanges('facilities', load);
  onMounted(() => void load());
  onScopeDispose(unsubscribeRevision);
  return { changeStatus, error, facility, loading, remove, toggleAffected };
}
