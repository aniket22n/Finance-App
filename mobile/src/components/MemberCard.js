import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

export default function MemberCard({ member, isWinner, isPastWinner, winnerMonth, paymentStatus, emiAmount }) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

    const STATUS = {
        pending:  { color: colors.warning, icon: 'time-outline', label: 'Pending' },
        paid:     { color: colors.success, icon: 'checkmark-circle-outline', label: 'Paid' },
        verified: { color: colors.success, icon: 'shield-checkmark-outline', label: 'Verified' },
        failed:   { color: colors.error,   icon: 'close-circle-outline', label: 'Failed' },
    };
    const status = STATUS[paymentStatus] || STATUS.pending;

    // Current pot holder uses the verified-status tint (green-mode-aware).
    // Past pot holders use the primary tint (coral/themed) — same colour family as the
    // POT Winner Config "current row" highlight so the visual language stays consistent.
    const winnerFg     = colors.status.verified.text;
    const pastWinnerFg = colors.primaryDark;

    const cardStyle =
        isWinner     ? [styles.card, styles.winnerCard] :
        isPastWinner ? [styles.card, styles.pastWinnerCard] :
        styles.card;

    return (
        <View style={cardStyle}>
            {isWinner && (
                <View style={styles.winnerBadge}>
                    <Ionicons name="trophy" size={10} color={winnerFg} />
                    <Text style={[styles.winnerText, { color: winnerFg }]}>
                        POT HOLDER{winnerMonth ? ` · MONTH ${winnerMonth}` : ''}
                    </Text>
                </View>
            )}
            {isPastWinner && (
                <View style={styles.pastWinnerBadge}>
                    <Ionicons name="ribbon" size={10} color={pastWinnerFg} />
                    <Text style={[styles.pastWinnerText, { color: pastWinnerFg }]}>
                        PAST WINNER{winnerMonth ? ` · MONTH ${winnerMonth}` : ''}
                    </Text>
                </View>
            )}
            <View style={styles.row}>
                <Avatar uri={member.avatar} name={member.name} size={34} />
                <View style={styles.info}>
                    <Text
                        style={[
                            styles.name,
                            isWinner     && { color: winnerFg },
                            isPastWinner && { color: pastWinnerFg },
                        ]}
                    >
                        {member.name || member.phone}
                    </Text>
                    <Text
                        style={[
                            styles.phone,
                            isWinner     && { color: winnerFg,     opacity: 0.85 },
                            isPastWinner && { color: pastWinnerFg, opacity: 0.75 },
                        ]}
                    >
                        {member.phone}
                    </Text>
                </View>
                <View style={styles.statusWrap}>
                    <Ionicons name={status.icon} size={18} color={status.color} />
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                    {emiAmount ? (
                        <Text
                            style={[
                                styles.amount,
                                isWinner     && { color: winnerFg },
                                isPastWinner && { color: pastWinnerFg },
                            ]}
                        >
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
            borderRadius: 10,
            paddingVertical: 8,
            paddingHorizontal: 10,
            marginBottom: 6,
            borderWidth: 1,
            borderColor: colors.border,
        },
        winnerCard: {
            borderColor: colors.status.verified.border,
            backgroundColor: colors.status.verified.bg,
        },
        pastWinnerCard: {
            borderColor: colors.primary,
            borderLeftWidth: 3,
            backgroundColor: colors.primaryLight,
        },
        winnerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primaryLight,
            alignSelf: 'flex-start',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            marginBottom: 4,
            borderWidth: 1,
            borderColor: colors.status.verified.border,
        },
        winnerText: { fontSize: 9, fontFamily: F.bold, color: colors.primary, marginLeft: 3, letterSpacing: 0.4 },
        pastWinnerBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.background,
            alignSelf: 'flex-start',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            marginBottom: 4,
            borderWidth: 1,
            borderColor: colors.primary,
        },
        pastWinnerText: { fontSize: 9, fontFamily: F.bold, marginLeft: 3, letterSpacing: 0.4 },
        row: { flexDirection: 'row', alignItems: 'center' },
        info: { flex: 1, marginLeft: 10 },
        name: { fontSize: 13, fontFamily: F.semibold, color: colors.text },
        phone: { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        statusWrap: { alignItems: 'flex-end' },
        statusText: { fontSize: 10, fontFamily: F.medium, marginTop: 1 },
        amount: { fontSize: 12, fontFamily: F.bold, color: colors.text, marginTop: 2 },
    });
}
