import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAdminPaymentsList, getGroups } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

const STATUS_OPTIONS = [
    { id: 'all',      label: 'All',      dot: null        },
    { id: 'awaiting', label: 'Awaiting', dot: '#F59E0B'   },
    { id: 'pending',  label: 'Pending',  dot: '#6B7280'   },
    { id: 'verified', label: 'Verified', dot: '#10B981'   },
    { id: 'rejected', label: 'Rejected', dot: '#EF4444'   },
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

// Unified dropdown for all three chips
function DropdownMenu({ visible, anchor, items, multiSelect, selected, onToggle, onSelect, onClose, colors }) {
    if (!visible || !anchor) return null;

    const styles = ddStyles(colors);

    // Clamp so dropdown never goes off right edge (screen width ~360–420)
    const dropW = Math.max(anchor.w, 160);
    const clampLeft = Math.min(anchor.x, 360 - dropW - 8);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
            <View style={[styles.card, { top: anchor.y + anchor.h + 6, left: clampLeft, minWidth: dropW }]}>
                {items.map((item, idx) => {
                    const isActive = multiSelect
                        ? (item.id === 'all' ? selected.includes('all') : selected.includes(item.id))
                        : selected === item.id;
                    const isLast = idx === items.length - 1;

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.row, isLast && styles.rowLast]}
                            onPress={() => {
                                if (multiSelect) {
                                    onToggle(item.id);
                                } else {
                                    onSelect(item.id);
                                    onClose();
                                }
                            }}
                            activeOpacity={0.65}
                        >
                            <View style={styles.rowLeft}>
                                {item.dot !== undefined ? (
                                    <View style={[
                                        styles.dot,
                                        { backgroundColor: item.dot || colors.border },
                                    ]} />
                                ) : null}
                                <Text style={[styles.label, isActive && { color: colors.primary, fontFamily: F.semibold }]}>
                                    {item.label}
                                </Text>
                            </View>
                            {multiSelect ? (
                                <View style={[styles.check, isActive && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                                    {isActive && <Ionicons name="checkmark" size={10} color="#fff" />}
                                </View>
                            ) : (
                                isActive && <Ionicons name="checkmark" size={15} color={colors.primary} />
                            )}
                        </TouchableOpacity>
                    );
                })}
                {multiSelect && (
                    <TouchableOpacity style={styles.doneRow} onPress={onClose} activeOpacity={0.75}>
                        <Text style={styles.doneTxt}>Done</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Modal>
    );
}

function ddStyles(colors) {
    return StyleSheet.create({
        card: {
            position: 'absolute',
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            elevation: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.22,
            shadowRadius: 12,
            overflow: 'hidden',
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        rowLast: { borderBottomWidth: 0 },
        rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
        dot: { width: 8, height: 8, borderRadius: 4 },
        label: { fontSize: 13, fontFamily: F.medium, color: colors.text },
        check: {
            width: 17, height: 17, borderRadius: 4,
            borderWidth: 1.5, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        doneRow: {
            paddingVertical: 11,
            alignItems: 'center',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
        },
        doneTxt: { fontSize: 13, fontFamily: F.semibold, color: colors.primary },
    });
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

    const [openDD,  setOpenDD]  = useState(null); // 'status' | 'group' | 'month' | null
    const [anchors, setAnchors] = useState({});

    const statusRef = useRef(null);
    const groupRef  = useRef(null);
    const monthRef  = useRef(null);

    const refs = { status: statusRef, group: groupRef, month: monthRef };

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

    const openDropdown = (key) => {
        refs[key].current?.measure((_fx, _fy, w, h, px, py) => {
            setAnchors(prev => ({ ...prev, [key]: { x: px, y: py, w, h } }));
            setOpenDD(key);
        });
    };

    const closeDD = () => setOpenDD(null);

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

    const isAllStatus    = statuses.includes('all');
    const hasGroupFilter = groupId !== 'all';
    const hasMonthFilter = month !== 'all';

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

            {/* ── Three filter chips ── */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    ref={statusRef}
                    style={[styles.chip, !isAllStatus && styles.chipActive]}
                    onPress={() => openDropdown('status')}
                    activeOpacity={0.75}
                >
                    <Ionicons name="funnel-outline" size={13}
                        color={!isAllStatus ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.chipTxt, !isAllStatus && styles.chipTxtActive]} numberOfLines={1}>
                        {statusLabel}
                    </Text>
                    <Ionicons
                        name={openDD === 'status' ? 'chevron-up' : 'chevron-down'}
                        size={11} color={!isAllStatus ? colors.primary : colors.textSecondary}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    ref={groupRef}
                    style={[styles.chip, hasGroupFilter && styles.chipActive]}
                    onPress={() => openDropdown('group')}
                    activeOpacity={0.75}
                >
                    <Ionicons name="people-outline" size={13}
                        color={hasGroupFilter ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.chipTxt, hasGroupFilter && styles.chipTxtActive]} numberOfLines={1}>
                        {groupLabel}
                    </Text>
                    <Ionicons
                        name={openDD === 'group' ? 'chevron-up' : 'chevron-down'}
                        size={11} color={hasGroupFilter ? colors.primary : colors.textSecondary}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    ref={monthRef}
                    style={[styles.chip, hasMonthFilter && styles.chipActive]}
                    onPress={() => openDropdown('month')}
                    activeOpacity={0.75}
                >
                    <Ionicons name="calendar-outline" size={13}
                        color={hasMonthFilter ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.chipTxt, hasMonthFilter && styles.chipTxtActive]} numberOfLines={1}>
                        {monthLabel}
                    </Text>
                    <Ionicons
                        name={openDD === 'month' ? 'chevron-up' : 'chevron-down'}
                        size={11} color={hasMonthFilter ? colors.primary : colors.textSecondary}
                    />
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

            {/* Status dropdown — multi-select */}
            <DropdownMenu
                visible={openDD === 'status'}
                anchor={anchors.status}
                items={STATUS_OPTIONS}
                multiSelect
                selected={statuses}
                onToggle={toggleStatus}
                onClose={closeDD}
                colors={colors}
            />

            {/* Group dropdown — single select */}
            <DropdownMenu
                visible={openDD === 'group'}
                anchor={anchors.group}
                items={groupItems}
                multiSelect={false}
                selected={groupId}
                onSelect={setGroupId}
                onClose={closeDD}
                colors={colors}
            />

            {/* Month dropdown — single select */}
            <DropdownMenu
                visible={openDD === 'month'}
                anchor={anchors.month}
                items={monthItems}
                multiSelect={false}
                selected={month}
                onSelect={setMonth}
                onClose={closeDD}
                colors={colors}
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
        empty: { paddingTop: 60, alignItems: 'center', justifyContent: 'center', gap: 10 },
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
    });
}
