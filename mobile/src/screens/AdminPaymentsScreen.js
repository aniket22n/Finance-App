import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl, Modal, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAdminPaymentsList, getGroups } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

const STATUS_FILTERS = [
    { id: 'all',      label: 'All' },
    { id: 'pending',  label: 'Pending' },
    { id: 'verified', label: 'Verified' },
    { id: 'rejected', label: 'Rejected' },
];

const BADGE = {
    paid:     { bg: '#F59E0B', label: 'Pending' },
    pending:  { bg: '#6B7280', label: 'Awaiting' },
    verified: { bg: '#10B981', label: 'Verified' },
    failed:   { bg: '#EF4444', label: 'Rejected' },
    rejected: { bg: '#EF4444', label: 'Rejected' },
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

function PickerModal({ visible, title, items, selected, onSelect, onClose, colors, styles }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>{title}</Text>
                <FlatList
                    data={items}
                    keyExtractor={i => String(i.id)}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.sheetRow}
                            onPress={() => { onSelect(item.id); onClose(); }}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.sheetRowText,
                                item.id === selected && { color: colors.primary, fontFamily: F.semibold },
                            ]}>
                                {item.label}
                            </Text>
                            {item.id === selected && (
                                <Ionicons name="checkmark" size={16} color={colors.primary} />
                            )}
                        </TouchableOpacity>
                    )}
                    style={{ maxHeight: 360 }}
                />
            </View>
        </Modal>
    );
}

export default function AdminPaymentsScreen({ navigation, route }) {
    const { colors } = useTheme();

    const [status,  setStatus]  = useState('all');
    const [groupId, setGroupId] = useState('all');
    const [month,   setMonth]   = useState('all');

    const [groups,   setGroups]   = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [groupModal, setGroupModal] = useState(false);
    const [monthModal, setMonthModal] = useState(false);

    // Handle incoming activeFilter from OTP screen redirect
    useEffect(() => {
        const incoming = route?.params?.activeFilter;
        if (incoming && STATUS_FILTERS.some(f => f.id === incoming)) {
            setStatus(incoming);
        }
    }, [route?.params?.activeFilter]);

    // Fetch groups once for the picker
    useEffect(() => {
        getGroups().then(r => setGroups(r.data.groups || [])).catch(() => {});
    }, []);

    const load = useCallback(async () => {
        try {
            const res = await getAdminPaymentsList({ status, group: groupId, month });
            setPayments(res.data.payments || []);
        } catch (err) {
            console.log('Payments error:', err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [status, groupId, month]);

    useFocusEffect(useCallback(() => {
        setLoading(true);
        load();
    }, [load]));

    const onRefresh = () => { setRefreshing(true); load(); };

    const switchStatus = (id) => {
        if (id === status) return;
        setLoading(true);
        setStatus(id);
    };

    // Build group picker items
    const groupItems = [
        { id: 'all', label: 'All Groups' },
        ...groups.map(g => ({ id: g._id, label: g.name })),
    ];

    // Build month picker items — use selected group's totalMonths or fall back to 24
    const selectedGroup = groups.find(g => g._id === groupId);
    const maxMonth = selectedGroup?.totalMonths || 24;
    const monthItems = [
        { id: 'all', label: 'All Months' },
        ...Array.from({ length: maxMonth }, (_, i) => ({ id: i + 1, label: `Month ${i + 1}` })),
    ];

    const groupLabel  = groupItems.find(g => g.id === groupId)?.label  || 'All Groups';
    const monthLabel  = monthItems.find(m => m.id === month)?.label    || 'All Months';
    const statusLabel = STATUS_FILTERS.find(f => f.id === status)?.label || 'All';

    const hasGroupFilter = groupId !== 'all';
    const hasMonthFilter = month   !== 'all';

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Payments</Text>
            </View>

            {/* Status pills */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
                style={styles.pillsScroll}
            >
                {STATUS_FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.id}
                        style={[styles.pill, status === f.id && styles.pillActive]}
                        onPress={() => switchStatus(f.id)}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.pillText, status === f.id && styles.pillTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Group + Month filter row */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterChip, hasGroupFilter && styles.filterChipActive]}
                    onPress={() => setGroupModal(true)}
                    activeOpacity={0.75}
                >
                    <Ionicons
                        name="people-outline"
                        size={13}
                        color={hasGroupFilter ? colors.primary : colors.textSecondary}
                    />
                    <Text
                        style={[styles.filterChipText, hasGroupFilter && styles.filterChipTextActive]}
                        numberOfLines={1}
                    >
                        {groupLabel}
                    </Text>
                    <Ionicons
                        name="chevron-down"
                        size={12}
                        color={hasGroupFilter ? colors.primary : colors.textSecondary}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterChip, hasMonthFilter && styles.filterChipActive]}
                    onPress={() => setMonthModal(true)}
                    activeOpacity={0.75}
                >
                    <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={hasMonthFilter ? colors.primary : colors.textSecondary}
                    />
                    <Text style={[styles.filterChipText, hasMonthFilter && styles.filterChipTextActive]}>
                        {monthLabel}
                    </Text>
                    <Ionicons
                        name="chevron-down"
                        size={12}
                        color={hasMonthFilter ? colors.primary : colors.textSecondary}
                    />
                </TouchableOpacity>

                {(hasGroupFilter || hasMonthFilter) && (
                    <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => { setGroupId('all'); setMonth('all'); }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Count */}
            <Text style={styles.countLabel}>
                {statusLabel.toUpperCase()} PAYMENTS ({payments.length})
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
                        <Text style={styles.emptyText}>No {statusLabel.toLowerCase()} payments</Text>
                    </View>
                ) : (
                    payments.map(p => {
                        const badge = BADGE[p.status] || { bg: colors.border, label: p.status };
                        const initial = (p.user?.name || p.user?.phone || '?').charAt(0).toUpperCase();
                        return (
                            <TouchableOpacity
                                key={p._id}
                                style={styles.card}
                                onPress={() => navigation.navigate('AdminPaymentDetail', { payment: p })}
                                activeOpacity={0.75}
                            >
                                <View style={styles.cardTop}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarTxt}>{initial}</Text>
                                    </View>
                                    <View style={styles.info}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {p.user?.name || p.user?.phone || 'Member'}
                                            </Text>
                                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                                <Text style={styles.badgeText}>{badge.label}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.metaLine} numberOfLines={1}>
                                            <Text style={styles.amountEmph}>₹{p.amount?.toLocaleString()}</Text>
                                            <Text style={styles.metaDot}>  ·  </Text>
                                            {(p.paymentMethod || 'upi').toUpperCase()}
                                            <Text style={styles.metaDot}>  ·  </Text>
                                            Month {p.month}
                                            <Text style={styles.metaDot}>  ·  </Text>
                                            {timeAgo(p.paidAt || p.createdAt)}
                                        </Text>
                                        {p.group?.name ? (
                                            <Text style={styles.group} numberOfLines={1}>{p.group.name}</Text>
                                        ) : null}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            {/* Group picker modal */}
            <PickerModal
                visible={groupModal}
                title="Filter by Group"
                items={groupItems}
                selected={groupId}
                onSelect={(id) => { setGroupId(id); setLoading(true); }}
                onClose={() => setGroupModal(false)}
                colors={colors}
                styles={styles}
            />

            {/* Month picker modal */}
            <PickerModal
                visible={monthModal}
                title="Filter by Month"
                items={monthItems}
                selected={month}
                onSelect={(id) => { setMonth(id); setLoading(true); }}
                onClose={() => setMonthModal(false)}
                colors={colors}
                styles={styles}
            />
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
        },
        title: { fontSize: 20, fontFamily: F.bold, color: colors.text },

        // Status pills
        pillsScroll: { flexGrow: 0 },
        pillsRow:    { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
        pill: {
            height: 34, paddingHorizontal: 14, borderRadius: 20,
            borderWidth: 1, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        pillActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
        pillText:       { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary },
        pillTextActive: { color: '#fff', fontFamily: F.semibold },

        // Group + Month filter row
        filterRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingBottom: 8,
            gap: 8,
        },
        filterChip: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            height: 34,
            paddingHorizontal: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary,
        },
        filterChipActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primaryLight || colors.primary + '15',
        },
        filterChipText: {
            flex: 1, fontSize: 12, fontFamily: F.medium,
            color: colors.textSecondary,
        },
        filterChipTextActive: { color: colors.primary },
        clearBtn: { padding: 4 },

        // Count
        countLabel: {
            fontSize: 11, fontFamily: F.semibold, color: colors.textTertiary,
            letterSpacing: 0.5, paddingHorizontal: 16, paddingBottom: 6,
        },

        // List
        list:        { flex: 1 },
        listContent: { paddingHorizontal: 12, paddingBottom: 90 },
        center:      { paddingTop: 60, alignItems: 'center' },
        empty: {
            height: 180, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderStyle: 'dashed',
            borderColor: colors.border, borderRadius: 12, marginTop: 8,
        },
        emptyText: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },

        // Card
        card: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border, borderRadius: 10,
            paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6,
        },
        cardTop:    { flexDirection: 'row', alignItems: 'center' },
        avatar: {
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: colors.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 10, borderWidth: 1, borderColor: colors.border,
        },
        avatarTxt:  { fontSize: 13, fontFamily: F.bold, color: colors.primary },
        info:       { flex: 1, minWidth: 0 },
        nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
        name:       { flex: 1, fontSize: 13, fontFamily: F.bold, color: colors.text },
        badge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
        badgeText:  { fontSize: 9, fontFamily: F.bold, color: '#fff', letterSpacing: 0.3 },
        metaLine:   { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        amountEmph: { fontFamily: F.bold, color: colors.text },
        metaDot:    { color: colors.textTertiary },
        group:      { fontSize: 11, fontFamily: F.medium, color: colors.primary, marginTop: 1 },

        // Modal / bottom sheet
        modalOverlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 32,
            paddingHorizontal: 16,
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
        },
        sheetHandle: {
            width: 36, height: 4, borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center', marginTop: 12, marginBottom: 16,
        },
        sheetTitle: {
            fontSize: 15, fontFamily: F.bold, color: colors.text, marginBottom: 8,
        },
        sheetRow: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 13,
            borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        sheetRowText: { fontSize: 14, fontFamily: F.regular, color: colors.text },
    });
}
