export const PRIMARY_COLORS = {
    coral:   { primary: '#FF6E6A', primaryLight: '#FFF0EF', primaryDark: '#E54D4A' },
    royal:   { primary: '#4F46E5', primaryLight: '#EEF2FF', primaryDark: '#3730A3' },
    emerald: { primary: '#10B981', primaryLight: '#ECFDF5', primaryDark: '#059669' },
    purple:  { primary: '#8B5CF6', primaryLight: '#F5F3FF', primaryDark: '#7C3AED' },
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
    errorLight:          '#450A0A',
    success:             '#4ADE80',
    successLight:        '#052E16',
    warning:             '#FCD34D',
    warningLight:        '#451A03',
    info:                '#60A5FA',
    infoLight:           '#1E3A5F',
    shadow:              '#000000',
};

export const STATUS_COLORS = {
    pending:  { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
    paid:     { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
    verified: { bg: '#ECFDF5', text: '#18A326', border: '#A7F3D0' },
    rejected: { bg: '#FEE2E2', text: '#ED2626', border: '#FECACA' },
    overdue:  { bg: '#FEE2E2', text: '#ED2626', border: '#FECACA' },
};

export const getColors = (isDark = false, primaryTheme = 'coral') => {
    const base = isDark ? DARK_PALETTE : LIGHT_PALETTE;
    const theme = PRIMARY_COLORS[primaryTheme] || PRIMARY_COLORS.coral;
    return {
        ...base,
        primary:      theme.primary,
        primaryLight: theme.primaryLight,
        primaryDark:  theme.primaryDark,
        status:       STATUS_COLORS,
    };
};

export const AVAILABLE_THEMES = {
    coral:   'Coral',
    royal:   'Royal Blue',
    emerald: 'Emerald',
    purple:  'Purple',
};
