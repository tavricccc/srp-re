import { useActionFeedback } from '@/composables/useActionFeedback';
import { useRouter, type RouteLocationRaw } from 'vue-router';

function copyWithTextarea(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('copy failed');
  }
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  copyWithTextarea(text);
}

export function useShareUrl() {
  const { show } = useActionFeedback();
  const router = useRouter();

  async function copyShareUrl(url: string) {
    try {
      await copyText(url);
      show('common.sharingLinkCopied', 'success');
      return true;
    } catch {
      show('common.unableToCopyLinkPleaseTryAgainLater', 'error');
      return false;
    }
  }

  function copyRouteUrl(location: RouteLocationRaw) {
    const href = router.resolve(location).href;
    return copyShareUrl(new URL(href, window.location.origin).toString());
  }

  return {
    copyRouteUrl,
    copyShareUrl,
  };
}
