import React, { useMemo, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
    Modal, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
    getGroups, getEligibleMembers, createEmiCycle, getPlannedWinner,
    sendBulkNotification, triggerReminders,
    getAdminUsers, deleteUser, sendOtp, verifyOtp,
    getPendingAccountRequests,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';
import Toast, { useToast } from '../components/Toast';

// ── Small reusable card ──
function ActionCard({ icon, iconBg, iconColor, title, subtitle, onPress, colors }) {
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.75}>
            <View style={styles.actionCardLeft}>
                <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
                    <Ionicons name={icon} size={24} color={iconColor} />
                </View>
                <View style={styles.actionCardInfo}>
                    <Text style={styles.actionCardTitle}>{title}</Text>
                    <Text style={styles.actionCardSub}>{subtitle}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
    );
}

// ── Modal shell ──
function Sheet({ visible, title, onClose, children, colors }) {
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle}>{title}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    {children}
                </View>
            </View>
        </Modal>
    );
}

export default function AdminControlsScreen({ navigation }) {
    const { colors } = useTheme();
    const { user: currentUser } = useAuth();
    const { toast, show } = useToast();
    const [pendingCount, setPendingCount] = useState(0);

    useFocusEffect(useCallback(() => {
        getPendingAccountRequests()
            .then(res => setPendingCount(res.data.requests?.length || 0))
            .catch(() => {});
    }, []));

    // ── Create Cycle state ──
    const [showCycle, setShowCycle] = useState(false);
    const [cycleStep, setCycleStep] = useState(1);
    const [allGroups, setAllGroups] = useState([]);
    const [cycleGroupId, setCycleGroupId] = useState('');
    const [eligible, setEligible] = useState([]);
    const [winnerId, setWinnerId] = useState('');
    const [loadingEligible, setLoadingEligible] = useState(false);
    const [creatingCycle, setCreatingCycle] = useState(false);
    const [plannedWinnerId, setPlannedWinnerId] = useState(null);
    const [plannedNextMonth, setPlannedNextMonth] = useState(null);
    const [plannedEmiAmount, setPlannedEmiAmount] = useState(null);
    const [plannedReducedEmi, setPlannedReducedEmi] = useState(null);
    const [cycleReducedEmi, setCycleReducedEmi] = useState('');   // editable on confirm step
    const [reducedFocused, reducedFocusProps] = useInputFocus();

    // ── Bulk Notify state ──
    const [showNotify, setShowNotify] = useState(false);
    const [notifyTitle, setNotifyTitle] = useState('');
    const [notifyBody, setNotifyBody] = useState('');
    const [notifyGroupId, setNotifyGroupId] = useState('');
    const [sending, setSending] = useState(false);

    // ── User Management state ──
    const [showUsers, setShowUsers] = useState(false);
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [titleFocused, titleFocusProps] = useInputFocus();
    const [bodyFocused, bodyFocusProps] = useInputFocus();
    const [userSearchFocused, userSearchFocusProps] = useInputFocus();
    const [loadingUsers, setLoadingUsers] = useState(false);

    // ── OTP-gated delete (only when target user belongs to one or more groups) ──
    const [deleteTarget, setDeleteTarget]       = useState(null);   // { user, requiresOtp }
    const [delOtpCode, setDelOtpCode]           = useState('');
    const [delOtpError, setDelOtpError]         = useState('');
    const [sendingDelOtp, setSendingDelOtp]     = useState(false);
    const [verifyingDelete, setVerifyingDelete] = useState(false);
    const [delOtpFocused, delOtpFocusProps]     = useInputFocus();

    // Peek a user's group memberships (opened from the Groups chip on the user card).
    const [groupsPeek, setGroupsPeek] = useState(null);   // { user }

    useFocusEffect(useCallback(() => {
        getGroups().then(res => setAllGroups(res.data.groups || [])).catch(() => {});
    }, []));

    // ── Cycle handlers ──
    const openCycle = () => {
        setCycleStep(1);
        setCycleGroupId('');
        setEligible([]);
        setWinnerId('');
        setPlannedWinnerId(null);
        setPlannedNextMonth(null);
        setPlannedEmiAmount(null);
        setPlannedReducedEmi(null);
        setCycleReducedEmi('');
        setShowCycle(true);
    };

    const selectCycleGroup = async (groupId) => {
        setCycleGroupId(groupId);
        setLoadingEligible(true);
        try {
            const [eligibleRes, planRes] = await Promise.all([
                getEligibleMembers(groupId),
                getPlannedWinner(groupId).catch(() => ({ data: {} })),
            ]);
            setEligible(eligibleRes.data.members || []);
            const planned = planRes.data?.plannedWinnerId || null;
            setPlannedWinnerId(planned);
            setPlannedNextMonth(planRes.data?.nextMonth || null);
            setPlannedEmiAmount(planRes.data?.plannedEmiAmount ?? null);
            setPlannedReducedEmi(planRes.data?.plannedReducedEmi ?? null);
            // Pre-select the planned winner if it's still eligible
            if (planned && (eligibleRes.data.members || []).some(m => String(m._id) === String(planned))) {
                setWinnerId(planned);
            } else {
                setWinnerId('');
            }
            setCycleStep(2);
        } catch (err) {
            show('Failed to load eligible members', 'error');
        } finally {
            setLoadingEligible(false);
        }
    };

    // Step 2 → Step 3: hop to confirmation with pre-filled reducing EMI for that month.
    const goToCycleConfirm = () => {
        if (!winnerId) return;
        const group = allGroups.find(g => g._id === cycleGroupId);
        const defaultReduced = plannedReducedEmi ?? group?.reducedEmi ?? '';
        setCycleReducedEmi(String(defaultReduced || ''));
        setCycleStep(3);
    };

    const submitCycle = async () => {
        if (!cycleGroupId || !winnerId) return;
        const re = Number(cycleReducedEmi);
        if (!Number.isFinite(re) || re <= 0) {
            show('Reducing EMI must be a positive number', 'warning');
            return;
        }
        setCreatingCycle(true);
        try {
            await createEmiCycle({ groupId: cycleGroupId, winnerId, reducedEmi: re });
            setShowCycle(false);
            show('Cycle created and members notified');
        } catch (err) {
            const candidates = [err?.response?.data?.error, err?.response?.data?.message, err?.message];
            const msg = candidates.find(v => typeof v === 'string' && v.length > 0) || 'Failed to create cycle';
            show(msg, 'error');
        } finally {
            setCreatingCycle(false);
        }
    };

    // ── Helpers to display month label for the upcoming draw ──
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const computeMonthName = (group, monthOffset) => {
        if (!group || !monthOffset) return '';
        const baseStr = group.startDate || group.createdAt;
        const base = baseStr ? new Date(baseStr) : new Date();
        const d = new Date(base.getFullYear(), base.getMonth() + (monthOffset - 1), 1);
        return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    };

    // ── Notify handlers ──
    const openNotify = () => { setNotifyTitle(''); setNotifyBody(''); setNotifyGroupId(''); setShowNotify(true); };

    const submitNotify = async () => {
        if (!notifyTitle.trim() || !notifyBody.trim()) {
            show('Enter both title and message', 'warning');
            return;
        }
        setSending(true);
        try {
            const payload = { title: notifyTitle.trim(), body: notifyBody.trim() };
            if (notifyGroupId) payload.groupId = notifyGroupId;
            const res = await sendBulkNotification(payload);
            setShowNotify(false);
            show(`Sent to ${res.data.sent || 0} members`);
        } catch (err) {
            show(err.response?.data?.error || 'Failed to send', 'error');
        } finally {
            setSending(false);
        }
    };

    // ── Trigger reminders ──
    const handleTriggerReminders = () => {
        Alert.alert(
            'Trigger Reminders',
            'Send EMI payment reminders to all members with pending payments?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send', onPress: async () => {
                        try {
                            await triggerReminders();
                            show('Reminders sent to all members');
                        } catch (err) {
                            show(err.response?.data?.error || 'Failed to trigger', 'error');
                        }
                    },
                },
            ]
        );
    };

    // ── User management ──
    const openUsers = async () => {
        setShowUsers(true);
        setLoadingUsers(true);
        try {
            const res = await getAdminUsers({ limit: 100 });
            setUsers(res.data.users || []);
        } catch (err) {
            show('Failed to load users', 'error');
        } finally {
            setLoadingUsers(false);
        }
    };

    // Helper: extract first non-empty string from server error response.
    const extractErr = (err, fallback) => {
        const candidates = [err?.response?.data?.error, err?.response?.data?.message, err?.message];
        return candidates.find(v => typeof v === 'string' && v.length > 0) || fallback;
    };

    const performDelete = async (userId) => {
        try {
            await deleteUser(userId);
            setUsers(prev => prev.filter(x => x._id !== userId));
            show('User removed', 'error');
        } catch (err) {
            show(extractErr(err, 'Failed to delete user'), 'error');
        }
    };

    const handleDeleteUser = (u) => {
        // Defensive — UI hides delete for admins, but guard the handler too.
        if (u.role === 'admin') {
            show('Admin accounts cannot be deleted', 'warning');
            return;
        }
        if (String(u._id) === String(currentUser?._id)) {
            show('You cannot delete your own account', 'warning');
            return;
        }
        const inGroups = (u.groups || []).length > 0;
        if (!inGroups) {
            // No group ties — simple confirm is enough.
            Alert.alert('Delete User', `Remove ${u.name || u.phone} permanently?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => performDelete(u._id) },
            ]);
            return;
        }
        // User belongs to one or more groups — gate behind OTP.
        setDelOtpCode('');
        setDelOtpError('');
        setSendingDelOtp(true);
        setDeleteTarget({ user: u, requiresOtp: true });
        sendOtp(currentUser?.phone)
            .catch(err => {
                show(extractErr(err, 'Failed to send OTP'), 'error');
                setDeleteTarget(null);
            })
            .finally(() => setSendingDelOtp(false));
    };

    const handleConfirmDeleteUser = async () => {
        if (delOtpCode.length < 4) {
            setDelOtpError('Enter the OTP sent to your phone');
            return;
        }
        if (!deleteTarget?.user) return;
        setVerifyingDelete(true);
        setDelOtpError('');
        try {
            await verifyOtp(currentUser?.phone, delOtpCode);
            await performDelete(deleteTarget.user._id);
            setDeleteTarget(null);
        } catch (err) {
            const msg = extractErr(err, '');
            const looksLikeOtpErr = msg.toLowerCase().includes('otp')
                || msg.toLowerCase().includes('invalid')
                || err?.response?.status === 400
                || err?.response?.status === 401;
            if (looksLikeOtpErr) setDelOtpError('Invalid OTP. Please try again.');
            else { show(msg || 'Failed to delete', 'error'); setDeleteTarget(null); }
        } finally {
            setVerifyingDelete(false);
        }
    };

    const cancelDeleteOtp = () => {
        setDeleteTarget(null);
        setDelOtpCode('');
        setDelOtpError('');
    };

    const filteredUsers = users.filter(u =>
        !userSearch ||
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone?.includes(userSearch)
    );

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.title}>Admin Controls</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 90 }}>

                {/* MONTHLY DRAW */}
                <Text style={styles.sectionTitle}>MONTHLY DRAW</Text>
                <ActionCard
                    icon="add-circle-outline"
                    iconBg={colors.primaryLight}
                    iconColor={colors.primary}
                    title="Run This Month's Draw"
                    subtitle="Execute the cycle for the next month (uses your POT Plan)"
                    onPress={openCycle}
                    colors={colors}
                />

                {/* NOTIFICATIONS */}
                <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
                <ActionCard
                    icon="notifications-outline"
                    iconBg={colors.warningLight}
                    iconColor={colors.warning}
                    title="Bulk Notify Members"
                    subtitle="Send a push message to all or a group"
                    onPress={openNotify}
                    colors={colors}
                />
                <ActionCard
                    icon="alarm-outline"
                    iconBg={colors.primaryLight}
                    iconColor={colors.primary}
                    title="Trigger EMI Reminders"
                    subtitle="Manually run the reminder scheduler"
                    onPress={handleTriggerReminders}
                    colors={colors}
                />

                {/* USER MANAGEMENT */}
                <Text style={styles.sectionTitle}>USER MANAGEMENT</Text>
                <ActionCard
                    icon="document-text-outline"
                    iconBg={colors.warningLight}
                    iconColor={colors.warning}
                    title={`Account Requests${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
                    subtitle="Review and approve new member sign-up requests"
                    onPress={() => navigation.navigate('AdminAccountRequests')}
                    colors={colors}
                />
                <ActionCard
                    icon="people-outline"
                    iconBg={colors.successLight}
                    iconColor={colors.success}
                    title="Manage Users"
                    subtitle="View memberships and remove inactive users"
                    onPress={openUsers}
                    colors={colors}
                />

                {/* APP SETTINGS */}
                <Text style={styles.sectionTitle}>APP SETTINGS</Text>
                <ActionCard
                    icon="archive-outline"
                    iconBg={colors.infoLight}
                    iconColor={colors.info}
                    title="Backup & Export"
                    subtitle="Export all data as JSON (coming soon)"
                    onPress={() => show('Coming soon — backup will be available in a future update.', 'info')}
                    colors={colors}
                />
            </ScrollView>

            {/* Create Cycle Modal */}
            <Sheet
                visible={showCycle}
                title={
                    cycleStep === 1 ? 'Run Draw: Select Group'
                    : cycleStep === 2 ? 'Run Draw: Pick Winner'
                    : 'Run Draw: Confirm'
                }
                onClose={() => setShowCycle(false)}
                colors={colors}
            >
                <ScrollView style={styles.cycleScroll} showsVerticalScrollIndicator={false}>
                    {cycleStep === 1 ? (
                        allGroups.filter(g => g.status === 'active').length === 0 ? (
                            <Text style={styles.emptyHint}>No active groups found</Text>
                        ) : (
                            allGroups.filter(g => g.status === 'active').map(g => {
                                const active = cycleGroupId === g._id;
                                return (
                                    <TouchableOpacity
                                        key={g._id}
                                        style={[styles.selectRow, active && styles.selectRowActive]}
                                        onPress={() => selectCycleGroup(g._id)}
                                        disabled={loadingEligible}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[styles.selectRowText, active && styles.selectRowTextActive]}>{g.name}</Text>
                                        <Text style={[styles.selectRowSub, active && styles.selectRowSubActive]}>
                                            Month {g.currentMonth}/{g.totalMonths} · {g.members?.length || 0} members
                                        </Text>
                                        {loadingEligible && active && (
                                            <ActivityIndicator size="small" color={colors.primaryDark} style={{ marginTop: 4 }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )
                    ) : cycleStep === 2 ? (
                        <>
                            <TouchableOpacity style={styles.backLink} onPress={() => { setCycleStep(1); setWinnerId(''); }}>
                                <Ionicons name="arrow-back" size={14} color={colors.primary} />
                                <Text style={styles.backLinkText}> Change group</Text>
                            </TouchableOpacity>
                            {plannedNextMonth ? (
                                <Text style={styles.plannedBanner}>
                                    {plannedWinnerId
                                        ? `Planned winner pre-selected for Month ${plannedNextMonth}. Tap another name to override.`
                                        : `No POT plan for Month ${plannedNextMonth} — pick a winner manually.`}
                                </Text>
                            ) : null}
                            {eligible.length === 0 ? (
                                <Text style={styles.emptyHint}>No eligible members — all have won already</Text>
                            ) : (
                                eligible.map(m => {
                                    const isPlanned = plannedWinnerId && String(plannedWinnerId) === String(m._id);
                                    const active    = winnerId === m._id;
                                    return (
                                        <TouchableOpacity
                                            key={m._id}
                                            style={[styles.selectRow, active && styles.selectRowActive]}
                                            onPress={() => setWinnerId(m._id)}
                                            activeOpacity={0.75}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={[styles.selectRowText, active && styles.selectRowTextActive]}>
                                                    {m.name || m.phone}
                                                </Text>
                                                {isPlanned && (
                                                    <View style={styles.plannedBadge}>
                                                        <Text style={styles.plannedBadgeText}>Planned</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={[styles.selectRowSub, active && styles.selectRowSubActive]}>{m.phone}</Text>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </>
                    ) : (
                        // ── Step 3: Confirm draw ──
                        (() => {
                            const group     = allGroups.find(g => g._id === cycleGroupId);
                            const winner    = eligible.find(m => m._id === winnerId);
                            const monthName = computeMonthName(group, plannedNextMonth);
                            const winnerEmi = plannedEmiAmount ?? group?.emiAmount;
                            return (
                                <>
                                    <TouchableOpacity style={styles.backLink} onPress={() => setCycleStep(2)}>
                                        <Ionicons name="arrow-back" size={14} color={colors.primary} />
                                        <Text style={styles.backLinkText}> Change winner</Text>
                                    </TouchableOpacity>

                                    <View style={styles.confirmCard}>
                                        <Text style={styles.confirmHint}>POT WINNER FOR</Text>
                                        <Text style={styles.confirmMonth}>
                                            Month {plannedNextMonth}{monthName ? ` · ${monthName}` : ''}
                                        </Text>
                                        <View style={styles.confirmDivider} />
                                        <View style={styles.confirmWinnerRow}>
                                            <View style={styles.confirmAvatar}>
                                                <Text style={styles.confirmAvatarTxt}>
                                                    {(winner?.name || winner?.phone || '?').charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.confirmWinnerName}>{winner?.name || 'Unknown'}</Text>
                                                <Text style={styles.confirmWinnerPhone}>+91 {winner?.phone}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.field}>
                                        <Text style={styles.fieldLabel}>Winner EMI (fixed for this winner)</Text>
                                        <View style={[styles.fieldInput, styles.fieldInputReadonly]}>
                                            <Text style={styles.fieldInputReadonlyTxt}>
                                                ₹{Number(winnerEmi || 0).toLocaleString('en-IN')}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.field}>
                                        <Text style={styles.fieldLabel}>Reducing EMI for non-winners (this month)</Text>
                                        <View style={[styles.fieldInputRow, focusBorder(colors, reducedFocused)]}>
                                            <Text style={styles.fieldPrefix}>₹</Text>
                                            <TextInput
                                                style={[styles.fieldInputBare, webOutlineReset]}
                                                value={cycleReducedEmi}
                                                onChangeText={v => setCycleReducedEmi(v.replace(/[^0-9.]/g, ''))}
                                                keyboardType="numeric"
                                                placeholder="0"
                                                placeholderTextColor={colors.textSecondary}
                                                {...reducedFocusProps}
                                            />
                                        </View>
                                        <Text style={styles.fieldHint}>
                                            Default {plannedReducedEmi != null ? 'from POT plan' : 'from group config'}. Edit to override for this draw only.
                                        </Text>
                                    </View>
                                </>
                            );
                        })()
                    )}
                </ScrollView>
                {cycleStep === 2 && winnerId ? (
                    <TouchableOpacity
                        style={styles.sheetBtn}
                        onPress={goToCycleConfirm}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.sheetBtnText}>Continue</Text>
                    </TouchableOpacity>
                ) : cycleStep === 3 ? (
                    <TouchableOpacity
                        style={[styles.sheetBtn, creatingCycle && { opacity: 0.6 }]}
                        onPress={submitCycle}
                        disabled={creatingCycle}
                        activeOpacity={0.85}
                    >
                        {creatingCycle ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetBtnText}>Confirm & Run Draw</Text>}
                    </TouchableOpacity>
                ) : null}
            </Sheet>

            {/* Bulk Notify Modal */}
            <Sheet visible={showNotify} title="Send Notification" onClose={() => setShowNotify(false)} colors={colors}>
                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Title *</Text>
                    <TextInput style={[styles.fieldInput, webOutlineReset, focusBorder(colors, titleFocused)]} value={notifyTitle} onChangeText={setNotifyTitle} placeholder="e.g. EMI Reminder" placeholderTextColor={colors.textSecondary} {...titleFocusProps} />
                </View>
                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Message * (max 160 chars)</Text>
                    <TextInput
                        style={[styles.fieldInput, styles.textarea, webOutlineReset, focusBorder(colors, bodyFocused)]}
                        value={notifyBody}
                        onChangeText={v => setNotifyBody(v.slice(0, 160))}
                        placeholder="Your message here…"
                        placeholderTextColor={colors.textSecondary}
                        multiline
                        numberOfLines={3}
                        {...bodyFocusProps}
                    />
                    <Text style={styles.charCount}>{notifyBody.length}/160</Text>
                </View>
                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Target Group (optional)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                        <TouchableOpacity
                            style={[styles.groupChip, !notifyGroupId && styles.groupChipActive]}
                            onPress={() => setNotifyGroupId('')}
                        >
                            <Text style={[styles.groupChipText, !notifyGroupId && { color: colors.primary }]}>All Members</Text>
                        </TouchableOpacity>
                        {allGroups.map(g => (
                            <TouchableOpacity
                                key={g._id}
                                style={[styles.groupChip, notifyGroupId === g._id && styles.groupChipActive]}
                                onPress={() => setNotifyGroupId(g._id)}
                            >
                                <Text style={[styles.groupChipText, notifyGroupId === g._id && { color: colors.primary }]}>{g.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                <TouchableOpacity
                    style={[styles.sheetBtn, sending && { opacity: 0.6 }]}
                    onPress={submitNotify}
                    disabled={sending}
                    activeOpacity={0.85}
                >
                    {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetBtnText}>Send to Members</Text>}
                </TouchableOpacity>
            </Sheet>

            {/* User Management Modal */}
            <Sheet visible={showUsers} title="User Management" onClose={() => setShowUsers(false)} colors={colors}>
                <View style={[styles.searchWrap, focusBorder(colors, userSearchFocused)]}>
                    <Ionicons name="search" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <TextInput
                        style={[styles.searchInput, webOutlineReset]}
                        value={userSearch}
                        onChangeText={setUserSearch}
                        placeholder="Search name or phone…"
                        placeholderTextColor={colors.textSecondary}
                        {...userSearchFocusProps}
                    />
                </View>
                <ScrollView style={styles.userList} showsVerticalScrollIndicator={false}>
                    {loadingUsers ? (
                        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
                    ) : filteredUsers.length === 0 ? (
                        <View style={styles.userEmptyBox}>
                            <Ionicons name="people-outline" size={36} color={colors.textSecondary} />
                            <Text style={styles.userEmptyTxt}>{userSearch ? 'No matching users' : 'No users yet'}</Text>
                        </View>
                    ) : (
                        filteredUsers.map(u => {
                            const grps    = u.groups || [];
                            const isAdmin = u.role === 'admin';
                            return (
                                <View key={u._id} style={[styles.userCard, isAdmin && styles.userCardAdmin]}>
                                    <View style={styles.userCardTop}>
                                        <View style={[styles.userCardAvatar, isAdmin && styles.userCardAvatarAdmin]}>
                                            <Ionicons name="person" size={15} color={isAdmin ? '#fff' : colors.textSecondary} />
                                        </View>
                                        <View style={styles.userCardMid}>
                                            <Text style={styles.userCardName} numberOfLines={1}>
                                                {u.name || '(no name)'}
                                            </Text>
                                            <Text style={styles.userCardPhone}>+91 {u.phone}</Text>
                                        </View>
                                        <View style={styles.userCardRight}>
                                            {/* Groups chip — tap to see the list. Only shown when user is in at least one group. */}
                                            {grps.length > 0 ? (
                                                <TouchableOpacity
                                                    style={styles.userGroupsBtn}
                                                    onPress={() => setGroupsPeek({ user: u })}
                                                    activeOpacity={0.7}
                                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                    <Ionicons name="people" size={11} color={colors.primary} style={{ marginRight: 4 }} />
                                                    <Text style={styles.userGroupsBtnTxt}>
                                                        Groups · {grps.length}
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : null}
                                            {/* Admin → protected lock; member → delete trash. Member role tag dropped per request. */}
                                            {isAdmin ? (
                                                <View style={styles.userLockBtn}>
                                                    <Ionicons name="lock-closed" size={12} color={colors.textSecondary} />
                                                </View>
                                            ) : (
                                                <TouchableOpacity
                                                    style={styles.userDelBtn}
                                                    onPress={() => handleDeleteUser(u)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Ionicons name="trash-outline" size={14} color={colors.error} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                    <View style={{ height: 20 }} />
                </ScrollView>
            </Sheet>

            {/* Groups peek — small popover listing the groups a user belongs to */}
            <Modal visible={!!groupsPeek} transparent animationType="fade" onRequestClose={() => setGroupsPeek(null)}>
                <TouchableOpacity
                    style={styles.groupsPeekOverlay}
                    activeOpacity={1}
                    onPress={() => setGroupsPeek(null)}
                >
                    {groupsPeek ? (
                        <TouchableOpacity activeOpacity={1} style={styles.groupsPeekBox}>
                            <View style={styles.groupsPeekHeader}>
                                <Ionicons name="people" size={16} color={colors.primary} />
                                <Text style={styles.groupsPeekTitle} numberOfLines={1}>
                                    {groupsPeek.user.name || groupsPeek.user.phone}
                                </Text>
                                <TouchableOpacity onPress={() => setGroupsPeek(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.groupsPeekSub}>
                                Member of {(groupsPeek.user.groups || []).length} group{(groupsPeek.user.groups || []).length === 1 ? '' : 's'}
                            </Text>
                            <View style={styles.groupsPeekList}>
                                {(groupsPeek.user.groups || []).map(g => (
                                    <View key={g._id} style={styles.groupsPeekItem}>
                                        <Ionicons name="ellipse" size={5} color={colors.primary} style={{ marginRight: 8 }} />
                                        <Text style={styles.groupsPeekItemTxt} numberOfLines={1}>{g.name}</Text>
                                    </View>
                                ))}
                            </View>
                        </TouchableOpacity>
                    ) : null}
                </TouchableOpacity>
            </Modal>

            {/* OTP-gated Delete User modal (only when user belongs to one or more groups) */}
            <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={cancelDeleteOtp}>
                <View style={styles.delOtpOverlay}>
                    {deleteTarget ? (
                        <View style={styles.delOtpBox}>
                            <View style={styles.delOtpIconWrap}>
                                <Ionicons name="shield-checkmark-outline" size={30} color={colors.error} />
                            </View>
                            <Text style={styles.delOtpTitle}>Confirm Delete</Text>
                            <Text style={styles.delOtpSub}>
                                <Text style={styles.delOtpEmph}>{deleteTarget.user.name || deleteTarget.user.phone}</Text>
                                {'  '}is a member of{'  '}
                                <Text style={styles.delOtpEmph}>{(deleteTarget.user.groups || []).length} group{(deleteTarget.user.groups || []).length === 1 ? '' : 's'}</Text>.
                                {'\n'}Deleting will also remove them from those groups.
                            </Text>

                            <View style={styles.delGroupsBox}>
                                {(deleteTarget.user.groups || []).slice(0, 4).map(g => (
                                    <Text key={g._id} style={styles.delGroupsItem}>• {g.name}</Text>
                                ))}
                                {(deleteTarget.user.groups || []).length > 4 ? (
                                    <Text style={styles.delGroupsMore}>… and {deleteTarget.user.groups.length - 4} more</Text>
                                ) : null}
                            </View>

                            <Text style={styles.delOtpHint}>
                                {sendingDelOtp
                                    ? 'Sending OTP…'
                                    : `OTP sent to +91 ${currentUser?.phone || '—'}`}
                            </Text>

                            <TextInput
                                style={[styles.delOtpInput, webOutlineReset, focusBorder(colors, delOtpFocused), delOtpError && styles.delOtpInputError]}
                                value={delOtpCode}
                                onChangeText={v => { setDelOtpCode(v); setDelOtpError(''); }}
                                placeholder="Enter OTP"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="number-pad"
                                maxLength={6}
                                {...delOtpFocusProps}
                                autoFocus
                                textAlign="center"
                                editable={!sendingDelOtp}
                            />
                            {delOtpError ? (
                                <View style={styles.delOtpErrorRow}>
                                    <Ionicons name="alert-circle" size={13} color={colors.error} />
                                    <Text style={styles.delOtpErrorTxt}>{delOtpError}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.delOtpConfirmBtn, (verifyingDelete || sendingDelOtp) && { opacity: 0.6 }]}
                                onPress={handleConfirmDeleteUser}
                                disabled={verifyingDelete || sendingDelOtp}
                                activeOpacity={0.85}
                            >
                                {verifyingDelete
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.delOtpConfirmTxt}>Confirm Delete</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.delOtpCancelBtn} onPress={cancelDeleteOtp} disabled={verifyingDelete}>
                                <Text style={styles.delOtpCancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </Modal>

            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.backgroundSecondary },
        header: {
            backgroundColor: colors.background,
            paddingHorizontal: 16,
            paddingTop: 56,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            zIndex: 10,
        },
        title:        { fontSize: 20, fontFamily: F.bold, color: colors.text },
        content:      { flex: 1, paddingHorizontal: 16 },
        sectionTitle: {
            fontSize: 12,
            fontFamily: F.semibold,
            color: colors.textSecondary,
            letterSpacing: 0.8,
            marginTop: 24,
            marginBottom: 10,
        },
        actionCard: {
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
            justifyContent: 'space-between',
            marginBottom: 10,
            padding: 14,
        },
        actionCardLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
        actionIcon:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        actionCardInfo:  { marginLeft: 14, flex: 1 },
        actionCardTitle: { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        actionCardSub:   { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 36,
            maxHeight: '88%',
        },
        handle: {
            width: 40,
            height: 4,
            backgroundColor: colors.border,
            borderRadius: 2,
            alignSelf: 'center',
            marginBottom: 20,
        },
        sheetHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        sheetTitle:   { fontSize: 18, fontFamily: F.bold, color: colors.text },
        sheetBtn: {
            height: 56,
            backgroundColor: colors.primary,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
        },
        sheetBtnText:  { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
        cycleScroll:   { maxHeight: 340, marginBottom: 8 },
        selectRow: {
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.border,
        },
        selectRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
        selectRowText:   { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        selectRowSub:    { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 3 },
        // selectRowActive bg is colors.primaryLight (fixed light tint, same in both modes), so the
        // text on it must use dark themed colors that contrast in both light + dark mode.
        selectRowTextActive: { color: colors.primaryDark },
        selectRowSubActive:  { color: colors.primaryDark, opacity: 0.75 },
        backLink:        { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
        backLinkText:    { fontSize: 13, fontFamily: F.medium, color: colors.primary },
        emptyHint:       { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 20 },
        plannedBanner:   {
            fontSize: 12, fontFamily: F.medium, color: colors.primary,
            backgroundColor: colors.primaryLight, borderRadius: 8,
            paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
        },
        plannedBadge: {
            marginLeft: 8, backgroundColor: colors.primary,
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
        },
        plannedBadgeText: { fontSize: 10, fontFamily: F.semibold, color: '#fff' },
        field:           { marginBottom: 12 },
        fieldLabel:      { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary, marginBottom: 6 },
        fieldInput: {
            height: 52,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            fontSize: 14,
            fontFamily: F.regular,
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
        },
        textarea:    { height: 80, textAlignVertical: 'top', paddingTop: 12 },
        fieldInputReadonly: { justifyContent: 'center' },
        fieldInputReadonlyTxt: { fontSize: 16, fontFamily: F.semibold, color: colors.text },
        fieldInputRow: {
            flexDirection: 'row', alignItems: 'center',
            height: 52, paddingHorizontal: 14,
            borderWidth: 1, borderColor: colors.border, borderRadius: 10,
            backgroundColor: colors.backgroundSecondary,
        },
        fieldPrefix:   { fontSize: 15, fontFamily: F.semibold, color: colors.primary, marginRight: 6 },
        fieldInputBare:{ flex: 1, fontSize: 15, fontFamily: F.regular, color: colors.text, height: 52 },
        fieldHint:     { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 4 },
        // Confirm card (step 3)
        confirmCard: {
            backgroundColor: colors.primaryLight,
            borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: colors.primary,
            marginBottom: 16,
        },
        confirmHint:   { fontSize: 10, fontFamily: F.semibold, color: colors.primary, letterSpacing: 1 },
        confirmMonth:  { fontSize: 18, fontFamily: F.bold, color: colors.primaryDark, marginTop: 2 },
        confirmDivider:{ height: 1, backgroundColor: colors.primary, opacity: 0.25, marginVertical: 12 },
        confirmWinnerRow: { flexDirection: 'row', alignItems: 'center' },
        confirmAvatar: {
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center', marginRight: 12,
        },
        confirmAvatarTxt:   { fontSize: 18, fontFamily: F.bold, color: '#fff' },
        confirmWinnerName:  { fontSize: 15, fontFamily: F.bold, color: colors.primaryDark },
        confirmWinnerPhone: { fontSize: 12, fontFamily: F.regular, color: colors.primaryDark, opacity: 0.75, marginTop: 1 },
        charCount:   { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
        groupChip: {
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 7,
            marginRight: 8,
            borderWidth: 1,
            borderColor: colors.border,
        },
        groupChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
        groupChipText:   { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary },
        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 44,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
        },
        searchInput:   { flex: 1, fontSize: 13, fontFamily: F.regular, color: colors.text },
        userList:      { maxHeight: 460 },
        // ── Card-based user row (compact) ──
        userCard: {
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6,
        },
        userCardAdmin: {
            borderColor: colors.primary, borderWidth: 1.5,
            backgroundColor: colors.primaryLight,
        },
        userLockBtn: {
            width: 28, height: 28, borderRadius: 7,
            backgroundColor: colors.backgroundTertiary,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border,
        },
        userCardTop:    { flexDirection: 'row', alignItems: 'center' },
        userCardAvatar: {
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 10, borderWidth: 1, borderColor: colors.border,
        },
        userCardAvatarAdmin: { backgroundColor: colors.textSecondary, borderColor: colors.textSecondary },
        userCardMid:         { flex: 1 },
        userCardName:        { fontSize: 13, fontFamily: F.semibold, color: colors.text },
        userCardPhone:       { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        userCardRight:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
        userDelBtn: {
            width: 28, height: 28, borderRadius: 7,
            backgroundColor: colors.errorLight,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.error,
        },
        // Groups chip (tap to peek)
        userGroupsBtn: {
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.primaryLight,
            paddingHorizontal: 8, paddingVertical: 4,
            borderRadius: 10, borderWidth: 1, borderColor: colors.primary,
        },
        userGroupsBtnTxt: { fontSize: 10, fontFamily: F.semibold, color: colors.primaryDark },

        userEmptyBox: { alignItems: 'center', paddingVertical: 28 },
        userEmptyTxt: { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 8 },

        // Groups peek modal
        groupsPeekOverlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center', alignItems: 'center', padding: 28,
        },
        groupsPeekBox: {
            width: '100%', maxWidth: 360,
            backgroundColor: colors.background,
            borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: colors.border,
        },
        groupsPeekHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        groupsPeekTitle:  { flex: 1, fontSize: 14, fontFamily: F.bold, color: colors.text },
        groupsPeekSub:    { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 4, marginBottom: 10 },
        groupsPeekList:   { gap: 4 },
        groupsPeekItem:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: colors.backgroundSecondary, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
        groupsPeekItemTxt:{ fontSize: 13, fontFamily: F.medium, color: colors.text, flex: 1 },

        // ── OTP-delete modal ──
        delOtpOverlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center', alignItems: 'center', padding: 24,
        },
        delOtpBox: {
            width: '100%', maxWidth: 420,
            backgroundColor: colors.background,
            borderRadius: 18, padding: 22,
            borderWidth: 1, borderColor: colors.border,
        },
        delOtpIconWrap: {
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.errorLight,
            alignItems: 'center', justifyContent: 'center',
            alignSelf: 'center', marginBottom: 12,
        },
        delOtpTitle: { fontSize: 17, fontFamily: F.bold, color: colors.text, textAlign: 'center', marginBottom: 8 },
        delOtpSub:   { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 12 },
        delOtpEmph:  { fontFamily: F.semibold, color: colors.text },
        delGroupsBox: {
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
        },
        delGroupsItem:  { fontSize: 12, fontFamily: F.medium, color: colors.text, paddingVertical: 2 },
        delGroupsMore:  { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, paddingTop: 2 },
        delOtpHint:     { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
        delOtpInput: {
            width: '100%', height: 52, borderRadius: 10, borderWidth: 1,
            borderColor: colors.border, backgroundColor: colors.backgroundSecondary,
            fontSize: 20, fontFamily: F.bold, color: colors.text,
            letterSpacing: 6, textAlign: 'center', marginBottom: 4,
        },
        delOtpInputError: { borderColor: colors.error },
        delOtpErrorRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
        delOtpErrorTxt:   { fontSize: 12, fontFamily: F.regular, color: colors.error },
        delOtpConfirmBtn: {
            height: 50, borderRadius: 12, backgroundColor: colors.error,
            alignItems: 'center', justifyContent: 'center', marginTop: 8,
        },
        delOtpConfirmTxt: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
        delOtpCancelBtn:  { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
        delOtpCancelTxt:  { fontSize: 13, fontFamily: F.medium, color: colors.textSecondary },
    });
}
