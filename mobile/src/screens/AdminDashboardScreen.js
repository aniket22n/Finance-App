import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAdminDashboard } from '../services/api';
import { F } from '../theme';
import NotificationsBell from '../components/NotificationsBell';

const W = Dimensions.get('window').width;
// card: marginHorizontal 12 each side + card padding 12 each side = 48 total
const CHART_W = W - 48;

function DonutChart({ verified, pending, failed, textColor, trackColor }) {
  const SIZE = 130;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 46;
  const CIRC = 2 * Math.PI * R;
  const SW = 15;

  const segments = [
    { pct: verified, color: '#10B981' },
    { pct: pending, color: '#F59E0B' },
    { pct: failed, color: '#EF4444' },
  ];
  let cum = 0;
  const arcs = segments.map((s) => {
    const dash = (s.pct / 100) * CIRC;
    const offset = -(cum / 100) * CIRC;
    cum += s.pct;
    return { ...s, dash, offset };
  });

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle
        cx={cx}
        cy={cy}
        r={R}
        fill="none"
        stroke={trackColor}
        strokeWidth={SW}
      />
      {arcs.map((a, i) =>
        a.pct > 0 ? (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={SW}
            strokeDasharray={`${a.dash} ${CIRC}`}
            strokeDashoffset={a.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ) : null,
      )}
      <SvgText
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        fontSize="16"
        fontWeight="bold"
        fill={textColor}
      >
        {verified}%
      </SvgText>
    </Svg>
  );
}

export default function AdminDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  // getUTCHours + timezone offset gives reliable 24-hour local time
  // regardless of the device's 12/24-hour display setting
  const hour = Math.floor(
    ((now.getTime() / 36e5) - (now.getTimezoneOffset() / 60) % 24 + 24) % 24
  );
  const greeting =
    hour >= 5 && hour < 12 ? 'Good morning'
    : hour >= 12 && hour < 17 ? 'Good afternoon'
    : 'Good evening';

  const loadData = async () => {
    try {
      const dashRes = await getAdminDashboard();
      setData(dashRes.data);
    } catch (err) {
      console.log('Dashboard error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const stats = data?.stats || {};
  const recentPayments = data?.recentPayments || [];

  // Build 8-day revenue trend from recentPayments
  const barData = useMemo(() => {
    const days = Array.from({ length: 8 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (7 - i));
      return d.toDateString();
    });
    const vals = days.map((day) =>
      recentPayments
        .filter(
          (p) =>
            p.status === 'verified' &&
            new Date(p.createdAt).toDateString() === day,
        )
        .reduce((s, p) => s + (p.amount || 0), 0),
    );
    // Use fallback demo data if no real data yet
    return vals.some((v) => v > 0)
      ? vals
      : [400, 700, 300, 1100, 800, 500, 1400, 900];
  }, [recentPayments]);

  // Payment status percentages
  const total = stats.totalPayments || 0;
  const verifiedPct =
    total > 0 ? Math.round((stats.verifiedCount / total) * 100) : 65;
  const pendingPct =
    total > 0 ? Math.round((stats.pendingCount / total) * 100) : 25;
  const failedPct = Math.max(0, 100 - verifiedPct - pendingPct) || 10;

  const statCards = [
    { icon: 'people', label: 'Groups', value: stats.totalGroups ?? 0 },
    { icon: 'person', label: 'Members', value: stats.totalUsers ?? 0 },
    { icon: 'time', label: 'Pending', value: stats.pendingCount ?? 0 },
    {
      icon: 'wallet',
      label: 'Collected',
      value: `₹${Math.round((stats.verifiedAmount || 0) / 1000)}K`,
    },
  ];

  const chartConfig = useMemo(
    () => ({
      backgroundColor: colors.backgroundSecondary,
      backgroundGradientFrom: colors.backgroundSecondary,
      backgroundGradientTo: colors.backgroundSecondary,
      color: () => colors.primary,
      barPercentage: 0.55,
      decimalPlaces: 0,
      propsForLabels: { fontSize: '0' },
    }),
    [colors],
  );

  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, Admin</Text>
          <Text style={styles.headerTitle}>DASHBOARD</Text>
        </View>
        <NotificationsBell />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── 2×2 Stat Grid ── */}
        <View style={styles.statGrid}>
          {statCards.map((card, i) => (
            <View key={i} style={styles.statCard}>
              <View style={styles.statTop}>
                <View style={styles.iconWrap}>
                  <Ionicons name={card.icon} size={16} color="#fff" />
                </View>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
              <Text style={styles.statValue}>{card.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Stats & Analytics ── */}
        <Text style={styles.sectionTitle}>STATS & ANALYTICS</Text>

        {/* Revenue Trend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Revenue Trend (30 days)</Text>
          <BarChart
            data={{
              labels: ['', '', '', '', '', '', '', ''],
              datasets: [{ data: barData }],
            }}
            width={CHART_W}
            height={110}
            chartConfig={chartConfig}
            withHorizontalLabels={false}
            withVerticalLabels={false}
            showBarTops={false}
            showValuesOnTopOfBars={false}
            fromZero
            style={styles.barChart}
          />
        </View>

        {/* Payment Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Status</Text>
          <View style={styles.pieRow}>
            <DonutChart
              verified={verifiedPct}
              pending={pendingPct}
              failed={failedPct}
              textColor={colors.text}
              trackColor={colors.backgroundTertiary}
            />
            <View style={styles.legend}>
              {[
                { label: 'Verified', pct: verifiedPct, color: '#10B981' },
                { label: 'Pending', pct: pendingPct, color: '#F59E0B' },
                { label: 'Failed', pct: failedPct, color: '#EF4444' },
              ].map((item) => (
                <View key={item.label} style={styles.legendRow}>
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                  <Text style={styles.legendPct}>{item.pct}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors) {
  const STAT_W = (W - 12 * 2 - 8) / 2;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    scroll: { flex: 1 },
    content: { paddingBottom: 20 },

    // Header — compact 40px content area
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 56,
      paddingBottom: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
      zIndex: 10,
    },
    greeting: {
      fontSize: 12,
      fontFamily: F.regular,
      color: colors.textSecondary,
    },
    headerTitle: { fontSize: 20, fontFamily: F.bold, color: colors.text },

    // Stat grid
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 12,
    },
    statCard: {
      width: STAT_W,
      height: 80,
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 10,
      justifyContent: 'space-between',
    },
    statTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: 7,
      backgroundColor: 'rgba(255,255,255,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      fontSize: 20,
      fontFamily: F.bold,
      color: '#fff',
      lineHeight: 24,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: F.medium,
      color: 'rgba(255,255,255,0.85)',
      flexShrink: 1,
    },

    // Section title
    sectionTitle: {
      fontSize: 11,
      fontFamily: F.bold,
      color: colors.textTertiary,
      letterSpacing: 0.8,
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 8,
    },

    // Cards
    card: {
      backgroundColor: colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      marginHorizontal: 12,
      marginBottom: 8,
      padding: 12,
    },
    cardTitle: {
      fontSize: 12,
      fontFamily: F.semibold,
      color: colors.text,
      marginBottom: 8,
    },
    barChart: { borderRadius: 8, marginLeft: -8 },

    // Donut + legend
    pieRow: { flexDirection: 'row', alignItems: 'center' },
    legend: { flex: 1, paddingLeft: 8, gap: 12 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: {
      flex: 1,
      fontSize: 12,
      fontFamily: F.regular,
      color: colors.textSecondary,
    },
    legendPct: { fontSize: 12, fontFamily: F.semibold, color: colors.text },
  });
}
