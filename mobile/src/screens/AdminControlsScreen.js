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
    getAdminUsers, updateUserRole, deleteUser,
    getPendingAccountRequests,
} from '../services/api';
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
    const [updatingUser, setUpdatingUser] = useState({});

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
            // Pre-select the planned winner if it's still eligible
            if (planned && (eligibleRes.data.members || []).some(m => String(m._id) === String(planned))) {
                setWinnerId(planned);
            } else {
                setWinnerId('');
            }
            setCycleStep(2);
        } catch (err) {
            Alert.alert('Error', 'Failed to load eligible members');
        } finally {
            setLoadingEligible(false);
        }
    };

    const submitCycle = async () => {
        if (!cycleGroupId || !winnerId) return;
        setCreatingCycle(true);
        try {
            await createEmiCycle({ groupId: cycleGroupId, winnerId });
            setShowCycle(false);
            show('Cycle created and members notified');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to create cycle');
        } finally {
            setCreatingCycle(false);
        }
    };

    // ── Notify handlers ──
    const openNotify = () => { setNotifyTitle(''); setNotifyBody(''); setNotifyGroupId(''); setShowNotify(true); };

    const submitNotify = async () => {
        if (!notifyTitle.trim() || !notifyBody.trim()) {
            Alert.alert('Required', 'Enter both title and message');
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
            Alert.alert('Error', err.response?.data?.error || 'Failed to send');
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
                            Alert.alert('Error', err.response?.data?.error || 'Failed to trigger');
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
            Alert.alert('Error', 'Failed to load users');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleRoleToggle = (u) => {
        const newRole = u.role === 'admin' ? 'member' : 'admin';
        Alert.alert('Change Role', `Make ${u.name || u.phone} a ${newRole}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm', onPress: async () => {
                    setUpdatingUser(prev => ({ ...prev, [u._id]: true }));
                    try {
                        await updateUserRole(u._id, newRole);
                        setUsers(prev => prev.map(x => x._id === u._id ? { ...x, role: newRole } : x));
                        show(`${u.name || u.phone} is now a ${newRole}`);
                    } catch (err) {
                        Alert.alert('Error', err.response?.data?.error || 'Failed to update role');
                    } finally {
                        setUpdatingUser(prev => { const n = { ...prev }; delete n[u._id]; return n; });
                    }
                },
            },
        ]);
    };

    const handleDeleteUser = (u) => {
        Alert.alert('Delete User', `Remove ${u.name || u.phone} permanently?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteUser(u._id);
                        setUsers(prev => prev.filter(x => x._id !== u._id));
                        show('User removed', 'error');
                    } catch (err) {
                        Alert.alert('Error', err.response?.data?.error || 'Failed to delete');
                    }
                },
            },
        ]);
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
                    title="Manage Users & Roles"
                    subtitle="Change roles, remove inactive users"
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
                    onPress={() => Alert.alert('Coming Soon', 'This feature will be available in a future update.')}
                    colors={colors}
                />
            </ScrollView>

            {/* Create Cycle Modal */}
            <Sheet visible={showCycle} title={cycleStep === 1 ? 'Run Draw: Select Group' : 'Run Draw: Confirm Winner'} onClose={() => setShowCycle(false)} colors={colors}>
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
                    ) : (
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
                    )}
                </ScrollView>
                {cycleStep === 2 && winnerId ? (
                    <TouchableOpacity
                        style={[styles.sheetBtn, creatingCycle && { opacity: 0.6 }]}
                        onPress={submitCycle}
                        disabled={creatingCycle}
                        activeOpacity={0.85}
                    >
                        {creatingCycle ? <ActivityIndicator color="#fff" /> : <Text style={styles.sheetBtnText}>Run Draw & Notify</Text>}
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
                    ) : (
                        filteredUsers.map(u => (
                            <View key={u._id} style={styles.userRow}>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{u.name || '(no name)'}</Text>
                                    <Text style={styles.userPhone}>{u.phone}</Text>
                                </View>
                                <View style={styles.userRight}>
                                    <View style={[styles.roleBadge, u.role === 'admin' && styles.roleBadgeAdmin]}>
                                        <Text style={[styles.roleBadgeText, u.role === 'admin' && { color: colors.primary }]}>
                                            {u.role}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.toggleBtn}
                                        onPress={() => handleRoleToggle(u)}
                                        disabled={!!updatingUser[u._id]}
                                    >
                                        {updatingUser[u._id] ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Text style={styles.toggleText}>
                                                {u.role === 'admin' ? '→ Member' : '→ Admin'}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteUser(u)} style={{ marginLeft: 6 }}>
                                        <Ionicons name="close-circle" size={18} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                    <View style={{ height: 20 }} />
                </ScrollView>
            </Sheet>

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
        userList:      { maxHeight: 360 },
        userRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        userInfo:         { flex: 1 },
        userName:         { fontSize: 13, fontFamily: F.semibold, color: colors.text },
        userPhone:        { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        userRight:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
        roleBadge: {
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            backgroundColor: colors.backgroundTertiary,
            borderWidth: 1,
            borderColor: colors.border,
        },
        roleBadgeAdmin:   { backgroundColor: colors.primaryLight, borderColor: colors.status.rejected.border },
        roleBadgeText:    { fontSize: 10, fontFamily: F.semibold, color: colors.textSecondary },
        toggleBtn: {
            backgroundColor: colors.backgroundTertiary,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 5,
            minWidth: 72,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
        },
        toggleText: { fontSize: 11, fontFamily: F.semibold, color: colors.primary },
    });
}
