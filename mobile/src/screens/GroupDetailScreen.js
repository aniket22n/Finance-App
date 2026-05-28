import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, ActivityIndicator, StyleSheet,
    RefreshControl, TouchableOpacity, Modal, TextInput, Alert, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    getGroup, getCurrentCycle, getGroupPayments, getPaymentConfig,
    deleteGroup, sendOtp, verifyOtp, activateGroup,
} from '../services/api';
import MemberCard from '../components/MemberCard';
import ProgressRing from '../components/ProgressRing';
import Toast, { useToast } from '../components/Toast';
import { F } from '../theme';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

const TIMELINE_STATUS = {
    verified: { color: '#10B981', bgColor: '#ECFDF5', label: 'Paid',     icon: 'checkmark-circle' },
    paid:     { color: '#D97706', bgColor: '#FEF3C7', label: 'Awaiting', icon: 'hourglass-outline' },
    pending:  { color: '#D97706', bgColor: '#FFF8EE', label: 'Due Soon', icon: 'time-outline'      },
    overdue:  { color: '#EF4444', bgColor: '#FEE2E2', label: 'Overdue',  icon: 'alert-circle'      },
    rejected: { color: '#EF4444', bgColor: '#FEE2E2', label: 'Rejected', icon: 'close-circle'      },
    upcoming: { color: '#9CA3AF', bgColor: 'transparent', label: 'Upcoming', icon: null            },
};

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
    const [upiVpa, setUpiVpa] = useState('admin@upi');
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
            const [groupRes, cycleRes, paymentsRes, configRes] = await Promise.all([
                getGroup(groupId),
                getCurrentCycle(groupId).catch(() => ({ data: {} })),
                getGroupPayments(groupId).catch(() => ({ data: { payments: [] } })),
                getPaymentConfig().catch(() => ({ data: {} })),
            ]);
            setGroup(groupRes.data.group);
            setCycle(cycleRes.data.cycle || null);
            setPayments(paymentsRes.data.payments || []);
            if (configRes.data.upiVpa) setUpiVpa(configRes.data.upiVpa);
        } catch (err) {
            console.log('Error loading group:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [groupId]);

    // Close the payment-timeline overlay on Android back press before navigation pops the screen.
    useEffect(() => {
        if (!timelineMember) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setTimelineMember(null);
            return true;
        });
        return () => sub.remove();
    }, [timelineMember]);

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
    const [activeTab, setActiveTab] = useState('payments');

    // OTP-activate flow
    const [showActivateOtpModal, setShowActivateOtpModal] = useState(false);
    const [activateOtpCode, setActivateOtpCode] = useState('');
    const [activateOtpError, setActivateOtpError] = useState('');
    const [sendingActivateOtp, setSendingActivateOtp] = useState(false);
    const [verifyingActivate, setVerifyingActivate] = useState(false);
    const [activateOtpFocused, activateOtpFocusProps] = useInputFocus();

    const handleActivatePress = () => {
        const memberCount = group?.members?.length || 0;
        const maxMembers  = group?.maxMembers || 0;

        const sendOtpAndOpen = async () => {
            setSendingActivateOtp(true);
            try {
                await sendOtp(user?.phone);
                setActivateOtpCode('');
                setActivateOtpError('');
                setShowActivateOtpModal(true);
            } catch (err) {
                show('Failed to send OTP. Try again.', 'error');
            } finally {
                setSendingActivateOtp(false);
            }
        };

        if (memberCount < maxMembers) {
            Alert.alert(
                'Group Not Full',
                `Only ${memberCount} of ${maxMembers} members have been added.\n\nOnce activated, no more members can be added. You should fill all slots first.`,
                [
                    {
                        text: 'Add Members',
                        onPress: () => navigation.navigate('AdminAddMembers', { groupId, mode: 'manage' }),
                    },
                    {
                        text: 'Activate Anyway',
                        style: 'destructive',
                        onPress: sendOtpAndOpen,
                    },
                ]
            );
        } else {
            sendOtpAndOpen();
        }
    };

    const handleConfirmActivate = async () => {
        if (activateOtpCode.length < 4) {
            setActivateOtpError('Enter the OTP sent to your phone');
            return;
        }
        setVerifyingActivate(true);
        setActivateOtpError('');
        try {
            await verifyOtp(user?.phone, activateOtpCode);
            const res = await activateGroup(groupId);
            setShowActivateOtpModal(false);
            show('Group activated');
            if (res?.data?.status) setGroup(g => g ? { ...g, status: res.data.status } : g);
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || '';
            if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('invalid') || err.response?.status === 400) {
                setActivateOtpError('Invalid OTP. Please try again.');
            } else {
                show(msg || 'Failed to activate group', 'error');
                setShowActivateOtpModal(false);
            }
        } finally {
            setVerifyingActivate(false);
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

    // Current user's payment for this month + member object
    const myPayment = payments.find(
        p => String(p.user?._id || p.user) === String(user?._id) && p.month === currentMonth
    );
    const myMember = group.members?.find(m => String(m._id) === String(user?._id));

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


                {/* ── Admin view: members list directly, no tabs ── */}
                {isAdmin ? (
                    <View style={styles.tabContent}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>
                                Members ({group.members?.length || 0}/{group.maxMembers})
                            </Text>
                            <TouchableOpacity
                                style={styles.addMemberBtn}
                                onPress={() => navigation.navigate('AdminAddMembers', { groupId, mode: 'manage' })}
                                activeOpacity={0.75}
                            >
                                <Ionicons name="add" size={20} color={colors.primary} />
                            </TouchableOpacity>
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
                ) : (
                    <>
                        {/* ── Member view: tab bar ── */}
                        <View style={styles.tabBar}>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
                                onPress={() => setActiveTab('payments')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="calendar-outline" size={16} color={activeTab === 'payments' ? colors.primary : colors.textSecondary} />
                                <Text style={[styles.tabText, activeTab === 'payments' && { color: colors.primary }]}>Payments</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'members' && styles.tabActive]}
                                onPress={() => setActiveTab('members')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="people-outline" size={16} color={activeTab === 'members' ? colors.primary : colors.textSecondary} />
                                <Text style={[styles.tabText, activeTab === 'members' && { color: colors.primary }]}>Members</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Payments Tab ── */}
                        {activeTab === 'payments' && (
                            <View style={styles.tabContent}>
                                {/* Pay Now card (active group only) */}
                                {isActive && (() => {
                                    const isRejected = myPayment?.status === 'rejected' || myPayment?.status === 'failed';
                                    const isPaid     = myPayment?.status === 'paid';
                                    const isVerified = myPayment?.status === 'verified';
                                    const accent = isRejected ? '#EF4444' : isPaid ? '#D97706' : isVerified ? '#10B981' : colors.primary;
                                    const icon   = isRejected ? 'close-circle' : isPaid ? 'hourglass-outline' : isVerified ? 'checkmark-circle' : 'card-outline';
                                    const canPay = !myPayment || myPayment.status === 'pending' || isRejected;
                                    return (
                                        <TouchableOpacity
                                            style={[styles.payCard, { borderLeftColor: accent }]}
                                            onPress={canPay ? () => navigation.navigate('Payments') : undefined}
                                            activeOpacity={canPay ? 0.75 : 1}
                                        >
                                            <View style={[styles.payCardIcon, { backgroundColor: accent + '18' }]}>
                                                <Ionicons name={icon} size={18} color={accent} />
                                            </View>
                                            <View style={styles.payCardBody}>
                                                <Text style={styles.payCardTitle} numberOfLines={1}>
                                                    Month {currentMonth}
                                                    {isVerified ? ' · Paid ✓' : isPaid ? ' · Awaiting verification' : isRejected ? ' · Rejected' : ' · Payment due'}
                                                </Text>
                                                <Text style={styles.payCardAmt}>
                                                    ₹{(myPayment?.amount || group.emiAmount)?.toLocaleString('en-IN')}
                                                </Text>
                                            </View>
                                            {canPay && (
                                                <View style={[styles.payCardBtn, { backgroundColor: accent }]}>
                                                    <Ionicons name={isRejected ? 'refresh' : 'card'} size={13} color="#fff" />
                                                    <Text style={styles.payCardBtnTxt}>{isRejected ? 'Resubmit' : 'Pay Now'}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })()}

                                {/* Payment Timeline */}
                                <Text style={styles.tlInlineHeading}>Payment Timeline</Text>
                                <Text style={styles.tlInlineSub}>Track all payments for the group</Text>

                                {Array.from({ length: totalMonths }, (_, i) => i + 1).map((month) => {
                                    const myPmt = payments.find(p => String(p.user?._id || p.user) === String(user?._id) && p.month === month);
                                    const isCurrentMonth = month === currentMonth;
                                    const isFuture = month > currentMonth;

                                    let statusKey = 'upcoming';
                                    if (!isFuture) {
                                        if (myPmt) {
                                            statusKey = myPmt.status === 'failed' ? 'rejected' : myPmt.status;
                                        } else {
                                            statusKey = isCurrentMonth ? 'pending' : 'overdue';
                                        }
                                    }
                                    const ST = TIMELINE_STATUS[statusKey] || TIMELINE_STATUS.upcoming;
                                    const isLast = month === totalMonths;
                                    const date = myPmt?.paidAt || myPmt?.createdAt;
                                    const amt = myPmt?.amount || group.emiAmount;
                                    const dotColor = isFuture
                                        ? colors.backgroundTertiary
                                        : (statusKey === 'rejected' || statusKey === 'overdue') ? '#EF4444' : statusKey === 'pending' ? '#D97706' : '#10B981';

                                    return (
                                        <TouchableOpacity
                                            key={month}
                                            style={[styles.tlOuterRow, isCurrentMonth && styles.tlOuterRowCurrent]}
                                            activeOpacity={myPmt ? 0.72 : 1}
                                            onPress={() => {
                                                if (!myPmt) return;
                                                navigation.navigate('PaymentDetail', { payment: { ...myPmt, group }, upiVpa });
                                            }}
                                        >
                                            <View style={styles.tlSpineCol}>
                                                <View style={[styles.tlDotCircle, { backgroundColor: dotColor }]}>
                                                    <Text style={[styles.tlDotNum, { color: isFuture ? colors.textTertiary : '#fff' }]}>{month}</Text>
                                                </View>
                                                {!isLast && <View style={[styles.tlSpineLine, { backgroundColor: isFuture ? colors.border : colors.primary + '35' }]} />}
                                            </View>
                                            <View style={styles.tlInnerRow}>
                                                {isFuture ? (
                                                    <Text style={[styles.tlMonthLabel, { color: colors.textTertiary }]}>
                                                        Month {month}
                                                    </Text>
                                                ) : (
                                                    <>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.tlMonthLabel}>
                                                                Month {month}{isCurrentMonth ? ' (Current)' : ''}
                                                            </Text>
                                                            {date ? (
                                                                <Text style={styles.tlDateLabel}>
                                                                    {new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                        <View style={{ alignItems: 'flex-end', gap: 5 }}>
                                                            <Text style={styles.tlAmtLabel}>
                                                                ₹{amt?.toLocaleString('en-IN')}
                                                            </Text>
                                                            <View style={[styles.tlStatusChip, { backgroundColor: ST.bgColor, borderColor: ST.color + '50' }]}>
                                                                {ST.icon && <Ionicons name={ST.icon} size={11} color={ST.color} />}
                                                                <Text style={[styles.tlStatusLabel, { color: ST.color }]}>{ST.label}</Text>
                                                            </View>
                                                        </View>
                                                    </>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {/* ── Members Tab ── */}
                        {activeTab === 'members' && (
                            <View style={styles.tabContent}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>
                                        Members ({group.members?.length || 0}/{group.maxMembers})
                                    </Text>
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
                        )}
                    </>
                )}

                {/* ── Activate Group (admin, pending only) ── */}
                {isAdmin && group.status === 'pending' && (() => {
                    const memberCount = group.members?.length || 0;
                    const maxMembers  = group.maxMembers || 0;
                    const isFull      = memberCount >= maxMembers;
                    return (
                        <View style={styles.activateSection}>
                            {/* Member count progress */}
                            <View style={styles.activateMemberRow}>
                                <Ionicons
                                    name={isFull ? 'checkmark-circle' : 'people-outline'}
                                    size={16}
                                    color={isFull ? colors.success : colors.warning}
                                />
                                <Text style={[styles.activateMemberText, { color: isFull ? colors.success : colors.warning }]}>
                                    {memberCount}/{maxMembers} members added
                                </Text>
                            </View>

                            {/* Warning if not full */}
                            {!isFull && (
                                <View style={styles.activateWarningBox}>
                                    <Ionicons name="warning-outline" size={14} color={colors.warning} />
                                    <Text style={styles.activateWarningText}>
                                        Add all {maxMembers} members before activating. Once activated, the member list is locked and no new members can be added.
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.activateBtn, sendingActivateOtp && { opacity: 0.6 }]}
                                onPress={handleActivatePress}
                                disabled={sendingActivateOtp}
                                activeOpacity={0.85}
                            >
                                {sendingActivateOtp
                                    ? <ActivityIndicator size="small" color="#fff" />
                                    : <>
                                        <Ionicons name="play-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.activateBtnText}>Activate Group</Text>
                                      </>
                                }
                            </TouchableOpacity>
                        </View>
                    );
                })()}

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

            {/* ── Activate Group OTP Modal ── */}
            <Modal visible={showActivateOtpModal} transparent animationType="fade" onRequestClose={() => setShowActivateOtpModal(false)}>
                <View style={styles.otpOverlay}>
                    <View style={styles.otpBox}>
                        <View style={[styles.otpIconWrap, { backgroundColor: colors.primaryLight }]}>
                            <Ionicons name="play-circle-outline" size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.otpTitle}>Confirm Activation</Text>
                        <Text style={styles.otpSub}>
                            Enter the OTP sent to{'\n'}+91 {user?.phone} to activate this group.
                        </Text>

                        <TextInput
                            style={[styles.otpInput, webOutlineReset, focusBorder(colors, activateOtpFocused), activateOtpError && styles.otpInputError]}
                            value={activateOtpCode}
                            onChangeText={v => { setActivateOtpCode(v); setActivateOtpError(''); }}
                            placeholder="Enter OTP"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="number-pad"
                            maxLength={6}
                            {...activateOtpFocusProps}
                            autoFocus
                            textAlign="center"
                        />

                        {activateOtpError ? (
                            <View style={styles.otpErrorRow}>
                                <Ionicons name="alert-circle" size={13} color={colors.error} />
                                <Text style={styles.otpErrorText}>{activateOtpError}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.activateOtpConfirmBtn, verifyingActivate && { opacity: 0.6 }]}
                            onPress={handleConfirmActivate}
                            disabled={verifyingActivate}
                            activeOpacity={0.85}
                        >
                            {verifyingActivate
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.otpConfirmText}>Activate Group</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.otpCancelBtn} onPress={() => setShowActivateOtpModal(false)}>
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

                if (!timelineMember) return null;
                return (
                    <View style={styles.tlRoot} pointerEvents="auto">

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
                                            activeOpacity={String(p._id).startsWith('dummy-') ? 1 : 0.75}
                                            onPress={() => {
                                                if (String(p._id).startsWith('dummy-')) return;
                                                if (isAdmin) {
                                                    navigation.navigate('AdminPaymentDetail', { payment: p });
                                                } else {
                                                    navigation.navigate('PaymentDetail', {
                                                        payment: { ...p, group },
                                                        upiVpa,
                                                    });
                                                }
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
        // ── Tab bar ──
        tabBar: {
            flexDirection: 'row',
            marginHorizontal: 16,
            marginTop: 4,
            backgroundColor: colors.background,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
        },
        tab: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 12,
            borderBottomWidth: 2,
            borderBottomColor: 'transparent',
        },
        tabActive: {
            borderBottomColor: colors.primary,
            backgroundColor: colors.primaryLight,
        },
        tabText: {
            fontSize: 14,
            fontFamily: F.medium,
            color: colors.textSecondary,
        },
        tabContent: {
            paddingHorizontal: 16,
            paddingTop: 12,
        },
        // ── Inline payment timeline ──
        tlInlineHeading: {
            fontSize: 15,
            fontFamily: F.semibold,
            color: colors.text,
            marginTop: 12,
            marginBottom: 2,
        },
        tlInlineSub: {
            fontSize: 12,
            fontFamily: F.regular,
            color: colors.textSecondary,
            marginBottom: 12,
        },
        tlOuterRow: {
            flexDirection: 'row',
            paddingVertical: 4,
        },
        tlOuterRowCurrent: {
            backgroundColor: colors.warningLight,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.warning + '60',
            marginHorizontal: -6,
            paddingHorizontal: 6,
        },
        tlSpineCol: {
            alignItems: 'center',
            width: 36,
            paddingTop: 12,
        },
        tlDotCircle: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        tlDotNum: {
            fontSize: 12,
            fontFamily: F.bold,
        },
        tlSpineLine: {
            width: 2,
            flexGrow: 1,
            minHeight: 20,
            marginTop: 4,
        },
        tlInnerRow: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingLeft: 8,
            paddingRight: 4,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        tlMonthLabel: {
            fontSize: 14,
            fontFamily: F.semibold,
            color: colors.text,
        },
        tlDateLabel: {
            fontSize: 11,
            fontFamily: F.regular,
            color: colors.textSecondary,
            marginTop: 2,
        },
        tlAmtLabel: {
            fontSize: 14,
            fontFamily: F.semibold,
            color: colors.text,
        },
        tlStatusChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderWidth: 1,
        },
        tlStatusLabel: {
            fontSize: 11,
            fontFamily: F.medium,
        },
        tlAdminNote: {
            fontSize: 11,
            fontFamily: F.regular,
            color: colors.textSecondary,
            textAlign: 'center',
            marginTop: 12,
            marginBottom: 4,
        },
        // ── Member payment card (compact) ──
        payCard: {
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: colors.background,
            borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3,
            borderRadius: 12, marginBottom: 8,
            padding: 12,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
        },
        payCardIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
        payCardBody: { flex: 1, minWidth: 0 },
        payCardTitle:{ fontSize: 13, fontFamily: F.semibold, color: colors.text },
        payCardAmt:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        payCardBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8,
        },
        payCardBtnTxt: { fontSize: 12, fontFamily: F.semibold, color: '#fff' },
        // ── Payment history button ──
        historyBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: 14, height: 44,
            borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary,
            backgroundColor: colors.primaryLight,
        },
        historyBtnTxt: { flex: 1, fontSize: 14, fontFamily: F.semibold, color: colors.primary },
        activateSection: { paddingHorizontal: 16, marginTop: 12 },
        activateMemberRow: {
            flexDirection: 'row', alignItems: 'center', gap: 6,
            marginBottom: 8,
        },
        activateMemberText: { fontSize: 13, fontFamily: F.semibold },
        activateWarningBox: {
            flexDirection: 'row', alignItems: 'flex-start', gap: 6,
            backgroundColor: colors.warningLight,
            borderWidth: 1, borderColor: colors.warning + '50',
            borderRadius: 10, padding: 10, marginBottom: 10,
        },
        activateWarningText: {
            flex: 1, fontSize: 12, fontFamily: F.regular,
            color: colors.warning, lineHeight: 17,
        },
        activateBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 52, borderRadius: 12, backgroundColor: colors.primary,
        },
        activateBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
        activateOtpConfirmBtn: {
            width: '100%', height: 52, borderRadius: 12,
            backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12,
        },
        deleteSection: { paddingHorizontal: 16, marginTop: 12 },
        deleteBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 52, borderRadius: 12, borderWidth: 1.5,
            borderColor: colors.status.rejected.border, backgroundColor: 'transparent',
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

        // ── Payment timeline (full-screen overlay) ──
        tlRoot: {
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: colors.background,
            zIndex: 10, elevation: 10,
        },
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
