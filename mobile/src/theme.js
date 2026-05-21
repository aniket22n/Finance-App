// ─── Design System Tokens ───────────────────────────────────────────────────

export const C = {
    primary: '#FF6E6A',
    primaryHover: '#FF5252',
    primaryPressed: '#E54D4A',
    primaryShadow: 'rgba(255,110,106,0.3)',

    textDark: '#2C2E39',
    textGray: '#9CA3AF',

    success: '#18A326',
    warning: '#D97706',
    error: '#ED2626',

    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8F9FB',
    bgTertiary: '#F3F4F6',
    border: '#E5E7EB',

    badgeSuccessBg: '#ECFDF5',
    badgePendingBg: '#FEF3C7',
    badgeOverdueBg: '#FEE2E2',
};

// Font family shorthands
export const F = {
    regular: 'Poppins_400Regular',
    medium: 'Poppins_500Medium',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
};

// Pre-composed text style objects (spread into StyleSheet)
export const T = {
    h1: { fontSize: 32, fontFamily: F.bold, color: C.textDark },
    h2: { fontSize: 24, fontFamily: F.semibold, color: C.textDark },
    h3: { fontSize: 20, fontFamily: F.semibold, color: C.textDark },
    subtitle: { fontSize: 16, fontFamily: F.medium, color: C.textDark },
    body: { fontSize: 14, fontFamily: F.regular, color: C.textDark },
    caption: { fontSize: 11, fontFamily: F.regular, color: C.textGray },
    btnLabel: { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
};

// Reusable component style objects (spread with { ...btn.large } in StyleSheet)
export const btn = {
    large: {
        height: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.primary,
        shadowColor: C.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 4,
    },
    small: {
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: C.primary,
        backgroundColor: 'transparent',
    },
    disabled: {
        backgroundColor: '#D1D5DB',
        shadowOpacity: 0,
        elevation: 0,
        opacity: 0.5,
    },
};

export const inputBase = {
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: F.regular,
    color: C.textDark,
    backgroundColor: C.bgPrimary,
};

export const cardBase = {
    backgroundColor: C.bgPrimary,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
};

// Badge helper — returns style object for status badges
export function badgeStyle(type) {
    const map = {
        success:  { bg: C.badgeSuccessBg, text: C.success },
        verified: { bg: C.badgeSuccessBg, text: C.success },
        pending:  { bg: C.badgePendingBg, text: C.warning },
        paid:     { bg: C.badgePendingBg, text: C.warning },
        overdue:  { bg: C.badgeOverdueBg, text: C.error },
        failed:   { bg: C.badgeOverdueBg, text: C.error },
    };
    const { bg, text } = map[type] || map.pending;
    return {
        container: { backgroundColor: bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
        text: { fontSize: 11, fontFamily: F.medium, color: text },
    };
}
