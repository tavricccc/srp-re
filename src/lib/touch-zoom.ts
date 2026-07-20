const DOUBLE_TAP_WINDOW_MS = 320;
const DOUBLE_TAP_DISTANCE_PX = 28;

function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function preventDoubleTapZoom() {
  let previousTouch: { at: number; target: EventTarget | null; x: number; y: number } | null = null;
  document.addEventListener('touchend', (event) => {
    if (event.changedTouches.length !== 1 || isEditableTarget(event.target)) {
      previousTouch = null;
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    const now = performance.now();
    const isDoubleTap = previousTouch
      && previousTouch.target === event.target
      && now - previousTouch.at <= DOUBLE_TAP_WINDOW_MS
      && Math.hypot(touch.clientX - previousTouch.x, touch.clientY - previousTouch.y) <= DOUBLE_TAP_DISTANCE_PX;
    if (isDoubleTap) event.preventDefault();
    previousTouch = { at: now, target: event.target, x: touch.clientX, y: touch.clientY };
  }, { passive: false });
}
