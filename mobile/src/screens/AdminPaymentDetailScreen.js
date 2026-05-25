import React, { useMemo, useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requestPaymentActionOtp } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import { apiErrMsg } from '../utils/error';
import Toast, { useToast } from '../components/Toast';

const BADGE = {
    paid:     { bg: '#F59E0B', label: 'Awaiting' },
    pending:  { bg: '#6B7280', label: 'Pending' },
    verified: { bg: '#10B981', label: 'Verified' },
    failed:   { bg: '#EF4444', label: 'Rejected' },
    rejected: { bg: '#EF4444', label: 'Rejected' },
};

function Row({ label, value, valueColor }) {
    const { colors } = useTheme();
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
            <Text style={{ fontSize: 13, fontFamily: F.regular, color: colors.textSecondary }}>{label}</Text>
            <Text style={{ fontSize: 13, fontFamily: F.semibold, color: valueColor || colors.text, textAlign: 'right', flex: 1, marginLeft: 16 }}>
                {value || '—'}
            </Text>
        </View>
    );
}

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

export default function AdminPaymentDetailScreen({ route, navigation }) {
    const { payment: initial } = route.params;
    const { colors } = useTheme();
    const [payment, setPayment] = useState(initial);
    const [sendingOtp, setSendingOtp] = useState(false);
    const { toast, show } = useToast();

    useEffect(() => {
        if (route.params?.payment) {
            setPayment(route.params.payment);
        }
    }, [route.params?.payment]);

    const badge = BADGE[payment.status] || { bg: colors.border, label: payment.status };

    const isPending  = payment.status === 'paid';
    const isVerified = payment.status === 'verified';
    const isRejected = payment.status === 'failed' || payment.status === 'rejected';

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

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payment Details</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={styles.badgeText}>{badge.label}</Text>
                </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                {/* Amount card */}
                <View style={styles.amountCard}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <Text style={styles.amountValue}>₹{payment.amount?.toLocaleString()}</Text>
                </View>

                {/* Details */}
                <View style={styles.detailCard}>
                    <Row label="Member"  value={payment.user?.name || payment.user?.phone} />
                    <View style={styles.divider} />
                    <Row label="Group"   value={payment.group?.name} valueColor={colors.primary} />
                    <View style={styles.divider} />
                    <Row label="Method"  value={payment.paymentMethod?.toUpperCase() || 'UPI'} />
                    <View style={styles.divider} />
                    <Row label="Month"   value={payment.month ? `Month ${payment.month}` : undefined} />
                    <View style={styles.divider} />
                    <Row label="Paid"    value={timeAgo(payment.paidAt || payment.createdAt)} />
                    {payment.upiTransactionId ? (
                        <>
                            <View style={styles.divider} />
                            <Row label="Transaction ID" value={payment.upiTransactionId} />
                        </>
                    ) : null}
                    {payment.upiRef ? (
                        <>
                            <View style={styles.divider} />
                            <Row label="UPI Ref" value={payment.upiRef} />
                        </>
                    ) : null}
                    {payment.verifiedBy?.name ? (
                        <>
                            <View style={styles.divider} />
                            <Row label="Verified by" value={payment.verifiedBy.name} />
                        </>
                    ) : null}
                    {payment.notes ? (
                        <>
                            <View style={styles.divider} />
                            <Row label="Notes" value={payment.notes} />
                        </>
                    ) : null}
                </View>

                {/* Action buttons */}
                {sendingOtp ? (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.loadingText}>Sending OTP…</Text>
                    </View>
                ) : isPending ? (
                    <View style={styles.btnRow}>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                            onPress={() => navigateToOtp('verify')}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                            <Text style={styles.actionBtnText}>Verify</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                            onPress={() => navigateToOtp('reject')}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="close-circle-outline" size={18} color="#fff" />
                            <Text style={styles.actionBtnText}>Reject</Text>
                        </TouchableOpacity>
                    </View>
                ) : isVerified ? (
                    <TouchableOpacity
                        style={[styles.changeBtn, { backgroundColor: '#EF4444' }]}
                        onPress={() => navigateToOtp('change-to-rejected')}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="close-circle-outline" size={18} color="#fff" />
                        <Text style={styles.changeBtnText}>Change to Rejected</Text>
                    </TouchableOpacity>
                ) : isRejected ? (
                    <TouchableOpacity
                        style={[styles.changeBtn, { backgroundColor: '#10B981' }]}
                        onPress={() => navigateToOtp('change-to-verified')}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <Text style={styles.changeBtnText}>Change to Verified</Text>
                    </TouchableOpacity>
                ) : null}
            </ScrollView>

            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:    { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 56,
            paddingBottom: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: 12,
        },
        backBtn:     { padding: 2 },
        headerTitle: { flex: 1, fontSize: 18, fontFamily: F.bold, color: colors.text },
        badge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
        },
        badgeText: { fontSize: 12, fontFamily: F.bold, color: '#fff' },

        scroll:  { flex: 1 },
        content: { padding: 16, gap: 12 },

        amountCard: {
            backgroundColor: colors.primary,
            borderRadius: 14,
            padding: 20,
            alignItems: 'center',
        },
        amountLabel: { fontSize: 12, fontFamily: F.regular, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
        amountValue: { fontSize: 32, fontFamily: F.bold, color: '#fff' },

        detailCard: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 16,
        },
        divider: { height: 1, backgroundColor: colors.border },

        loadingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 56,
            gap: 10,
        },
        loadingText: { fontSize: 14, fontFamily: F.medium, color: colors.textSecondary },

        btnRow: { flexDirection: 'row', gap: 10 },
        actionBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            borderRadius: 12,
            gap: 6,
            elevation: 3,
        },
        actionBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },

        changeBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            borderRadius: 12,
            gap: 8,
            elevation: 3,
        },
        changeBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
    });
}
