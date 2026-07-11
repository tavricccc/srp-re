import { onBeforeUnmount, watch, type MaybeRefOrGetter, type Ref, toValue } from 'vue';

type ClickOutsideTarget = Ref<HTMLElement | null | undefined> | (() => HTMLElement | null | undefined);

export interface UseClickOutsideOptions {
  /** Listen only while active is true (default true). */
  whileActiveOnly?: boolean;
  /** Also close on Escape (default false). */
  escape?: boolean;
  /** Event type for outside detection (default 'click'). */
  event?: 'click' | 'pointerdown';
}

/**
 * Close a floating panel when the user interacts outside the given targets.
 * - With targets: closes when the event target is outside all of them (Teleport-safe).
 * - Without targets: closes on any event that reaches window (panels should @click.stop).
 */
export function useClickOutside(
  active: MaybeRefOrGetter<boolean>,
  targets: ClickOutsideTarget[],
  onOutside: () => void,
  options: UseClickOutsideOptions = {},
) {
  const whileActiveOnly = options.whileActiveOnly !== false;
  const escape = options.escape === true;
  const eventName = options.event ?? 'click';

  function resolveTargets() {
    return targets
      .map((target) => (typeof target === 'function' ? target() : target.value))
      .filter((node): node is HTMLElement => Boolean(node));
  }

  function handlePointer(event: Event) {
    if (whileActiveOnly && !toValue(active)) return;
    const eventTarget = event.target;
    if (!(eventTarget instanceof Node)) return;
    const nodes = resolveTargets();
    if (nodes.length > 0 && nodes.some((node) => node.contains(eventTarget))) return;
    onOutside();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!escape) return;
    if (whileActiveOnly && !toValue(active)) return;
    if (event.key === 'Escape') onOutside();
  }

  function addListeners() {
    window.addEventListener(eventName, handlePointer);
    if (escape) window.addEventListener('keydown', handleKeydown);
  }

  function removeListeners() {
    window.removeEventListener(eventName, handlePointer);
    if (escape) window.removeEventListener('keydown', handleKeydown);
  }

  if (whileActiveOnly) {
    watch(
      () => toValue(active),
      (isActive) => {
        if (isActive) addListeners();
        else removeListeners();
      },
      { immediate: true },
    );
  } else {
    addListeners();
  }

  onBeforeUnmount(removeListeners);
}
