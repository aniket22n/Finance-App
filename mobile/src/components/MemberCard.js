import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

export default function MemberCard({ member, isWinner, paymentStatus, emiAmount }) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

    const STATUS = {
        pending:  { color: colors.warning, icon: 'time-outline', label: 'Pending' },
        paid:     { color: colors.success,  icon: 'checkmark-circle-outline', label: 'Paid' },
        verified: { color: colors.success,  icon: 'shield-checkmark-outline', label: 'Verified' },
        failed:   { color: colors.error,    icon: 'close-circle-outline', label: 'Failed' },
    };
    const status = STATUS[paymentStatus] || STATUS.pending;

    // Winner card uses a light-green background (same in light & dark mode), so the inner
    // text needs a dark-on-light color rather than the default theme text color.
    // Using a very dark forest green ensures WCAG AA contrast on the #ECFDF5 background.
    const winnerOnLight      = '#064E3B'; // very dark green — high contrast on light-green bg
    const winnerOnLightMuted = '#065F46'; // slightly lighter dark-green for secondary text

    return (
        <View style={[styles.card, isWinner && styles.winnerCard]}>
            {isWinner && (
                <View style={styles.winnerBadge}>
                    <Ionicons name="trophy" size={10} color={winnerOnLight} />
                    <Text style={[styles.winnerText, { color: winnerOnLight }]}>POT HOLDER</Text>
                </View>
            )}
            <View style={styles.row}>
                <Avatar uri={member.avatar} name={member.name} size={42} />
                <View style={styles.info}>
                    <Text style={[styles.name, isWinner && { color: winnerOnLight }]}>
                        {member.name || member.phone}
                    </Text>
                    <Text style={[styles.phone, isWinner && { color: winnerOnLightMuted }]}>
                        {member.phone}
                    </Text>
                </View>
                <View style={styles.statusWrap}>
                    <Ionicons name={status.icon} size={18} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    {emiAmount ? (
                        <Text style={[styles.amount, isWinner && { color: winnerOnLight }]}>
                            ₹{emiAmount.toLocaleString()}
                        </Text>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        card: {
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
            elevation: 1,
        },
        winnerCard: {
            borderColor: colors.status.verified.border,
            backgroundColor: colors.status.verified.bg,
        },
        winnerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primaryLight,
            alignSelf: 'flex-start',
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: colors.status.verified.border,
        },
        winnerText: { fontSize: 10, fontFamily: F.bold, color: colors.primary, marginLeft: 4, letterSpacing: 0.5 },
        row: { flexDirection: 'row', alignItems: 'center' },
        info: { flex: 1, marginLeft: 12 },
        name: { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        phone: { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        statusWrap: { alignItems: 'flex-end' },
        statusText: { fontSize: 11, fontFamily: F.medium, marginTop: 2 },
        amount: { fontSize: 13, fontFamily: F.bold, color: colors.text, marginTop: 3 },
    });
}
