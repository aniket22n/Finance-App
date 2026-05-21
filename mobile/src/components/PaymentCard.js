import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

export default function PaymentCard({ payment, onPress }) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

    const STATUS = {
        pending:  { color: colors.warning, icon: 'time-outline',             bg: colors.status.pending.bg,  label: 'PENDING'  },
        paid:     { color: colors.success,  icon: 'checkmark-circle-outline', bg: colors.status.paid.bg,     label: 'PAID'     },
        verified: { color: colors.success,  icon: 'shield-checkmark-outline', bg: colors.status.verified.bg, label: 'VERIFIED' },
        failed:   { color: colors.error,    icon: 'close-circle-outline',     bg: colors.status.rejected.bg, label: 'FAILED'   },
    };
    const status = STATUS[payment.status] || STATUS.pending;

    const date = payment.paidAt ? new Date(payment.paidAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    }) : '—';

    return (
        <View style={styles.card} onTouchEnd={onPress}>
            <View style={[styles.iconWrap, { backgroundColor: status.bg }]}>
                <Ionicons name={status.icon} size={22} color={status.color} />
            </View>
            <View style={styles.info}>
                <Text style={styles.group}>{payment.group?.name || `Month ${payment.month}`}</Text>
                <Text style={styles.date}>{date}</Text>
                {payment.upiRef ? <Text style={styles.ref}>Ref: {payment.upiRef}</Text> : null}
                {payment.receipt ? (
                    <View style={styles.receiptBadge}>
                        <Ionicons name="receipt-outline" size={11} color={colors.info} />
                        <Text style={[styles.receiptText, { color: colors.info }]}>Receipt uploaded</Text>
                    </View>
                ) : null}
            </View>
            <View style={styles.amountWrap}>
                <Text style={styles.amount}>₹{payment.amount?.toLocaleString()}</Text>
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            </View>
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 14,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
        },
        iconWrap: {
            width: 44,
            height: 44,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        info: { flex: 1, marginLeft: 12 },
        group: { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        date: { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        ref: { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        receiptBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
        receiptText: { fontSize: 11, fontFamily: F.medium, marginLeft: 4 },
        amountWrap: { alignItems: 'flex-end' },
        amount: { fontSize: 16, fontFamily: F.bold, color: colors.text },
        statusLabel: { fontSize: 10, fontFamily: F.semibold, marginTop: 3, letterSpacing: 0.5 },
    });
}
