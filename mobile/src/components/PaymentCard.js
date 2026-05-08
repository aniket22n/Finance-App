import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentCard({ payment }) {
    const statusConfig = {
        pending: { color: '#f0a500', icon: 'time', bg: '#f0a50015' },
        paid: { color: '#00b894', icon: 'checkmark-circle', bg: '#00b89415' },
        verified: { color: '#6c5ce7', icon: 'shield-checkmark', bg: '#6c5ce715' },
        failed: { color: '#e17055', icon: 'close-circle', bg: '#e1705515' },
    };

    const status = statusConfig[payment.status] || statusConfig.pending;
    const date = payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    }) : '—';

    return (
        <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: status.bg }]}>
                <Ionicons name={status.icon} size={24} color={status.color} />
            </View>
            <View style={styles.info}>
                <Text style={styles.group}>{payment.group?.name || `Month ${payment.month}`}</Text>
                <Text style={styles.date}>{date}</Text>
                {payment.upiRef ? <Text style={styles.ref}>Ref: {payment.upiRef}</Text> : null}
            </View>
            <View style={styles.amountWrap}>
                <Text style={styles.amount}>₹{payment.amount?.toLocaleString()}</Text>
                <Text style={[styles.statusLabel, { color: status.color }]}>
                    {payment.status?.toUpperCase()}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f3460',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: { flex: 1, marginLeft: 12 },
    group: { color: '#fff', fontSize: 15, fontWeight: '600' },
    date: { color: '#8899aa', fontSize: 12, marginTop: 2 },
    ref: { color: '#6c7a89', fontSize: 11, marginTop: 2 },
    amountWrap: { alignItems: 'flex-end' },
    amount: { color: '#fff', fontSize: 17, fontWeight: '700' },
    statusLabel: { fontSize: 10, fontWeight: '700', marginTop: 3, letterSpacing: 0.5 },
});
