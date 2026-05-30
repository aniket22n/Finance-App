import { createContext, useContext, useEffect, useState } from 'react';

// Mirrors mobile/src/context/ThemeContext.js — same storage keys, same options,
// so a member's theme choice feels identical across mobile and web.
const ThemeContext = createContext({});
export const useTheme = () => useContext(ThemeContext);

const KEY_DARK = 'theme.isDark';
const KEY_PRIMARY = 'theme.primaryTheme';

export const AVAILABLE_THEMES = {
  coral: 'Coral',
  royal: 'Royal Blue',
  emerald: 'Emerald',
  purple: 'Purple',
};

// Swatch (the brand `primary`) for each theme — used by the picker UI.
export const THEME_SWATCH = {
  coral: '#FF6E6A',
  royal: '#4F46E5',
  emerald: '#10B981',
  purple: '#8B5CF6',
};

function apply(isDark, primaryTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
  root.setAttribute('data-primary', primaryTheme);
}

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem(KEY_DARK) === 'true');
  const [primaryTheme, setPrimary] = useState(() => localStorage.getItem(KEY_PRIMARY) || 'coral');

  // Apply before paint so there's no flash of the wrong theme.
  useEffect(() => { apply(isDark, primaryTheme); }, [isDark, primaryTheme]);

  const setIsDarkPersist = (value) => {
    setIsDark(value);
    localStorage.setItem(KEY_DARK, String(value));
  };
  const setPrimaryTheme = (value) => {
    setPrimary(value);
    localStorage.setItem(KEY_PRIMARY, value);
  };

  return (
    <ThemeContext.Provider
      value={{ isDark, setIsDark: setIsDarkPersist, primaryTheme, setPrimaryTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
