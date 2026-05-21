import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    RefreshControl, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAdminDashboard, getGroupHealth } from '../services/api';
import { F } from '../theme';

export default function AdminDashboardScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const [stats, setStats] = useState(null);
    const [health, setHealth] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    const loadData = async () => {
        try {
            const [dashRes, healthRes] = await Promise.all([
                getAdminDashboard(),
                getGroupHealth(),
            ]);
            setStats(dashRes.data.stats);
            setHealth(healthRes.data.groups || []);
        } catch (err) {
            console.log('Dashboard load error:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const styles = makeStyles(colors);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    const statCards = [
        { icon: 'people',  label: 'Total Groups',  value: stats?.totalGroups ?? 0 },
        { icon: 'person',  label: 'Total Members', value: stats?.totalUsers ?? 0 },
        { icon: 'time',    label: 'Pending',        value: stats?.pendingCount ?? 0 },
        { icon: 'wallet',  label: 'Collected',      value: `₹${((stats?.verifiedAmount || 0) / 1000).toFixed(0)}K` },
    ];

    return (
        <View style={styles.root}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={{ paddingBottom: 90 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.greeting}>{greeting},</Text>
                    <Text style={styles.adminName}>{user?.name || 'Admin'} 👋</Text>
                </View>

                {/* 2×2 Stat Grid */}
                <View style={styles.statGrid}>
                    {statCards.map((card, i) => (
                        <LinearGradient
                            key={i}
                            colors={[colors.primary, colors.primaryDark]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.statCard}
                        >
                            <View style={styles.statIconWrap}>
                                <Ionicons name={card.icon} size={22} color="#fff" />
                            </View>
                            <Text style={styles.statValue}>{card.value}</Text>
                            <Text style={styles.statLabel}>{card.label}</Text>
                        </LinearGradient>
                    ))}
                </View>

                {/* Group Health */}
                {health.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>GROUP HEALTH</Text>
                        {health.map(g => (
                            <View key={g._id} style={styles.healthCard}>
                                <View style={styles.healthTop}>
                                    <View style={styles.healthLeft}>
                                        <Text style={styles.healthName}>{g.name}</Text>
                                        <Text style={styles.healthMeta}>
                                            👥 {g.totalMembers} members • {g.percentage}% paid
                                        </Text>
                                    </View>
                                    <Text style={styles.healthPct}>{g.percentage}%</Text>
                                </View>
                                <View style={styles.progressTrack}>
                                    <LinearGradient
                                        colors={[colors.primary, colors.primaryDark]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={[styles.progressFill, { width: `${g.percentage || 0}%` }]}
                                    />
                                </View>
                            </View>
                        ))}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:       { flex: 1 },
        container:  { flex: 1, backgroundColor: colors.backgroundSecondary },
        center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundSecondary },
        header: {
            backgroundColor: colors.background,
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 20,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        greeting:     { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },
        adminName:    { fontSize: 22, fontFamily: F.bold, color: colors.text, marginTop: 2 },
        statGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 12,
            paddingTop: 16,
            gap: 12,
        },
        statCard: {
            width: '47%',
            borderRadius: 16,
            padding: 16,
            minHeight: 120,
            justifyContent: 'space-between',
        },
        statIconWrap: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        statValue:    { fontSize: 28, fontFamily: F.bold, color: '#fff' },
        statLabel:    { fontSize: 14, fontFamily: F.regular, color: 'rgba(255,255,255,0.85)' },
        sectionTitle: {
            fontSize: 12,
            fontFamily: F.semibold,
            color: colors.textSecondary,
            letterSpacing: 0.8,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 12,
        },
        healthCard: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
            marginHorizontal: 16,
            marginBottom: 10,
        },
        healthTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
        healthLeft:   { flex: 1 },
        healthName:   { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        healthMeta:   { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },
        healthPct:    { fontSize: 16, fontFamily: F.bold, color: colors.primary, marginLeft: 12 },
        progressTrack:{ height: 4, backgroundColor: colors.backgroundTertiary, borderRadius: 2, overflow: 'hidden' },
        progressFill: { height: 4, borderRadius: 2 },
    });
}
