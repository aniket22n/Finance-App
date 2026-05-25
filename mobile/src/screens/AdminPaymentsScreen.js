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

// ─── Status options with colour dots ────────────────────────────────────────
const STATUS_OPTIONS = [
    { id: 'all',      label: 'All Statuses', dot: null       },
    { id: 'awaiting', label: 'Awaiting',     dot: '#F59E0B'  },
    { id: 'pending',  label: 'Pending',      dot: '#6B7280'  },
    { id: 'verified', label: 'Verified',     dot: '#10B981'  },
    { id: 'rejected', label: 'Rejected',     dot: '#EF4444'  },
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

// ─── Single-select dropdown (Group / Month) — mirrors dashboard exactly ──────
function Dropdown({ label, value, options, onSelect, colors, styles, icon }) {
    const [open, setOpen] = useState(false);
    const selected  = options.find(o => o.value === value);
    const isFiltered = value !== 'all';
    return (
        <>
            <TouchableOpacity
                style={[styles.dropBtn, isFiltered && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={() => setOpen(true)}
                activeOpacity={0.75}
            >
                <Ionicons name={icon} size={14} color={isFiltered ? colors.primary : colors.textSecondary} />
                <Text style={[styles.dropValue, isFiltered && { color: colors.primary }]} numberOfLines={1}>
                    {selected?.label || label}
                </Text>
                <Ionicons name="chevron-down" size={12} color={isFiltered ? colors.primary : colors.textTertiary} />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <View style={[styles.sheetIconBox, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name={icon} size={16} color={colors.primary} />
                            </View>
                            <Text style={styles.sheetTitle}>Select {label}</Text>
                        </View>
                        <FlatList
                            data={options}
                            keyExtractor={o => String(o.value)}
                            contentContainerStyle={styles.optionList}
                            renderItem={({ item }) => {
                                const active = item.value === value;
                                return (
                                    <TouchableOpacity
                                        style={[styles.option, active && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                                        onPress={() => { onSelect(item.value); setOpen(false); }}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.optionTxt, active && { color: colors.primary, fontFamily: F.semibold }]}>
                                            {item.label}
                                        </Text>
                                        {active && (
                                            <View style={[styles.optionCheck, { backgroundColor: colors.primary }]}>
                                                <Ionicons name="checkmark" size={11} color="#fff" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

// ─── Multi-select status sheet — same visual style, checkboxes + Done ────────
function StatusDropdown({ statuses, onToggle, onClose, onOpen, open, colors, styles }) {
    const isAll      = statuses.includes('all');
    const isFiltered = !isAll;
    const label = isAll
        ? 'Status'
        : statuses.length === 1
            ? STATUS_OPTIONS.find(o => o.id === statuses[0])?.label || 'Status'
            : `${statuses.length} selected`;

    return (
        <>
            <TouchableOpacity
                style={[styles.dropBtn, isFiltered && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={onOpen}
                activeOpacity={0.75}
            >
                <Ionicons name="funnel" size={14} color={isFiltered ? colors.primary : colors.textSecondary} />
                <Text style={[styles.dropValue, isFiltered && { color: colors.primary }]} numberOfLines={1}>
                    {label}
                </Text>
                <Ionicons name="chevron-down" size={12} color={isFiltered ? colors.primary : colors.textTertiary} />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <View style={[styles.sheetIconBox, { backgroundColor: colors.primaryLight }]}>
                                <Ionicons name="funnel" size={16} color={colors.primary} />
                            </View>
                            <Text style={styles.sheetTitle}>Filter by Status</Text>
                        </View>
                        <View style={styles.optionList}>
                            {STATUS_OPTIONS.map(opt => {
                                const active = opt.id === 'all' ? isAll : statuses.includes(opt.id);
                                return (
                                    <TouchableOpacity
                                        key={opt.id}
                                        style={[styles.option, active && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                                        onPress={() => onToggle(opt.id)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.optionLeft}>
                                            {opt.dot !== null ? (
                                                <View style={[styles.statusDot, { backgroundColor: opt.dot || colors.border }]} />
                                            ) : (
                                                <View style={[styles.statusDot, { backgroundColor: colors.border }]} />
                                            )}
                                            <Text style={[styles.optionTxt, active && { color: colors.primary, fontFamily: F.semibold }]}>
                                                {opt.label}
                                            </Text>
                                        </View>
                                        <View style={[styles.checkbox, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                                            {active && <Ionicons name="checkmark" size={11} color="#fff" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={onClose} activeOpacity={0.85}>
                            <Text style={styles.doneTxt}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function AdminPaymentsScreen({ navigation, route }) {
    const { colors } = useTheme();

    const [statuses,  setStatuses]  = useState(['all']);
    const [groupId,   setGroupId]   = useState('all');
    const [month,     setMonth]     = useState('all');

    const [groups,     setGroups]     = useState([]);
    const [payments,   setPayments]   = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [statusOpen, setStatusOpen] = useState(false);

    useEffect(() => {
        const { activeFilter, group: inGroup, month: inMonth } = route?.params || {};
        if (activeFilter !== undefined) {
            if (activeFilter === 'all') {
                setStatuses(['all']);
            } else {
                const map = { pending: 'awaiting', verified: 'verified', rejected: 'rejected', awaiting: 'awaiting' };
                const mapped = map[activeFilter] || activeFilter;
                if (STATUS_OPTIONS.some(o => o.id === mapped)) setStatuses([mapped]);
            }
        }
        if (inGroup !== undefined) setGroupId(inGroup);
        if (inMonth !== undefined) setMonth(inMonth !== 'all' ? Number(inMonth) : 'all');
    }, [route?.params?.activeFilter, route?.params?.group, route?.params?.month]);

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
        { value: 'all', label: 'All Groups' },
        ...groups.map(g => ({ value: g._id, label: g.name })),
    ];
    const maxMonth = groups.length > 0 ? Math.max(...groups.map(g => g.totalMonths || 0)) : 24;
    const monthItems = [
        { value: 'all', label: 'All Months' },
        ...Array.from({ length: maxMonth }, (_, i) => ({ value: i + 1, label: `Month ${i + 1}` })),
    ];

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.title}>Payments</Text>
            </View>

            {/* ── Filter row ── */}
            <View style={styles.filterRow}>
                <View style={styles.dropWrap}>
                    <StatusDropdown
                        open={statusOpen}
                        statuses={statuses}
                        onToggle={toggleStatus}
                        onOpen={() => setStatusOpen(true)}
                        onClose={() => setStatusOpen(false)}
                        colors={colors} styles={styles}
                    />
                </View>
                <View style={styles.dropWrap}>
                    <Dropdown
                        label="Group" value={groupId} options={groupItems}
                        onSelect={setGroupId} colors={colors} styles={styles}
                        icon="people"
                    />
                </View>
                <View style={styles.dropWrap}>
                    <Dropdown
                        label="Month" value={month} options={monthItems}
                        onSelect={setMonth} colors={colors} styles={styles}
                        icon="calendar"
                    />
                </View>
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

        // ── Filter row ────────────────────────────────────────────────────────
        filterRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
        dropWrap:  { flex: 1 },
        dropBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
            borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7,
        },
        dropValue: { flex: 1, fontSize: 12, fontFamily: F.medium, color: colors.text },

        // ── Bottom sheet ──────────────────────────────────────────────────────
        overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingBottom: 36, maxHeight: '70%',
        },
        handle: {
            width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
            alignSelf: 'center', marginTop: 10, marginBottom: 16,
        },
        sheetHeader: {
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingHorizontal: 16, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            marginBottom: 4,
        },
        sheetIconBox: {
            width: 32, height: 32, borderRadius: 9,
            alignItems: 'center', justifyContent: 'center',
        },
        sheetTitle: { fontSize: 15, fontFamily: F.semibold, color: colors.text },
        optionList: { paddingHorizontal: 12, paddingTop: 8, gap: 6 },
        option: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 14, paddingVertical: 13,
            borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
        },
        optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
        optionTxt:   { fontSize: 14, fontFamily: F.regular, color: colors.text },
        optionCheck: {
            width: 20, height: 20, borderRadius: 10,
            alignItems: 'center', justifyContent: 'center',
        },
        statusDot: { width: 9, height: 9, borderRadius: 5 },
        checkbox: {
            width: 20, height: 20, borderRadius: 5,
            borderWidth: 1.5, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        doneBtn: {
            marginHorizontal: 16, marginTop: 12, height: 48,
            borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        },
        doneTxt: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },

        // ── List ──────────────────────────────────────────────────────────────
        countLabel: {
            fontSize: 11, fontFamily: F.semibold, color: colors.textTertiary,
            letterSpacing: 0.5, paddingHorizontal: 16, paddingBottom: 6,
        },
        list:        { flex: 1 },
        listContent: { paddingHorizontal: 12, paddingBottom: 90 },
        center:      { paddingTop: 60, alignItems: 'center' },
        empty:       { paddingTop: 60, alignItems: 'center', justifyContent: 'center', gap: 10 },
        emptyTxt:    { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },

        card: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
        },
        cardRow:   { flexDirection: 'row', alignItems: 'center' },
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
