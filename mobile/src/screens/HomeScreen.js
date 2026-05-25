import React, { useMemo, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, RefreshControl, TouchableOpacity,
    StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getGroups, getAdminDashboard, getGroupHealth, getMyPendingPayments } from '../services/api';

const SW = Dimensions.get('window').width;
import Avatar from '../components/Avatar';
import GroupCard from '../components/GroupCard';
import NotificationsBell from '../components/NotificationsBell';
import { F } from '../theme';

// ── Admin Home ───────────────────────────────────────────────────────────────

function AdminHomeView({ navigation, user, colors }) {
    const [stats, setStats] = useState(null);
    const [health, setHealth] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const [dashRes, healthRes] = await Promise.all([
                getAdminDashboard(),
                getGroupHealth(),
            ]);
            setStats(dashRes.data.stats);
            setHealth(healthRes.data.groups || []);
        } catch (err) {
            console.log('Admin home load error:', err.message);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{greeting},</Text>
                    <Text style={styles.name}>{user?.name || 'Admin'}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                    <Avatar uri={user?.avatar} name={user?.name} size={46} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >

            {/* Gradient Stat Cards */}
            {stats && (
                <View style={styles.statGrid}>
                    <GradientCard icon="people" label="Total Groups" value={stats.totalGroups} colors={colors} />
                    <GradientCard icon="person" label="Members" value={stats.totalUsers} colors={colors} />
                    <GradientCard icon="time" label="Pending" value={stats.pendingCount} colors={colors} />
                    <GradientCard icon="wallet"
                        label="Collected"
                        value={`₹${((stats.verifiedAmount || 0) / 1000).toFixed(0)}K`}
                        colors={colors}
                    />
                </View>
            )}

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
                <QuickAction icon="card" label="Payments" onPress={() => navigation.navigate('Admin')} colors={colors} />
                <QuickAction icon="people" label="Groups" onPress={() => navigation.navigate('Groups')} colors={colors} />
                <QuickAction icon="refresh-circle" label="New Cycle" onPress={() => navigation.navigate('Admin')} colors={colors} />
                <QuickAction icon="notifications" label="Notify" onPress={() => navigation.navigate('Admin')} colors={colors} />
            </View>

            {/* Pending Actions Alert */}
            {stats?.pendingCount > 0 && (
                <TouchableOpacity
                    style={styles.pendingAlert}
                    onPress={() => navigation.navigate('Admin')}
                    activeOpacity={0.85}
                >
                    <View style={styles.pendingAlertLeft}>
                        <Ionicons name="alert-circle" size={22} color={colors.error} />
                        <View style={styles.pendingAlertText}>
                            <Text style={styles.pendingAlertTitle}>
                                {stats.pendingCount} Payments Need Verification
                            </Text>
                            <Text style={styles.pendingAlertSub}>Tap to review and verify</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.error} />
                </TouchableOpacity>
            )}

            {/* Group Health */}
            {health.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Group Health</Text>
                    {health.slice(0, 3).map(g => (
                        <View key={g._id} style={styles.healthCard}>
                            <View style={styles.healthRow}>
                                <Text style={styles.healthName}>{g.name}</Text>
                                <Text style={styles.healthPct}>{g.percentage}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${g.percentage}%` }]} />
                            </View>
                            <Text style={styles.healthSub}>{g.paid}/{g.totalMembers} paid</Text>
                        </View>
                    ))}
                </>
            )}

            <View style={{ height: 90 }} />
            </ScrollView>
        </View>
    );
}

// ── Member Home ──────────────────────────────────────────────────────────────

function MemberHomeView({ navigation, user, colors }) {
    const [groups, setGroups] = useState([]);
    const [pendingPayments, setPendingPayments] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const [groupsRes, pendingRes] = await Promise.all([
                getGroups(),
                getMyPendingPayments(),
            ]);
            setGroups(groupsRes.data.groups || []);
            setPendingPayments(pendingRes.data.data?.payments || []);
        } catch (err) {
            console.log('Member home load error:', err.message);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const activeGroups = groups.filter(g => g.status === 'active');
    const totalPot = activeGroups.reduce((sum, g) => sum + (g.potAmount || 0), 0);
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hi,</Text>
                    <Text style={styles.name}>{user?.name || 'Member'} 👋</Text>
                </View>
                <NotificationsBell />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >

            {/* Summary Banner */}
            <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.summaryBanner}
            >
                <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{groups.length}</Text>
                    <Text style={styles.summaryLabel}>My Groups</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>{activeGroups.length}</Text>
                    <Text style={styles.summaryLabel}>Active</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryStat}>
                    <Text style={styles.summaryValue}>
                        {totalPot >= 100000 ? `₹${(totalPot / 100000).toFixed(1)}L` : totalPot >= 1000 ? `₹${(totalPot / 1000).toFixed(0)}K` : `₹${totalPot}`}
                    </Text>
                    <Text style={styles.summaryLabel}>Total Pot</Text>
                </View>
            </LinearGradient>

            {/* Pending Payments */}
            {pendingPayments.length > 0 && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Pending Payments</Text>
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>{pendingPayments.length}</Text>
                        </View>
                    </View>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.pendingScroll}
                        snapToInterval={SW - 32 + 10}
                        decelerationRate="fast"
                    >
                        {pendingPayments.map((payment) => (
                            <View key={payment._id} style={styles.pendingCard}>
                                <View style={styles.pendingCardLeft}>
                                    <View style={[styles.pendingDot, { backgroundColor: colors.warning }]} />
                                    <View>
                                        <Text style={styles.pendingGroupName} numberOfLines={1}>
                                            {payment.group?.name}
                                        </Text>
                                        <Text style={styles.pendingMeta}>
                                            Month {payment.month}  ·  ₹{payment.amount?.toLocaleString()}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[styles.payBtn, { backgroundColor: colors.primary }]}
                                    onPress={() => navigation.navigate('Payment', { groupId: payment.group?._id, paymentId: payment._id })}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.payBtnText}>Pay Now</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </>
            )}

            {/* Active Groups */}
            {activeGroups.length > 0 && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Active Groups</Text>
                        <Text style={styles.sectionCount}>{activeGroups.length} groups</Text>
                    </View>
                    <View style={styles.groupsList}>
                        {activeGroups.slice(0, 2).map(group => (
                            <GroupCard
                                key={group._id}
                                group={group}
                                onPress={() => navigation.navigate('GroupDetail', { groupId: group._id })}
                            />
                        ))}
                    </View>
                    {activeGroups.length > 2 && (
                        <TouchableOpacity
                            style={[styles.viewAllBtn, { borderColor: colors.primary }]}
                            onPress={() => navigation.navigate('Groups')}
                            activeOpacity={0.75}
                        >
                            <Text style={[styles.viewAllText, { color: colors.primary }]}>View All Groups</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </>
            )}

            {groups.length === 0 && (
                <View style={styles.emptyBox}>
                    <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.emptyTitle}>No Groups Yet</Text>
                    <Text style={styles.emptyBody}>You'll be added to a group by your admin.</Text>
                </View>
            )}

            <View style={{ height: 90 }} />
            </ScrollView>
        </View>
    );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function GradientCard({ icon, label, value, colors }) {
    return (
        <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={gradCardStyle}
        >
            <Ionicons name={icon} size={28} color="#fff" />
            <Text style={gradValueStyle}>{value}</Text>
            <Text style={gradLabelStyle}>{label}</Text>
        </LinearGradient>
    );
}

const gradCardStyle  = { width: '47%', height: 110, borderRadius: 16, padding: 16, justifyContent: 'space-between' };
const gradValueStyle = { fontSize: 24, fontFamily: F.bold, color: '#fff' };
const gradLabelStyle = { fontSize: 12, fontFamily: F.medium, color: 'rgba(255,255,255,0.85)' };

function QuickAction({ icon, label, onPress, colors }) {
    return (
        <TouchableOpacity style={quickBtnStyle} onPress={onPress} activeOpacity={0.75}>
            <View style={[quickIconStyle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={icon} size={22} color={colors.primary} />
            </View>
            <Text style={[quickLabelStyle, { color: colors.text }]}>{label}</Text>
        </TouchableOpacity>
    );
}

const quickBtnStyle   = { flex: 1, alignItems: 'center' };
const quickIconStyle  = { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 };
const quickLabelStyle = { fontSize: 11, fontFamily: F.medium, textAlign: 'center' };

// ── Root ─────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
    const { user } = useAuth();
    const { colors } = useTheme();
    if (user?.role === 'admin') return <AdminHomeView navigation={navigation} user={user} colors={colors} />;
    return <MemberHomeView navigation={navigation} user={user} colors={colors} />;
}

// ── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.backgroundSecondary },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.background,
            paddingHorizontal: 16,
            paddingTop: 56,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            zIndex: 10,
        },
        greeting:     { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary },
        name:         { fontSize: 20, fontFamily: F.bold, color: colors.text, marginTop: 2 },
        sectionTitle: { fontSize: 16, fontFamily: F.semibold, color: colors.text },
        // Admin stat grid
        statGrid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
        // Summary banner
        summaryBanner: {
            marginHorizontal: 16,
            marginTop: 20,
            borderRadius: 16,
            paddingVertical: 18,
            flexDirection: 'row',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
        },
        summaryStat:   { flex: 1, alignItems: 'center' },
        summaryDivider:{ width: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 4 },
        summaryValue:  { fontSize: 20, fontFamily: F.bold, color: '#fff', marginBottom: 3 },
        summaryLabel:  { fontSize: 11, fontFamily: F.regular, color: 'rgba(255,255,255,0.8)' },
        // Section header
        sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12 },
        sectionCount:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary },
        // Groups list
        groupsList: { paddingHorizontal: 16, gap: 12 },
        // View all button
        viewAllBtn: {
            marginHorizontal: 16,
            marginTop: 12,
            borderWidth: 1.5,
            borderRadius: 12,
            paddingVertical: 13,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
        },
        viewAllText: { fontSize: 14, fontFamily: F.semibold },
        // Pending payments carousel
        pendingBadge: {
            backgroundColor: colors.warning,
            borderRadius: 10, minWidth: 20, height: 20,
            alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
        },
        pendingBadgeText: { fontSize: 11, fontFamily: F.bold, color: '#fff' },
        pendingScroll: { paddingHorizontal: 16, gap: 10 },
        pendingCard: {
            width: SW - 32,
            backgroundColor: colors.background,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: colors.warning,
            paddingHorizontal: 14,
            paddingVertical: 13,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 2,
        },
        pendingCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
        pendingDot: { width: 8, height: 8, borderRadius: 4 },
        pendingGroupName: { fontSize: 14, fontFamily: F.semibold, color: colors.text, marginBottom: 3 },
        pendingMeta: { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary },
        payBtn: {
            borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
        },
        payBtnText: { fontSize: 13, fontFamily: F.semibold, color: '#fff' },
        // Pending alert
        pendingAlert: {
            marginHorizontal: 16,
            marginTop: 16,
            backgroundColor: colors.errorLight,
            borderRadius: 12,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: colors.status.overdue.border,
        },
        pendingAlertLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
        pendingAlertText:  { marginLeft: 12, flex: 1 },
        pendingAlertTitle: { fontSize: 13, fontFamily: F.semibold, color: colors.error },
        pendingAlertSub:   { fontSize: 11, fontFamily: F.regular, color: colors.error, marginTop: 2 },
        // Group health
        healthCard: {
            marginHorizontal: 16,
            marginBottom: 10,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
        },
        healthRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
        healthName:  { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        healthPct:   { fontSize: 14, fontFamily: F.semibold, color: colors.primary },
        progressBar: { height: 4, backgroundColor: colors.backgroundTertiary, borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
        progressFill:{ height: 4, backgroundColor: colors.primary, borderRadius: 2 },
        healthSub:   { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary },
        // Empty state
        emptyBox: {
            margin: 16,
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary,
            padding: 32,
            alignItems: 'center',
        },
        emptyTitle: { fontSize: 16, fontFamily: F.medium, color: colors.text, marginTop: 12 },
        emptyBody:  { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
    });
}
