import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getGroups } from '../services/api';
import Avatar from '../components/Avatar';

export default function HomeScreen({ navigation }) {
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = async () => {
        try {
            const res = await getGroups();
            setGroups(res.data.groups || []);
        } catch (err) {
            console.log('Load error:', err.message);
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

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Welcome back,</Text>
                    <Text style={styles.name}>{user?.name || 'Member'}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                    <Avatar uri={user?.avatar} name={user?.name} size={48} />
                </TouchableOpacity>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: '#e9456020', borderColor: '#e94560' }]}>
                    <Ionicons name="people" size={28} color="#e94560" />
                    <Text style={styles.statValue}>{groups.length}</Text>
                    <Text style={styles.statLabel}>My Groups</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#00b89420', borderColor: '#00b894' }]}>
                    <Ionicons name="checkmark-done" size={28} color="#00b894" />
                    <Text style={styles.statValue}>{activeGroups.length}</Text>
                    <Text style={styles.statLabel}>Active</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#6c5ce720', borderColor: '#6c5ce7' }]}>
                    <Ionicons name="wallet" size={28} color="#6c5ce7" />
                    <Text style={styles.statValue}>₹{(totalPot / 1000).toFixed(0)}K</Text>
                    <Text style={styles.statLabel}>Total Pot</Text>
                </View>
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Groups')}>
                    <View style={[styles.actionIcon, { backgroundColor: '#e9456020' }]}>
                        <Ionicons name="people" size={22} color="#e94560" />
                    </View>
                    <Text style={styles.actionLabel}>Groups</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Payments')}>
                    <View style={[styles.actionIcon, { backgroundColor: '#00b89420' }]}>
                        <Ionicons name="card" size={22} color="#00b894" />
                    </View>
                    <Text style={styles.actionLabel}>Pay EMI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Profile')}>
                    <View style={[styles.actionIcon, { backgroundColor: '#6c5ce720' }]}>
                        <Ionicons name="person" size={22} color="#6c5ce7" />
                    </View>
                    <Text style={styles.actionLabel}>Profile</Text>
                </TouchableOpacity>
            </View>

            {/* Active Groups */}
            {activeGroups.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Active Groups</Text>
                    {activeGroups.slice(0, 3).map((group) => (
                        <TouchableOpacity
                            key={group._id}
                            style={styles.groupRow}
                            onPress={() => navigation.navigate('GroupDetail', { groupId: group._id })}
                        >
                            <View style={styles.groupIcon}>
                                <Ionicons name="people-circle" size={36} color="#e94560" />
                            </View>
                            <View style={styles.groupInfo}>
                                <Text style={styles.groupName}>{group.name}</Text>
                                <Text style={styles.groupMeta}>
                                    {group.members?.length} members · Month {group.currentMonth}/{group.totalMonths}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.groupPot}>₹{group.emiAmount?.toLocaleString()}</Text>
                                <Text style={styles.groupPotLabel}>EMI/mo</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e', paddingHorizontal: 20 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 60,
        paddingBottom: 24,
    },
    greeting: { color: '#8899aa', fontSize: 14 },
    name: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 2 },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    statCard: {
        flex: 1,
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 4,
        alignItems: 'center',
        borderWidth: 1,
    },
    statValue: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
    statLabel: { color: '#8899aa', fontSize: 11, marginTop: 4, fontWeight: '600' },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14 },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 28 },
    actionBtn: { alignItems: 'center' },
    actionIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    actionLabel: { color: '#ccc', fontSize: 12, fontWeight: '600' },
    groupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f3460',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    groupIcon: { marginRight: 12 },
    groupInfo: { flex: 1 },
    groupName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    groupMeta: { color: '#8899aa', fontSize: 12, marginTop: 3 },
    groupPot: { color: '#e94560', fontSize: 16, fontWeight: '800', textAlign: 'right' },
    groupPotLabel: { color: '#8899aa', fontSize: 10, textAlign: 'right', marginTop: 2 },
});
