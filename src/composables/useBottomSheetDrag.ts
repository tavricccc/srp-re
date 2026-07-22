import { computed, onBeforeUnmount, ref, type Ref } from 'vue';

const CLOSE_DISTANCE_RATIO = 0.28;
const CLOSE_VELOCITY = 0.65;

export function useBottomSheetDrag(options: {
  disabled: Ref<boolean>;
  onClose: () => void;
  surface: Ref<HTMLElement | null>;
}) {
  const offset = ref(0);
  const dragging = ref(false);
  let activePointerId: number | null = null;
  let startY = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;

  const style = computed(() => ({
    '--sheet-drag-offset': `${offset.value}px`,
    '--sheet-drag-progress': String(Math.min(1, offset.value / Math.max(1, options.surface.value?.offsetHeight ?? 1))),
  }));

  function reset() {
    activePointerId = null;
    dragging.value = false;
    offset.value = 0;
    velocity = 0;
  }

  function onPointerDown(event: PointerEvent) {
    if (options.disabled.value || event.button !== 0) return;
    activePointerId = event.pointerId;
    startY = event.clientY;
    lastY = event.clientY;
    lastTime = event.timeStamp;
    velocity = 0;
    dragging.value = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (activePointerId !== event.pointerId || !dragging.value) return;
    const nextOffset = Math.max(0, event.clientY - startY);
    const elapsed = Math.max(1, event.timeStamp - lastTime);
    velocity = (event.clientY - lastY) / elapsed;
    lastY = event.clientY;
    lastTime = event.timeStamp;
    offset.value = nextOffset;
  }

  function finish(event: PointerEvent) {
    if (activePointerId !== event.pointerId) return;
    const height = Math.max(1, options.surface.value?.offsetHeight ?? 1);
    const shouldClose = offset.value >= height * CLOSE_DISTANCE_RATIO || velocity >= CLOSE_VELOCITY;
    reset();
    if (shouldClose && !options.disabled.value) options.onClose();
  }

  function onPointerCancel(event: PointerEvent) {
    if (activePointerId === event.pointerId) reset();
  }

  onBeforeUnmount(reset);

  return {
    dragging,
    onPointerCancel,
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    style,
  };
}
