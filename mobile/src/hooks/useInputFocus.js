import { useState, useCallback } from 'react';
import { Platform } from 'react-native';

// Removes the browser's default focus outline on React Native Web.
// Has no effect on native — TextInput ignores unknown style keys there.
export const webOutlineReset = Platform.OS === 'web'
    ? { outlineStyle: 'none', outlineWidth: 0 }
    : {};

// Returns [focused, handlers] for tracking focus on a TextInput or wrapper row.
// Pass existing onFocus/onBlur through if you need to chain behavior.
export function useInputFocus(extraOnFocus, extraOnBlur) {
    const [focused, setFocused] = useState(false);
    const onFocus = useCallback((e) => { setFocused(true);  extraOnFocus?.(e); }, [extraOnFocus]);
    const onBlur  = useCallback((e) => { setFocused(false); extraOnBlur?.(e);  }, [extraOnBlur]);
    return [focused, { onFocus, onBlur }];
}

// Style overlay to apply to a focused input (or input wrapper row).
export function focusBorder(colors, focused) {
    if (!focused) return null;
    return {
        borderColor: colors.primary,
        backgroundColor: colors.background,
    };
}
