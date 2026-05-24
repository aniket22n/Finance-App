import React, { useMemo, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { verifyPayment } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import { apiErrMsg } from '../utils/error';
import Toast, { useToast } from '../components/Toast';

const BADGE = {
    paid:     { bg: '#F59E0B', label: 'Pending' },
    verified: { bg: '#10B981', label: 'Verified' },
    failed:   { bg: '#EF4444', label: 'Rejected' },
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
    const [busy, setBusy] = useState(null); // 'verify' | 'reject'
    const { toast, show } = useToast();

    const badge = BADGE[payment.status] || { bg: colors.border, label: payment.status };
    const canAction = payment.status === 'paid';

    const doVerify = async () => {
        setBusy('verify');
        try {
            await verifyPayment(payment._id, 'verified');
            setPayment(p => ({ ...p, status: 'verified' }));
        } catch (err) {
            show(apiErrMsg(err, 'Failed to verify'), 'error');
        } finally {
            setBusy(null);
        }
    };

    const doReject = () => {
        Alert.alert(
            'Reject Payment',
            `Reject ₹${payment.amount?.toLocaleString()} from ${payment.user?.name || 'member'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject', style: 'destructive', onPress: async () => {
                        setBusy('reject');
                        try {
                            await verifyPayment(payment._id, 'failed');
                            setPayment(p => ({ ...p, status: 'failed' }));
                        } catch (err) {
                            show(apiErrMsg(err, 'Failed to reject'), 'error');
                        } finally {
                            setBusy(null);
                        }
                    },
                },
            ]
        );
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
                <Text style={styles.headerTitle}>Payment Detail</Text>
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
                </View>

                {/* Action buttons — only for pending */}
                {canAction && (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.verifyBtn, busy && styles.btnDisabled]}
                            onPress={doVerify}
                            disabled={!!busy}
                            activeOpacity={0.8}
                        >
                            {busy === 'verify'
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.verifyText}>Verify</Text></>
                            }
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.rejectBtn, busy && styles.btnDisabled]}
                            onPress={doReject}
                            disabled={!!busy}
                            activeOpacity={0.8}
                        >
                            {busy === 'reject'
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <><Ionicons name="close" size={16} color="#fff" /><Text style={styles.rejectText}>Reject</Text></>
                            }
                        </TouchableOpacity>
                    </View>
                )}
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
        badgeText:   { fontSize: 12, fontFamily: F.bold, color: '#fff' },

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

        actions: { flexDirection: 'row', gap: 12 },
        verifyBtn: {
            flex: 1,
            height: 52,
            backgroundColor: '#10B981',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
        },
        rejectBtn: {
            flex: 1,
            height: 52,
            backgroundColor: '#EF4444',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
        },
        btnDisabled: { opacity: 0.5 },
        verifyText:  { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
        rejectText:  { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
    });
}
