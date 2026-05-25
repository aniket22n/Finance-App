// Primary theme palettes — each provides light + dark variants of the accent surfaces.
// `primary`     — main accent color, identical across light/dark modes (so brand stays consistent)
// `primaryLight`— tinted SURFACE color, dark in dark mode / pastel in light mode (lives behind text)
// `primaryDark` — high-contrast TEXT color that sits readably ON primaryLight in the matching mode
export const PRIMARY_COLORS = {
    coral: {
        primary: '#FF6E6A',
        light:   { primaryLight: '#FFF0EF', primaryDark: '#E54D4A' },
        dark:    { primaryLight: '#3A1E1D', primaryDark: '#FFB3B0' },
    },
    royal: {
        primary: '#4F46E5',
        light:   { primaryLight: '#EEF2FF', primaryDark: '#3730A3' },
        dark:    { primaryLight: '#1E1D3A', primaryDark: '#A5A0F0' },
    },
    emerald: {
        primary: '#10B981',
        light:   { primaryLight: '#ECFDF5', primaryDark: '#059669' },
        dark:    { primaryLight: '#0F2820', primaryDark: '#6EE7B7' },
    },
    purple: {
        primary: '#8B5CF6',
        light:   { primaryLight: '#F5F3FF', primaryDark: '#7C3AED' },
        dark:    { primaryLight: '#241D3A', primaryDark: '#C4B5FD' },
    },
};

export const LIGHT_PALETTE = {
    background:          '#FFFFFF',
    backgroundSecondary: '#F8F9FB',
    backgroundTertiary:  '#F3F4F6',
    text:                '#2C2E39',
    textSecondary:       '#6B7280',
    textTertiary:        '#9CA3AF',
    border:              '#E5E7EB',
    borderSecondary:     '#D1D5DB',
    error:               '#ED2626',
    errorLight:          '#FEE2E2',
    success:             '#18A326',
    successLight:        '#ECFDF5',
    warning:             '#D97706',
    warningLight:        '#FEF3C7',
    info:                '#3B82F6',
    infoLight:           '#EFF6FF',
    shadow:              '#000000',
};

export const DARK_PALETTE = {
    background:          '#1A1B23',
    backgroundSecondary: '#22232E',
    backgroundTertiary:  '#2D2E3D',
    text:                '#F9FAFB',
    textSecondary:       '#D1D5DB',
    textTertiary:        '#9CA3AF',
    border:              '#374151',
    borderSecondary:     '#4B5563',
    error:               '#F87171',
    errorLight:          '#3A1818',
    success:             '#4ADE80',
    successLight:        '#0F2C20',
    warning:             '#FCD34D',
    warningLight:        '#3D2E10',
    info:                '#60A5FA',
    infoLight:           '#1E3A5F',
    shadow:              '#000000',
};

// Status pill colors — bg sits behind text, border outlines the pill.
// Dark-mode variants use deeper tinted backgrounds with brighter foreground text.
export const STATUS_COLORS_LIGHT = {
    pending:  { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
    paid:     { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
    verified: { bg: '#ECFDF5', text: '#18A326', border: '#A7F3D0' },
    rejected: { bg: '#FEE2E2', text: '#ED2626', border: '#FECACA' },
    overdue:  { bg: '#FEE2E2', text: '#ED2626', border: '#FECACA' },
};

export const STATUS_COLORS_DARK = {
    pending:  { bg: '#3D2E10', text: '#FCD34D', border: '#78551B' },
    paid:     { bg: '#3D2E10', text: '#FCD34D', border: '#78551B' },
    verified: { bg: '#0F2C20', text: '#4ADE80', border: '#1F5A3F' },
    rejected: { bg: '#3A1818', text: '#F87171', border: '#7A2D2D' },
    overdue:  { bg: '#3A1818', text: '#F87171', border: '#7A2D2D' },
};

export const getColors = (isDark = false, primaryTheme = 'coral') => {
    const base  = isDark ? DARK_PALETTE : LIGHT_PALETTE;
    const theme = PRIMARY_COLORS[primaryTheme] || PRIMARY_COLORS.coral;
    const tint  = isDark ? theme.dark : theme.light;
    return {
        ...base,
        primary:      theme.primary,
        primaryLight: tint.primaryLight,
        primaryDark:  tint.primaryDark,
        status:       isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT,
    };
};

export const AVAILABLE_THEMES = {
    coral:   'Coral',
    royal:   'Royal Blue',
    emerald: 'Emerald',
    purple:  'Purple',
};
