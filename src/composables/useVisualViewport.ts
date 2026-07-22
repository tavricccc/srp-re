import { onBeforeUnmount, onMounted } from 'vue';

export function useVisualViewport() {
  function sync() {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty('--visual-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
    document.documentElement.style.setProperty('--visual-viewport-offset-top', `${viewport?.offsetTop ?? 0}px`);
  }

  onMounted(() => {
    sync();
    window.visualViewport?.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
  });
  onBeforeUnmount(() => {
    window.visualViewport?.removeEventListener('resize', sync);
    window.visualViewport?.removeEventListener('scroll', sync);
    window.removeEventListener('resize', sync);
  });
}
