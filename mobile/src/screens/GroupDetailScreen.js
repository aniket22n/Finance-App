import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, ActivityIndicator, StyleSheet,
    RefreshControl, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    getGroup, getCurrentCycle, getGroupPayments,
    deleteGroup, sendOtp, verifyOtp, activateGroup,
} from '../services/api';
import MemberCard from '../components/MemberCard';
import ProgressRing from '../components/ProgressRing';
import Toast, { useToast } from '../components/Toast';
import { F } from '../theme';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

function getStatusBadge(type, colors) {
    const map = {
        success: colors.status.verified,
        verified: colors.status.verified,
        pending: colors.status.pending,
        paid: colors.status.paid,
        overdue: colors.status.overdue,
        failed: colors.status.rejected,
        rejected: colors.status.rejected,
    };
    const s = map[type] || colors.status.pending;
    return {
        container: { backgroundColor: s.bg, borderColor: s.border, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
        text: { fontSize: 11, fontFamily: F.medium, color: s.text },
    };
}

export default function GroupDetailScreen({ route, navigation }) {
    const { groupId } = route.params;
    const { user } = useAuth();
    const { colors } = useTheme();
    const isAdmin = user?.role === 'admin';

    const [group, setGroup] = useState(null);
    const [cycle, setCycle] = useState(null);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // OTP-delete flow
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpError, setOtpError] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);

    const { toast, show } = useToast();
    const [otpFocused, otpFocusProps] = useInputFocus();

    const loadData = async () => {
        try {
            const [groupRes, cycleRes, paymentsRes] = await Promise.all([
                getGroup(groupId),
                getCurrentCycle(groupId).catch(() => ({ data: {} })),
                getGroupPayments(groupId).catch(() => ({ data: { payments: [] } })),
            ]);
            setGroup(groupRes.data.group);
            setCycle(cycleRes.data.cycle || null);
            setPayments(paymentsRes.data.payments || []);
        } catch (err) {
            console.log('Error loading group:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [groupId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleDeleteGroup = () => {
        Alert.alert(
            'Delete Group',
            `Delete "${group?.name}" permanently? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        setSendingOtp(true);
                        try {
                            await sendOtp(user?.phone);
                            setOtpCode('');
                            setOtpError('');
                            setShowOtpModal(true);
                        } catch (err) {
                            Alert.alert('Error', 'Failed to send OTP. Try again.');
                        } finally {
                            setSendingOtp(false);
                        }
                    },
                },
            ]
        );
    };

    const handleConfirmDelete = async () => {
        if (otpCode.length < 4) {
            setOtpError('Enter the OTP sent to your phone');
            return;
        }
        setVerifyingOtp(true);
        setOtpError('');
        try {
            await verifyOtp(user?.phone, otpCode);
            await deleteGroup(groupId);
            setShowOtpModal(false);
            show('Group deleted');
            setTimeout(() => navigation.goBack(), 800);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || '';
            if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('invalid') || err.response?.status === 400) {
                setOtpError('Invalid OTP. Please try again.');
            } else {
                Alert.alert('Error', msg || 'Failed to delete group');
                setShowOtpModal(false);
            }
        } finally {
            setVerifyingOtp(false);
        }
    };

    const [activating, setActivating] = useState(false);
    const handleActivate = async () => {
        if (activating) return;
        setActivating(true);
        try {
            const res = await activateGroup(groupId);
            show('Group activated');
            if (res?.data?.status) setGroup(g => g ? { ...g, status: res.data.status } : g);
        } catch (err) {
            const candidates = [err?.response?.data?.error, err?.response?.data?.message, err?.message];
            const msg = candidates.find(v => typeof v === 'string' && v.length > 0) || 'Failed to activate group';
            show(msg, 'error');
        } finally {
            setActivating(false);
        }
    };

    const styles = useMemo(() => makeStyles(colors), [colors]);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!group) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>Group not found</Text>
            </View>
        );
    }

    const winnerId = cycle?.winner?._id || cycle?.winner;
    const currentMonth = group.currentMonth || 0;
    const totalMonths = group.totalMonths || 1;
    const progress = (currentMonth / totalMonths) * 100;
    const isActive = group.status === 'active';
    const statusBadge = getStatusBadge(isActive ? 'success' : 'pending', colors);

    // Map memberId → month they won (only for months that have already been drawn).
    // Used to (a) flag past/current winners on MemberCard and (b) sort the member list
    // so winners appear in ascending month order, then non-winners.
    const winnerMonthByMember = new Map();
    for (const c of (group.monthlyConfig || [])) {
        if (c.month <= currentMonth && c.winner) {
            winnerMonthByMember.set(String(c.winner), c.month);
        }
    }
    const currentWinnerKey = winnerId ? String(winnerId) : '';

    const sortedMembers = [...(group.members || [])].sort((a, b) => {
        const ma = winnerMonthByMember.get(String(a._id));
        const mb = winnerMonthByMember.get(String(b._id));
        if (ma && mb) return ma - mb;       // both won — month 1 first
        if (ma) return -1;                  // only a won — a comes first
        if (mb) return 1;                   // only b won — b comes first
        return 0;                           // neither won — preserve order
    });

    return (
        <View style={{ flex: 1 }}>
            <ScrollView
                style={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {/* Group Info Card */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <View style={styles.infoLeft}>
                            <Text style={styles.groupName}>{group.name}</Text>
                            <View style={statusBadge.container}>
                                <Text style={statusBadge.text}>{group.status?.toUpperCase()}</Text>
                            </View>
                        </View>
                        <ProgressRing
                            progress={progress}
                            size={80}
                            strokeWidth={7}
                            label={`${currentMonth}/${totalMonths}`}
                        />
                    </View>

                    <View style={styles.statsRow}>
                        <StatItem label="Pot Amount" value={`₹${group.potAmount?.toLocaleString()}`} accent colors={colors} />
                        <View style={styles.statDivider} />
                        <StatItem label="Winner EMI" value={`₹${group.emiAmount?.toLocaleString()}`} colors={colors} />
                        <View style={styles.statDivider} />
                        <StatItem label="Reducing EMI" value={`₹${group.reducedEmi?.toLocaleString()}`} colors={colors} />
                    </View>
                </View>

                {/* Current Winner */}
                {cycle && (
                    <View style={styles.winnerCard}>
                        <View style={styles.winnerLeft}>
                            <View style={styles.trophyCircle}>
                                <Ionicons name="trophy" size={22} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.winnerLabel}>Month {cycle.month} Pot Holder</Text>
                                <Text style={styles.winnerName}>{cycle.winner?.name || 'Unknown'}</Text>
                            </View>
                        </View>
                        <View style={styles.reducedBadge}>
                            <Text style={styles.reducedText}>₹{group.emiAmount?.toLocaleString()} EMI</Text>
                        </View>
                    </View>
                )}

                {/* Members */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            Members ({group.members?.length || 0}/{group.maxMembers})
                        </Text>
                        {isAdmin && (
                            <TouchableOpacity
                                style={styles.addMemberBtn}
                                onPress={() => navigation.navigate('AdminAddMembers', { groupId, mode: 'manage' })}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="person-add-outline" size={14} color={colors.primary} />
                                <Text style={styles.addMemberText}>Add</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {sortedMembers.map(member => {
                        const memberPayment = payments.find(
                            p => (p.user?._id || p.user) === member._id && p.month === currentMonth
                        );
                        const wonMonth     = winnerMonthByMember.get(String(member._id)) || null;
                        const isWinner     = !!currentWinnerKey && String(member._id) === currentWinnerKey;
                        const isPastWinner = !!wonMonth && !isWinner;
                        return (
                            <MemberCard
                                key={member._id}
                                member={member}
                                isWinner={isWinner}
                                isPastWinner={isPastWinner}
                                winnerMonth={wonMonth}
                                paymentStatus={memberPayment?.status}
                                emiAmount={(isWinner || isPastWinner) ? group.emiAmount : group.reducedEmi}
                            />
                        );
                    })}
                </View>

                {/* Make Payment CTA (members only) */}
                {!isAdmin && isActive && (
                    <View style={styles.ctaSection}>
                        <TouchableOpacity
                            style={styles.ctaBtn}
                            onPress={() => navigation.navigate('Payments')}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="wallet" size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.ctaText}>Make Payment</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Activate Group (admin, pending only) */}
                {isAdmin && group.status === 'pending' && (
                    <View style={styles.activateSection}>
                        <TouchableOpacity
                            style={[styles.activateBtn, activating && { opacity: 0.6 }]}
                            onPress={handleActivate}
                            disabled={activating}
                            activeOpacity={0.85}
                        >
                            {activating
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <>
                                    <Ionicons name="play-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.activateBtnText}>Activate Group</Text>
                                  </>
                            }
                        </TouchableOpacity>
                        <Text style={styles.activateHint}>
                            Activates the scheme so draws can be run. Auto-runs after POT config save; use this as fallback.
                        </Text>
                    </View>
                )}

                {/* Delete Group (admin only) */}
                {isAdmin && (
                    <View style={styles.deleteSection}>
                        <TouchableOpacity
                            style={[styles.deleteBtn, sendingOtp && { opacity: 0.6 }]}
                            onPress={handleDeleteGroup}
                            disabled={sendingOtp}
                            activeOpacity={0.8}
                        >
                            {sendingOtp
                                ? <ActivityIndicator size="small" color={colors.error} />
                                : <>
                                    <Ionicons name="trash-outline" size={18} color={colors.error} style={{ marginRight: 8 }} />
                                    <Text style={styles.deleteBtnText}>Delete Group</Text>
                                  </>
                            }
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 90 }} />
            </ScrollView>

            {/* OTP Confirm Modal */}
            <Modal visible={showOtpModal} transparent animationType="fade" onRequestClose={() => setShowOtpModal(false)}>
                <View style={styles.otpOverlay}>
                    <View style={styles.otpBox}>
                        <View style={styles.otpIconWrap}>
                            <Ionicons name="shield-checkmark-outline" size={32} color={colors.error} />
                        </View>
                        <Text style={styles.otpTitle}>Confirm Delete</Text>
                        <Text style={styles.otpSub}>
                            Enter the OTP sent to{'\n'}+91 {user?.phone} to confirm deletion.
                        </Text>

                        <TextInput
                            style={[styles.otpInput, webOutlineReset, focusBorder(colors, otpFocused), otpError && styles.otpInputError]}
                            value={otpCode}
                            onChangeText={v => { setOtpCode(v); setOtpError(''); }}
                            placeholder="Enter OTP"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="number-pad"
                            maxLength={6}
                            {...otpFocusProps}
                            autoFocus
                            textAlign="center"
                        />

                        {otpError ? (
                            <View style={styles.otpErrorRow}>
                                <Ionicons name="alert-circle" size={13} color={colors.error} />
                                <Text style={styles.otpErrorText}>{otpError}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.otpConfirmBtn, verifyingOtp && { opacity: 0.6 }]}
                            onPress={handleConfirmDelete}
                            disabled={verifyingOtp}
                            activeOpacity={0.85}
                        >
                            {verifyingOtp
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.otpConfirmText}>Confirm Delete</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.otpCancelBtn} onPress={() => setShowOtpModal(false)}>
                            <Text style={styles.otpCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Toast {...toast} />
        </View>
    );
}

function StatItem({ label, value, accent, colors }) {
    return (
        <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontFamily: F.bold, color: accent ? colors.primary : colors.text }}>{value}</Text>
            <Text style={{ fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.backgroundSecondary },
        center: { flex: 1, backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
        errorText: { fontSize: 14, fontFamily: F.regular, color: colors.error },
        infoCard: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
            margin: 16,
        },
        infoHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
        infoLeft:    { flex: 1, paddingRight: 12 },
        groupName:   { fontSize: 20, fontFamily: F.semibold, color: colors.text, marginBottom: 8 },
        statsRow:    { flexDirection: 'row', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
        statDivider: { width: 1, height: 32, backgroundColor: colors.border },
        winnerCard: {
            backgroundColor: colors.primaryLight,
            borderWidth: 1,
            borderColor: colors.status.rejected.border,
            borderRadius: 14,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
            marginHorizontal: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        winnerLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
        trophyCircle: {
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
            marginRight: 12, borderWidth: 1, borderColor: colors.status.rejected.border,
        },
        winnerLabel:  { fontSize: 11, fontFamily: F.medium, color: colors.primary },
        winnerName:   { fontSize: 16, fontFamily: F.semibold, color: colors.primaryDark, marginTop: 2 },
        reducedBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.status.rejected.border },
        reducedText:  { fontSize: 12, fontFamily: F.semibold, color: colors.primary },
        section:      { paddingHorizontal: 16, marginBottom: 8 },
        sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
        sectionTitle: { fontSize: 16, fontFamily: F.medium, color: colors.text },
        sectionSub:   { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 10 },
        addMemberBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.status.rejected.border,
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
        },
        addMemberText:  { fontSize: 12, fontFamily: F.semibold, color: colors.primary },
        ctaSection:     { paddingHorizontal: 16, marginTop: 8 },
        ctaBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 56, borderRadius: 12, backgroundColor: colors.primary,
            shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
        },
        ctaText:       { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
        activateSection: { paddingHorizontal: 16, marginTop: 12 },
        activateBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 52, borderRadius: 12, backgroundColor: colors.primary,
        },
        activateBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
        activateHint: {
            fontSize: 11, fontFamily: F.regular, color: colors.textSecondary,
            textAlign: 'center', marginTop: 6, paddingHorizontal: 4,
        },
        deleteSection: { paddingHorizontal: 16, marginTop: 12 },
        deleteBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 52, borderRadius: 12, borderWidth: 1.5,
            borderColor: colors.status.rejected.border, backgroundColor: colors.errorLight,
        },
        deleteBtnText: { fontSize: 14, fontFamily: F.semibold, color: colors.error },
        // OTP modal
        otpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
        otpBox: {
            width: '100%', backgroundColor: colors.background,
            borderRadius: 20, padding: 28, alignItems: 'center',
        },
        otpIconWrap: {
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        },
        otpTitle:   { fontSize: 18, fontFamily: F.bold, color: colors.text, marginBottom: 8 },
        otpSub:     { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
        otpInput: {
            width: '100%', height: 56, borderRadius: 12, borderWidth: 1,
            borderColor: colors.border, backgroundColor: colors.backgroundSecondary,
            fontSize: 22, fontFamily: F.bold, color: colors.text,
            letterSpacing: 8, textAlign: 'center', marginBottom: 4,
        },
        otpInputError:   { borderColor: colors.error },
        otpErrorRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
        otpErrorText:    { fontSize: 12, fontFamily: F.regular, color: colors.error },
        otpConfirmBtn: {
            width: '100%', height: 52, borderRadius: 12,
            backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', marginTop: 12,
        },
        otpConfirmText: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
        otpCancelBtn:   { marginTop: 10, paddingVertical: 10 },
        otpCancelText:  { fontSize: 14, fontFamily: F.medium, color: colors.textSecondary },
    });
}
