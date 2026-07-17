<template>
  <EntryComposerShell
    v-model:entry-title="form.title"
    v-model:location="form.location"
    v-model:content="form.content"
    v-model:show-preview="showPreview"
    :open="open"
    eyebrow="facility.reportAFacilityIssue"
    title="facility.addFacilityReport"
    title-input-id="facility-title"
    title-label="facility.questionTitle"
    :title-max-length="INPUT_LIMITS.title"
    :title-warning-length="27"
    title-placeholder="facility.brieflyDescribeTheFacilityIssue"
    location-input-id="facility-location"
    location-label="facility.place"
    :location-max-length="INPUT_LIMITS.facilityLocation"
    :location-warning-length="108"
    location-placeholder="facility.forExampleClassroom301OnThe3RdFloorOfTheTeachingBuilding"
    editor-textarea-id="facility-content"
    editor-label="common.detailedDescription"
    editor-placeholder="facility.describeTheCurrentSituation"
    :images="editorImages"
    :max-images="RATE_LIMITS.imageUploads.facilityMaxImages"
    max-images-label="facility.facility"
    hint="facility.pleaseConfirmTheLocationAndDescriptionOfTheProblemBeforeSendingIt"
    submit-label="common.confirmPublish"
    :busy="submitting"
    :uploading="images.uploading.value"
    :error="error || images.uploadError.value"
    @close="close"
    @image-picked="images.handleImagePicked"
    @remove-image="removeImage"
    @submit="submit"
  />
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import EntryComposerShell from '@/components/ui/EntryComposerShell.vue';
import { INPUT_LIMITS } from '@/constants/input-limits';
import { RATE_LIMITS } from '@/generated/rate-limits';
import { useFacilityComposerForm } from '@/composables/useFacilityComposerForm';
import type { FacilityRecord } from '@/types';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; submitted: [facility: FacilityRecord] }>();
const { editorImages, error, form, images, showPreview, submitting, close, submit } = useFacilityComposerForm(
  toRef(props, 'open'),
  () => emit('close'),
  (facility) => emit('submitted', facility),
);

function removeImage(key: string) {
  const index = editorImages.value.findIndex((image) => image.key === key);
  if (index >= 0) void images.removeImage(index);
}
</script>
