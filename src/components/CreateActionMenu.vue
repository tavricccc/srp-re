<template>
  <slot name="trigger" :open="openMenu">
    <button
      type="button"
      class="button-icon-filled !h-9 !w-9 items-center justify-center"
      title="新增"
      aria-label="新增"
      @click="openMenu"
    >
      <AppIcon name="plus" :size="4" :stroke-width="2.5" />
    </button>
  </slot>

  <DialogOverlay :open="menuOpen" padded z-index-class="z-[110]" @close="closeMenu">
    <section
      ref="dialogRef"
      class="panel panel-pad mx-auto flex w-full max-w-md flex-col gap-4"
      data-dialog-root
      tabindex="-1"
      aria-labelledby="create-action-menu-title"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold text-ink-500 dark:text-ink-400">新增</p>
          <h3 id="create-action-menu-title" class="mt-1 text-lg font-bold tracking-normal text-ink-950 dark:text-ink-50">
            選擇發布分類
          </h3>
        </div>
        <button
          type="button"
          class="button-toolbar h-9 w-9 shrink-0 rounded-full p-0"
          aria-label="關閉新增選單"
          data-autofocus
          @click="closeMenu"
        >
          <AppIcon name="close" :size="4" />
        </button>
      </div>

      <div class="grid gap-2">
        <button
          type="button"
          class="content-trigger flex w-full items-center justify-between gap-3 border-0 bg-ink-50/60 px-3 py-3 text-left shadow-note dark:bg-ink-800/40"
          :class="{ 'button-toolbar--active': selectedAction.kind === 'facility' }"
          @click="selectedAction = { kind: 'facility' }"
        >
          <span class="text-sm font-semibold text-ink-900 dark:text-ink-100">設備</span>
          <SelectionMark :selected="selectedAction.kind === 'facility'" />
        </button>
        <button
          v-for="option in issueCategoryOptions"
          :key="option.value"
          type="button"
          class="content-trigger flex w-full items-center justify-between gap-3 border-0 bg-ink-50/60 px-3 py-3 text-left shadow-note dark:bg-ink-800/40"
          :class="{ 'button-toolbar--active': selectedAction.kind === 'issue' && option.value === selectedAction.category }"
          @click="selectIssueCategory(option.value)"
        >
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">{{ option.label }}</span>
          </span>
          <SelectionMark :selected="selectedAction.kind === 'issue' && option.value === selectedAction.category" />
        </button>

        <button
          v-if="canCreateAnnouncement"
          type="button"
          class="content-trigger flex w-full items-center justify-between gap-3 border-0 bg-ink-50/60 px-3 py-3 text-left shadow-note dark:bg-ink-800/40"
          :class="{ 'button-toolbar--active': selectedAction.kind === 'announcement' }"
          @click="selectAnnouncement"
        >
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-ink-900 dark:text-ink-100">公告</span>
          </span>
          <SelectionMark :selected="selectedAction.kind === 'announcement'" />
        </button>
      </div>

      <div class="flex justify-end gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
        <button type="button" class="button-secondary px-4" @click="closeMenu">取消</button>
        <button type="button" class="button-primary px-4" @click="confirmSelection">下一步</button>
      </div>
    </section>
  </DialogOverlay>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import DialogOverlay from '@/components/ui/DialogOverlay.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import SelectionMark from '@/components/ui/SelectionMark.vue';
import { useDialogFocus } from '@/composables/useDialogFocus';
import { ISSUE_FILTER_OPTIONS } from '@/constants/categories';
import type { IssueCategory } from '@/types';

type CreateActionSelection =
  | { kind: 'issue'; category: IssueCategory }
  | { kind: 'facility' }
  | { kind: 'announcement' };

const props = defineProps<{
  canCreateAnnouncement?: boolean;
  defaultCategory: IssueCategory;
  defaultKind?: CreateActionSelection['kind'];
}>();

const emit = defineEmits<{
  createAnnouncement: [];
  createFacility: [];
  createIssue: [category: IssueCategory];
}>();

const issueCategoryOptions = ISSUE_FILTER_OPTIONS;
const menuOpen = ref(false);
const selectedAction = ref<CreateActionSelection>({
  kind: 'issue',
  category: props.defaultCategory,
});
const { dialogRef } = useDialogFocus(menuOpen, {
  onClose: closeMenu,
});

function openMenu() {
  selectedAction.value = getDefaultAction();
  menuOpen.value = true;
}

function closeMenu() {
  menuOpen.value = false;
}

function selectIssueCategory(category: IssueCategory) {
  selectedAction.value = {
    kind: 'issue',
    category,
  };
}

function selectAnnouncement() {
  selectedAction.value = { kind: 'announcement' };
}

function getDefaultAction(): CreateActionSelection {
  if (props.defaultKind === 'facility') return { kind: 'facility' };
  if (props.defaultKind === 'announcement' && props.canCreateAnnouncement) {
    return { kind: 'announcement' };
  }

  return {
    kind: 'issue',
    category: props.defaultCategory,
  };
}

function confirmSelection() {
  const action = selectedAction.value;
  menuOpen.value = false;
  if (action.kind === 'announcement') {
    emit('createAnnouncement');
    return;
  }
  if (action.kind === 'facility') {
    emit('createFacility');
    return;
  }
  emit('createIssue', action.category);
}

watch(
  () => [props.defaultCategory, props.defaultKind, props.canCreateAnnouncement] as const,
  () => {
    if (!menuOpen.value) {
      selectedAction.value = getDefaultAction();
    }
  },
);

</script>
