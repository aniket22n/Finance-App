import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const PAYMENT_STATUS = {
    pending:  { icon: 'time-outline',             label: 'Pending'  },
    paid:     { icon: 'checkmark-circle-outline', label: 'Paid'     },
    verified: { icon: 'shield-checkmark-outline', label: 'Verified' },
    failed:   { icon: 'close-circle-outline',     label: 'Failed'   },
};

export default function MemberCard({ member, isWinner, isPastWinner, winnerMonth, paymentStatus, emiAmount, onPress }) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

    const ps = PAYMENT_STATUS[paymentStatus] || PAYMENT_STATUS.pending;
    const statusColor = paymentStatus === 'verified' || paymentStatus === 'paid'
        ? colors.success
        : paymentStatus === 'failed'
            ? colors.error
            : colors.warning;

    // ── Current POT holder — primary gradient (matches home summary banner) ──
    if (isWinner) {
        return (
            <TouchableOpacity style={styles.gradCard} onPress={onPress} disabled={!onPress} activeOpacity={0.75}>
                <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.gradInner}
                >
                    <View style={[styles.rankCircle, { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(0,0,0,0.2)' }]}>
                        <Text style={[styles.rankNum, { color: '#fff' }]}>{winnerMonth}</Text>
                    </View>
                    <View style={styles.body}>
                        <Text style={[styles.name, { color: '#fff' }]} numberOfLines={1}>{member.name || member.phone}</Text>
                        {member.phone && member.name ? <Text style={[styles.sub, { color: 'rgba(255,255,255,0.7)' }]}>{member.phone}</Text> : null}
                        <Text style={[styles.sub, { color: '#fff', fontFamily: F.bold }]}>POT - {winnerMonth}</Text>
                    </View>
                    <View style={styles.right}>
                        <Ionicons name={ps.icon} size={15} color={statusColor} />
                        <Text style={[styles.statusTxt, { color: statusColor }]}>{ps.label}</Text>
                        {emiAmount ? <Text style={[styles.emi, { color: '#fff' }]}>₹{emiAmount.toLocaleString()}</Text> : null}
                    </View>
                    {onPress ? <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" style={{ marginLeft: 4 }} /> : null}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    // ── Past winners + regular members ───────────────────────────────────────
    return (
        <TouchableOpacity style={styles.plainCard} onPress={onPress} disabled={!onPress} activeOpacity={0.75}>
            <View style={styles.rankCircle}>
                {isPastWinner
                    ? <Text style={[styles.rankNum, { color: colors.primary }]}>{winnerMonth}</Text>
                    : <Ionicons name="person" size={16} color={colors.textSecondary} />
                }
            </View>

            <View style={styles.body}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{member.name || member.phone}</Text>
                {member.phone && member.name
                    ? <Text style={[styles.sub, { color: colors.textSecondary }]}>{member.phone}</Text>
                    : null
                }
                {isPastWinner &&
                    <Text style={[styles.sub, { color: colors.textSecondary, fontFamily: F.bold }]}>POT - {winnerMonth}</Text>
                }
            </View>

            <View style={styles.right}>
                <Ionicons name={ps.icon} size={15} color={statusColor} />
                <Text style={[styles.statusTxt, { color: statusColor }]}>{ps.label}</Text>
                {emiAmount ? <Text style={[styles.emi, { color: colors.text }]}>₹{emiAmount.toLocaleString()}</Text> : null}
            </View>
            {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 4 }} /> : null}
        </TouchableOpacity>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        // ── Current winner ──
        gradCard: {
            borderRadius: 14, overflow: 'hidden', marginBottom: 6,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
        },
        gradInner: {
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 12, paddingVertical: 10, gap: 10,
        },

        // ── Past winners + regular members ──
        plainCard: {
            flexDirection: 'row', alignItems: 'center', gap: 10,
            borderRadius: 14, borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary,
            paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6,
            shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
        },

        // ── Shared ──
        rankCircle: {
            width: 36, height: 36, borderRadius: 10, borderWidth: 1,
            backgroundColor: colors.background, borderColor: colors.border,
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        },
        rankNum:   { fontSize: 15, fontFamily: F.bold },
        body:      { flex: 1, minWidth: 0 },
        name:      { fontSize: 14, fontFamily: F.semibold },
        sub:       { fontSize: 11, fontFamily: F.regular, marginTop: 2 },
        right:     { alignItems: 'flex-end', gap: 2 },
        statusTxt: { fontSize: 10, fontFamily: F.medium, marginTop: 1 },
        emi:       { fontSize: 12, fontFamily: F.bold, marginTop: 1 },
    });
}
