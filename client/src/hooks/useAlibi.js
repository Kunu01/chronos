import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * FEAT-DEC-03: Quick Alibi Exit with Savepoint & Optional Minimize Shield
 * - `minimizeShield === 'auto'`: hides to CraveBook with Savepoint when switching apps.
 * - `minimizeShield === 'manual'` (default): lets user switch to YouTube/other apps without losing state.
 * - Double-tap Dynamic Island / Escape / Alibi button: switches immediately to CraveBook with Savepoint.
 */
export const useAlibi = (allowAutoHide = true) => {
  const { isUnlocked, minimizeShield, executeAlibiPanicLock } = useAuth();
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!isUnlocked) return;

    const handleVisibilityChange = () => {
      if (allowAutoHide && minimizeShield === 'auto' && document.hidden) {
        executeAlibiPanicLock({ preserveSavepoint: true });
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        executeAlibiPanicLock({ preserveSavepoint: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUnlocked, allowAutoHide, minimizeShield, executeAlibiPanicLock]);

  const handleIslandTap = useCallback(() => {
    const now = performance.now();
    if (now - lastTapRef.current < 320) {
      executeAlibiPanicLock({ preserveSavepoint: true });
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [executeAlibiPanicLock]);

  const triggerPanicNow = useCallback(
    (hardWipe = false) => {
      executeAlibiPanicLock({ preserveSavepoint: !hardWipe });
    },
    [executeAlibiPanicLock]
  );

  return {
    triggerPanicNow,
    handleIslandTap,
  };
};
