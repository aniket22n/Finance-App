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

// Multi-select status pills — 'all' is exclusive; others combine freely
const STATUS_OPTIONS = [
    { id: 'all',      label: 'All' },
    { id: 'awaiting', label: 'Awaiting' },
    { id: 'pending',  label: 'Pending'  },
    { id: 'verified', label: 'Verified' },
    { id: 'rejected', label: 'Rejected' },
];

const BADGE = {
    paid:     { bg: '#F59E0B', label: 'Awaiting' },
    pending:  { bg: '#6B7280', label: 'Pending'  },
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
    return `${Math.floor(hrs / 24)}d ago`;
}

function PickerModal({ visible, title, items, selected, onSelect, onClose, colors, styles }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>{title}</Text>
                <FlatList
                    data={items}
                    keyExtractor={i => String(i.id)}
                    style={{ maxHeight: 360 }}
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
                            {item.id === selected &&
                                <Ionicons name="checkmark" size={16} color={colors.primary} />}
                        </TouchableOpacity>
                    )}
                />
            </View>
        </Modal>
    );
}

export default function AdminPaymentsScreen({ navigation, route }) {
    const { colors } = useTheme();

    // Multi-select statuses — ['all'] means no filter
    const [statuses, setStatuses] = useState(['all']);
    const [groupId,  setGroupId]  = useState('all');
    const [month,    setMonth]    = useState('all');

    const [groups,    setGroups]    = useState([]);
    const [payments,  setPayments]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [groupModal, setGroupModal] = useState(false);
    const [monthModal, setMonthModal] = useState(false);

    // Handle redirect from OTP screen
    useEffect(() => {
        const incoming = route?.params?.activeFilter;
        if (!incoming || incoming === 'all') return;
        // Map old single-value filter names to new semantic ids
        const map = { pending: 'awaiting', verified: 'verified', rejected: 'rejected' };
        const mapped = map[incoming] || incoming;
        if (STATUS_OPTIONS.some(o => o.id === mapped)) setStatuses([mapped]);
    }, [route?.params?.activeFilter]);

    useEffect(() => {
        getGroups().then(r => setGroups(r.data.groups || [])).catch(() => {});
    }, []);

    const load = useCallback(async () => {
        try {
            const res = await getAdminPaymentsList({ statuses, group: groupId, month });
            setPayments(res.data.payments || []);
        } catch (err) {
            console.log('Payments error:', err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statuses, groupId, month]);

    useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

    const onRefresh = () => { setRefreshing(true); load(); };

    const toggleStatus = (id) => {
        setLoading(true);
        if (id === 'all') {
            setStatuses(['all']);
            return;
        }
        setStatuses(prev => {
            const without = prev.filter(s => s !== 'all' && s !== id);
            const next = prev.includes(id) ? without : [...without, id];
            return next.length === 0 ? ['all'] : next;
        });
    };

    // Group + month picker data
    const groupItems = [
        { id: 'all', label: 'All Groups' },
        ...groups.map(g => ({ id: g._id, label: g.name })),
    ];
    const selectedGroup = groups.find(g => g._id === groupId);
    const maxMonth = selectedGroup?.totalMonths || 24;
    const monthItems = [
        { id: 'all', label: 'All Months' },
        ...Array.from({ length: maxMonth }, (_, i) => ({ id: i + 1, label: `Month ${i + 1}` })),
    ];

    const groupLabel = groupItems.find(g => g.id === groupId)?.label || 'All Groups';
    const monthLabel = monthItems.find(m => m.id === month)?.label   || 'All Months';
    const hasGroupFilter = groupId !== 'all';
    const hasMonthFilter = month   !== 'all';
    const isAllStatus    = statuses.includes('all');

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.title}>Payments</Text>
            </View>

            {/* ── Single filter line ── */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={styles.filterScroll}
            >
                {/* Status pills (multi-select) */}
                {STATUS_OPTIONS.map((opt, idx) => {
                    const active = opt.id === 'all' ? isAllStatus : statuses.includes(opt.id);
                    return (
                        <TouchableOpacity
                            key={opt.id}
                            style={[styles.pill, active && styles.pillActive]}
                            onPress={() => toggleStatus(opt.id)}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.pillTxt, active && styles.pillTxtActive]}>
                                {opt.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                {/* Divider */}
                <View style={styles.divider} />

                {/* Group chip */}
                <TouchableOpacity
                    style={[styles.chip, hasGroupFilter && styles.chipActive]}
                    onPress={() => setGroupModal(true)}
                    activeOpacity={0.75}
                >
                    <Ionicons name="people-outline" size={12}
                        color={hasGroupFilter ? colors.primary : colors.textSecondary} />
                    <Text
                        style={[styles.chipTxt, hasGroupFilter && styles.chipTxtActive]}
                        numberOfLines={1}
                    >
                        {hasGroupFilter ? groupLabel : 'Group'}
                    </Text>
                    <Ionicons name="chevron-down" size={11}
                        color={hasGroupFilter ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>

                {/* Month chip */}
                <TouchableOpacity
                    style={[styles.chip, hasMonthFilter && styles.chipActive]}
                    onPress={() => setMonthModal(true)}
                    activeOpacity={0.75}
                >
                    <Ionicons name="calendar-outline" size={12}
                        color={hasMonthFilter ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.chipTxt, hasMonthFilter && styles.chipTxtActive]}>
                        {hasMonthFilter ? monthLabel : 'Month'}
                    </Text>
                    <Ionicons name="chevron-down" size={11}
                        color={hasMonthFilter ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>

                {/* Clear group+month button */}
                {(hasGroupFilter || hasMonthFilter) && (
                    <TouchableOpacity
                        style={styles.clearBtn}
                        onPress={() => { setGroupId('all'); setMonth('all'); }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Count */}
            <Text style={styles.countLabel}>
                {payments.length} PAYMENT{payments.length !== 1 ? 'S' : ''}
            </Text>

            {/* List */}
            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
                ) : payments.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyTxt}>No payments match the filters</Text>
                    </View>
                ) : (
                    payments.map(p => {
                        const badge   = BADGE[p.status] || { bg: colors.border, label: p.status };
                        const initial = (p.user?.name || p.user?.phone || '?').charAt(0).toUpperCase();
                        return (
                            <TouchableOpacity
                                key={p._id}
                                style={styles.card}
                                onPress={() => navigation.navigate('AdminPaymentDetail', { payment: p })}
                                activeOpacity={0.75}
                            >
                                <View style={styles.cardRow}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarTxt}>{initial}</Text>
                                    </View>
                                    <View style={styles.cardInfo}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {p.user?.name || p.user?.phone || 'Member'}
                                            </Text>
                                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                                <Text style={styles.badgeTxt}>{badge.label}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.meta} numberOfLines={1}>
                                            <Text style={styles.amount}>₹{p.amount?.toLocaleString()}</Text>
                                            {'  ·  '}{(p.paymentMethod || 'upi').toUpperCase()}
                                            {'  ·  '}M{p.month}
                                            {'  ·  '}{timeAgo(p.paidAt || p.createdAt)}
                                        </Text>
                                        {p.group?.name
                                            ? <Text style={styles.groupName} numberOfLines={1}>{p.group.name}</Text>
                                            : null}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            <PickerModal
                visible={groupModal}
                title="Filter by Group"
                items={groupItems}
                selected={groupId}
                onSelect={(id) => { setGroupId(id); setLoading(true); }}
                onClose={() => setGroupModal(false)}
                colors={colors} styles={styles}
            />
            <PickerModal
                visible={monthModal}
                title="Filter by Month"
                items={monthItems}
                selected={month}
                onSelect={(id) => { setMonth(id); setLoading(true); }}
                onClose={() => setMonthModal(false)}
                colors={colors} styles={styles}
            />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:   { flex: 1, backgroundColor: colors.background },
        header: {
            paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
            borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        title: { fontSize: 20, fontFamily: F.bold, color: colors.text },

        // ── Filter line ──
        filterScroll: { flexGrow: 0 },
        filterRow: {
            paddingHorizontal: 12, paddingVertical: 10,
            gap: 6, alignItems: 'center',
        },

        // Status pills
        pill: {
            height: 32, paddingHorizontal: 12, borderRadius: 16,
            borderWidth: 1, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        pillActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
        pillTxt:      { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary },
        pillTxtActive:{ fontSize: 12, fontFamily: F.semibold, color: '#fff' },

        // Divider between pills and chips
        divider: { width: 1, height: 22, backgroundColor: colors.border, marginHorizontal: 2 },

        // Group / Month chips
        chip: {
            height: 32, paddingHorizontal: 10, borderRadius: 8,
            borderWidth: 1, borderColor: colors.border,
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: colors.backgroundSecondary,
        },
        chipActive: {
            borderColor: colors.primary,
            backgroundColor: (colors.primaryLight || colors.primary + '18'),
        },
        chipTxt:      { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary, maxWidth: 90 },
        chipTxtActive:{ color: colors.primary },
        clearBtn: { paddingHorizontal: 2 },

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
            height: 160, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderStyle: 'dashed',
            borderColor: colors.border, borderRadius: 12, marginTop: 8,
        },
        emptyTxt: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },

        // Card
        card: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6,
        },
        cardRow:  { flexDirection: 'row', alignItems: 'center' },
        avatar: {
            width: 34, height: 34, borderRadius: 17,
            backgroundColor: colors.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 10, borderWidth: 1, borderColor: colors.border,
        },
        avatarTxt: { fontSize: 13, fontFamily: F.bold, color: colors.primary },
        cardInfo:  { flex: 1, minWidth: 0 },
        nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
        name:      { flex: 1, fontSize: 13, fontFamily: F.bold, color: colors.text },
        badge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
        badgeTxt:  { fontSize: 9, fontFamily: F.bold, color: '#fff', letterSpacing: 0.3 },
        meta:      { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        amount:    { fontFamily: F.bold, color: colors.text },
        groupName: { fontSize: 11, fontFamily: F.medium, color: colors.primary, marginTop: 1 },

        // Modal sheet
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
        sheet: {
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: colors.background,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingHorizontal: 16, paddingBottom: 32,
        },
        handle: {
            width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
            alignSelf: 'center', marginTop: 12, marginBottom: 16,
        },
        sheetTitle:   { fontSize: 15, fontFamily: F.bold, color: colors.text, marginBottom: 8 },
        sheetRow: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        sheetRowText: { fontSize: 14, fontFamily: F.regular, color: colors.text },
    });
}
