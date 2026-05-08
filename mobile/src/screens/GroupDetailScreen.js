import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getGroup, getCurrentCycle, getGroupPayments, getEligibleMembers } from '../services/api';
import MemberCard from '../components/MemberCard';
import ProgressRing from '../components/ProgressRing';

export default function GroupDetailScreen({ route }) {
    const { groupId } = route.params;
    const [group, setGroup] = useState(null);
    const [summary, setSummary] = useState(null);
    const [cycle, setCycle] = useState(null);
    const [payments, setPayments] = useState([]);
    const [eligible, setEligible] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const [groupRes, cycleRes, paymentsRes, eligibleRes] = await Promise.all([
                getGroup(groupId),
                getCurrentCycle(groupId).catch(() => ({ data: {} })),
                getGroupPayments(groupId, { month: undefined }).catch(() => ({ data: { payments: [] } })),
                getEligibleMembers(groupId).catch(() => ({ data: { members: [] } })),
            ]);

            setGroup(groupRes.data.group);
            setSummary(groupRes.data.summary);
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

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#e94560" />
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

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        >
            {/* Group Header */}
            <View style={styles.header}>
                <Text style={styles.title}>{group.name}</Text>
                <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, {
                        backgroundColor: group.status === 'active' ? '#00b894' : '#f0a500'
                    }]} />
                    <Text style={styles.statusText}>{group.status?.toUpperCase()}</Text>
                </View>
            </View>

            {/* Progress + Stats */}
            <View style={styles.progressSection}>
                <ProgressRing
                    progress={progress}
                    size={120}
                    strokeWidth={10}
                    label={`${currentMonth}/${totalMonths}`}
                />
                <View style={styles.statsColumn}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>₹{group.potAmount?.toLocaleString()}</Text>
                        <Text style={styles.statLabel}>Pot Amount</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>₹{group.emiAmount?.toLocaleString()}</Text>
                        <Text style={styles.statLabel}>EMI / Month</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>₹{group.reducedEmi?.toLocaleString()}</Text>
                        <Text style={styles.statLabel}>Reduced EMI</Text>
                    </View>
                </View>
            </View>

            {/* Pot Winner */}
            {cycle && (
                <View style={styles.winnerSection}>
                    <Ionicons name="trophy" size={20} color="#e94560" />
                    <Text style={styles.winnerTitle}>Month {cycle.month} Pot Holder</Text>
                    <Text style={styles.winnerName}>
                        {cycle.winner?.name || 'Unknown'}
                    </Text>
                </View>
            )}

            {/* Next Draw */}
            {group.status === 'active' && currentMonth < totalMonths && (
                <View style={styles.nextDrawSection}>
                    <Text style={styles.sectionTitle}>🎯 Next Draw Eligible</Text>
                    <Text style={styles.nextDrawDesc}>
                        {eligible.length} members eligible for Month {currentMonth + 1} pot:
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eligibleScroll}>
                        {eligible.map(m => (
                            <View key={m._id} style={styles.eligibleBadge}>
                                <Text style={styles.eligibleText}>{m.name || m.phone}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Members */}
            <Text style={styles.sectionTitle}>
                Members ({group.members?.length || 0}/{group.maxMembers})
            </Text>
            {group.members?.map((member) => {
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

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e', paddingHorizontal: 20 },
    center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
    errorText: { color: '#e94560', fontSize: 16 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 16,
    },
    title: { color: '#fff', fontSize: 22, fontWeight: '800', flex: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f3460', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statusText: { color: '#8899aa', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    progressSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f3460',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    statsColumn: { flex: 1, marginLeft: 24 },
    statItem: { marginBottom: 12 },
    statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
    statLabel: { color: '#8899aa', fontSize: 11, marginTop: 1 },
    winnerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e9456020',
        borderWidth: 1,
        borderColor: '#e94560',
        borderRadius: 14,
        padding: 14,
        marginBottom: 20,
    },
    winnerTitle: { color: '#e94560', fontSize: 13, fontWeight: '700', marginLeft: 8 },
    winnerName: { color: '#fff', fontSize: 15, fontWeight: '800', marginLeft: 8 },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
    },
    nextDrawSection: {
        marginBottom: 20,
    },
    nextDrawDesc: {
        color: '#8899aa',
        fontSize: 13,
        marginBottom: 8,
    },
    eligibleScroll: {
        flexDirection: 'row',
    },
    eligibleBadge: {
        backgroundColor: '#0f3460',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    eligibleText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
