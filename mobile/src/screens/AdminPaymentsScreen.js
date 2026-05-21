import React, { useMemo, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getAdminPayments } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

const FILTERS = [
    { id: 'all',      label: 'All' },
    { id: 'paid',     label: 'Pending' },
    { id: 'verified', label: 'Verified' },
    { id: 'failed',   label: 'Rejected' },
];

const BADGE = {
    paid:     { bg: '#F59E0B', label: 'Pending' },
    verified: { bg: '#10B981', label: 'Verified' },
    failed:   { bg: '#EF4444', label: 'Rejected' },
};

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function AdminPaymentsScreen({ navigation }) {
    const { colors } = useTheme();
    const [filter, setFilter]       = useState('all');
    const [payments, setPayments]   = useState([]);
    const [loading, setLoading]     = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = async (status) => {
        try {
            const res = await getAdminPayments(status === 'all' ? undefined : status);
            setPayments(res.data.payments || []);
        } catch (err) {
            console.log('Payments error:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { load(filter); }, [filter]));

    const onRefresh = async () => {
        setRefreshing(true);
        await load(filter);
        setRefreshing(false);
    };

    const switchFilter = (id) => {
        if (id === filter) return;
        setLoading(true);
        setFilter(id);
    };

    const filterLabel = FILTERS.find(f => f.id === filter)?.label || 'All';
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Payments</Text>
            </View>

            {/* Filter Pills */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
                style={styles.pillsScroll}
            >
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.id}
                        style={[styles.pill, filter === f.id && styles.pillActive]}
                        onPress={() => switchFilter(f.id)}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.pillText, filter === f.id && styles.pillTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Count */}
            <Text style={styles.countLabel}>
                {filterLabel.toUpperCase()} PAYMENTS ({payments.length})
            </Text>

            {/* List */}
            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : payments.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No {filterLabel.toLowerCase()} payments</Text>
                    </View>
                ) : (
                    payments.map(p => {
                        const badge = BADGE[p.status] || { bg: colors.border, label: p.status };
                        return (
                            <TouchableOpacity
                                key={p._id}
                                style={styles.card}
                                onPress={() => navigation.navigate('AdminPaymentDetail', { payment: p })}
                                activeOpacity={0.75}
                            >
                                {/* Row 1: name + badge */}
                                <View style={styles.row1}>
                                    <Text style={styles.name} numberOfLines={1}>
                                        {p.user?.name || p.user?.phone || 'Member'}
                                    </Text>
                                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                        <Text style={styles.badgeText}>{badge.label}</Text>
                                    </View>
                                </View>

                                {/* Row 2: amount + method */}
                                <Text style={styles.amountRow}>
                                    ₹{p.amount?.toLocaleString()} • {p.paymentMethod?.toUpperCase() || 'UPI'}
                                </Text>

                                {/* Row 3: time */}
                                <Text style={styles.time}>
                                    {timeAgo(p.paidAt || p.createdAt)}
                                </Text>

                                {/* Row 4: group */}
                                {p.group?.name ? (
                                    <Text style={styles.group} numberOfLines={1}>{p.group.name}</Text>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:   { flex: 1, backgroundColor: colors.background },
        header: {
            paddingTop: 56,
            paddingBottom: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
            zIndex: 10,
        },
        title: { fontSize: 20, fontFamily: F.bold, color: colors.text },

        // Pills
        pillsScroll: { flexGrow: 0 },
        pillsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
        pill: {
            height: 34,
            paddingHorizontal: 14,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        pillActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
        pillText:       { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary },
        pillTextActive: { color: '#fff', fontFamily: F.semibold },

        // Count
        countLabel: {
            fontSize: 11,
            fontFamily: F.semibold,
            color: colors.textTertiary,
            letterSpacing: 0.5,
            paddingHorizontal: 16,
            paddingBottom: 6,
        },

        // List
        list:        { flex: 1 },
        listContent: { paddingHorizontal: 12, paddingBottom: 90 },
        center:      { paddingTop: 60, alignItems: 'center' },
        empty: {
            height: 180,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            borderRadius: 12,
            marginTop: 8,
        },
        emptyText: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },

        // Card
        card: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
        },
        row1: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
        },
        name:       { fontSize: 14, fontFamily: F.bold, color: colors.text, flex: 1, marginRight: 8 },
        badge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        badgeText:  { fontSize: 11, fontFamily: F.bold, color: '#fff' },
        amountRow:  { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 3 },
        time:       { fontSize: 12, fontFamily: F.regular, color: colors.textTertiary, marginBottom: 3 },
        group:      { fontSize: 12, fontFamily: F.medium, color: colors.primary },
    });
}
