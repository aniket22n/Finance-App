import React, { useMemo, useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requestPaymentActionOtp, adminChangePaymentStatus, sendPaymentReminder } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { F } from '../theme';
import { apiErrMsg } from '../utils/error';
import Toast, { useToast } from '../components/Toast';

const STATUS_CONFIG = {
    paid:     { heroBg: '#FEF3C7', icon: 'hourglass-outline', iconColor: '#D97706', badgeBg: '#FEF3C7', badgeColor: '#D97706', label: 'Awaiting' },
    pending:  { heroBg: '#F3F4F6', icon: 'time-outline',      iconColor: '#6B7280', badgeBg: '#F3F4F6', badgeColor: '#4B5563', label: 'Pending'  },
    verified: { heroBg: '#D1FAE5', icon: 'checkmark-circle',  iconColor: '#10B981', badgeBg: '#D1FAE5', badgeColor: '#059669', label: 'Verified' },
    failed:   { heroBg: '#FEE2E2', icon: 'close-circle',      iconColor: '#EF4444', badgeBg: '#FEE2E2', badgeColor: '#DC2626', label: 'Rejected' },
    rejected: { heroBg: '#FEE2E2', icon: 'close-circle',      iconColor: '#EF4444', badgeBg: '#FEE2E2', badgeColor: '#DC2626', label: 'Rejected' },
};

function formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
           ', ' +
           d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatMonth(payment) {
    const m = payment.month;
    if (!m) return '—';
    const dateRef = payment.paidAt || payment.createdAt;
    if (dateRef) {
        const d = new Date(dateRef);
        const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        return `${label} (Month ${m})`;
    }
    return `Month ${m}`;
}

function formatPot(group) {
    if (!group?.name) return null;
    if (!group?.potAmount) return group.name;
    const k = group.potAmount >= 1000 ? `₹${group.potAmount / 1000}K` : `₹${group.potAmount}`;
    return `${group.name} — ${k}`;
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

export default function AdminPaymentDetailScreen({ route, navigation }) {
    const { payment: initial } = route.params;
    const { colors } = useTheme();
    const { user: admin } = useAuth();
    const [payment,      setPayment]      = useState(initial);
    const [sendingOtp,   setSendingOtp]   = useState(false);
    const [reminding,    setReminding]    = useState(false);
    const [changeModal,  setChangeModal]  = useState(null); // 'change-to-rejected' | 'change-to-verified'
    const [otpValue,     setOtpValue]     = useState('');
    const [otpError,     setOtpError]     = useState('');
    const [otpLoading,   setOtpLoading]   = useState(false);
    const [sendingModal, setSendingModal] = useState(false);
    const { toast, show } = useToast();

    useEffect(() => {
        if (route.params?.payment) setPayment(route.params.payment);
    }, [route.params?.payment]);

    const cfg        = STATUS_CONFIG[payment.status] || STATUS_CONFIG.pending;
    const isPending  = payment.status === 'paid';
    const isVerified = payment.status === 'verified';
    const isRejected = payment.status === 'failed' || payment.status === 'rejected';
    const isNotPaid  = payment.status === 'pending';
    const canRemind  = isNotPaid || isRejected;

    const heroTimestamp = isPending
        ? `Submitted on ${formatDate(payment.paidAt || payment.createdAt)}`
        : isVerified
            ? `Verified on ${formatDate(payment.verifiedAt || payment.updatedAt)}`
            : isRejected
                ? `Rejected on ${formatDate(payment.verifiedAt || payment.updatedAt)}`
                : 'Payment not submitted yet';

    const openChangeModal = async (action) => {
        setSendingModal(true);
        try {
            await requestPaymentActionOtp(payment._id);
            setOtpValue('');
            setOtpError('');
            setChangeModal(action);
        } catch (err) {
            show(apiErrMsg(err, 'Could not send OTP'), 'error');
        } finally {
            setSendingModal(false);
        }
    };

    const submitChangeOtp = async () => {
        if (!otpValue.trim()) { setOtpError('Please enter the OTP'); return; }
        setOtpLoading(true);
        setOtpError('');
        try {
            const newStatus = changeModal === 'change-to-verified' ? 'verified' : 'rejected';
            await adminChangePaymentStatus(payment._id, newStatus, otpValue.trim());
            setChangeModal(null);
            show(`Payment marked as ${newStatus}`);
            setTimeout(() => navigation.goBack(), 800);
        } catch (err) {
            setOtpError(apiErrMsg(err, 'Invalid OTP. Please try again.'));
        } finally {
            setOtpLoading(false);
        }
    };

    const navigateToOtp = async (action) => {
        setSendingOtp(true);
        try {
            await requestPaymentActionOtp(payment._id);
        } catch (err) {
            show(apiErrMsg(err, 'Could not send OTP'), 'error');
            setSendingOtp(false);
            return;
        }
        setSendingOtp(false);
        navigation.navigate('AdminPaymentOTP', {
            paymentId:  payment._id,
            action,
            amount:     payment.amount,
            memberName: payment.user?.name || payment.user?.phone || 'Member',
        });
    };

    const confirmReminder = () => {
        const memberName = payment.user?.name || payment.user?.phone || 'this member';
        const message = isRejected
            ? `Send a reminder to ${memberName} to resubmit their rejected payment?`
            : `Send a payment reminder to ${memberName} for this month's EMI?`;
        Alert.alert('Send Reminder', message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send', onPress: handleRemind },
        ]);
    };

    const handleRemind = async () => {
        setReminding(true);
        try {
            const res = await sendPaymentReminder(payment._id);
            show(res.data.message || 'Reminder sent');
        } catch (err) {
            show(err.response?.data?.message || 'Failed to send reminder', 'error');
        } finally {
            setReminding(false);
        }
    };

    const memberInitial = (payment.user?.name || payment.user?.phone || '?').charAt(0).toUpperCase();
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
                        {/* Member */}
                        <InfoRow label="Member" colors={colors} noBorder>
                            <View style={styles.memberRow}>
                                <View style={[styles.memberAvatar, { backgroundColor: colors.backgroundSecondary }]}>
                                    <Text style={[styles.memberInitial, { color: colors.textSecondary }]}>{memberInitial}</Text>
                                </View>
                                <Text style={[styles.memberName, { color: colors.text }]}>
                                    {payment.user?.name || payment.user?.phone || '—'}
                                </Text>
                            </View>
                        </InfoRow>

                        <InfoRow label="Method"  value={(payment.paymentMethod || 'UPI').toUpperCase()} colors={colors} />
                        <InfoRow label="Month"   value={`Month ${payment.month}`} colors={colors} />

                        {(payment.paidAt || payment.createdAt) && (
                            <InfoRow label="Paid" value={formatDate(payment.paidAt || payment.createdAt)} colors={colors} />
                        )}

                        {payment.upiTransactionId ? (
                            <InfoRow label="Transaction ID" value={payment.upiTransactionId} colors={colors} />
                        ) : null}
                        {payment.upiRef ? (
                            <InfoRow label="UPI Ref" value={payment.upiRef} colors={colors} />
                        ) : null}
                        {payment.verifiedBy?.name ? (
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
                {isNotPaid ? (
                    <View style={styles.section}>
                        <View style={styles.pendingBox}>
                            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} style={{ marginTop: 1 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pendingBoxTitle}>Payment not submitted yet</Text>
                                <Text style={styles.pendingBoxBody}>No payment has been submitted for this month. You can send a reminder to the member.</Text>
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

                {/* ── Action buttons ── */}
                <View style={styles.actions}>
                    {sendingOtp ? (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator color={colors.primary} />
                            <Text style={styles.loadingText}>Sending OTP…</Text>
                        </View>
                    ) : isPending ? (
                        <View style={styles.btnRow}>
                            <TouchableOpacity style={[styles.filledBtn, { backgroundColor: '#10B981' }]} onPress={() => navigateToOtp('verify')} activeOpacity={0.85}>
                                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                                <Text style={styles.filledBtnText}>Verify Payment</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.filledBtn, { backgroundColor: '#EF4444' }]} onPress={() => navigateToOtp('reject')} activeOpacity={0.85}>
                                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                                <Text style={styles.filledBtnText}>Reject Payment</Text>
                            </TouchableOpacity>
                        </View>
                    ) : isVerified ? (
                        <TouchableOpacity
                            style={[styles.filledBtn, { backgroundColor: '#EF4444' }, sendingModal && { opacity: 0.6 }]}
                            onPress={() => openChangeModal('change-to-rejected')}
                            disabled={sendingModal}
                            activeOpacity={0.85}
                        >
                            {sendingModal
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Ionicons name="close-circle-outline" size={18} color="#fff" />}
                            <Text style={styles.filledBtnText}>Change to Rejected</Text>
                        </TouchableOpacity>
                    ) : isRejected ? (
                        <TouchableOpacity
                            style={[styles.filledBtn, { backgroundColor: '#10B981' }, sendingModal && { opacity: 0.6 }]}
                            onPress={() => openChangeModal('change-to-verified')}
                            disabled={sendingModal}
                            activeOpacity={0.85}
                        >
                            {sendingModal
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />}
                            <Text style={styles.filledBtnText}>Change to Verified</Text>
                        </TouchableOpacity>
                    ) : null}

                    {canRemind && (
                        <TouchableOpacity
                            style={[styles.filledBtn, { backgroundColor: '#F59E0B' }, reminding && { opacity: 0.6 }]}
                            onPress={confirmReminder}
                            disabled={reminding}
                            activeOpacity={0.85}
                        >
                            {reminding
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Ionicons name="notifications-outline" size={18} color="#fff" />}
                            <Text style={styles.filledBtnText}>{reminding ? 'Sending…' : 'Send Reminder'}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* ── Change status OTP modal ── */}
            <Modal visible={!!changeModal} transparent animationType="fade" onRequestClose={() => !otpLoading && setChangeModal(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        {/* Icon */}
                        <View style={[styles.modalIconCircle, { backgroundColor: changeModal === 'change-to-verified' ? '#D1FAE5' : '#FEE2E2' }]}>
                            <Ionicons
                                name={changeModal === 'change-to-verified' ? 'checkmark-circle' : 'close-circle'}
                                size={32}
                                color={changeModal === 'change-to-verified' ? '#10B981' : '#EF4444'}
                            />
                        </View>

                        {/* Title */}
                        <Text style={styles.modalTitle}>
                            {changeModal === 'change-to-verified' ? 'Change to Verified' : 'Change to Rejected'}
                        </Text>

                        {/* Subtitle */}
                        <Text style={styles.modalSub}>
                            Enter the OTP sent to{'\n'}
                            {admin?.phone ? `+91 ${admin.phone}` : 'your phone'} to confirm this change.
                        </Text>

                        {/* OTP input */}
                        <TextInput
                            style={[styles.otpInput, otpError && { borderColor: '#EF4444' }]}
                            placeholder="Enter OTP"
                            placeholderTextColor={colors.textTertiary}
                            value={otpValue}
                            onChangeText={v => { setOtpValue(v); setOtpError(''); }}
                            keyboardType="number-pad"
                            maxLength={6}
                            editable={!otpLoading}
                            autoFocus
                        />
                        {otpError ? <Text style={styles.otpErrText}>{otpError}</Text> : null}

                        {/* Confirm button */}
                        <TouchableOpacity
                            style={[styles.modalConfirmBtn,
                                { backgroundColor: changeModal === 'change-to-verified' ? '#10B981' : '#EF4444' },
                                otpLoading && { opacity: 0.6 }]}
                            onPress={submitChangeOtp}
                            disabled={otpLoading}
                            activeOpacity={0.85}
                        >
                            {otpLoading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.modalConfirmText}>
                                    {changeModal === 'change-to-verified' ? 'Confirm Verify' : 'Confirm Reject'}
                                  </Text>}
                        </TouchableOpacity>

                        {/* Cancel */}
                        <TouchableOpacity onPress={() => setChangeModal(null)} disabled={otpLoading} activeOpacity={0.7}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
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
        heroLeft:       { flex: 1, paddingRight: 10 },
        heroMonthLabel:  { fontSize: 12, fontFamily: F.medium, color: '#374151', marginBottom: 2 },
        heroGroupFaint:  { fontSize: 12, fontFamily: F.regular, color: '#9CA3AF' },
        heroAmount:     { fontSize: 28, fontFamily: F.bold, color: '#111827', marginBottom: 3 },
        heroTimestamp:  { fontSize: 11, fontFamily: F.regular, color: '#6B7280' },

        // Section
        section:      { marginBottom: 14 },
        sectionTitle: { fontSize: 12, fontFamily: F.semibold, color: colors.textSecondary, marginBottom: 6, letterSpacing: 0.2 },
        card: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 14, paddingHorizontal: 16,
        },

        // Member row
        memberRow:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
        memberAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
        memberInitial:{ fontSize: 12, fontFamily: F.bold },
        memberName:   { fontSize: 13, fontFamily: F.semibold },

        // Rejection reason
        rejectionBox: {
            flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: '#FECACA',
        },
        rejectionTitle: { fontSize: 13, fontFamily: F.semibold, color: '#DC2626', marginBottom: 3 },
        rejectionBody:  { fontSize: 12, fontFamily: F.regular, color: '#B91C1C', lineHeight: 18 },

        // Pending info box
        pendingBox: {
            flexDirection: 'row', gap: 10, alignItems: 'flex-start',
            backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: 14,
            borderWidth: 1, borderColor: colors.border,
        },
        pendingBoxTitle: { fontSize: 13, fontFamily: F.semibold, color: colors.text, marginBottom: 3 },
        pendingBoxBody:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, lineHeight: 18 },

        // Activity
        activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
        activityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
        activityLabel:{ fontSize: 13, fontFamily: F.semibold, color: colors.text, marginBottom: 2 },
        activityMeta: { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary },

        // Actions
        actions:    { gap: 10, marginTop: 4 },
        loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, gap: 10 },
        loadingText:{ fontSize: 14, fontFamily: F.medium, color: colors.textSecondary },

        btnRow:     { flexDirection: 'column', gap: 10 },
        outlineBtn: {
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 52, borderRadius: 12, borderWidth: 1.5, gap: 6,
        },
        outlineBtnText: { fontSize: 14, fontFamily: F.semibold },

        filledBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 52, borderRadius: 12, gap: 8,
        },
        filledBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },

        remindBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: '#F59E0B', gap: 8,
        },
        remindBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#D97706' },

        // ── Change status OTP modal ──
        modalOverlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28,
        },
        modalCard: {
            backgroundColor: colors.background, borderRadius: 20, padding: 28,
            width: '100%', alignItems: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18, shadowRadius: 20, elevation: 16,
        },
        modalIconCircle:  { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
        modalTitle:       { fontSize: 20, fontFamily: F.bold, color: colors.text, marginBottom: 8, textAlign: 'center' },
        modalSub:         { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
        otpInput: {
            width: '100%', height: 52, borderRadius: 12,
            borderWidth: 1.5, borderColor: colors.primary,
            paddingHorizontal: 16, fontSize: 20, fontFamily: F.semibold,
            color: colors.text, backgroundColor: colors.backgroundSecondary,
            textAlign: 'center', letterSpacing: 8, marginBottom: 6,
        },
        otpErrText:       { fontSize: 12, fontFamily: F.medium, color: '#EF4444', marginBottom: 8, alignSelf: 'flex-start' },
        modalConfirmBtn:  { width: '100%', height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 14 },
        modalConfirmText: { fontSize: 15, fontFamily: F.bold, color: '#fff' },
        modalCancelText:  { fontSize: 14, fontFamily: F.medium, color: colors.textSecondary },
    });
}
