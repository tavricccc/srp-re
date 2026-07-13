import { onBeforeUnmount, onMounted, ref } from 'vue';

const COMPACT_TABLE_MAX_WIDTH = 74 * 16;

export function useCompactTableLayout() {
  const tableRef = ref<HTMLElement | null>(null);
  const isCompactLayout = ref(true);
  let resizeObserver: ResizeObserver | null = null;

  function updateLayout(width: number) {
    isCompactLayout.value = width <= COMPACT_TABLE_MAX_WIDTH;
  }

  onMounted(() => {
    const table = tableRef.value;
    if (!table) return;

    updateLayout(table.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;

    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) updateLayout(entry.contentRect.width);
    });
    resizeObserver.observe(table);
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
  });

  return {
    isCompactLayout,
    tableRef,
  };
}
