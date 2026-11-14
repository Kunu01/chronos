import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState('light'); // 'light' (Decoy), 'dark' (Vault), 'amoled' (Theater)
  const [batteryLevel, setBatteryLevel] = useState(1);
  const [batteryAlert, setBatteryAlert] = useState(false);

  const applyDomTheme = useCallback((nextTheme) => {
    document.documentElement.setAttribute('data-theme', nextTheme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        nextTheme === 'light' ? '#FAFAFA' : nextTheme === 'amoled' ? '#000000' : '#121212'
      );
    }
  }, []);

  const setTheme = useCallback(
    (nextTheme) => {
      setThemeState(nextTheme);
      applyDomTheme(nextTheme);
    },
    [applyDomTheme]
  );

  const cycleVaultTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'amoled' : 'dark';
      applyDomTheme(next);
      return next;
    });
  }, [applyDomTheme]);

  // Hardware Sympathy: S24 Ultra / iPhone 11 Battery Monitor (<20% forces AMOLED)
  useEffect(() => {
    let batteryObj = null;
    const handleBatteryChange = () => {
      if (!batteryObj) return;
      setBatteryLevel(batteryObj.level);
      if (batteryObj.level <= 0.2 && !batteryObj.charging) {
        setBatteryAlert(true);
        setThemeState((current) => {
          if (current === 'dark') {
            applyDomTheme('amoled');
            return 'amoled';
          }
          return current;
        });
      } else {
        setBatteryAlert(false);
      }
    };

    if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
      navigator
        .getBattery()
        .then((bat) => {
          batteryObj = bat;
          handleBatteryChange();
          bat.addEventListener('levelchange', handleBatteryChange);
          bat.addEventListener('chargingchange', handleBatteryChange);
        })
        .catch(() => {});
    }

    return () => {
      if (batteryObj) {
        batteryObj.removeEventListener('levelchange', handleBatteryChange);
        batteryObj.removeEventListener('chargingchange', handleBatteryChange);
      }
    };
  }, [applyDomTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        cycleVaultTheme,
        batteryLevel,
        batteryAlert,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

