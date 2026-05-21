import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAdminPayments, verifyPayment } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import Toast, { useToast } from '../components/Toast';

const FILTERS = [
    { id: 'all',      label: 'All' },
    { id: 'paid',     label: 'Pending' },
    { id: 'verified', label: 'Verified' },
    { id: 'failed',   label: 'Rejected' },
];

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? 's' : ''} ago`;
}

export default function AdminPaymentsScreen() {
    const { colors } = useTheme();
    const [filter, setFilter] = useState('paid');
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [verifying, setVerifying] = useState({});
    const { toast, show } = useToast();

    const loadPayments = async (status) => {
        try {
            const res = await getAdminPayments(status === 'all' ? undefined : status);
            setPayments(res.data.payments || []);
        } catch (err) {
            console.log('Payments load error:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadPayments(filter); }, [filter]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadPayments(filter);
        setRefreshing(false);
    };

    const switchFilter = (id) => {
        if (id === filter) return;
        setFilter(id);
        setLoading(true);
    };

    const doVerify = async (payment) => {
        setVerifying(prev => ({ ...prev, [payment._id]: 'verify' }));
        try {
            await verifyPayment(payment._id, 'verified');
            setPayments(prev => prev.filter(p => p._id !== payment._id));
            show(`✓ Payment verified for ${payment.user?.name || 'member'}`);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to verify');
        } finally {
            setVerifying(prev => { const n = { ...prev }; delete n[payment._id]; return n; });
        }
    };

    const doReject = (payment) => {
        Alert.alert(
            'Reject Payment',
            `Reject ₹${payment.amount?.toLocaleString()} from ${payment.user?.name || 'member'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject', style: 'destructive', onPress: async () => {
                        setVerifying(prev => ({ ...prev, [payment._id]: 'reject' }));
                        try {
                            await verifyPayment(payment._id, 'failed');
                            setPayments(prev => prev.filter(p => p._id !== payment._id));
                            show('Payment rejected', 'error');
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || 'Failed to reject');
                        } finally {
                            setVerifying(prev => { const n = { ...prev }; delete n[payment._id]; return n; });
                        }
                    },
                },
            ]
        );
    };

    const filterLabel = FILTERS.find(f => f.id === filter)?.label || '';
    const styles = makeStyles(colors);

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Payments</Text>
            </View>

            {/* Filter Pills */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
            >
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.id}
                        style={[styles.pill, filter === f.id && styles.pillActive]}
                        onPress={() => switchFilter(f.id)}
                        activeOpacity={0.75}
                    >
                        {filter === f.id && f.id === 'verified' && (
                            <Ionicons name="checkmark" size={11} color="#fff" />
                        )}
                        {filter === f.id && f.id === 'failed' && (
                            <Ionicons name="close" size={11} color="#fff" />
                        )}
                        <Text style={[styles.pillText, filter === f.id && styles.pillTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Count */}
            <Text style={styles.countLabel}>
                {filterLabel.toUpperCase()} PAYMENTS ({payments.length})
            </Text>

            {/* List */}
            <ScrollView
                style={styles.list}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: 90 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : payments.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyText}>No {filterLabel.toLowerCase()} payments</Text>
                    </View>
                ) : (
                    payments.map(payment => {
                        const isBusy = !!verifying[payment._id];
                        const canAction = payment.status === 'paid';
                        const statusColor = payment.status === 'verified'
                            ? colors.status.verified
                            : colors.status.rejected;
                        return (
                            <View key={payment._id} style={styles.card}>
                                <View style={styles.cardLeft}>
                                    <Text style={styles.memberName}>
                                        {payment.user?.name || payment.user?.phone || 'Member'}
                                    </Text>
                                    <Text style={styles.payDetail}>
                                        ₹{payment.amount?.toLocaleString()} • {payment.paymentMethod?.toUpperCase() || 'UPI'}
                                    </Text>
                                    <Text style={styles.timeLabel}>
                                        {timeAgo(payment.paidAt || payment.createdAt)}
                                    </Text>
                                    {payment.group?.name ? (
                                        <Text style={styles.groupLabel}>{payment.group.name}</Text>
                                    ) : null}
                                </View>
                                {canAction ? (
                                    <View style={styles.btnCol}>
                                        <TouchableOpacity
                                            style={styles.verifyBtn}
                                            onPress={() => doVerify(payment)}
                                            disabled={isBusy}
                                            activeOpacity={0.8}
                                        >
                                            {isBusy && verifying[payment._id] === 'verify' ? (
                                                <ActivityIndicator size="small" color={colors.success} />
                                            ) : (
                                                <Text style={styles.verifyText}>✓ Verify</Text>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.rejectBtn}
                                            onPress={() => doReject(payment)}
                                            disabled={isBusy}
                                            activeOpacity={0.8}
                                        >
                                            {isBusy && verifying[payment._id] === 'reject' ? (
                                                <ActivityIndicator size="small" color={colors.error} />
                                            ) : (
                                                <Text style={styles.rejectText}>✗ Reject</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={[styles.statusPill, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
                                        <Text style={[styles.statusPillText, { color: statusColor.text }]}>
                                            {payment.status === 'verified' ? 'Verified' : payment.status === 'failed' ? 'Rejected' : payment.status}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.backgroundSecondary },
        header: {
            backgroundColor: colors.background,
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        title:      { fontSize: 24, fontFamily: F.semibold, color: colors.text },
        pillsRow:   { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2, gap: 8 },
        pill: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 20,
            paddingVertical: 12,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
        },
        pillActive:      { backgroundColor: colors.primary, borderColor: colors.primary },
        pillText:        { fontSize: 14, fontFamily: F.semibold, color: colors.textSecondary },
        pillTextActive:  { color: '#fff' },
        countLabel: {
            fontSize: 12,
            fontFamily: F.semibold,
            color: colors.textSecondary,
            letterSpacing: 0.5,
            paddingHorizontal: 12,
            paddingTop: 0,
            paddingBottom: 2,
        },
        list:       { flex: 1, paddingHorizontal: 12 },
        loadingBox: { paddingTop: 60, alignItems: 'center' },
        emptyCard: {
            height: 200,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.border,
            marginTop: 8,
        },
        emptyText:   { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, marginTop: 12 },
        card: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
            padding: 12,
        },
        cardLeft:   { flex: 1 },
        memberName: { fontSize: 14, fontFamily: F.bold, color: colors.text },
        payDetail:  { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        timeLabel:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        groupLabel: { fontSize: 11, fontFamily: F.medium, color: colors.primary, marginTop: 3 },
        btnCol:     { gap: 4 },
        verifyBtn: {
            width: 80,
            height: 32,
            backgroundColor: colors.status.verified.bg,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.status.verified.border,
        },
        verifyText:  { fontSize: 12, fontFamily: F.semibold, color: colors.success },
        rejectBtn: {
            width: 80,
            height: 32,
            backgroundColor: colors.status.rejected.bg,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.status.rejected.border,
        },
        rejectText:      { fontSize: 12, fontFamily: F.semibold, color: colors.error },
        statusPill:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
        statusPillText:  { fontSize: 11, fontFamily: F.semibold },
    });
}
