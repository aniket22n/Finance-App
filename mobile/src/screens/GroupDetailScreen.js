import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, ActivityIndicator, StyleSheet,
    RefreshControl, TouchableOpacity, Modal, TextInput, Alert, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
    getGroup, getCurrentCycle, getGroupPayments, getEligibleMembers,
    deleteGroup, addMember, getAdminUsers, sendOtp, verifyOtp,
} from '../services/api';
import MemberCard from '../components/MemberCard';
import ProgressRing from '../components/ProgressRing';
import Toast, { useToast } from '../components/Toast';
import { F } from '../theme';

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
    const [eligible, setEligible] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Add Member modal
    const [showAddMember, setShowAddMember] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [addingMember, setAddingMember] = useState(null);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // OTP-delete flow
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpError, setOtpError] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);

    const { toast, show } = useToast();

    const loadData = async () => {
        try {
            const [groupRes, cycleRes, paymentsRes, eligibleRes] = await Promise.all([
                getGroup(groupId),
                getCurrentCycle(groupId).catch(() => ({ data: {} })),
                getGroupPayments(groupId).catch(() => ({ data: { payments: [] } })),
                getEligibleMembers(groupId).catch(() => ({ data: { members: [] } })),
            ]);
            setGroup(groupRes.data.group);
            setCycle(cycleRes.data.cycle || null);
            setPayments(paymentsRes.data.payments || []);
            setEligible(eligibleRes.data.members || []);
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

    const openAddMember = async () => {
        setShowAddMember(true);
        setMemberSearch('');
        setLoadingUsers(true);
        try {
            const res = await getAdminUsers();
            const existing = new Set((group?.members || []).map(m => m._id));
            setAllUsers((res.data.users || []).filter(u => !existing.has(u._id)));
        } catch {
            Alert.alert('Error', 'Could not load users');
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleAddMember = async (member) => {
        setAddingMember(member._id);
        try {
            await addMember(groupId, member._id);
            setShowAddMember(false);
            await loadData();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to add member');
        } finally {
            setAddingMember(null);
        }
    };

    const styles = makeStyles(colors);

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

    const filteredUsers = memberSearch
        ? allUsers.filter(u =>
            u.name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
            u.phone?.includes(memberSearch)
          )
        : allUsers;

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
                        <StatItem label="EMI / Month" value={`₹${group.emiAmount?.toLocaleString()}`} colors={colors} />
                        <View style={styles.statDivider} />
                        <StatItem label="Reduced EMI" value={`₹${group.reducedEmi?.toLocaleString()}`} colors={colors} />
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
                            <Text style={styles.reducedText}>₹{group.reducedEmi?.toLocaleString()} EMI</Text>
                        </View>
                    </View>
                )}

                {/* Next Draw */}
                {isActive && currentMonth < totalMonths && eligible.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>🎯 Next Draw Eligible</Text>
                        <Text style={styles.sectionSub}>
                            {eligible.length} member{eligible.length !== 1 ? 's' : ''} eligible for Month {currentMonth + 1}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eligibleScroll}>
                            {eligible.map(m => {
                                const isMe = m._id === user?._id;
                                return (
                                    <View key={m._id} style={[styles.eligibleChip, isMe && styles.eligibleChipMe]}>
                                        {isMe && <Ionicons name="star" size={10} color={colors.primary} style={{ marginRight: 4 }} />}
                                        <Text style={[styles.eligibleText, isMe && styles.eligibleTextMe]}>
                                            {m.name || m.phone}
                                        </Text>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* Members */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            Members ({group.members?.length || 0}/{group.maxMembers})
                        </Text>
                        {isAdmin && (
                            <TouchableOpacity style={styles.addMemberBtn} onPress={openAddMember} activeOpacity={0.75}>
                                <Ionicons name="person-add-outline" size={14} color={colors.primary} />
                                <Text style={styles.addMemberText}>Add</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {group.members?.map(member => {
                        const memberPayment = payments.find(
                            p => (p.user?._id || p.user) === member._id && p.month === currentMonth
                        );
                        const isWinner = winnerId && member._id === winnerId.toString();
                        return (
                            <MemberCard
                                key={member._id}
                                member={member}
                                isWinner={isWinner}
                                paymentStatus={memberPayment?.status}
                                emiAmount={isWinner ? group.reducedEmi : group.emiAmount}
                            />
                        );
                    })}
                </View>

                {/* Make Payment CTA */}
                {isActive && (
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
                            style={[styles.otpInput, otpError && styles.otpInputError]}
                            value={otpCode}
                            onChangeText={v => { setOtpCode(v); setOtpError(''); }}
                            placeholder="Enter OTP"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="number-pad"
                            maxLength={6}
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

            {/* Add Member Modal */}
            <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
                <View style={styles.overlay}>
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Add Member</Text>
                            <TouchableOpacity onPress={() => setShowAddMember(false)}>
                                <Ionicons name="close" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchRow}>
                            <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                value={memberSearch}
                                onChangeText={setMemberSearch}
                                placeholder="Search by name or phone..."
                                placeholderTextColor={colors.textSecondary}
                                autoFocus
                            />
                            {memberSearch ? (
                                <TouchableOpacity onPress={() => setMemberSearch('')}>
                                    <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {loadingUsers ? (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator color={colors.primary} />
                            </View>
                        ) : filteredUsers.length === 0 ? (
                            <View style={styles.loadingBox}>
                                <Text style={styles.emptyText}>
                                    {memberSearch ? 'No users found' : 'All users are already members'}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredUsers}
                                keyExtractor={item => item._id}
                                style={styles.userList}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.userRow}
                                        onPress={() => handleAddMember(item)}
                                        disabled={addingMember === item._id}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.userAvatar}>
                                            <Text style={styles.userAvatarText}>
                                                {(item.name || item.phone || 'U').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={styles.userInfo}>
                                            <Text style={styles.userName}>{item.name || 'No name'}</Text>
                                            <Text style={styles.userPhone}>{item.phone}</Text>
                                        </View>
                                        {addingMember === item._id
                                            ? <ActivityIndicator size="small" color={colors.primary} />
                                            : <Ionicons name="add-circle-outline" size={22} color={colors.primary} />}
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.separator} />}
                            />
                        )}
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
        winnerName:   { fontSize: 16, fontFamily: F.medium, color: colors.text, marginTop: 2 },
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
        eligibleScroll: { marginBottom: 12 },
        eligibleChip: {
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.backgroundTertiary, borderRadius: 20,
            paddingHorizontal: 12, paddingVertical: 6, marginRight: 8,
            borderWidth: 1, borderColor: colors.border,
        },
        eligibleChipMe: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
        eligibleText:   { fontSize: 11, fontFamily: F.medium, color: colors.text },
        eligibleTextMe: { color: colors.primary },
        ctaSection:     { paddingHorizontal: 16, marginTop: 8 },
        ctaBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            height: 56, borderRadius: 12, backgroundColor: colors.primary,
            shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
        },
        ctaText:       { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
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
            width: '100%', height: 56, borderRadius: 12, borderWidth: 1.5,
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
        // Bottom sheet modals
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        sheet: {
            backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24, paddingBottom: 36, maxHeight: '80%',
        },
        handle: {
            width: 40, height: 4, backgroundColor: colors.border,
            borderRadius: 2, alignSelf: 'center', marginBottom: 20,
        },
        sheetHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
        sheetTitle:   { fontSize: 18, fontFamily: F.bold, color: colors.text },
        searchRow: {
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.backgroundSecondary, borderRadius: 10,
            paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
        },
        searchInput: { flex: 1, fontSize: 14, fontFamily: F.regular, color: colors.text },
        loadingBox:  { height: 120, alignItems: 'center', justifyContent: 'center' },
        emptyText:   { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },
        userList:    { flex: 1 },
        userRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
        userAvatar: {
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
            marginRight: 12, borderWidth: 1, borderColor: colors.status.rejected.border,
        },
        userAvatarText: { fontSize: 16, fontFamily: F.bold, color: colors.primary },
        userInfo:    { flex: 1 },
        userName:    { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        userPhone:   { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        separator:   { height: 1, backgroundColor: colors.border },
    });
}
