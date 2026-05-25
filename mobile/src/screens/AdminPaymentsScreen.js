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

const STATUS_OPTIONS = [
    { id: 'all',      label: 'All'      },
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
                    style={{ maxHeight: 380 }}
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

function StatusModal({ visible, statuses, onToggle, onClose, colors, styles }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.sheetTitle}>Filter by Status</Text>
                {STATUS_OPTIONS.map(opt => {
                    const active = opt.id === 'all'
                        ? statuses.includes('all')
                        : statuses.includes(opt.id);
                    return (
                        <TouchableOpacity
                            key={opt.id}
                            style={styles.sheetRow}
                            onPress={() => onToggle(opt.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.sheetRowText,
                                active && { color: colors.primary, fontFamily: F.semibold },
                            ]}>
                                {opt.label}
                            </Text>
                            <View style={[
                                styles.checkbox,
                                active && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}>
                                {active && <Ionicons name="checkmark" size={12} color="#fff" />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
                <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.85}>
                    <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
}

export default function AdminPaymentsScreen({ navigation, route }) {
    const { colors } = useTheme();

    const [statuses,  setStatuses]  = useState(['all']);
    const [groupId,   setGroupId]   = useState('all');
    const [month,     setMonth]     = useState('all');

    const [groups,     setGroups]     = useState([]);
    const [payments,   setPayments]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [statusModal, setStatusModal] = useState(false);
    const [groupModal,  setGroupModal]  = useState(false);
    const [monthModal,  setMonthModal]  = useState(false);

    useEffect(() => {
        const incoming = route?.params?.activeFilter;
        if (!incoming || incoming === 'all') return;
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

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const onRefresh = () => { setRefreshing(true); load(); };

    const toggleStatus = (id) => {
        setStatuses(prev => {
            if (id === 'all') return ['all'];
            const without = prev.filter(s => s !== 'all' && s !== id);
            const next = prev.includes(id) ? without : [...without, id];
            return next.length === 0 ? ['all'] : next;
        });
    };

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

    const isAllStatus   = statuses.includes('all');
    const hasGroupFilter = groupId !== 'all';
    const hasMonthFilter = month   !== 'all';

    const statusLabel = isAllStatus
        ? 'Status'
        : statuses.length === 1
            ? STATUS_OPTIONS.find(o => o.id === statuses[0])?.label || 'Status'
            : `${statuses.length} selected`;
    const groupLabel = hasGroupFilter
        ? (groupItems.find(g => g.id === groupId)?.label || 'Group')
        : 'Group';
    const monthLabel = hasMonthFilter
        ? (monthItems.find(m => m.id === month)?.label || 'Month')
        : 'Month';

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.title}>Payments</Text>
            </View>

            {/* ── Three filter chips in one row ── */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.chip, !isAllStatus && styles.chipActive]}
                    onPress={() => setStatusModal(true)}
                    activeOpacity={0.75}
                >
                    <Ionicons
                        name="funnel-outline" size={13}
                        color={!isAllStatus ? colors.primary : colors.textSecondary}
                    />
                    <Text
                        style={[styles.chipTxt, !isAllStatus && styles.chipTxtActive]}
                        numberOfLines={1}
                    >
                        {statusLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={11}
                        color={!isAllStatus ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.chip, hasGroupFilter && styles.chipActive]}
                    onPress={() => setGroupModal(true)}
                    activeOpacity={0.75}
                >
                    <Ionicons name="people-outline" size={13}
                        color={hasGroupFilter ? colors.primary : colors.textSecondary} />
                    <Text
                        style={[styles.chipTxt, hasGroupFilter && styles.chipTxtActive]}
                        numberOfLines={1}
                    >
                        {groupLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={11}
                        color={hasGroupFilter ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.chip, hasMonthFilter && styles.chipActive]}
                    onPress={() => setMonthModal(true)}
                    activeOpacity={0.75}
                >
                    <Ionicons name="calendar-outline" size={13}
                        color={hasMonthFilter ? colors.primary : colors.textSecondary} />
                    <Text
                        style={[styles.chipTxt, hasMonthFilter && styles.chipTxtActive]}
                        numberOfLines={1}
                    >
                        {monthLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={11}
                        color={hasMonthFilter ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <Text style={styles.countLabel}>
                {payments.length} PAYMENT{payments.length !== 1 ? 'S' : ''}
            </Text>

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
                        <Ionicons name="receipt-outline" size={36} color={colors.textSecondary} />
                        <Text style={styles.emptyTxt}>No payments match filters</Text>
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
                                            {'  ·  '}Month {p.month}
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

            <StatusModal
                visible={statusModal}
                statuses={statuses}
                onToggle={toggleStatus}
                onClose={() => { setStatusModal(false); setLoading(true); }}
                colors={colors} styles={styles}
            />
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

        // Three chips row
        filterRow: {
            flexDirection: 'row',
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
        },
        chip: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            height: 36,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: 8,
        },
        chipActive: {
            borderColor: colors.primary,
            backgroundColor: colors.primary + '18',
        },
        chipTxt: {
            flex: 1, fontSize: 12, fontFamily: F.medium,
            color: colors.textSecondary, textAlign: 'center',
        },
        chipTxtActive: { color: colors.primary, fontFamily: F.semibold },

        countLabel: {
            fontSize: 11, fontFamily: F.semibold, color: colors.textTertiary,
            letterSpacing: 0.5, paddingHorizontal: 16, paddingBottom: 6,
        },

        list:        { flex: 1 },
        listContent: { paddingHorizontal: 12, paddingBottom: 90 },
        center:      { paddingTop: 60, alignItems: 'center' },
        empty: {
            paddingTop: 60, alignItems: 'center', justifyContent: 'center', gap: 10,
        },
        emptyTxt: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },

        card: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
        },
        cardRow:  { flexDirection: 'row', alignItems: 'center' },
        avatar: {
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: colors.primary + '18',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 10, borderWidth: 1, borderColor: colors.border,
        },
        avatarTxt: { fontSize: 14, fontFamily: F.bold, color: colors.primary },
        cardInfo:  { flex: 1, minWidth: 0 },
        nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
        name:      { flex: 1, fontSize: 14, fontFamily: F.bold, color: colors.text },
        badge:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
        badgeTxt:  { fontSize: 10, fontFamily: F.bold, color: '#fff' },
        meta:      { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary },
        amount:    { fontFamily: F.semibold, color: colors.text },
        groupName: { fontSize: 11, fontFamily: F.medium, color: colors.primary, marginTop: 2 },

        // Bottom sheet modal
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
        sheet: {
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: colors.background,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            paddingHorizontal: 16, paddingBottom: 28,
        },
        handle: {
            width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
            alignSelf: 'center', marginTop: 12, marginBottom: 16,
        },
        sheetTitle:   { fontSize: 15, fontFamily: F.bold, color: colors.text, marginBottom: 4 },
        sheetRow: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        sheetRowText: { fontSize: 14, fontFamily: F.regular, color: colors.text },
        checkbox: {
            width: 20, height: 20, borderRadius: 4,
            borderWidth: 1.5, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        doneBtn: {
            marginTop: 16, height: 48, borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
        },
        doneBtnText: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
    });
}
