import { useCallback, useRef } from "react";

type CompositionAwareEvent = {
  key?: string;
  isComposing?: boolean;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean; keyCode?: number; key?: string };
};

const ENTER = "Enter";

/**
 * Separates the Enter that commits an IME candidate from the Enter that
 * submits the message.
 *
 * The committing keystroke is usually dispatched while the composition is
 * still open, so `isComposing` and the IME-reserved `keyCode` 229 identify it
 * on their own. Some IMEs end the composition first and dispatch the commit
 * afterwards; that ordering is covered by arming a one-task flag on
 * `compositionend`, so only the keystroke that follows the commit immediately
 * is suppressed and a deliberate Enter a moment later still submits.
 */
export function useImeComposition() {
  const composingRef = useRef(false);
  /** True once the committing Enter itself reached the guard. */
  const swallowedCommitRef = useRef(false);
  /** True for one task after a `compositionend` the guard did not see arrive. */
  const pendingCommitRef = useRef(false);
  const clearPendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Marks the start of an IME composition. */
  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
    swallowedCommitRef.current = false;
  }, []);

  /** Marks the end of an IME composition and arms the commit fallback. */
  const onCompositionEnd = useCallback(() => {
    composingRef.current = false;

    // The committing keystroke already passed through `isComposing`, so there
    // is nothing left to suppress.
    if (swallowedCommitRef.current) {
      swallowedCommitRef.current = false;
      return;
    }

    pendingCommitRef.current = true;
    if (clearPendingRef.current) clearTimeout(clearPendingRef.current);
    clearPendingRef.current = setTimeout(() => {
      pendingCommitRef.current = false;
    }, 0);
  }, []);

  /** Clears per-keystroke state so a later Enter is never suppressed. */
  const onKeyUp = useCallback((event: CompositionAwareEvent) => {
    const key = event.key ?? event.nativeEvent?.key;
    if (key !== ENTER) return;
    swallowedCommitRef.current = false;
    pendingCommitRef.current = false;
  }, []);

  /** True when the event belongs to the IME rather than to the application. */
  const isComposing = useCallback((event: CompositionAwareEvent): boolean => {
    const native = event.nativeEvent ?? event;
    const key = event.key ?? event.nativeEvent?.key;

    if (composingRef.current || native?.isComposing || native?.keyCode === 229) {
      if (key === ENTER) swallowedCommitRef.current = true;
      return true;
    }

    if (key === ENTER && pendingCommitRef.current) {
      pendingCommitRef.current = false;
      return true;
    }

    return false;
  }, []);

  return { onCompositionStart, onCompositionEnd, onKeyUp, isComposing };
}
