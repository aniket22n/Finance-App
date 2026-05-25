import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getColors } from '../theme/colors';

export const ThemeContext = createContext({});

export const useTheme = () => useContext(ThemeContext);

const KEY_DARK    = 'theme.isDark';
const KEY_PRIMARY = 'theme.primaryTheme';
const isWeb = Platform.OS === 'web';

const storage = {
    async get(key) {
        if (isWeb) return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        try { return await SecureStore.getItemAsync(key); } catch { return null; }
    },
    async set(key, value) {
        if (isWeb) {
            if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
            return;
        }
        try { await SecureStore.setItemAsync(key, value); } catch {}
    },
};

export function ThemeProvider({ children }) {
    const [isDark, setIsDarkState] = useState(false);
    const [primaryTheme, setPrimaryThemeState] = useState('coral');
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        (async () => {
            const [savedDark, savedPrimary] = await Promise.all([
                storage.get(KEY_DARK),
                storage.get(KEY_PRIMARY),
            ]);
            if (savedDark != null) setIsDarkState(savedDark === 'true');
            if (savedPrimary) setPrimaryThemeState(savedPrimary);
            setHydrated(true);
        })();
    }, []);

    const setIsDark = (value) => {
        setIsDarkState(value);
        storage.set(KEY_DARK, String(value));
    };

    const setPrimaryTheme = (value) => {
        setPrimaryThemeState(value);
        storage.set(KEY_PRIMARY, value);
    };

    const colors = getColors(isDark, primaryTheme);

    return (
        <ThemeContext.Provider
            value={{
                colors,
                isDark,
                setIsDark,
                primaryTheme,
                setPrimaryTheme,
                hydrated,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}
