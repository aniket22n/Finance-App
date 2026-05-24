import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getGroup, getAdminUsers, addMember, removeMember } from '../services/api';
import Toast, { useToast } from '../components/Toast';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';
import { F } from '../theme';

export default function AdminAddMembersScreen({ route, navigation }) {
    const { groupId, mode = 'create' } = route.params || {};
    const isManage = mode === 'manage';
    const { colors } = useTheme();
    const { toast, show } = useToast();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [searchFocused, searchFocusProps] = useInputFocus();

    const [group, setGroup]         = useState(null);
    const [users, setUsers]         = useState([]);
    const [loading, setLoading]     = useState(true);
    const [search, setSearch]       = useState('');
    const [pendingId, setPendingId] = useState(null);  // id of user being added/removed
    const [confirmShort, setConfirmShort] = useState(false);

    const loadAll = useCallback(async () => {
        try {
            const [groupRes, usersRes] = await Promise.all([
                getGroup(groupId),
                getAdminUsers(),
            ]);
            setGroup(groupRes.data.group);
            setUsers(usersRes.data.users || []);
        } catch (err) {
            const raw = err?.response?.data?.error || err?.response?.data?.message || err?.message;
            const msg = (typeof raw === 'string' && raw) || 'Failed to load users';
            show(msg, 'error');
        } finally {
            setLoading(false);
        }
    }, [groupId, show]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const memberIds = useMemo(
        () => new Set((group?.members || []).map(m => String(m._id || m))),
        [group]
    );

    const memberCount    = memberIds.size;
    const requiredCount  = group?.maxMembers || 0;
    const remaining      = Math.max(0, requiredCount - memberCount);
    const overfilled     = memberCount > requiredCount;
    const exactlyFull    = memberCount === requiredCount && requiredCount > 0;
    const progressPct    = requiredCount > 0 ? Math.min(100, (memberCount / requiredCount) * 100) : 0;
    // Roster is locked once the first cycle has been drawn — backend enforces this too.
    const rosterLocked   = (group?.currentMonth || 0) > 0;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter(u =>
            (u.name || '').toLowerCase().includes(q) ||
            (u.phone || '').includes(q)
        );
    }, [users, search]);

    // Sort: current members first, then everyone else; preserves order within each group.
    const sortedUsers = useMemo(() => {
        const members = [];
        const others  = [];
        for (const u of filtered) {
            if (memberIds.has(String(u._id))) members.push(u);
            else others.push(u);
        }
        return [...members, ...others];
    }, [filtered, memberIds]);

    const toggleMember = async (user) => {
        if (rosterLocked) {
            show('Member list is locked — the first draw has already been executed', 'warning');
            return;
        }
        const isMember = memberIds.has(String(user._id));
        if (!isMember && memberCount >= requiredCount) {
            show(`Group already has ${requiredCount} members`, 'warning');
            return;
        }
        setPendingId(user._id);
        try {
            const res = isMember
                ? await removeMember(groupId, user._id)
                : await addMember(groupId, user._id);
            if (res?.data?.group) setGroup(res.data.group);
            show(`${user.name || user.phone} ${isMember ? 'removed' : 'added'}`, isMember ? 'warning' : 'success');
        } catch (err) {
            const candidates = [
                err?.response?.data?.error,
                err?.response?.data?.message,
                err?.message,
            ];
            const msg = candidates.find(v => typeof v === 'string' && v.length > 0)
                || (isMember ? 'Failed to remove member' : 'Failed to add member');
            show(msg, 'error');
        } finally {
            setPendingId(null);
        }
    };

    const goToPotConfig = () => {
        navigation.replace('AdminPOTWinnerConfig', { groupId });
    };

    const handleContinue = () => {
        if (isManage) {
            navigation.goBack();
            return;
        }
        if (memberCount === 0) {
            show('Add at least one member to continue', 'warning');
            return;
        }
        if (memberCount < requiredCount) {
            setConfirmShort(true);
            return;
        }
        goToPotConfig();
    };

    if (loading) {
        return (
            <View style={[styles.root, styles.center]}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (!group) {
        return (
            <View style={[styles.root, styles.center]}>
                <Text style={styles.empty}>Group not found</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
                    <Text style={styles.backLinkTxt}>Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                    <Text style={styles.backTxt}>Groups</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Add Members</Text>
                <Text style={styles.groupName}>{group.name}</Text>
            </View>

            {/* Lock banner — shown once roster is frozen */}
            {rosterLocked && (
                <View style={styles.lockBanner}>
                    <Ionicons name="lock-closed" size={14} color={colors.warning} style={{ marginRight: 8 }} />
                    <Text style={styles.lockBannerTxt}>
                        Members are locked. Draws have started for this group — the roster can't be changed.
                    </Text>
                </View>
            )}

            {/* Progress card */}
            <View style={styles.progressCard}>
                <View style={styles.progressRow}>
                    <Text style={styles.progressNumbers}>
                        <Text style={styles.progressCount}>{memberCount}</Text>
                        <Text style={styles.progressDivider}> / </Text>
                        <Text style={styles.progressTotal}>{requiredCount}</Text>
                    </Text>
                    <Text style={styles.progressLabel}>
                        {exactlyFull
                            ? 'All members added'
                            : overfilled
                                ? `Over by ${memberCount - requiredCount}`
                                : `${remaining} remaining`}
                    </Text>
                </View>
                <View style={styles.progressBarTrack}>
                    <View
                        style={[
                            styles.progressBarFill,
                            { width: `${progressPct}%`, backgroundColor: exactlyFull ? colors.success : colors.primary },
                        ]}
                    />
                </View>
            </View>

            {/* Search */}
            <View style={[styles.searchWrap, focusBorder(colors, searchFocused)]}>
                <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={[styles.searchInput, webOutlineReset]}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by name or phone..."
                    placeholderTextColor={colors.textSecondary}
                    {...searchFocusProps}
                />
                {search ? (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* User list */}
            <FlatList
                data={sortedUsers}
                keyExtractor={u => String(u._id)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Ionicons name="people-outline" size={36} color={colors.textSecondary} />
                        <Text style={styles.empty}>
                            {search ? 'No matching users' : 'No users available'}
                        </Text>
                    </View>
                }
                renderItem={({ item }) => {
                    const isMember  = memberIds.has(String(item._id));
                    const isPending = pendingId === item._id;
                    return (
                        <TouchableOpacity
                            style={[styles.row, isMember && styles.rowMember, rosterLocked && { opacity: 0.55 }]}
                            onPress={() => toggleMember(item)}
                            disabled={isPending || rosterLocked}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.avatar, isMember && styles.avatarMember]}>
                                <Text style={[styles.avatarTxt, isMember && { color: '#fff' }]}>
                                    {(item.name || item.phone || 'U').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View style={styles.info}>
                                <Text style={styles.name}>{item.name || 'No name'}</Text>
                                <Text style={styles.phone}>+91 {item.phone}</Text>
                            </View>
                            <View style={styles.actionWrap}>
                                {isPending ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : isMember ? (
                                    <View style={styles.removeBtn}>
                                        <Ionicons name="checkmark" size={14} color="#fff" />
                                        <Text style={styles.removeBtnTxt}>Added</Text>
                                    </View>
                                ) : (
                                    <View style={styles.addBtn}>
                                        <Ionicons name="add" size={16} color={colors.primary} />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />

            {/* Continue / Done button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.continueBtn, !isManage && memberCount === 0 && { opacity: 0.5 }]}
                    onPress={handleContinue}
                    disabled={!isManage && memberCount === 0}
                    activeOpacity={0.85}
                >
                    <Text style={styles.continueTxt}>
                        {isManage ? 'Done' : 'Continue to POT Config'}
                    </Text>
                    <Ionicons
                        name={isManage ? 'checkmark' : 'arrow-forward'}
                        size={18} color="#fff" style={{ marginLeft: 8 }}
                    />
                </TouchableOpacity>
            </View>

            {/* "Fewer than required" confirm modal */}
            <Modal visible={confirmShort} transparent animationType="fade" onRequestClose={() => setConfirmShort(false)}>
                <View style={styles.warnOverlay}>
                    <View style={styles.warnBox}>
                        <View style={styles.warnIconWrap}>
                            <Ionicons name="alert-circle-outline" size={30} color={colors.warning} />
                        </View>
                        <Text style={styles.warnTitle}>Continue with fewer members?</Text>
                        <Text style={styles.warnSub}>
                            This group requires{'  '}
                            <Text style={styles.warnEmph}>{requiredCount} members</Text>{'  '}
                            but only{'  '}
                            <Text style={styles.warnEmph}>{memberCount}</Text>{'  '}
                            {memberCount === 1 ? 'is' : 'are'} added.
                            {'\n'}You can add the remaining {remaining} member{remaining === 1 ? '' : 's'} later from group details.
                        </Text>

                        <TouchableOpacity
                            style={styles.warnConfirmBtn}
                            onPress={() => { setConfirmShort(false); goToPotConfig(); }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.warnConfirmTxt}>Continue anyway</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.warnCancelBtn}
                            onPress={() => setConfirmShort(false)}
                        >
                            <Text style={styles.warnCancelTxt}>Keep adding members</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:   { flex: 1, backgroundColor: colors.background },
        center: { alignItems: 'center', justifyContent: 'center' },

        // Header
        header: {
            paddingTop: 56, paddingHorizontal: 16, paddingBottom: 10,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            backgroundColor: colors.background,
        },
        backBtn:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
        backTxt:   { fontSize: 13, fontFamily: F.medium, color: colors.text, marginLeft: 2 },
        title:     { fontSize: 20, fontFamily: F.bold, color: colors.text, marginTop: 4 },
        groupName: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },

        // Lock banner
        lockBanner: {
            flexDirection: 'row', alignItems: 'center',
            marginHorizontal: 16, marginTop: 12,
            backgroundColor: colors.warningLight,
            borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
            borderWidth: 1, borderColor: colors.warning,
        },
        lockBannerTxt: {
            fontSize: 12, fontFamily: F.medium,
            color: colors.warning, flex: 1, lineHeight: 16,
        },

        // Progress card
        progressCard: {
            marginHorizontal: 16, marginTop: 12,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12, borderWidth: 1, borderColor: colors.border,
            padding: 14,
        },
        progressRow:    { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
        progressNumbers:{ fontSize: 22 },
        progressCount:  { fontFamily: F.bold,    color: colors.text },
        progressDivider:{ fontFamily: F.regular, color: colors.textSecondary, fontSize: 18 },
        progressTotal:  { fontFamily: F.semibold, color: colors.textSecondary, fontSize: 18 },
        progressLabel:  { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary },
        progressBarTrack: {
            height: 6, borderRadius: 3, backgroundColor: colors.backgroundTertiary, overflow: 'hidden',
        },
        progressBarFill:  { height: '100%', borderRadius: 3 },

        // Search
        searchWrap: {
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.backgroundSecondary,
            marginHorizontal: 16, marginTop: 12, marginBottom: 10,
            borderRadius: 10, paddingHorizontal: 14, height: 44,
            borderWidth: 1, borderColor: colors.border,
        },
        searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular, color: colors.text },

        // List rows
        sep: { height: 1, backgroundColor: colors.border, marginVertical: 0 },
        row: {
            flexDirection: 'row', alignItems: 'center',
            paddingVertical: 10, paddingHorizontal: 4,
        },
        rowMember: {},
        avatar: {
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: colors.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12, borderWidth: 1, borderColor: colors.border,
        },
        avatarMember: { backgroundColor: colors.primary, borderColor: colors.primary },
        avatarTxt:    { fontSize: 16, fontFamily: F.bold, color: colors.primary },
        info:         { flex: 1 },
        name:         { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        phone:        { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        actionWrap:   { minWidth: 56, alignItems: 'flex-end' },
        addBtn: {
            width: 32, height: 32, borderRadius: 8,
            backgroundColor: colors.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.primary,
        },
        removeBtn: {
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        },
        removeBtnTxt: { fontSize: 11, fontFamily: F.semibold, color: '#fff', marginLeft: 4 },
        emptyBox: { alignItems: 'center', paddingVertical: 48 },
        empty:    { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginTop: 8 },
        backLink: { marginTop: 12 },
        backLinkTxt: { fontSize: 13, fontFamily: F.semibold, color: colors.primary },

        // Footer
        footer: {
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: 16, backgroundColor: colors.background,
            borderTopWidth: 1, borderTopColor: colors.border,
        },
        continueBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 56, borderRadius: 12, backgroundColor: colors.primary,
        },
        continueTxt: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },

        // Confirm modal
        warnOverlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center', alignItems: 'center', padding: 24,
        },
        warnBox: {
            width: '100%', maxWidth: 400,
            backgroundColor: colors.background,
            borderRadius: 18, padding: 24,
            borderWidth: 1, borderColor: colors.border,
        },
        warnIconWrap: {
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.warningLight,
            alignItems: 'center', justifyContent: 'center',
            alignSelf: 'center', marginBottom: 14,
        },
        warnTitle: {
            fontSize: 17, fontFamily: F.bold, color: colors.text,
            textAlign: 'center', marginBottom: 8,
        },
        warnSub: {
            fontSize: 13, fontFamily: F.regular, color: colors.textSecondary,
            textAlign: 'center', lineHeight: 20, marginBottom: 18,
        },
        warnEmph: { fontFamily: F.semibold, color: colors.text },
        warnConfirmBtn: {
            height: 50, borderRadius: 12, backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
        },
        warnConfirmTxt: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
        warnCancelBtn:  { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
        warnCancelTxt:  { fontSize: 13, fontFamily: F.medium, color: colors.textSecondary },
    });
}
