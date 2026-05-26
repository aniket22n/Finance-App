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
    { id: 'all',      label: 'All Statuses', dot: null      },
    { id: 'awaiting', label: 'Awaiting',     dot: '#F59E0B' },
    { id: 'pending',  label: 'Pending',      dot: '#6B7280' },
    { id: 'verified', label: 'Verified',     dot: '#10B981' },
    { id: 'rejected', label: 'Rejected',     dot: '#EF4444' },
];

const STATUS_INFO = [
    { dot: '#F59E0B', label: 'Awaiting', desc: 'Member has paid. You need to verify it.' },
    { dot: '#6B7280', label: 'Pending',  desc: 'Member has not paid yet.',
      hint: 'You can send a reminder. Once they pay, it becomes Awaiting.' },
    { dot: '#10B981', label: 'Verified', desc: 'Payment is confirmed.',
      hint: 'You can change it to Rejected if something is wrong.' },
    { dot: '#EF4444', label: 'Rejected', desc: 'Payment was not accepted.',
      hint: 'Change to Verified if it was a mistake. Once member pays again, it becomes Awaiting.' },
];

const BADGE = {
    paid:     { bg: '#F59E0B', label: 'Awaiting' },
    pending:  { bg: '#9CA3AF', label: 'Pending'  },
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

function groupLabel(group) {
    if (!group?.name) return null;
    if (group.potAmount) {
        const k = group.potAmount >= 1000 ? `₹${group.potAmount / 1000}K` : `₹${group.potAmount}`;
        return `${group.name} — ${k}`;
    }
    return group.name;
}

// ─── Status legend modal ──────────────────────────────────────────────────────
function StatusInfoModal({ visible, onClose, colors }) {
    const s = useMemo(() => infoStyles(colors), [colors]);
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={s.card}>
                    <Text style={s.title}>Payment Statuses</Text>
                    {STATUS_INFO.map((item, i) => (
                        <View key={item.label} style={[s.row, i > 0 && s.rowBorder]}>
                            <View style={[s.dot, { backgroundColor: item.dot }]} />
                            <View style={s.rowText}>
                                <Text style={s.label}>{item.label}</Text>
                                <Text style={s.desc}>{item.desc}</Text>
                                {item.hint && <Text style={s.hint}>{item.hint}</Text>}
                            </View>
                        </View>
                    ))}
                    <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.8}>
                        <Text style={s.closeTxt}>Got it</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

function infoStyles(colors) {
    return StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 32 },
        card: {
            backgroundColor: colors.background, borderRadius: 16, padding: 20,
            borderWidth: 1, borderColor: colors.border,
            shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
        },
        title:     { fontSize: 15, fontFamily: F.bold, color: colors.text, marginBottom: 14 },
        row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
        rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        dot:       { width: 10, height: 10, borderRadius: 5, flexShrink: 0, marginTop: 3 },
        rowText:   { flex: 1 },
        label:     { fontSize: 13, fontFamily: F.semibold, color: colors.text, marginBottom: 1 },
        desc:      { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, lineHeight: 17 },
        hint:      { fontSize: 11, fontFamily: F.regular, color: colors.textTertiary, lineHeight: 16, marginTop: 3 },
        closeBtn:  { marginTop: 14, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
        closeTxt:  { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
    });
}

// ─── Single-select dropdown (Group / Month) ───────────────────────────────────
function Dropdown({ label, value, options, onSelect, colors, styles, icon }) {
    const [open, setOpen] = useState(false);
    const selected   = options.find(o => o.value === value);
    const isFiltered = value !== 'all';
    return (
        <>
            <TouchableOpacity
                style={[styles.dropBtn, isFiltered && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={() => setOpen(true)}
                activeOpacity={0.75}
            >
                <Ionicons name={icon} size={13} color={isFiltered ? colors.primary : colors.textSecondary} />
                <Text style={[styles.dropValue, isFiltered && { color: colors.primary }]} numberOfLines={1}>
                    {selected?.label || label}
                </Text>
                <Ionicons name="chevron-down" size={11} color={isFiltered ? colors.primary : colors.textTertiary} />
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

// ─── Multi-select status dropdown ─────────────────────────────────────────────
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
                <Ionicons name="funnel" size={13} color={isFiltered ? colors.primary : colors.textSecondary} />
                <Text style={[styles.dropValue, isFiltered && { color: colors.primary }]} numberOfLines={1}>
                    {label}
                </Text>
                <Ionicons name="chevron-down" size={11} color={isFiltered ? colors.primary : colors.textTertiary} />
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
                                            <View style={[styles.statusDot, { backgroundColor: opt.dot || colors.border }]} />
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
    const [infoOpen,   setInfoOpen]   = useState(false);
    const [compact,    setCompact]    = useState(false);

    useEffect(() => {
        const { activeFilter, group: inGroup, month: inMonth } = route?.params || {};
        if (activeFilter !== undefined) {
            if (activeFilter === 'all') {
                setStatuses(['all']);
            } else if (activeFilter === 'pending') {
                setStatuses(['awaiting', 'pending', 'rejected']);
            } else {
                const map = { verified: 'verified', rejected: 'rejected', awaiting: 'awaiting' };
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
    const activeGroup = groups.find(g => g._id === groupId);
    const maxMonth = activeGroup
        ? (activeGroup.totalMonths || 24)
        : groups.length > 0 ? Math.max(...groups.map(g => g.totalMonths || 0)) : 24;
    const monthItems = [
        { value: 'all', label: 'All Months' },
        ...Array.from({ length: maxMonth }, (_, i) => ({ value: i + 1, label: `Month ${i + 1}` })),
    ];

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <Text style={styles.title}>Payments</Text>
                <TouchableOpacity
                    style={styles.infoBtn}
                    onPress={() => setInfoOpen(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="information-circle-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            <StatusInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} colors={colors} />

            {/* ── Filter pills ── */}
            <View style={styles.filterRow}>
                <View style={styles.dropWrap}>
                    <StatusDropdown
                        open={statusOpen} statuses={statuses}
                        onToggle={toggleStatus}
                        onOpen={() => setStatusOpen(true)}
                        onClose={() => setStatusOpen(false)}
                        colors={colors} styles={styles}
                    />
                </View>
                <View style={styles.dropWrap}>
                    <Dropdown label="All Groups" value={groupId} options={groupItems}
                        onSelect={setGroupId} colors={colors} styles={styles} icon="people" />
                </View>
                <View style={styles.dropWrap}>
                    <Dropdown label="All Months" value={month} options={monthItems}
                        onSelect={setMonth} colors={colors} styles={styles} icon="calendar" />
                </View>
            </View>

            <View style={styles.countRow}>
                <Text style={styles.countLabel}>
                    {payments.length} PAYMENT{payments.length !== 1 ? 'S' : ''}
                </Text>
                <TouchableOpacity
                    style={[styles.compactBtn, compact && styles.compactBtnActive]}
                    onPress={() => setCompact(v => !v)}
                    activeOpacity={0.75}
                >
                    <Ionicons name={compact ? 'list' : 'reorder-four'} size={16} color={compact ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
            </View>

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
                        <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
                        <Text style={styles.emptyTxt}>No payments match filters</Text>
                    </View>
                ) : (
                    payments.map(p => {
                        const badge      = BADGE[p.status] || { bg: colors.border, label: p.status };
                        const initial    = (p.user?.name || p.user?.phone || '?').charAt(0).toUpperCase();
                        const isRejected = p.status === 'failed' || p.status === 'rejected';
                        const gl         = groupLabel(p.group);
                        return (
                            <TouchableOpacity
                                key={p._id}
                                style={[styles.card, isRejected && styles.cardRejected]}
                                onPress={() => navigation.navigate('AdminPaymentDetail', { payment: p })}
                                activeOpacity={0.75}
                            >
                                <View style={[styles.cardInner, compact && styles.cardInnerCompact]}>
                                    {/* Avatar — hidden in compact */}
                                    {!compact && (
                                        <View style={styles.avatar}>
                                            <Ionicons name="person" size={20} color={colors.textSecondary} />
                                        </View>
                                    )}

                                    {/* Content */}
                                    <View style={styles.cardBody}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {p.user?.name || p.user?.phone || 'Member'}
                                            </Text>
                                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                                <Text style={styles.badgeTxt}>{badge.label}</Text>
                                            </View>
                                        </View>
                                        {/* Row 2: amount · method · time */}
                                        <Text style={styles.meta} numberOfLines={1}>
                                            {'₹'}{p.amount?.toLocaleString('en-IN')}
                                            {' · '}{(p.paymentMethod || 'UPI').toUpperCase()}
                                            {' · '}{timeAgo(p.paidAt || p.createdAt)}
                                        </Text>
                                        {/* Row 3: month · group — hidden in compact */}
                                        {!compact && (
                                            gl ? (
                                                <Text style={styles.groupName} numberOfLines={1}>
                                                    {'Month '}{p.month}{' · '}{gl}
                                                </Text>
                                            ) : (
                                                <Text style={styles.groupName}>{'Month '}{p.month}</Text>
                                            )
                                        )}
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
        root:  { flex: 1, backgroundColor: colors.background },

        // ── Header ──
        header: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 56, paddingBottom: 10, paddingHorizontal: 16,
        },
        title:   { fontSize: 26, fontFamily: F.bold, color: colors.text },
        infoBtn: { padding: 4 },

        // ── Filter pills ──
        filterRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
        dropWrap:  { flex: 1 },
        dropBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: colors.background,
            borderWidth: 1.5, borderColor: colors.border,
            borderRadius: 100, paddingHorizontal: 10, paddingVertical: 8,
        },
        dropValue: { flex: 1, fontSize: 12, fontFamily: F.medium, color: colors.text },

        // ── Bottom sheet ──
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
            borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4,
        },
        sheetIconBox: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
        sheetTitle:   { fontSize: 15, fontFamily: F.semibold, color: colors.text },
        optionList:   { paddingHorizontal: 12, paddingTop: 8, gap: 6 },
        option: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 14, paddingVertical: 13,
            borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
        },
        optionLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
        optionTxt:   { fontSize: 14, fontFamily: F.regular, color: colors.text },
        optionCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
        statusDot:   { width: 9, height: 9, borderRadius: 5 },
        checkbox: {
            width: 20, height: 20, borderRadius: 5,
            borderWidth: 1.5, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        doneBtn: { marginHorizontal: 16, marginTop: 12, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        doneTxt: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },

        // ── Count ──
        countRow: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingBottom: 6,
        },
        countLabel: { fontSize: 11, fontFamily: F.semibold, color: colors.textTertiary, letterSpacing: 0.6 },
        compactBtn: {
            width: 30, height: 30, borderRadius: 8,
            borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center', justifyContent: 'center',
        },
        compactBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },

        // ── List ──
        list:        { flex: 1 },
        listContent: { paddingHorizontal: 14, paddingBottom: 100, gap: 10 },
        center:      { paddingTop: 60, alignItems: 'center' },
        empty:       { paddingTop: 60, alignItems: 'center', gap: 10 },
        emptyTxt:    { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },

        // ── Card ──
        card: {
            backgroundColor: colors.background,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 14,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
        },
        cardRejected: {
            borderLeftWidth: 3, borderLeftColor: '#EF4444',
        },
        cardInner:        { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
        cardInnerCompact: { padding: 10, gap: 10 },
        avatar: {
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            borderWidth: 1, borderColor: colors.border,
        },
        cardBody:  { flex: 1, minWidth: 0 },
        nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
        name:     { flex: 1, fontSize: 15, fontFamily: F.bold, color: colors.text },
        badge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
        badgeTxt: { fontSize: 11, fontFamily: F.bold, color: '#fff' },
        meta:     { fontSize: 12, fontFamily: F.semibold, color: colors.text, marginBottom: 3 },
        groupName:{ fontSize: 12, fontFamily: F.regular, color: colors.textTertiary },
    });
}
