import type { AnnouncementRecord, AnnouncementSortOption } from '@/types';

function dateValue(value: Date | null | undefined) {
  return value?.getTime() ?? 0;
}

export function sortAnnouncements(
  announcements: AnnouncementRecord[],
  sortOption: AnnouncementSortOption,
) {
  return [...announcements].sort((left, right) => {
    if (sortOption === 'most-liked') {
      const likeDifference = right.like_count - left.like_count;
      if (likeDifference !== 0) return likeDifference;
    }
    if (sortOption === 'most-commented') {
      const commentDifference = right.comment_count - left.comment_count;
      if (commentDifference !== 0) return commentDifference;
    }
    const publishedDifference = dateValue(right.published_at) - dateValue(left.published_at);
    return publishedDifference || right.id.localeCompare(left.id);
  });
}
