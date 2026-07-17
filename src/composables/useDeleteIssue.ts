import { ref, unref, type MaybeRef } from 'vue';
import { deleteIssue } from '@/services/issues';
import { useActionFeedback } from '@/composables/useActionFeedback';

export function useDeleteIssue(issueId: MaybeRef<string>) {
  const { start } = useActionFeedback();
  const isDeleteDialogOpen = ref(false);
  const isDeleting = ref(false);
  const actionError = ref('');
  const actionMessage = ref('');

  function confirmDelete() {
    actionError.value = '';
    actionMessage.value = '';
    isDeleteDialogOpen.value = true;
  }

  function closeDeleteDialog() {
    if (isDeleting.value) {
      return;
    }
    isDeleteDialogOpen.value = false;
  }

  async function performDelete() {
    isDeleting.value = true;
    const targetIssueId = unref(issueId);
    const feedbackHandle = start('issue.deletingProposal');

    try {
      const result = await deleteIssue(targetIssueId);
      isDeleteDialogOpen.value = false;
      feedbackHandle.succeed('issue.proposalDeleted');
      return result.issueId;
    } catch {
      actionError.value = 'facility.deletionFailedPleaseTryAgainLater';
      feedbackHandle.fail(actionError.value);
      return '';
    } finally {
      isDeleting.value = false;
    }
  }

  return {
    isDeleteDialogOpen,
    isDeleting,
    actionError,
    actionMessage,
    confirmDelete,
    closeDeleteDialog,
    performDelete,
  };
}
