import { onScopeDispose, shallowRef } from 'vue';
import type { Router } from 'vue-router';
import type { IssueCategory } from '@/types';

type CreateIssueHandler = (category: IssueCategory) => void | Promise<void>;
type CreateAnnouncementHandler = () => void | Promise<void>;

const createIssueHandler = shallowRef<CreateIssueHandler | null>(null);
const createAnnouncementHandler = shallowRef<CreateAnnouncementHandler | null>(null);

export const CREATE_ENTRY_QUERY_KEY = 'create';
export const CREATE_ENTRY_CATEGORY_QUERY_KEY = 'category';
export const CREATE_ISSUE_QUERY_VALUE = 'issue';
export const CREATE_ANNOUNCEMENT_QUERY_VALUE = 'announcement';

export async function dispatchCreateIssue(category: IssueCategory) {
  const handler = createIssueHandler.value;
  if (!handler) return false;
  await handler(category);
  return true;
}

export async function dispatchCreateAnnouncement() {
  const handler = createAnnouncementHandler.value;
  if (!handler) return false;
  await handler();
  return true;
}

export async function requestCreateIssue(router: Router, category: IssueCategory) {
  const handled = await dispatchCreateIssue(category);
  if (handled) return;
  await router.push({
    name: 'issues',
    params: { filter: category },
    query: {
      [CREATE_ENTRY_QUERY_KEY]: CREATE_ISSUE_QUERY_VALUE,
      [CREATE_ENTRY_CATEGORY_QUERY_KEY]: category,
    },
  });
}

export async function requestCreateAnnouncement(router: Router) {
  const handled = await dispatchCreateAnnouncement();
  if (handled) return;
  await router.push({
    name: 'announcements',
    query: { [CREATE_ENTRY_QUERY_KEY]: CREATE_ANNOUNCEMENT_QUERY_VALUE },
  });
}

export function registerCreateIssueHandler(handler: CreateIssueHandler) {
  createIssueHandler.value = handler;
  onScopeDispose(() => {
    if (createIssueHandler.value === handler) {
      createIssueHandler.value = null;
    }
  });
}

export function registerCreateAnnouncementHandler(handler: CreateAnnouncementHandler) {
  createAnnouncementHandler.value = handler;
  onScopeDispose(() => {
    if (createAnnouncementHandler.value === handler) {
      createAnnouncementHandler.value = null;
    }
  });
}
