import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    ActivityIndicator, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAccountRequests, approveAccountRequest, rejectAccountRequest } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import Toast, { useToast } from '../components/Toast';

const FILTERS = [
    { id: 'all',      label: 'All',      icon: 'people-outline' },
    { id: 'pending',  label: 'Pending',  icon: 'time-outline',             iconColor: '#F59E0B' },
    { id: 'approved', label: 'Approved', icon: 'checkmark-circle-outline', iconColor: '#10B981' },
    // 'rejected' tab dropped — rejected requests are deleted on reject so the user can
    // re-apply later.
];

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export default function AdminAccountRequestsScreen({ navigation }) {
    const { colors } = useTheme();
    const { toast, show } = useToast();
    const [filter, setFilter]     = useState('all');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionBusy, setActionBusy] = useState(null);

    // Reject modal
    const [rejectModal, setRejectModal] = useState(false);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const styles = useMemo(() => makeStyles(colors), [colors]);

    const load = useCallback(async (status) => {
        try {
            const res = await getAccountRequests(status === 'all' ? undefined : status);
            setRequests(res.data.requests || []);
        } catch (err) {
            console.log('Account requests error:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(filter); }, [filter, load]));

    const onRefresh = async () => {
        setRefreshing(true);
        await load(filter);
        setRefreshing(false);
    };

    const switchFilter = (id) => {
        if (id === filter) return;
        setLoading(true);
        setFilter(id);
    };

    const handleApprove = (req) => {
        Alert.alert(
            'Approve Account',
            `Approve account for ${req.name} (+91 ${req.phone})?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve', onPress: async () => {
                        setActionBusy(req._id);
                        try {
                            await approveAccountRequest(req._id);
                            setRequests(prev => prev.map(r =>
                                r._id === req._id ? { ...r, status: 'approved', reviewedAt: new Date().toISOString() } : r
                            ));
                        } catch (err) {
                            show(err?.response?.data?.error || 'Failed to approve', 'error');
                        } finally {
                            setActionBusy(null);
                        }
                    },
                },
            ]
        );
    };

    const openRejectModal = (req) => {
        setRejectTarget(req);
        setRejectReason('');
        setRejectModal(true);
    };

    const confirmReject = async () => {
        if (!rejectTarget) return;
        setActionBusy(rejectTarget._id);
        setRejectModal(false);
        try {
            await rejectAccountRequest(rejectTarget._id, rejectReason || undefined);
            // Backend deletes the record entirely (so the applicant can re-apply later).
            // Remove the row from local state to match.
            setRequests(prev => prev.filter(r => r._id !== rejectTarget._id));
            show('Request rejected and removed');
        } catch (err) {
            show(err?.response?.data?.error || 'Failed to reject', 'error');
        } finally {
            setActionBusy(null);
            setRejectTarget(null);
        }
    };

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Account Requests</Text>
            </View>

            {/* Filter Pills */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
                style={styles.pillsScroll}
            >
                {FILTERS.map(f => {
                    const active = filter === f.id;
                    return (
                        <TouchableOpacity
                            key={f.id}
                            style={[styles.pill, active && styles.pillActive]}
                            onPress={() => switchFilter(f.id)}
                            activeOpacity={0.75}
                        >
                            <Ionicons
                                name={f.icon}
                                size={15}
                                color={active ? '#fff' : f.iconColor || colors.textSecondary}
                            />
                            <Text style={[styles.pillText, active && styles.pillTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Count */}
            <View style={styles.countWrap}>
                <Text style={styles.countLabel}>
                    {filter === 'all' ? 'All' : filter === 'pending' ? 'Pending' : 'Approved'} Requests ({requests.length})
                </Text>
            </View>

            {/* List */}
            <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : requests.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No {filter === 'all' ? '' : filter} requests</Text>
                    </View>
                ) : (
                    requests.map(r => {
                        const isBusy  = actionBusy === r._id;
                        const isPending = r.status === 'pending';
                        return (
                            <View key={r._id} style={[styles.card, isPending && styles.cardPending]}>
                                <View style={styles.cardTop}>
                                    <View style={styles.avatar}>
                                        <Ionicons name="person" size={18} color={colors.textSecondary} />
                                    </View>
                                    <View style={styles.info}>
                                        <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                                        <Text style={styles.metaLine} numberOfLines={1}>
                                            +91 {r.phone}
                                            <Text style={styles.metaDot}>  ·  </Text>
                                            {timeAgo(r.createdAt)}
                                        </Text>
                                    </View>
                                    {/* Status pill */}
                                    {isPending ? (
                                        <View style={styles.pendingPill}>
                                            <Ionicons name="time-outline" size={18} color="#F59E0B" />
                                        </View>
                                    ) : (
                                        <View style={styles.approvedPill}>
                                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                        </View>
                                    )}
                                </View>

                                {isPending && (
                                    <>
                                        <View style={styles.cardDivider} />
                                        <View style={styles.actions}>
                                            <TouchableOpacity
                                                style={[styles.approveBtn, isBusy && styles.btnDisabled]}
                                                onPress={() => handleApprove(r)}
                                                disabled={!!actionBusy}
                                                activeOpacity={0.85}
                                            >
                                                {isBusy
                                                    ? <ActivityIndicator color="#fff" size="small" />
                                                    : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.approveBtnText}>Approve</Text></>
                                                }
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.rejectBtn, isBusy && styles.btnDisabled]}
                                                onPress={() => openRejectModal(r)}
                                                disabled={!!actionBusy}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name="close" size={16} color="#fff" />
                                                <Text style={styles.rejectBtnText}>Reject</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Reject reason modal */}
            <Modal visible={rejectModal} transparent animationType="fade" onRequestClose={() => setRejectModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Reject Request</Text>
                        <Text style={styles.modalSub}>
                            Reject account for {rejectTarget?.name}?
                        </Text>
                        <TextInput
                            style={styles.reasonInput}
                            placeholder="Reason (optional)"
                            placeholderTextColor={colors.textSecondary}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                            multiline
                            maxLength={200}
                        />
                        <View style={styles.modalBtns}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectModal(false)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalRejectBtn} onPress={confirmReject}>
                                <Text style={styles.modalRejectText}>Confirm Reject</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },

        // Header
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 56,
            paddingBottom: 8,
            paddingHorizontal: 16,
            backgroundColor: colors.background,
            gap: 12,
        },
        backBtn:   { padding: 2 },
        title:     { flex: 1, fontSize: 22, fontFamily: F.bold, color: colors.text },
        // Pills
        pillsScroll: { flexGrow: 0 },
        pillsRow:    { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
        pill: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            height: 34, paddingHorizontal: 14, borderRadius: 20,
            borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.background,
        },
        pillActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
        pillText:       { fontSize: 13, fontFamily: F.medium, color: colors.textSecondary },
        pillTextActive: { color: '#fff', fontFamily: F.semibold },

        // Count
        countWrap:  { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10 },
        countLabel: { fontSize: 15, fontFamily: F.bold, color: colors.text },

        // List
        list:        { flex: 1 },
        listContent: { paddingHorizontal: 16, paddingBottom: 90 },
        center:      { paddingTop: 60, alignItems: 'center' },
        empty: {
            height: 180, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
            borderRadius: 12, marginTop: 8,
        },
        emptyText: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },

        // Card (matches User Management cards)
        card: {
            backgroundColor: colors.background,
            borderWidth: 1, borderColor: colors.border, borderRadius: 14,
            padding: 12, marginBottom: 8,
        },
        cardPending: {
            backgroundColor: colors.primaryLight,
            borderColor: colors.primary,
            borderLeftWidth: 4,
        },
        cardTop:  { flexDirection: 'row', alignItems: 'center' },
        avatar: {
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12, borderWidth: 1, borderColor: colors.border,
        },
        info:      { flex: 1, minWidth: 0 },
        name:      { fontSize: 14, fontFamily: F.bold, color: colors.text },
        metaLine:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        metaDot:   { color: colors.textTertiary },

        // Status icon badges (icon only)
        pendingPill: {
            width: 32, height: 32, borderRadius: 16,
            borderWidth: 1, borderColor: '#F59E0B',
            alignItems: 'center', justifyContent: 'center',
        },
        approvedPill: {
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.successLight,
            alignItems: 'center', justifyContent: 'center',
        },

        // Action buttons (pending only)
        cardDivider: { height: 1, backgroundColor: colors.primary, opacity: 0.25, marginVertical: 12 },
        actions: { flexDirection: 'row', gap: 10 },
        approveBtn: {
            flex: 1, height: 46, backgroundColor: '#10B981', borderRadius: 12,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        },
        rejectBtn: {
            flex: 1, height: 46, backgroundColor: '#EF4444', borderRadius: 12,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        },
        btnDisabled:    { opacity: 0.5 },
        approveBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
        rejectBtnText:  { fontSize: 14, fontFamily: F.semibold, color: '#fff' },

        // Reject modal
        modalOverlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        modalSheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 20, borderTopRightRadius: 20,
            padding: 24, paddingBottom: 40,
        },
        modalTitle:   { fontSize: 18, fontFamily: F.bold, color: colors.text, marginBottom: 6 },
        modalSub:     { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 16 },
        reasonInput: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border, borderRadius: 10,
            padding: 12, fontSize: 14, fontFamily: F.regular, color: colors.text,
            minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
        },
        modalBtns:       { flexDirection: 'row', gap: 10 },
        modalCancelBtn: {
            flex: 1, height: 48, borderRadius: 10,
            borderWidth: 1, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        modalCancelText: { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        modalRejectBtn: {
            flex: 1, height: 48, borderRadius: 10,
            backgroundColor: '#EF4444',
            alignItems: 'center', justifyContent: 'center',
        },
        modalRejectText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
    });
}
