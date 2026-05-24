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
    { id: 'all',      label: 'All' },
    { id: 'pending',  label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    // 'rejected' tab dropped — rejected requests are deleted on reject so the user can
    // re-apply later.
];

const BADGE = {
    pending:  { bg: '#F59E0B', label: 'Pending' },
    approved: { bg: '#10B981', label: 'Approved' },
};

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

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Account Requests</Text>
                {pendingCount > 0 && (
                    <View style={styles.headerBadge}>
                        <Text style={styles.headerBadgeText}>{pendingCount}</Text>
                    </View>
                )}
            </View>

            {/* Filter Pills */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsRow}
                style={styles.pillsScroll}
            >
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.id}
                        style={[styles.pill, filter === f.id && styles.pillActive]}
                        onPress={() => switchFilter(f.id)}
                        activeOpacity={0.75}
                    >
                        <Text style={[styles.pillText, filter === f.id && styles.pillTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Count */}
            <Text style={styles.countLabel}>
                {filter.toUpperCase()} REQUESTS ({requests.length})
            </Text>

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
                        const badge = BADGE[r.status] || { bg: colors.border, label: r.status };
                        const isBusy = actionBusy === r._id;
                        return (
                            <View key={r._id} style={styles.card}>
                                {/* Row 1: name + badge */}
                                <View style={styles.row1}>
                                    <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                        <Text style={styles.badgeText}>{badge.label}</Text>
                                    </View>
                                </View>

                                {/* Row 2: phone */}
                                <Text style={styles.phone}>+91 {r.phone}</Text>

                                {/* Row 3: created time */}
                                <Text style={styles.time}>{timeAgo(r.createdAt)}</Text>

                                {/* Row 4: reject reason (if rejected) */}
                                {r.status === 'rejected' && r.rejectReason ? (
                                    <Text style={styles.reason}>Reason: {r.rejectReason}</Text>
                                ) : null}

                                {/* Row 5: reviewed by (if reviewed) */}
                                {r.status !== 'pending' && r.reviewedAt ? (
                                    <Text style={styles.reviewed}>
                                        {r.status === 'approved' ? 'Approved' : 'Rejected'} {timeAgo(r.reviewedAt)}
                                        {r.reviewedBy?.name ? ` by ${r.reviewedBy.name}` : ''}
                                    </Text>
                                ) : null}

                                {/* Action buttons — pending only */}
                                {r.status === 'pending' && (
                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            style={[styles.approveBtn, isBusy && styles.btnDisabled]}
                                            onPress={() => handleApprove(r)}
                                            disabled={!!actionBusy}
                                            activeOpacity={0.8}
                                        >
                                            {isBusy
                                                ? <ActivityIndicator color="#fff" size="small" />
                                                : <><Ionicons name="checkmark" size={14} color="#fff" /><Text style={styles.approveBtnText}>Approve</Text></>
                                            }
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.rejectBtn, isBusy && styles.btnDisabled]}
                                            onPress={() => openRejectModal(r)}
                                            disabled={!!actionBusy}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="close" size={14} color="#fff" />
                                            <Text style={styles.rejectBtnText}>Reject</Text>
                                        </TouchableOpacity>
                                    </View>
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
            paddingBottom: 12,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
            gap: 10,
        },
        backBtn:     { padding: 2 },
        title:       { flex: 1, fontSize: 20, fontFamily: F.bold, color: colors.text },
        headerBadge: {
            backgroundColor: '#F59E0B',
            minWidth: 22, height: 22, borderRadius: 11,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 6,
        },
        headerBadgeText: { fontSize: 11, fontFamily: F.bold, color: '#fff' },

        // Pills
        pillsScroll: { flexGrow: 0 },
        pillsRow:    { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
        pill: {
            height: 34, paddingHorizontal: 14, borderRadius: 20,
            borderWidth: 1, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        pillActive:     { backgroundColor: colors.primary, borderColor: colors.primary },
        pillText:       { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary },
        pillTextActive: { color: '#fff', fontFamily: F.semibold },

        // Count
        countLabel: {
            fontSize: 11, fontFamily: F.semibold, color: colors.textTertiary,
            letterSpacing: 0.5, paddingHorizontal: 16, paddingBottom: 6,
        },

        // List
        list:        { flex: 1 },
        listContent: { paddingHorizontal: 12, paddingBottom: 90 },
        center:      { paddingTop: 60, alignItems: 'center' },
        empty: {
            height: 180, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
            borderRadius: 12, marginTop: 8,
        },
        emptyText: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },

        // Card
        card: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border, borderRadius: 12,
            padding: 12, marginBottom: 8,
        },
        row1: {
            flexDirection: 'row', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 4,
        },
        name:   { fontSize: 14, fontFamily: F.bold, color: colors.text, flex: 1, marginRight: 8 },
        badge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
        badgeText: { fontSize: 11, fontFamily: F.bold, color: '#fff' },
        phone:    { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 2 },
        time:     { fontSize: 12, fontFamily: F.regular, color: colors.textTertiary, marginBottom: 4 },
        reason:   { fontSize: 11, fontFamily: F.regular, color: '#EF4444', marginBottom: 2 },
        reviewed: { fontSize: 11, fontFamily: F.regular, color: colors.textTertiary },

        // Action buttons
        actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
        approveBtn: {
            flex: 1, height: 34, backgroundColor: '#10B981', borderRadius: 8,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        },
        rejectBtn: {
            flex: 1, height: 34, backgroundColor: '#EF4444', borderRadius: 8,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        },
        btnDisabled:     { opacity: 0.5 },
        approveBtnText:  { fontSize: 12, fontFamily: F.semibold, color: '#fff' },
        rejectBtnText:   { fontSize: 12, fontFamily: F.semibold, color: '#fff' },

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
