<template>
  <DropdownPanel class="absolute top-1.5 left-1/2 z-[120] w-44 shrink-0 -translate-x-1/2 select-none md:left-[180px] md:translate-x-0" size="default">
    <p class="text-[10px] font-bold text-ink-500 dark:text-ink-400 mb-2 text-center whitespace-nowrap">
      {{ hoveredRow >= 0
        ? t('markdown.createTable', { rows: hoveredRow + 1, columns: hoveredCol + 1 })
        : t('markdown.selectTableSize') }}
    </p>
    <div
      ref="gridRef"
      role="grid"
      :aria-label="t('markdown.selectTableSize')"
      :aria-rowcount="GRID_SIZE"
      :aria-colcount="GRID_SIZE"
      class="space-y-1.5"
      @focusout="handleGridFocusOut"
      @mouseleave="resetTableHover"
    >
      <div
        v-for="r in GRID_SIZE"
        :key="`row-${r}`"
        role="row"
        class="grid grid-cols-5 gap-1.5"
      >
        <div
          v-for="c in GRID_SIZE"
          :key="`col-${c}`"
          role="gridcell"
        >
          <button
            type="button"
            data-table-grid-cell
            class="h-6 w-6 rounded border transition-colors duration-150"
            :class="isCellSelected(r - 1, c - 1) ? 'bg-ink-900 border-ink-900 dark:bg-ink-100 dark:border-ink-100' : 'border-ink-200 dark:border-ink-700 bg-ink-50/50 hover:bg-ink-100 dark:bg-ink-950/50'"
            :aria-label="t('markdown.createTable', { rows: r, columns: c })"
            :tabindex="cellIndex(r - 1, c - 1) === focusedIndex ? 0 : -1"
            @mouseenter="hoverCell(r - 1, c - 1)"
            @focus="focusCell(r - 1, c - 1)"
            @keydown="handleCellKeydown($event, r - 1, c - 1)"
            @click="selectCell(r, c)"
          ></button>
        </div>
      </div>
    </div>
  </DropdownPanel>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import DropdownPanel from '@/components/ui/molecules/DropdownPanel.vue';
import { useI18n } from '@/i18n';

const GRID_SIZE = 5;

const emit = defineEmits<{
  'select': [rows: number, cols: number];
}>();
const { t } = useI18n();

const hoveredRow = ref(-1);
const hoveredCol = ref(-1);
const focusedIndex = ref(0);
const gridRef = useTemplateRef<HTMLElement>('gridRef');

function cellIndex(row: number, column: number) {
  return row * GRID_SIZE + column;
}

function hoverCell(r: number, c: number) {
  hoveredRow.value = r;
  hoveredCol.value = c;
}

function focusCell(row: number, column: number) {
  focusedIndex.value = cellIndex(row, column);
  hoverCell(row, column);
}

function focusCellAt(index: number) {
  const boundedIndex = Math.min(Math.max(index, 0), GRID_SIZE * GRID_SIZE - 1);
  focusedIndex.value = boundedIndex;
  const row = Math.floor(boundedIndex / GRID_SIZE);
  const column = boundedIndex % GRID_SIZE;
  hoverCell(row, column);
  gridRef.value
    ?.querySelectorAll<HTMLButtonElement>('[data-table-grid-cell]')
    .item(boundedIndex)
    .focus();
}

function resetTableHover() {
  if (gridRef.value?.contains(document.activeElement)) return;
  hoveredRow.value = -1;
  hoveredCol.value = -1;
}

function handleGridFocusOut(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && gridRef.value?.contains(event.relatedTarget)) return;
  hoveredRow.value = -1;
  hoveredCol.value = -1;
}

function handleCellKeydown(event: KeyboardEvent, row: number, column: number) {
  const currentIndex = cellIndex(row, column);
  let nextIndex: number | null = null;

  if (event.key === 'ArrowLeft') nextIndex = cellIndex(row, Math.max(column - 1, 0));
  else if (event.key === 'ArrowRight') nextIndex = cellIndex(row, Math.min(column + 1, GRID_SIZE - 1));
  else if (event.key === 'ArrowUp') nextIndex = cellIndex(Math.max(row - 1, 0), column);
  else if (event.key === 'ArrowDown') nextIndex = cellIndex(Math.min(row + 1, GRID_SIZE - 1), column);
  else if (event.key === 'Home') nextIndex = event.ctrlKey ? 0 : cellIndex(row, 0);
  else if (event.key === 'End') nextIndex = event.ctrlKey
    ? GRID_SIZE * GRID_SIZE - 1
    : cellIndex(row, GRID_SIZE - 1);
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectCell(row + 1, column + 1);
    return;
  }

  if (nextIndex === null || nextIndex === currentIndex) return;
  event.preventDefault();
  focusCellAt(nextIndex);
}

function isCellSelected(r: number, c: number) {
  if (hoveredRow.value === -1 || hoveredCol.value === -1) return false;
  return r <= hoveredRow.value && c <= hoveredCol.value;
}

function selectCell(r: number, c: number) {
  emit('select', r, c);
}

onMounted(() => {
  window.requestAnimationFrame(() => {
    if (gridRef.value?.offsetParent !== null) focusCellAt(0);
  });
});
</script>
