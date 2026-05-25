import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

export default function GroupCard({ group, onPress }) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

    const progress = group.totalMonths > 0
        ? Math.round((group.currentMonth / group.totalMonths) * 100)
        : 0;
    const isActive = group.status === 'active';
    const accentColor = isActive ? colors.primary : colors.textTertiary;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
            <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
            <View style={styles.inner}>

                {/* Row 1: name + EMI + chevron */}
                <View style={styles.topRow}>
                    <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="people" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
                    <View style={styles.emiWrap}>
                        <Text style={[styles.emiAmount, { color: colors.primary }]}>
                            ₹{group.emiAmount?.toLocaleString()}
                        </Text>
                        <Text style={styles.emiLabel}>/mo</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 4 }} />
                </View>

                {/* Row 2: progress bar + meta */}
                <View style={styles.bottomRow}>
                    <View style={styles.progressBarWrap}>
                        <View style={styles.progressBg}>
                            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accentColor }]} />
                        </View>
                    </View>
                    <Text style={styles.metaText}>
                        Month {group.currentMonth}/{group.totalMonths}
                        {'  ·  '}
                        <Text style={{ color: accentColor }}>{progress}%</Text>
                        {'  ·  '}
                        ₹{group.potAmount?.toLocaleString()} pot
                    </Text>
                </View>

            </View>
        </TouchableOpacity>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.background,
            borderRadius: 14,
            flexDirection: 'row',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 8,
            elevation: 3,
            borderWidth: 1,
            borderColor: colors.border,
        },
        accentBar: { width: 4 },
        inner:     { flex: 1, paddingHorizontal: 12, paddingVertical: 11 },
        topRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
        iconWrap:  {
            width: 30, height: 30, borderRadius: 8,
            alignItems: 'center', justifyContent: 'center', marginRight: 10,
        },
        name:      { flex: 1, fontSize: 14, fontFamily: F.semibold, color: colors.text },
        emiWrap:   { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
        emiAmount: { fontSize: 14, fontFamily: F.bold },
        emiLabel:  { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary },
        bottomRow: {},
        progressBarWrap: { marginBottom: 6 },
        progressBg: {
            height: 4, backgroundColor: colors.backgroundTertiary,
            borderRadius: 2, overflow: 'hidden',
        },
        progressFill: { height: 4, borderRadius: 2 },
        metaText: { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary },
    });
}
