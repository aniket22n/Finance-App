import React, { useMemo, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, RefreshControl, TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getGroups, getMyPendingPayments } from '../services/api';
import GroupCard from '../components/GroupCard';
import NotificationsBell from '../components/NotificationsBell';
import { F } from '../theme';

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const BADGE = {
    pending:  { bg: '#9CA3AF', label: 'Pending'  },
    failed:   { bg: '#EF4444', label: 'Rejected' },
    rejected: { bg: '#EF4444', label: 'Rejected' },
};

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

            {/* Action Required — Pending / Rejected Payments */}
            {pendingPayments.length > 0 && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>ACTION REQUIRED</Text>
                        <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>{pendingPayments.length}</Text>
                        </View>
                    </View>
                    {pendingPayments.map((payment) => {
                        const badge      = BADGE[payment.status] || { bg: '#9CA3AF', label: 'Pending' };
                        const isRejected = payment.status === 'failed' || payment.status === 'rejected';
                        return (
                            <TouchableOpacity
                                key={payment._id}
                                style={[styles.card, isRejected && styles.cardRejected]}
                                onPress={() => navigation.navigate('Payments')}
                                activeOpacity={0.75}
                            >
                                <View style={styles.cardInner}>
                                    <View style={styles.avatar}>
                                        <Ionicons name="receipt-outline" size={20} color={colors.textSecondary} />
                                    </View>
                                    <View style={styles.cardBody}>
                                        <View style={styles.nameRow}>
                                            <Text style={styles.cardName} numberOfLines={1}>
                                                {payment.group?.name || `Month ${payment.month}`}
                                            </Text>
                                            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                                                <Text style={styles.badgeTxt}>{badge.label}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.meta} numberOfLines={1}>
                                            {'₹'}{payment.amount?.toLocaleString('en-IN')}
                                            {' · '}{(payment.paymentMethod || 'UPI').toUpperCase()}
                                            {' · '}{timeAgo(payment.paidAt || payment.createdAt)}
                                        </Text>
                                        <Text style={styles.subText}>{'Month '}{payment.month}</Text>
                                        <TouchableOpacity
                                            style={[styles.cardPayBtn, isRejected && { backgroundColor: '#EF4444' }]}
                                            onPress={() => navigation.navigate('Payments')}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name={isRejected ? 'refresh' : 'card'} size={14} color="#fff" />
                                            <Text style={styles.cardPayTxt}>{isRejected ? 'Resubmit Payment' : 'Make Payment'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </>
            )}

            {/* Active Groups */}
            {activeGroups.length > 0 && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>ACTIVE GROUPS</Text>
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

// ── Root ─────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
    const { user } = useAuth();
    const { colors } = useTheme();
    // Admins are routed to AdminDashboardScreen by the navigator; this screen is members-only.
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
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: 16,
            paddingTop: 56,
            paddingBottom: 10,
            zIndex: 10,
        },
        greeting:     { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },
        name:         { fontSize: 26, fontFamily: F.bold, color: colors.text, marginTop: 2 },
        sectionTitle: { fontSize: 11, fontFamily: F.bold, color: colors.textTertiary, letterSpacing: 0.8 },
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
        // Action required badge
        pendingBadge: {
            backgroundColor: colors.warning,
            borderRadius: 10, minWidth: 20, height: 20,
            alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
        },
        pendingBadgeText: { fontSize: 11, fontFamily: F.bold, color: '#fff' },
        // Cards — identical to PaymentScreen
        card: {
            backgroundColor: colors.background,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
        },
        cardRejected: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
        cardInner:    { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
        avatar: {
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            borderWidth: 1, borderColor: colors.border,
        },
        cardBody:  { flex: 1, minWidth: 0 },
        nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
        cardName:  { flex: 1, fontSize: 15, fontFamily: F.bold, color: colors.text },
        badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
        badgeTxt:  { fontSize: 11, fontFamily: F.bold, color: '#fff' },
        meta:      { fontSize: 12, fontFamily: F.semibold, color: colors.text, marginBottom: 3 },
        subText:   { fontSize: 12, fontFamily: F.regular, color: colors.textTertiary },
        cardPayBtn: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
            height: 38, borderRadius: 10, backgroundColor: colors.primary, marginTop: 10,
        },
        cardPayTxt: { fontSize: 13, fontFamily: F.semibold, color: '#fff' },
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
