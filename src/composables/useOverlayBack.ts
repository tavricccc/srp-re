import { onBeforeUnmount, watch, type Ref } from 'vue';

const OVERLAY_STATE_KEY = '__novaeOverlay';
let nextOverlayId = 0;
const stack: Array<{ close: () => void; id: number }> = [];
let suppressNextPop = false;

function handlePopState() {
  if (suppressNextPop) {
    suppressNextPop = false;
    return;
  }
  stack.at(-1)?.close();
}

if (typeof window !== 'undefined') window.addEventListener('popstate', handlePopState);

export function useOverlayBack(open: Ref<boolean>, close: () => void) {
  const id = ++nextOverlayId;
  let registered = false;

  function register() {
    if (registered || typeof window === 'undefined') return;
    registered = true;
    stack.push({ close, id });
    window.history.pushState({ ...window.history.state, [OVERLAY_STATE_KEY]: id }, '');
  }

  function unregister() {
    if (!registered || typeof window === 'undefined') return;
    registered = false;
    const index = stack.findIndex((entry) => entry.id === id);
    if (index >= 0) stack.splice(index, 1);
    if (window.history.state?.[OVERLAY_STATE_KEY] === id) {
      suppressNextPop = true;
      window.history.back();
    }
  }

  watch(open, (nextOpen) => nextOpen ? register() : unregister(), { immediate: true });
  onBeforeUnmount(unregister);
}
