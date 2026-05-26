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
                            show('Failed to send OTP. Try again.', 'error');
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
                show(msg || 'Failed to delete group', 'error');
                setShowOtpModal(false);
            }
        } finally {
            setVerifyingOtp(false);
        }
    };

    const [timelineMember, setTimelineMember] = useState(null);
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
                                <Ionicons name="add" size={20} color={colors.primary} />
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
                                onPress={() => setTimelineMember(member)}
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

            {/* ── Payment Timeline Modal ── */}
            {(() => {
                const TL_STATUS = {
                    pending:  { color: '#9CA3AF', label: 'Pending'  },
                    paid:     { color: '#F59E0B', label: 'Awaiting' },
                    verified: { color: '#10B981', label: 'Verified' },
                    failed:   { color: '#EF4444', label: 'Rejected' },
                    rejected: { color: '#EF4444', label: 'Rejected' },
                };

                const real = payments
                    .filter(p => (p.user?._id || p.user) === timelineMember?._id)
                    .sort((a, b) => a.month - b.month);

                const dummyCount = Math.max(currentMonth || 0, 4);
                const DUMMY = [
                    { status: 'verified', method: 'upi'  },
                    { status: 'paid',     method: 'cash' },
                    { status: 'pending',  method: 'bank' },
                    { status: 'rejected', method: 'upi'  },
                    { status: 'paid',     method: 'upi'  },
                ];
                const dummy = Array.from({ length: Math.min(dummyCount, 5) }, (_, i) => ({
                    _id: `dummy-${i}`,
                    month: i + 1,
                    status: DUMMY[i].status,
                    amount: group?.emiAmount || 5000,
                    paymentMethod: DUMMY[i].method,
                    paidAt: new Date(Date.now() - (dummyCount - i) * 30 * 24 * 60 * 60 * 1000).toISOString(),
                }));

                const memberPayments = real.length > 0 ? real : dummy;
                const totalPaid = memberPayments.filter(p => p.status === 'verified' || p.status === 'paid').length;
                const totalAmt  = memberPayments
                    .filter(p => p.status === 'verified' || p.status === 'paid')
                    .reduce((s, p) => s + (p.amount || 0), 0);

                return (
                    <Modal
                        visible={!!timelineMember}
                        animationType="slide"
                        onRequestClose={() => setTimelineMember(null)}
                        statusBarTranslucent
                    >
                        <View style={styles.tlRoot}>

                            {/* Top bar */}
                            <View style={styles.tlTopBar}>
                                <TouchableOpacity
                                    onPress={() => setTimelineMember(null)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                                </TouchableOpacity>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tlTitle}>Payment History</Text>
                                    <Text style={styles.tlGroupName} numberOfLines={1}>{group?.name}</Text>
                                </View>
                            </View>

                            {/* Member info card */}
                            <View style={styles.tlMemberCard}>
                                <View style={styles.tlMemberIcon}>
                                    <Ionicons name="person" size={16} color={colors.textSecondary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.tlName}>{timelineMember?.name || timelineMember?.phone}</Text>
                                    {timelineMember?.name && timelineMember?.phone
                                        ? <Text style={styles.tlPhone}>{timelineMember.phone}</Text>
                                        : null}
                                </View>
                                <View style={styles.tlMemberStat}>
                                    <Text style={styles.tlMemberStatVal}>₹{totalAmt.toLocaleString('en-IN')}</Text>
                                    <Text style={styles.tlMemberStatLbl}>{totalPaid} paid</Text>
                                </View>
                            </View>

                            {/* Status chips — centered single line */}
                            <View style={styles.tlChipsRow}>
                                {Object.entries(TL_STATUS).map(([key, { color, label }]) => {
                                    const count = memberPayments.filter(p => p.status === key).length;
                                    if (!count) return null;
                                    return (
                                        <View key={key} style={[styles.tlChip, { backgroundColor: color + '18' }]}>
                                            <Text style={[styles.tlChipNum, { color }]}>{count}</Text>
                                            <Text style={[styles.tlChipLbl, { color }]}>{label}</Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.tlScrollContent}>
                                {memberPayments.map((p, idx) => {
                                    const isLast = idx === memberPayments.length - 1;
                                    const st    = TL_STATUS[p.status] || TL_STATUS.pending;
                                    const date  = p.paidAt || p.createdAt;
                                    return (
                                        <TouchableOpacity
                                            key={p._id}
                                            style={styles.tlRow}
                                            activeOpacity={0.75}
                                            onPress={() => {
                                                setTimelineMember(null);
                                                navigation.navigate('AdminPaymentDetail', { payment: p });
                                            }}
                                        >
                                            {/* Spine */}
                                            <View style={styles.tlSpine}>
                                                <View style={[styles.tlDot, { backgroundColor: st.color }]} />
                                                {!isLast && <View style={styles.tlLine} />}
                                            </View>
                                            {/* Row content */}
                                            <View style={[styles.tlItem, isLast && { borderBottomWidth: 0 }]}>
                                                <View style={styles.tlItemLeft}>
                                                    <Text style={styles.tlMonth}>Month {p.month}</Text>
                                                    {date ? (
                                                        <Text style={styles.tlDate}>
                                                            {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            {'  ·  '}{(p.paymentMethod || 'UPI').toUpperCase()}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <View style={styles.tlItemRight}>
                                                    <Text style={[styles.tlAmount, { color: st.color }]}>₹{(p.amount || 0).toLocaleString('en-IN')}</Text>
                                                    <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </Modal>
                );
            })()}

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
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            marginHorizontal: 16, marginBottom: 12,
            backgroundColor: '#FFFBEB',
            borderWidth: 1, borderColor: '#FDE68A',
            borderRadius: 14, padding: 14,
            shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
        },
        winnerCardLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
        winnerTrophy: {
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
            alignItems: 'center', justifyContent: 'center',
        },
        winnerCardLabel: { fontSize: 10, fontFamily: F.semibold, color: '#92400E', letterSpacing: 0.5, marginBottom: 3 },
        winnerCardName:  { fontSize: 16, fontFamily: F.bold, color: '#78350F' },
        winnerAmtBadge: {
            backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
        },
        winnerAmtText:  { fontSize: 13, fontFamily: F.bold, color: '#92400E' },
        section:      { paddingHorizontal: 16, marginBottom: 8 },
        sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
        sectionTitle: { fontSize: 16, fontFamily: F.medium, color: colors.text },
        sectionSub:   { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 10 },
        addMemberBtn: {
            width: 32, height: 32, borderRadius: 8,
            backgroundColor: colors.primaryLight,
            borderWidth: 1, borderColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
        },
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

        // ── Payment timeline (full-screen modal) ──
        tlRoot: { flex: 1, backgroundColor: colors.background },
        tlTopBar: {
            flexDirection: 'row', alignItems: 'center', gap: 14,
            paddingTop: 52, paddingBottom: 10, paddingHorizontal: 16,
            borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        tlTitle:     { fontSize: 16, fontFamily: F.bold, color: colors.text, lineHeight: 20 },
        tlGroupName: { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        tlMemberCard: {
            flexDirection: 'row', alignItems: 'center', gap: 10,
            marginHorizontal: 16, marginTop: 12, marginBottom: 14,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 14, padding: 12,
        },
        tlMemberIcon: {
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center',
        },
        tlName:          { fontSize: 14, fontFamily: F.bold, color: colors.text },
        tlPhone:         { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        tlMemberStat:    { alignItems: 'flex-end' },
        tlMemberStatVal: { fontSize: 14, fontFamily: F.bold, color: colors.primary },
        tlMemberStatLbl: { fontSize: 10, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        tlChipsRow: {
            flexDirection: 'row', justifyContent: 'center',
            gap: 10, paddingHorizontal: 16, paddingBottom: 14,
        },
        tlChip: {
            alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
            borderRadius: 12,
        },
        tlChipNum: { fontSize: 20, fontFamily: F.bold, lineHeight: 24 },
        tlChipLbl: { fontSize: 10, fontFamily: F.medium, marginTop: 2 },
        tlScrollContent: { paddingTop: 4, paddingBottom: 40 },
        tlRow:   { flexDirection: 'row', paddingLeft: 16 },
        tlSpine: { alignItems: 'center', width: 20, paddingTop: 18 },
        tlDot:   { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
        tlLine:  { width: 2, flexGrow: 1, backgroundColor: colors.border, marginTop: 4, minHeight: 28 },
        tlItem: {
            flex: 1, flexDirection: 'row', alignItems: 'center',
            paddingVertical: 12, paddingRight: 16, gap: 8,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
        },
        tlItemLeft:  { flex: 1 },
        tlItemRight: { alignItems: 'flex-end', gap: 4 },
        tlMonth:    { fontSize: 13, fontFamily: F.semibold, color: colors.text },
        tlBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
        tlBadgeTxt: { fontSize: 9, fontFamily: F.bold },
        tlAmount:   { fontSize: 14, fontFamily: F.bold, color: colors.text },
        tlDate:     { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary },
    });
}
