import { computed, onMounted, ref, watch } from 'vue';
import { listFacilities, toggleFacilityAffected } from '@/services/facilities';
import type { FacilityCursor, FacilitySortOption, FacilityStatus, FacilitySummary } from '@/types';

export function useFacilities() {
  const bucket = ref<'active' | 'closed'>('active');
  const status = ref<FacilityStatus | ''>('');
  const sort = ref<FacilitySortOption>('latest');
  const query = ref('');
  const facilities = ref<FacilitySummary[]>([]);
  const cursor = ref<FacilityCursor | null>(null);
  const hasMore = ref(false);
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref('');
  let requestVersion = 0;

  async function load(append = false) {
    const version = ++requestVersion;
    (append ? loadingMore : loading).value = true;
    error.value = '';
    try {
      const result = await listFacilities({
        bucket: bucket.value, status: status.value, sort: sort.value,
        query: query.value.trim(), cursor: append ? cursor.value : null,
      });
      if (version !== requestVersion) return;
      facilities.value = append ? [...facilities.value, ...result.facilities] : result.facilities;
      cursor.value = result.cursor;
      hasMore.value = result.hasMore;
    } catch (caught) {
      if (version === requestVersion) error.value = caught instanceof Error ? caught.message : '設備載入失敗。';
    } finally {
      if (version === requestVersion) (append ? loadingMore : loading).value = false;
    }
  }

  async function toggleAffected(facility: FacilitySummary) {
    if (facility.isOwnFacility || ['completed', 'unable-to-handle'].includes(facility.status)) return;
    const result = await toggleFacilityAffected(facility.id);
    facility.currentUserAffected = result.affected;
    facility.affected_count = result.affected_count;
  }

  const statusOptions = computed(() => bucket.value === 'closed'
    ? [{ value: '', label: '全部' }, { value: 'completed', label: '已完成' }, { value: 'unable-to-handle', label: '無法處理' }]
    : [{ value: '', label: '全部' }, { value: 'pending', label: '待受理' }, { value: 'processing', label: '處理中' }]);

  let searchTimer = 0;
  watch([bucket, status, sort], () => { cursor.value = null; void load(); });
  watch(query, () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void load(), 300);
  });
  watch(bucket, () => { status.value = ''; });
  onMounted(() => void load());

  return { bucket, error, facilities, hasMore, load, loading, loadingMore, query, sort, status, statusOptions, toggleAffected };
}
