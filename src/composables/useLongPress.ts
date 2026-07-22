import { onBeforeUnmount, type Ref } from 'vue';

const HOLD_DURATION_MS = 500;
const MOVE_TOLERANCE_PX = 10;

export function useLongPress(options: {
  enabled: Ref<boolean>;
  onLongPress: () => void;
}) {
  let timer = 0;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let triggered = false;

  function cancel() {
    window.clearTimeout(timer);
    timer = 0;
    pointerId = null;
  }

  function onPointerDown(event: PointerEvent) {
    if (!options.enabled.value || event.button !== 0 || event.pointerType === 'mouse') return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    triggered = false;
    timer = window.setTimeout(() => {
      triggered = true;
      options.onLongPress();
    }, HOLD_DURATION_MS);
  }

  function onPointerMove(event: PointerEvent) {
    if (pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_TOLERANCE_PX) cancel();
  }

  function consumeClick(event: MouseEvent) {
    if (!triggered) return false;
    event.preventDefault();
    event.stopPropagation();
    triggered = false;
    return true;
  }

  onBeforeUnmount(cancel);
  return { cancel, consumeClick, onPointerDown, onPointerMove };
}
