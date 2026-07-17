<template>
  <div class="h-4 w-px bg-ink-200 dark:bg-ink-700 mx-1 shrink-0"></div>
  <button
    type="button"
    class="button-toolbar shrink-0"
    :disabled="disabled"
    :title="buttonTitle"
    :aria-label="t('comments.insertImage')"
    @click="emit('pick-image')"
  >
    <AppIcon name="image" />
  </button>
  <span v-if="uploading" class="text-xs text-ink-400 select-none shrink-0 ml-1">{{ busyLabel }}</span>
  <span v-else class="text-xs text-ink-400 select-none shrink-0 ml-1">{{ imageCount }} / {{ maxImages }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import { useI18n } from '@/i18n';

const props = defineProps<{
  busyLabel: string;
  disabled: boolean;
  imageCount: number;
  maxImages: number;
  maxImagesLabel: string;
  uploading: boolean;
}>();

const emit = defineEmits<{
  'pick-image': [];
}>();
const { t } = useI18n();

const buttonTitle = computed(() => {
  if (props.uploading) return t('comments.imageProcessing');
  if (props.imageCount >= props.maxImages) {
    return `${t(props.maxImagesLabel)}${t('upload.imageLimit', { count: props.maxImages })}`;
  }
  return t('comments.addImage');
});
</script>
