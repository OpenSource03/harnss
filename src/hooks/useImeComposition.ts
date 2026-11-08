import { useCallback, useRef } from "react";

type CompositionAwareEvent = {
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
  isComposing?: boolean;
  keyCode?: number;
};

/**
 * Distinguishes the Enter that commits an IME candidate from the Enter that
 * submits the message.
 *
 * Chromium fires `keydown` with `isComposing === true` for most IMEs, but the
 * commit keystroke is often dispatched *after* `compositionend`, with the flag
 * already cleared. Tracking composition state plus a short grace window after
 * `compositionend` covers both shapes.
 */
export function useImeComposition() {
  const composingRef = useRef(false);
  const lastEndRef = useRef(0);

  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(() => {
    composingRef.current = false;
    lastEndRef.current = Date.now();
  }, []);

  /** True while an IME is composing, or for the keystroke that commits it. */
  const isComposing = useCallback((event: CompositionAwareEvent): boolean => {
    const native = event.nativeEvent ?? event;
    if (composingRef.current) return true;
    if (native?.isComposing) return true;
    // 229 is what Chromium reports for keys consumed by the IME.
    if (native?.keyCode === 229) return true;
    return Date.now() - lastEndRef.current < 80;
  }, []);

  return { onCompositionStart, onCompositionEnd, isComposing };
}
