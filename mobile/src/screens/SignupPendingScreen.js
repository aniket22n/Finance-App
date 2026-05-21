import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

export default function SignupPendingScreen({ route, navigation }) {
    const { name, phone } = route.params || {};
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            <View style={styles.center}>
                {/* Icon */}
                <View style={styles.iconWrap}>
                    <Ionicons name="time-outline" size={48} color={colors.primary} />
                </View>

                {/* Title + message */}
                <Text style={styles.title}>Account Request Submitted</Text>
                <Text style={styles.message}>
                    Your account request is under review. You'll be notified once the admin approves it.
                </Text>

                {/* Details card */}
                <View style={styles.card}>
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>Name</Text>
                        <Text style={styles.rowValue}>{name || '—'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>Phone</Text>
                        <Text style={styles.rowValue}>+91 {phone || '—'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <Text style={styles.rowLabel}>Status</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>Pending Review</Text>
                        </View>
                    </View>
                </View>

                {/* Button */}
                <TouchableOpacity
                    style={styles.btn}
                    onPress={() => navigation.replace('Login')}
                    activeOpacity={0.85}
                >
                    <Text style={styles.btnText}>Got it</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:    { flex: 1, backgroundColor: colors.background },
        center: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
        },
        iconWrap: {
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
        },
        title: {
            fontSize: 20,
            fontFamily: F.bold,
            color: colors.text,
            textAlign: 'center',
            marginBottom: 10,
        },
        message: {
            fontSize: 13,
            fontFamily: F.regular,
            color: colors.textSecondary,
            textAlign: 'center',
            lineHeight: 20,
            marginBottom: 28,
        },
        card: {
            width: '100%',
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 16,
            marginBottom: 28,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 12,
        },
        rowLabel: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },
        rowValue: { fontSize: 13, fontFamily: F.semibold, color: colors.text },
        divider:  { height: 1, backgroundColor: colors.border },
        badge: {
            backgroundColor: '#F59E0B',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 6,
        },
        badgeText: { fontSize: 11, fontFamily: F.bold, color: '#fff' },
        btn: {
            width: '100%',
            height: 56,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
        },
        btnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
    });
}
