import React, { useMemo, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, Linking, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import { initiatePayment } from '../services/api';
import Toast, { useToast } from '../components/Toast';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

const STATUS_CONFIG = {
    paid:     { heroBg: '#FEF3C7', icon: 'hourglass-outline', iconColor: '#D97706', badgeBg: '#FEF3C7', badgeColor: '#D97706', label: 'Awaiting' },
    pending:  { heroBg: '#F3F4F6', icon: 'time-outline',      iconColor: '#6B7280', badgeBg: '#F3F4F6', badgeColor: '#4B5563', label: 'Pending'  },
    verified: { heroBg: '#D1FAE5', icon: 'checkmark-circle',  iconColor: '#10B981', badgeBg: '#D1FAE5', badgeColor: '#059669', label: 'Verified' },
    failed:   { heroBg: '#FEE2E2', icon: 'close-circle',      iconColor: '#EF4444', badgeBg: '#FEE2E2', badgeColor: '#DC2626', label: 'Rejected' },
    rejected: { heroBg: '#FEE2E2', icon: 'close-circle',      iconColor: '#EF4444', badgeBg: '#FEE2E2', badgeColor: '#DC2626', label: 'Rejected' },
};

const buildMethods = (colors) => [
    { id: 'upi',  icon: 'qr-code',  color: colors.success, label: 'UPI',           sub: 'GPay, PhonePe, Paytm — 0% fee' },
    { id: 'bank', icon: 'business', color: colors.info,    label: 'Bank Transfer', sub: 'NEFT / IMPS / RTGS' },
    { id: 'cash', icon: 'cash',     color: colors.warning, label: 'Cash',          sub: 'Admin verifies in person' },
];

function formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ', ' +
           d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function InfoRow({ label, value, valueColor, children, colors, noBorder }) {
    return (
        <View style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
            !noBorder && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <Text style={{ fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, width: 110 }}>
                {label}
            </Text>
            {children || (
                <Text style={{ flex: 1, fontSize: 13, fontFamily: F.semibold, color: valueColor || colors.text, textAlign: 'right' }}>
                    {value || '—'}
                </Text>
            )}
        </View>
    );
}

export default function PaymentDetailScreen({ route, navigation }) {
    const { payment, upiVpa = 'admin@upi' } = route.params;
    const { colors } = useTheme();
    const { toast, show } = useToast();

    const [modalVisible,   setModalVisible]   = useState(false);
    const [paymentMethod,  setPaymentMethod]  = useState('');
    const [utrNumber,      setUtrNumber]      = useState('');
    const [submitting,     setSubmitting]     = useState(false);
    const [utrFocused, utrFocusProps] = useInputFocus();

    const cfg        = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
    const isPaid     = payment.status === 'paid';
    const isVerified = payment.status === 'verified';
    const isRejected = payment.status === 'failed' || payment.status === 'rejected';
    const isPending  = payment.status === 'pending';
    const canPay     = isPending || isRejected;

    const heroTimestamp = isPaid
        ? `Submitted on ${formatDate(payment.paidAt || payment.createdAt)}`
        : isVerified
            ? `Verified on ${formatDate(payment.verifiedAt || payment.updatedAt)}`
            : isRejected
                ? `Rejected on ${formatDate(payment.verifiedAt || payment.updatedAt)}`
                : 'Payment not submitted yet';

    const openPayModal = () => {
        setPaymentMethod('');
        setUtrNumber('');
        setModalVisible(true);
    };

    const submitPayment = async (method = paymentMethod) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await initiatePayment({
                groupId: payment.group?._id || payment.group,
                month: payment.month,
                amount: payment.amount,
                paymentMethod: method,
                upiTransactionId: utrNumber,
            });
            setModalVisible(false);
            setPaymentMethod('');
            setUtrNumber('');
            show('Payment submitted — pending verification');
            setTimeout(() => navigation.goBack(), 800);
        } catch (err) {
            show(err.response?.data?.error || 'Payment failed. Try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUPIPay = () => {
        const groupName = payment.group?.name || 'Group';
        const amount    = payment.amount;
        const month     = payment.month;
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

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Details</Text>
                <View style={[styles.statusBadge, { backgroundColor: cfg.badgeBg }]}>
                    <Text style={[styles.statusBadgeText, { color: cfg.badgeColor }]}>{cfg.label}</Text>
                </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* ── Hero card ── */}
                <View style={[styles.heroCard, { backgroundColor: cfg.heroBg }]}>
                    <View style={styles.heroLeft}>
                        <Text style={styles.heroMonthLabel} numberOfLines={1}>
                            Month {payment.month} Payment
                            {payment.group?.name ? <Text style={styles.heroGroupFaint}> ({payment.group.name})</Text> : ''}
                        </Text>
                        <Text style={styles.heroAmount}>₹{payment.amount?.toLocaleString('en-IN')}</Text>
                        <Text style={styles.heroTimestamp}>{heroTimestamp}</Text>
                    </View>
                    <Ionicons name={cfg.icon} size={40} color={cfg.iconColor} />
                </View>

                {/* ── Payment Information ── */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Information</Text>
                    <View style={styles.card}>
                        <InfoRow label="Group" value={payment.group?.name || '—'} colors={colors} noBorder />
                        <InfoRow label="Method" value={(payment.paymentMethod || 'UPI').toUpperCase()} colors={colors} />
                        <InfoRow label="Month" value={`Month ${payment.month}`} colors={colors} />
                        {(payment.paidAt || payment.createdAt) && (
                            <InfoRow label="Submitted" value={formatDate(payment.paidAt || payment.createdAt)} colors={colors} />
                        )}
                        {payment.upiTransactionId ? (
                            <InfoRow label="Transaction ID" value={payment.upiTransactionId} colors={colors} />
                        ) : null}
                        {payment.upiRef ? (
                            <InfoRow label="UPI Ref" value={payment.upiRef} colors={colors} />
                        ) : null}
                        {isVerified && payment.verifiedBy?.name ? (
                            <InfoRow label="Verified By" value={payment.verifiedBy.name} colors={colors} />
                        ) : null}
                    </View>
                </View>

                {/* ── Rejection Reason ── */}
                {isRejected && payment.notes ? (
                    <View style={styles.section}>
                        <View style={styles.rejectionBox}>
                            <Ionicons name="alert-circle-outline" size={18} color="#DC2626" style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.rejectionTitle}>Rejection Reason</Text>
                                <Text style={styles.rejectionBody}>{payment.notes}</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                {/* ── Pending info box ── */}
                {isPending ? (
                    <View style={styles.section}>
                        <View style={styles.pendingBox}>
                            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pendingBoxTitle}>Payment not submitted yet</Text>
                                <Text style={styles.pendingBoxBody}>Tap "Make Payment" below to pay your EMI for this month.</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                {/* ── Awaiting info box ── */}
                {isPaid ? (
                    <View style={styles.section}>
                        <View style={[styles.pendingBox, { backgroundColor: '#FEF3C720', borderColor: '#F59E0B40' }]}>
                            <Ionicons name="hourglass-outline" size={18} color="#D97706" style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.pendingBoxTitle, { color: '#D97706' }]}>Awaiting Verification</Text>
                                <Text style={[styles.pendingBoxBody, { color: '#92400E' }]}>Your payment has been submitted. Admin will verify it shortly.</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                {/* ── Activity History ── */}
                {(isVerified || isRejected) && payment.verifiedAt ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Activity History</Text>
                        <View style={styles.card}>
                            <View style={styles.activityRow}>
                                <View style={[styles.activityDot, { backgroundColor: cfg.iconColor }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.activityLabel}>
                                        {isVerified ? 'Payment Verified' : 'Payment Rejected'}
                                    </Text>
                                    <Text style={styles.activityMeta}>
                                        {formatDate(payment.verifiedAt)}
                                        {payment.verifiedBy?.name ? ` by ${payment.verifiedBy.name}` : ''}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                ) : null}

                {/* ── Payment action ── */}
                {canPay && (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.payBtn, isRejected && { backgroundColor: '#EF4444' }]}
                            onPress={openPayModal}
                            activeOpacity={0.85}
                        >
                            <Ionicons name={isRejected ? 'refresh' : 'card'} size={18} color="#fff" />
                            <Text style={styles.payBtnText}>{isRejected ? 'Resubmit Payment' : 'Make Payment'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* ── Payment Method Modal ── */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => !submitting && setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{isRejected ? 'Resubmit Payment' : 'Choose Payment Method'}</Text>
                                <Text style={styles.modalSub}>
                                    ₹{payment.amount?.toLocaleString()} · {payment.group?.name}
                                </Text>
                            </View>
                            {!submitting && (
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Rejection reason banner — shown when resubmitting so member knows what to fix */}
                        {isRejected && payment.notes ? (
                            <View style={styles.rejectBanner}>
                                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginTop: 1 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rejectBannerTitle}>Rejected by admin</Text>
                                    <Text style={styles.rejectBannerBody}>{payment.notes}</Text>
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
                                <TouchableOpacity
                                    style={styles.backBtn}
                                    onPress={() => setPaymentMethod('')}
                                >
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

        header: {
            flexDirection: 'row', alignItems: 'center',
            paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            gap: 10,
        },
        backBtn:         { padding: 2 },
        headerTitle:     { flex: 1, fontSize: 18, fontFamily: F.bold, color: colors.text },
        statusBadge:     { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
        statusBadgeText: { fontSize: 12, fontFamily: F.bold },

        scroll:  { flex: 1 },
        content: { padding: 14, gap: 0 },

        // Hero
        heroCard: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            borderRadius: 14, padding: 16, marginBottom: 14,
        },
        heroLeft:      { flex: 1, paddingRight: 10 },
        heroMonthLabel: { fontSize: 12, fontFamily: F.medium, color: '#374151', marginBottom: 2 },
        heroGroupFaint: { fontSize: 12, fontFamily: F.regular, color: '#9CA3AF' },
        heroAmount:    { fontSize: 28, fontFamily: F.bold, color: '#111827', marginBottom: 3 },
        heroTimestamp: { fontSize: 11, fontFamily: F.regular, color: '#6B7280' },

        // Section
        section:      { marginBottom: 14 },
        sectionTitle: { fontSize: 12, fontFamily: F.semibold, color: colors.textSecondary, marginBottom: 6, letterSpacing: 0.2 },
        card: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 14, paddingHorizontal: 16,
        },

        // Rejection reason
        rejectionBox: {
            flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: '#FECACA',
        },
        rejectionTitle: { fontSize: 13, fontFamily: F.semibold, color: '#DC2626', marginBottom: 3 },
        rejectionBody:  { fontSize: 12, fontFamily: F.regular, color: '#B91C1C', lineHeight: 18 },

        // Pending/info box
        pendingBox: {
            flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: colors.border,
        },
        pendingBoxTitle: { fontSize: 13, fontFamily: F.semibold, color: colors.text, marginBottom: 3 },
        pendingBoxBody:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, lineHeight: 18 },

        // Activity
        activityRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
        activityDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
        activityLabel: { fontSize: 13, fontFamily: F.semibold, color: colors.text, marginBottom: 2 },
        activityMeta:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary },

        // Payment action
        actions: { marginTop: 4, marginBottom: 4 },
        payBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 52, borderRadius: 12, backgroundColor: colors.primary, gap: 8,
        },
        payBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },

        // Payment modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        modalSheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 40, maxHeight: '85%',
        },
        sheetHandle: {
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
