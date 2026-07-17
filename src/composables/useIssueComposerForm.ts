import { reactive, ref, toRef, watch, type Ref } from 'vue';
import { useMarkdownImageUpload } from '@/composables/useMarkdownImageUpload';
import { useSession } from '@/composables/useSession';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { createIssue } from '@/services/issues';
import type { IssueRecord, WritableIssueCategory } from '@/types';
import { RATE_LIMITS } from '@/generated/rate-limits';

interface IssueComposerFormOptions {
  category: Ref<WritableIssueCategory>;
  onClose: () => void;
  onSubmitted: (issue: IssueRecord) => void;
}

export function useIssueComposerForm(open: Ref<boolean>, options: IssueComposerFormOptions) {
  const { user } = useSession();
  const { show, start } = useActionFeedback();
  const form = reactive({
    title: '',
    content: '',
  });
  const {
    handleImagePicked,
    contentWithImages,
    deleteUploadedImages,
    discardImages,
    imageUrls,
    removeImage,
    resetImages,
    uploadError,
    uploadImagesAndBuildContent,
    uploading,
  } = useMarkdownImageUpload(toRef(form, 'content'), {
    maxImages: RATE_LIMITS.imageUploads.issueMaxImages,
  });

  const submitting = ref(false);
  const showPreview = ref(false);
  const error = ref('');

  watch(open, (isOpen) => {
    if (!isOpen) {
      resetForm();
    }
  });

  function resetForm() {
    form.title = '';
    form.content = '';
    resetImages();
    showPreview.value = false;
    error.value = '';
  }

  async function handleClose() {
    if (submitting.value || uploading.value) {
      return;
    }

    try {
      await discardImages();
      options.onClose();
    } catch {
      uploadError.value = 'comments.imageDeletionFailedPleaseTryAgainLater';
      show(uploadError.value, 'error');
    }
  }

  async function submit() {
    if (!user.value?.email || !user.value.displayName) {
      error.value = 'auth.fullSchoolGoogleAccountRequired';
      show(error.value, 'error');
      return;
    }

    if (form.title.trim().length === 0) {
      error.value = 'issue.pleaseEnterAProposalTitle';
      show(error.value, 'error');
      return;
    }

    if (!contentWithImages.value.trim()) {
      error.value = 'issue.pleaseEnterProposalContentOrAddImages';
      show(error.value, 'error');
      return;
    }

    submitting.value = true;
    const feedbackHandle = start('issue.sendingProposal');
    let uploadedImages: Awaited<ReturnType<typeof uploadImagesAndBuildContent>>['uploadedImages'] = [];

    try {
      if (imageUrls.value.length > 0) feedbackHandle.update('facility.uploadingImages');
      const uploadResult = await uploadImagesAndBuildContent();
      uploadedImages = uploadResult.uploadedImages;
      feedbackHandle.update('issue.buildingProposal');

      const issue = await createIssue({
        title: form.title,
        content: uploadResult.content,
        category: options.category.value,
      });

      resetForm();
      options.onSubmitted(issue);
      options.onClose();
      feedbackHandle.succeed('issue.proposalHasBeenSent');
    } catch (caught) {
      if (uploadedImages.length) {
        await deleteUploadedImages(uploadedImages);
      }
      error.value = caught instanceof Error ? caught.message : 'issue.sendingFailedPleaseTryAgainLater';
      feedbackHandle.fail(error.value);
    } finally {
      submitting.value = false;
    }
  }

  return {
    form,
    handleImagePicked,
    contentWithImages,
    imageUrls,
    removeImage,
    uploadError,
    uploading,
    submitting,
    showPreview,
    error,
    handleClose,
    submit,
  };
}
