<template>
  <EntryComposerShell
    v-model:entry-title="title"
    v-model:content="content"
    v-model:show-preview="showPreview"
    :open="open"
    eyebrow="announcement.postNewCampusAnnouncements"
    title="announcement.announcementContent"
    title-input-id="announcement-title"
    title-label="announcement.announcementTitle"
    :title-max-length="INPUT_LIMITS.title"
    :title-warning-length="27"
    title-placeholder="announcement.pleaseEnterTheAnnouncementTitle"
    title-required
    editor-textarea-id="announcement-content"
    editor-label="announcement.contentDescription"
    editor-placeholder="announcement.enterAnnouncementDetailsHere"
    :images="editorImages"
    :max-images="maxImages"
    max-images-label="announcement.announcement"
    hint="announcement.announcementsWillBePostedToAllUsersImmediately"
    submit-label="announcement.publishAnnouncement"
    :busy="submitting"
    :uploading="uploading"
    :error="error || uploadError"
    :submit-disabled="!title.trim() || (!content.trim() && editorImages.length === 0)"
    @close="handleClose"
    @image-picked="handleEditorImagePicked"
    @remove-image="removeEditorImage"
    @submit="submit"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import EntryComposerShell from '@/components/ui/EntryComposerShell.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { RATE_LIMITS } from '@/generated/rate-limits';
import { useMarkdownImageUpload } from '@/composables/useMarkdownImageUpload';
import type { UploadedImage } from '@/composables/useImageUpload';
import { useI18n } from '@/i18n';

const props = defineProps<{
  error: string;
  open: boolean;
  submitting: boolean;
}>();

const emit = defineEmits<{
  close: [];
  save: [payload: { title: string; content: string; uploadedImages: UploadedImage[] }];
}>();
const { t } = useI18n();

const title = ref('');
const content = ref('');
const showPreview = ref(false);
const maxImages = RATE_LIMITS.imageUploads.announcementMaxImages;
const {
  handleImagePicked,
  imageUrls,
  removeImage,
  resetImages,
  uploadError,
  uploadImagesAndBuildContent,
  uploading,
} = useMarkdownImageUpload(content, {
  getRemainingSlots: () => maxImages - editorImages.value.length,
  maxImages,
});

const editorImages = computed(() =>
  imageUrls.value.map((src, index) => ({
    alt: t('announcement.announcementAttachmentPreview'),
    index,
    key: `new:${src}:${index}`,
    src,
  })),
);

watch(
  () => props.open,
  (open) => {
    if (!open) {
      resetImages();
      return;
    }
    title.value = '';
    content.value = '';
    resetImages();
    showPreview.value = false;
  },
  { immediate: true },
);

function buildMarkdownImage(image: { url: string; width?: number; height?: number }) {
  const size = image.width && image.height ? `|${image.width}x${image.height}` : '';
  return `![image${size}](${image.url})`;
}

function buildAnnouncementContent(uploadedImages: UploadedImage[]) {
  const text = content.value.trimEnd();
  const images = uploadedImages.map(buildMarkdownImage).join('\n');
  if (!images) return text;
  return text ? `${text}\n\n${images}` : images;
}

function removeEditorImage(key: string) {
  const image = editorImages.value.find((candidate) => candidate.key === key);
  if (image) void removeImage(image.index);
}

function handleClose() {
  if (props.submitting || uploading.value) return;
  resetImages();
  emit('close');
}

function handleEditorImagePicked(event: Event) {
  const target = event.target as HTMLInputElement;
  if (editorImages.value.length >= maxImages) {
    uploadError.value = t('upload.imageLimit', { count: maxImages });
    target.value = '';
    return;
  }
  void handleImagePicked(event);
}

async function submit() {
  const uploadResult = await uploadImagesAndBuildContent();
  emit('save', {
    title: title.value.trim(),
    content: buildAnnouncementContent(uploadResult.uploadedImages),
    uploadedImages: uploadResult.uploadedImages,
  });
}
</script>
