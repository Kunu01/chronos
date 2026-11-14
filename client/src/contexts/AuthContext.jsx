import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useTheme } from './ThemeContext';

const AuthContext = createContext(null);

/**
 * Zero-Trace Authentication Context with In-Memory Savepoint:
 * - Credentials & savepoints stay strictly in volatile React memory (zero browser storage).
 * - Quick Exit / Auto-Hide pauses media and swaps to CraveBook while holding an in-memory savepoint
 *   so the user can return cleanly via the discreet savepoint trigger or wipe fully.
 */
export const AuthProvider = ({ children }) => {
  const [vaultToken, setVaultToken] = useState(null);
  const [role, setRole] = useState(null); // 'PARTNER_HER' | 'PARTNER_HIM'
  const [alibiRecipeActive, setAlibiRecipeActive] = useState(false);
  const [savepoint, setSavepoint] = useState(null); // { token, role, activeTab, trainProgress }
  const [minimizeShield, setMinimizeShield] = useState('manual'); // 'manual' | 'auto'
  const { setTheme } = useTheme();

  const teardownCallbacksRef = useRef(new Set());
  const sessionProgressRef = useRef({ activeTab: 'train', trainProgress: 0.06 });

  const registerPanicTeardown = useCallback((fn) => {
    teardownCallbacksRef.current.add(fn);
    return () => teardownCallbacksRef.current.delete(fn);
  }, []);

  const updateSavepointState = useCallback((patch) => {
    sessionProgressRef.current = {
      ...sessionProgressRef.current,
      ...patch,
    };
  }, []);

  const loginToVault = useCallback(
    (token, assignedRole) => {
      setAlibiRecipeActive(false);
      setSavepoint(null);
      setVaultToken(token);
      setRole(assignedRole);
      setTheme('dark');
      document.title = 'CraveBook — Saved Collection';
    },
    [setTheme]
  );

  const runHardwareTeardowns = useCallback(() => {
    for (const fn of teardownCallbacksRef.current) {
      try {
        fn();
      } catch {
        // Ignore teardown errors during rapid exit
      }
    }
  }, []);

  const executeAlibiPanicLock = useCallback(
    ({ preserveSavepoint = true } = {}) => {
      setTheme('light');
      document.title = 'Paneer Butter Masala — CraveBook Recipes';

      runHardwareTeardowns();

      if (preserveSavepoint && vaultToken && role) {
        setSavepoint({
          token: vaultToken,
          role,
          activeTab: sessionProgressRef.current.activeTab || 'train',
          trainProgress: sessionProgressRef.current.trainProgress ?? 0.06,
        });
      } else {
        setSavepoint(null);
      }

      setVaultToken(null);
      setRole(null);
      setAlibiRecipeActive(true);
    },
    [setTheme, runHardwareTeardowns, vaultToken, role]
  );

  const resumeFromSavepoint = useCallback(() => {
    if (!savepoint?.token || !savepoint?.role) return false;
    setAlibiRecipeActive(false);
    setVaultToken(savepoint.token);
    setRole(savepoint.role);
    sessionProgressRef.current = {
      activeTab: savepoint.activeTab || 'train',
      trainProgress: savepoint.trainProgress ?? 0.06,
    };
    setTheme('dark');
    document.title = 'CraveBook — Saved Collection';
    return true;
  }, [savepoint, setTheme]);

  const clearSavepointPermanently = useCallback(() => {
    setSavepoint(null);
  }, []);

  const toggleMinimizeShield = useCallback(() => {
    setMinimizeShield((prev) => (prev === 'auto' ? 'manual' : 'auto'));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        vaultToken,
        role,
        isUnlocked: Boolean(vaultToken),
        alibiRecipeActive,
        setAlibiRecipeActive,
        hasSavepoint: Boolean(savepoint?.token),
        savepointMeta: sessionProgressRef.current,
        minimizeShield,
        toggleMinimizeShield,
        updateSavepointState,
        loginToVault,
        executeAlibiPanicLock,
        resumeFromSavepoint,
        clearSavepointPermanently,
        registerPanicTeardown,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
