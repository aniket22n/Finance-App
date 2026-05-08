import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import { Ionicons } from '@expo/vector-icons';

export default function MemberCard({ member, isWinner, paymentStatus, emiAmount }) {
    const statusConfig = {
        pending: { color: '#f0a500', icon: 'time', label: 'Pending' },
        paid: { color: '#00b894', icon: 'checkmark-circle', label: 'Paid' },
        verified: { color: '#6c5ce7', icon: 'shield-checkmark', label: 'Verified' },
        failed: { color: '#e17055', icon: 'close-circle', label: 'Failed' },
    };

    const status = statusConfig[paymentStatus] || statusConfig.pending;

    return (
        <View style={[styles.card, isWinner && styles.winnerCard]}>
            {isWinner && (
                <View style={styles.winnerBadge}>
                    <Ionicons name="trophy" size={12} color="#fff" />
                    <Text style={styles.winnerText}>POT HOLDER</Text>
                </View>
            )}
            <View style={styles.row}>
                <Avatar uri={member.avatar} name={member.name} size={44} />
                <View style={styles.info}>
                    <Text style={styles.name}>{member.name || member.phone}</Text>
                    <Text style={styles.phone}>{member.phone}</Text>
                </View>
                <View style={styles.statusWrap}>
                    <Ionicons name={status.icon} size={20} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    {emiAmount && <Text style={styles.amount}>₹{emiAmount.toLocaleString()}</Text>}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#0f3460',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    winnerCard: {
        borderWidth: 1.5,
        borderColor: '#e94560',
        backgroundColor: '#1a1a4e',
    },
    winnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e94560',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 8,
    },
    winnerText: { color: '#fff', fontSize: 10, fontWeight: '800', marginLeft: 4, letterSpacing: 0.5 },
    row: { flexDirection: 'row', alignItems: 'center' },
    info: { flex: 1, marginLeft: 12 },
    name: { color: '#fff', fontSize: 15, fontWeight: '600' },
    phone: { color: '#8899aa', fontSize: 12, marginTop: 2 },
    statusWrap: { alignItems: 'flex-end' },
    statusText: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    amount: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 3 },
});
