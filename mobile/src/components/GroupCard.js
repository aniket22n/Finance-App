import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function GroupCard({ group, onPress }) {
    const memberCount = group.members?.length || 0;
    const progress = group.totalMonths > 0
        ? ((group.currentMonth / group.totalMonths) * 100).toFixed(0)
        : 0;

    const statusColors = {
        pending: '#f0a500',
        active: '#00b894',
        completed: '#6c5ce7',
        paused: '#e17055',
    };

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.header}>
                <View style={styles.iconWrap}>
                    <Ionicons name="people" size={24} color="#e94560" />
                </View>
                <View style={styles.headerText}>
                    <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusColors[group.status] || '#888' }]} />
                        <Text style={styles.statusText}>{group.status?.toUpperCase()}</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#555" />
            </View>

            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{memberCount}</Text>
                    <Text style={styles.statLabel}>Members</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>₹{group.potAmount?.toLocaleString()}</Text>
                    <Text style={styles.statLabel}>Pot</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{group.currentMonth}/{group.totalMonths}</Text>
                    <Text style={styles.statLabel}>Month</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statValue}>{progress}%</Text>
                    <Text style={styles.statLabel}>Done</Text>
                </View>
            </View>

            <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#0f3460',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#1a1a2e',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    headerText: { flex: 1 },
    name: { color: '#fff', fontSize: 17, fontWeight: '700' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    statusText: { color: '#8899aa', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    stat: { alignItems: 'center' },
    statValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
    statLabel: { color: '#8899aa', fontSize: 11, marginTop: 2 },
    progressBar: {
        height: 4,
        backgroundColor: '#1a1a2e',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#e94560',
        borderRadius: 2,
    },
});
