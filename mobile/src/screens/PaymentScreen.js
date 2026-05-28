import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl, Modal, FlatList, Linking, Alert, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUserPayments, getGroups, initiatePayment, getPaymentConfig } from '../services/api';
import { F } from '../theme';
import Toast, { useToast } from '../components/Toast';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

const STATUS_OPTIONS = [
    { id: 'all',      label: 'All Statuses', dot: null      },
    { id: 'awaiting', label: 'Awaiting',     dot: '#F59E0B' },
    { id: 'pending',  label: 'Pending',      dot: '#6B7280' },
    { id: 'verified', label: 'Verified',     dot: '#10B981' },
    { id: 'rejected', label: 'Rejected',     dot: '#EF4444' },
];

const BADGE = {
    paid:     { bg: '#F59E0B', label: 'Awaiting' },
    pending:  { bg: '#9CA3AF', label: 'Pending'  },
    verified: { bg: '#10B981', label: 'Verified' },
    failed:   { bg: '#EF4444', label: 'Rejected' },
    rejected: { bg: '#EF4444', label: 'Rejected' },
};

const FILTER_DB = {
    awaiting: ['paid'],
    pending:  ['pending'],
    verified: ['verified'],
    rejected: ['failed', 'rejected'],
};

const buildMethods = (colors) => [
    { id: 'upi',  icon: 'qr-code',  color: colors.success, label: 'UPI',           sub: 'GPay, PhonePe, Paytm — 0% fee' },
    { id: 'bank', icon: 'business', color: colors.info,    label: 'Bank Transfer', sub: 'NEFT / IMPS / RTGS' },
    { id: 'cash', icon: 'cash',     color: colors.warning, label: 'Cash',          sub: 'Admin verifies in person' },
];

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

// ─── Dropdown (Group / Month) ─────────────────────────────────────────────────
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

// ─── Status dropdown (multi-select) ──────────────────────────────────────────
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
export default function PaymentScreen({ navigation }) {
    const { user } = useAuth();
    const { colors } = useTheme();
    const { toast, show } = useToast();

    const [payments,   setPayments]   = useState([]);
    const [groups,     setGroups]     = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [upiVpa,     setUpiVpa]     = useState('admin@upi');

    const [statuses,    setStatuses]    = useState(['all']);
    const [groupId,     setGroupId]     = useState('all');
    const [month,       setMonth]       = useState('all');
    const [statusOpen,  setStatusOpen]  = useState(false);
    const [compact,     setCompact]     = useState(false);

    // Quick-pay modal (for card button)
    const [modalVisible,  setModalVisible]  = useState(false);
    const [selectedPay,   setSelectedPay]   = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [utrNumber,     setUtrNumber]     = useState('');
    const [submitting,    setSubmitting]    = useState(false);
    const [utrFocused, utrFocusProps] = useInputFocus();

    const loadData = useCallback(async () => {
        try {
            const [paymentsRes, groupsRes, configRes] = await Promise.all([
                getUserPayments(user._id),
                getGroups(),
                getPaymentConfig(),
            ]);
            setPayments(paymentsRes.data.payments || []);
            setGroups(groupsRes.data.groups || []);
            if (configRes.data.upiVpa) setUpiVpa(configRes.data.upiVpa);
        } catch (err) {
            console.log('Payment load error:', err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user._id]);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    const onRefresh = () => { setRefreshing(true); loadData(); };

    const toggleStatus = (id) => {
        setStatuses(prev => {
            if (id === 'all') return ['all'];
            const without = prev.filter(s => s !== 'all' && s !== id);
            const next = prev.includes(id) ? without : [...without, id];
            return next.length === 0 ? ['all'] : next;
        });
    };

    const openPayModal = (payment) => {
        setSelectedPay(payment);
        setPaymentMethod('');
        setUtrNumber('');
        setModalVisible(true);
    };

    const submitPayment = async (method = paymentMethod) => {
        if (!selectedPay || submitting) return;
        setSubmitting(true);
        try {
            await initiatePayment({
                groupId: selectedPay.group?._id || selectedPay.group,
                month: selectedPay.month,
                amount: selectedPay.amount,
                paymentMethod: method,
                upiTransactionId: utrNumber,
            });
            setModalVisible(false);
            setPaymentMethod('');
            setUtrNumber('');
            show('Payment submitted — pending verification');
            setTimeout(() => loadData(), 600);
        } catch (err) {
            show(err.response?.data?.error || 'Payment failed. Try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUPIPay = () => {
        const groupName = selectedPay.group?.name || 'Group';
        const amount    = selectedPay.amount;
        const month     = selectedPay.month;
        const upiUrl    = `upi://pay?pa=${upiVpa}&pn=EMI+Group&am=${amount}&tn=EMI+Month+${month}+${groupName}&cu=INR`;
        Alert.alert(
            `Pay ₹${amount?.toLocaleString()}`,
            `${groupName} · Month ${month}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open UPI App',
                    onPress: async () => {
                        const supported = await Linking.canOpenURL(upiUrl).catch(() => false);
                        if (supported) {
                            await Linking.openURL(upiUrl);
                            await submitPayment('upi');
                        } else {
                            show('No UPI app found. Install Google Pay, PhonePe, or Paytm.', 'error');
                        }
                    },
                },
            ]
        );
    };

    const visible = useMemo(() => {
        const isAll = statuses.includes('all');
        return payments
            .filter(p => {
                if (!isAll) {
                    const allowed = statuses.flatMap(s => FILTER_DB[s] || [s]);
                    if (!allowed.includes(p.status)) return false;
                }
                if (groupId !== 'all' && (p.group?._id || p.group) !== groupId) return false;
                if (month !== 'all' && p.month !== month) return false;
                return true;
            })
            .sort((a, b) => {
                const rank = { pending: 0, failed: 1, rejected: 1, paid: 2, verified: 3 };
                return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || (b.month || 0) - (a.month || 0);
            });
    }, [payments, statuses, groupId, month]);

    const maxMonth = groups.length > 0 ? Math.max(...groups.map(g => g.totalMonths || 0), 24) : 24;
    const groupItems = [
        { value: 'all', label: 'All Groups' },
        ...groups.map(g => ({ value: g._id, label: g.name })),
    ];
    const monthItems = [
        { value: 'all', label: 'All Months' },
        ...Array.from({ length: maxMonth }, (_, i) => ({ value: i + 1, label: `Month ${i + 1}` })),
    ];

    const styles = useMemo(() => makeStyles(colors), [colors]);

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
    }

    return (
        <View style={styles.root}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <Text style={styles.title}>Payments</Text>
            </View>

            {/* ── Filter dropdowns ── */}
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
                        onSelect={v => setMonth(v)} colors={colors} styles={styles} icon="calendar" />
                </View>
            </View>

            <View style={styles.countRow}>
                <Text style={styles.countLabel}>
                    {visible.length} PAYMENT{visible.length !== 1 ? 'S' : ''}
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
                {visible.length === 0 ? (
                    <View style={styles.empty}>
                        <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
                        <Text style={styles.emptyTxt}>No payments match filters</Text>
                    </View>
                ) : (
                    visible.map(p => {
                        const badge      = BADGE[p.status] || { bg: colors.border, label: p.status };
                        const isRejected = p.status === 'failed' || p.status === 'rejected';
                        const canPay     = p.status === 'pending' || isRejected;
                        const groupObj   = typeof p.group === 'object' ? p.group : groups.find(g => g._id === p.group);
                        return (
                            <TouchableOpacity
                                key={p._id}
                                style={[styles.card, isRejected && styles.cardRejected]}
                                onPress={() => navigation.navigate('PaymentDetail', { payment: p, upiVpa })}
                                activeOpacity={0.75}
                            >
                                <View style={[styles.cardInner, compact && styles.cardInnerCompact]}>
                                    {/* Avatar — hidden in compact */}
                                    {!compact && (
                                        <View style={styles.avatar}>
                                            <Ionicons name="receipt-outline" size={20} color={colors.textSecondary} />
                                        </View>
                                    )}

                                    {/* Content */}
                                    <View style={styles.cardBody}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.name} numberOfLines={1}>
                                                {groupObj?.name || `Month ${p.month}`}
                                            </Text>
                                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                                <Text style={styles.badgeTxt}>{badge.label}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.meta} numberOfLines={1}>
                                            {'₹'}{p.amount?.toLocaleString('en-IN')}
                                            {' · '}{(p.paymentMethod || 'UPI').toUpperCase()}
                                            {' · '}{timeAgo(p.paidAt || p.createdAt)}
                                        </Text>
                                        {!compact && (
                                            <Text style={styles.groupName}>{'Month '}{p.month}</Text>
                                        )}

                                        {/* Payment button on card for pending / rejected */}
                                        {canPay && (
                                            <TouchableOpacity
                                                style={[styles.cardPayBtn, isRejected && { backgroundColor: '#EF4444' }]}
                                                onPress={(e) => { e.stopPropagation?.(); openPayModal(p); }}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name={isRejected ? 'refresh' : 'card'} size={14} color="#fff" />
                                                <Text style={styles.cardPayTxt}>{isRejected ? 'Resubmit Payment' : 'Make Payment'}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            {/* ── Quick-pay Modal (card button) ── */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => !submitting && setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.sheetHandleBar} />

                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>
                                    {(selectedPay?.status === 'rejected' || selectedPay?.status === 'failed') ? 'Resubmit Payment' : 'Choose Payment Method'}
                                </Text>
                                {selectedPay && (
                                    <Text style={styles.modalSub}>
                                        ₹{selectedPay.amount?.toLocaleString()} · {selectedPay.group?.name || `Month ${selectedPay.month}`}
                                    </Text>
                                )}
                            </View>
                            {!submitting && (
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Rejection reason banner — shown when resubmitting so member knows what to fix */}
                        {(selectedPay?.status === 'rejected' || selectedPay?.status === 'failed') && selectedPay?.notes ? (
                            <View style={styles.rejectBanner}>
                                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginTop: 1 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rejectBannerTitle}>Rejected by admin</Text>
                                    <Text style={styles.rejectBannerBody}>{selectedPay.notes}</Text>
                                </View>
                            </View>
                        ) : null}

                        {!paymentMethod ? (
                            <View style={styles.methodGrid}>
                                {buildMethods(colors).map(m => (
                                    <TouchableOpacity
                                        key={m.id}
                                        style={styles.methodCard}
                                        onPress={() => m.id === 'upi' ? handleUPIPay() : setPaymentMethod(m.id)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.methodIconCircle, { backgroundColor: (m.color || colors.primary) + '18' }]}>
                                            <Ionicons name={m.icon} size={24} color={m.color || colors.primary} />
                                        </View>
                                        <View style={styles.methodTextCol}>
                                            <Text style={styles.methodLabel}>{m.label}</Text>
                                            <Text style={styles.methodSub}>{m.sub}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <ScrollView>
                                {paymentMethod === 'bank' && (
                                    <>
                                        <Text style={styles.infoLabel}>Bank Account Details</Text>
                                        <View style={styles.bankCard}>
                                            {[
                                                ['Account Name', 'EMI Group Admin'],
                                                ['Account No', '1234567890'],
                                                ['IFSC Code', 'HDFC0001234'],
                                                ['Bank', 'HDFC Bank'],
                                            ].map(([k, v]) => (
                                                <View key={k} style={styles.bankRow}>
                                                    <Text style={styles.bankKey}>{k}</Text>
                                                    <Text style={styles.bankVal}>{v}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <Text style={styles.infoLabel}>UTR / Reference Number</Text>
                                        <TextInput
                                            style={[styles.textInput, webOutlineReset, focusBorder(colors, utrFocused)]}
                                            placeholder="Enter transaction reference"
                                            placeholderTextColor={colors.textSecondary}
                                            value={utrNumber}
                                            onChangeText={setUtrNumber}
                                            {...utrFocusProps}
                                        />
                                    </>
                                )}
                                {paymentMethod === 'cash' && (
                                    <View style={styles.infoBox}>
                                        <Ionicons name="information-circle" size={20} color={colors.warning} />
                                        <Text style={styles.infoText}>
                                            Hand over cash to the admin and submit to mark as pending verification.
                                        </Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                    onPress={() => submitPayment(paymentMethod)}
                                    disabled={submitting}
                                    activeOpacity={0.85}
                                >
                                    {submitting
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={styles.submitText}>Submit Payment</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.backBtn} onPress={() => setPaymentMethod('')}>
                                    <Text style={styles.backBtnText}>← Back to methods</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:   { flex: 1, backgroundColor: colors.background },
        center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },

        // ── Header ──
        header: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 56, paddingBottom: 10, paddingHorizontal: 16,
        },
        title: { fontSize: 26, fontFamily: F.bold, color: colors.text },

        // ── Filter dropdowns ──
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

        // ── Count row ──
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
        cardRejected:     { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
        cardInner:        { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
        cardInnerCompact: { padding: 10, gap: 10 },
        avatar: {
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            borderWidth: 1, borderColor: colors.border,
        },
        cardBody: { flex: 1, minWidth: 0 },
        nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
        name:     { flex: 1, fontSize: 15, fontFamily: F.bold, color: colors.text },
        badge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
        badgeTxt: { fontSize: 11, fontFamily: F.bold, color: '#fff' },
        meta:     { fontSize: 12, fontFamily: F.semibold, color: colors.text, marginBottom: 3 },
        groupName:{ fontSize: 12, fontFamily: F.regular, color: colors.textTertiary },

        // Pay button on card
        cardPayBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
            height: 38, borderRadius: 10, backgroundColor: colors.primary, marginTop: 10,
        },
        cardPayTxt: { fontSize: 13, fontFamily: F.semibold, color: '#fff' },

        // ── Quick-pay modal ──
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        modalSheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 40, maxHeight: '85%',
        },
        sheetHandleBar: {
            width: 32, height: 4, backgroundColor: colors.border,
            borderRadius: 2, alignSelf: 'center', marginBottom: 16,
        },
        modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },

        // Rejection reason banner inside resubmit modal
        rejectBanner: {
            flexDirection: 'row', gap: 8, alignItems: 'flex-start',
            backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: '#FECACA', marginBottom: 16,
        },
        rejectBannerTitle: { fontSize: 12, fontFamily: F.semibold, color: '#DC2626', marginBottom: 2 },
        rejectBannerBody:  { fontSize: 12, fontFamily: F.regular,  color: '#B91C1C', lineHeight: 17 },
        modalTitle:   { fontSize: 20, fontFamily: F.semibold, color: colors.text },
        modalSub:     { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, marginTop: 3 },
        methodGrid:   { gap: 10 },
        methodCard: {
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 14, padding: 14,
            backgroundColor: colors.background, gap: 12,
        },
        methodIconCircle: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        methodTextCol:    { flex: 1 },
        methodLabel:      { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        methodSub:        { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        infoLabel:        { fontSize: 14, fontFamily: F.medium, color: colors.text, marginBottom: 8, marginTop: 4 },
        bankCard: {
            backgroundColor: colors.backgroundSecondary, borderRadius: 12,
            padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16,
        },
        bankRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
        bankKey:  { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary },
        bankVal:  { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        textInput: {
            height: 56, paddingHorizontal: 16,
            borderWidth: 1, borderColor: colors.border, borderRadius: 10,
            fontSize: 14, fontFamily: F.regular, color: colors.text,
            backgroundColor: colors.backgroundSecondary, marginBottom: 8,
        },
        infoBox: {
            flexDirection: 'row', alignItems: 'flex-start',
            backgroundColor: colors.warningLight, borderRadius: 10,
            padding: 14, gap: 10, marginBottom: 8,
        },
        infoText:    { fontSize: 14, fontFamily: F.regular, color: colors.warning, flex: 1, lineHeight: 20 },
        submitBtn: {
            height: 56, borderRadius: 12, backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center', marginTop: 8,
            shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
        },
        submitText:  { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
        backBtn:     { alignItems: 'center', marginTop: 14 },
        backBtnText: { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },
    });
}
