import { useRoute, useRouter } from 'vue-router';
import { fetchAnnouncementRecordById } from '@/services/announcements';
import { fetchIssueRecordById } from '@/services/issues';
import { getFacility } from '@/services/facilities';
import { useActionFeedback } from '@/composables/useActionFeedback';
import type { NotificationRecord } from '@/types';

export function useNotificationNavigation() {
  const route = useRoute();
  const router = useRouter();
  const { show } = useActionFeedback();
  let navigationVersion = 0;

  function commentQuery(notification: NotificationRecord) {
    const isComment = notification.type === 'announcement_comment_created' || notification.type === 'issue_comment_created';
    if (!isComment) return undefined;
    return {
      tab: 'comments',
      ...(notification.comment_id ? { comment: notification.comment_id } : {}),
    };
  }

  async function openNotificationTarget(notification: NotificationRecord) {
    const currentVersion = ++navigationVersion;
    if (notification.type === 'issue_deleted') {
      show('notification.thisProposalHasBeenDeleted', 'info');
      if (route.name !== 'notifications') {
        await router.push({ name: 'notifications' });
      }
      return false;
    }

    try {
      if (notification.target_type === 'announcement') {
        const announcement = await fetchAnnouncementRecordById(notification.target_id);
        if (currentVersion !== navigationVersion) return false;
        await router.push({
          name: 'announcement-detail',
          params: { announcementId: announcement.id },
          query: commentQuery(notification),
        });
        return true;
      }
      if (notification.target_type === 'facility') {
        const facility = await getFacility(notification.target_id);
        if (currentVersion !== navigationVersion) return false;
        await router.push({ name: 'facility-detail', params: { facilityId: facility.id } });
        return true;
      }

      const issue = await fetchIssueRecordById(notification.target_id);
      if (currentVersion !== navigationVersion) return false;
      await router.push({
        name: 'issue-detail',
        params: {
          filter: issue.category,
          issueId: issue.id,
        },
        query: commentQuery(notification),
      });
      return true;
    } catch {
      if (currentVersion === navigationVersion) {
        show('notification.thisContentDoesNotExistOrCannotBeViewed', 'error');
      }
      return false;
    }
  }

  return {
    openNotificationTarget,
  };
}
