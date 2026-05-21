import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

export default function GroupCard({ group, onPress }) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

    const memberCount = group.members?.length || 0;
    const progress = group.totalMonths > 0
        ? ((group.currentMonth / group.totalMonths) * 100).toFixed(0)
        : 0;
    const isActive = group.status === 'active';
    const badge = isActive ? colors.status.verified : colors.status.pending;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
            <View style={styles.header}>
                <View style={styles.iconWrap}>
                    <Ionicons name="people" size={22} color={colors.primary} />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
                    <View style={{ backgroundColor: badge.bg, borderColor: badge.border, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' }}>
                        <Text style={{ fontSize: 11, fontFamily: F.medium, color: badge.text }}>{group.status?.toUpperCase()}</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>

            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{memberCount}</Text>
                    <Text style={styles.statLabel}>Members</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>₹{group.potAmount?.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Pot</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{group.currentMonth}/{group.totalMonths}</Text>
                    <Text style={styles.statLabel}>Month</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{progress}%</Text>
                    <Text style={styles.statLabel}>Done</Text>
                </View>
            </View>

            <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
        </TouchableOpacity>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 16,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
            marginBottom: 12,
        },
        header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
        iconWrap: {
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        headerText: { flex: 1 },
        name: { fontSize: 16, fontFamily: F.semibold, color: colors.text, marginBottom: 4 },
        statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
        stat: { flex: 1, alignItems: 'center' },
        statValue: { fontSize: 14, fontFamily: F.bold, color: colors.text },
        statLabel: { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        statDivider: { width: 1, height: 28, backgroundColor: colors.border },
        progressBar: {
            height: 4,
            backgroundColor: colors.backgroundTertiary,
            borderRadius: 2,
            overflow: 'hidden',
        },
        progressFill: {
            height: 4,
            backgroundColor: colors.primary,
            borderRadius: 2,
        },
    });
}
