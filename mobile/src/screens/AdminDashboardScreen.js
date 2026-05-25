import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, FlatList, Dimensions,
} from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getAdminDashboard, getGroups, getAdminPaymentStats } from '../services/api';
import { F } from '../theme';
import NotificationsBell from '../components/NotificationsBell';

const W = Dimensions.get('window').width;

// ── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ verifiedPct, pendingPct, textColor, trackColor }) {
  const SIZE = 120, cx = 60, cy = 60, R = 44, CIRC = 2 * Math.PI * R, SW = 14;
  const failedPct = Math.max(0, 100 - verifiedPct - pendingPct);
  const segments = [
    { pct: verifiedPct, color: '#10B981' },
    { pct: pendingPct,  color: '#F59E0B' },
    { pct: failedPct,   color: '#EF4444' },
  ];
  let cum = 0;
  const arcs = segments.map(s => {
    const dash   = (s.pct / 100) * CIRC;
    const offset = -(cum / 100) * CIRC;
    cum += s.pct;
    return { ...s, dash, offset };
  });
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle cx={cx} cy={cy} r={R} fill="none" stroke={trackColor} strokeWidth={SW} />
      {arcs.map((a, i) => a.pct > 0 ? (
        <Circle key={i} cx={cx} cy={cy} r={R} fill="none"
          stroke={a.color} strokeWidth={SW}
          strokeDasharray={`${a.dash} ${CIRC}`}
          strokeDashoffset={a.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      ) : null)}
      <SvgText x={cx} y={cy + 6} textAnchor="middle" fontSize="15" fontWeight="bold" fill={textColor}>
        {verifiedPct}%
      </SvgText>
    </Svg>
  );
}

// ── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown({ label, value, options, onSelect, colors, styles, icon }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  const isFiltered = value !== 'all';
  return (
    <>
      <TouchableOpacity
        style={[styles.dropBtn, isFiltered && { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <Ionicons name={icon} size={14} color={isFiltered ? colors.primary : colors.textSecondary} />
        <Text style={[styles.dropValue, isFiltered && { color: colors.primary }]} numberOfLines={1}>
          {selected?.label || label}
        </Text>
        <Ionicons name="chevron-down" size={12} color={isFiltered ? colors.primary : colors.textTertiary} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            {/* Drag handle */}
            <View style={styles.modalHandle} />
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={icon} size={16} color={colors.primary} />
              </View>
              <Text style={styles.modalTitle}>Select {label}</Text>
            </View>
            <FlatList
              data={options}
              keyExtractor={o => String(o.value)}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => {
                const isActive = item.value === value;
                return (
                  <TouchableOpacity
                    style={[styles.modalOption, isActive && { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                    onPress={() => { onSelect(item.value); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalOptionText, isActive && { color: colors.primary, fontFamily: F.semibold }]}>
                      {item.label}
                    </Text>
                    {isActive && (
                      <View style={[styles.modalCheck, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function AdminDashboardScreen({ navigation }) {
  const { colors } = useTheme();

  const [dashData, setDashData]           = useState(null);
  const [groups, setGroups]               = useState([]);
  const [filteredStats, setFilteredStats] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [statsLoading, setStatsLoading]   = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

  const now  = new Date();
  const hour = Math.floor(((now.getTime() / 36e5) - (now.getTimezoneOffset() / 60) % 24 + 24) % 24);
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening';

  const loadBase = async () => {
    try {
      const [dashRes, groupsRes] = await Promise.all([getAdminDashboard(), getGroups()]);
      setDashData(dashRes.data);
      setGroups(groupsRes.data.groups || []);
    } catch (err) {
      console.log('Dashboard load error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = useCallback(async (groupId, month) => {
    setStatsLoading(true);
    try {
      const res = await getAdminPaymentStats(
        groupId !== 'all' ? groupId : null,
        month   !== 'all' ? month   : null,
      );
      setFilteredStats(res.data.data);
    } catch (err) {
      console.log('Stats load error:', err.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadBase(); }, []));
  useFocusEffect(useCallback(() => { loadStats(selectedGroup, selectedMonth); }, [selectedGroup, selectedMonth]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBase(), loadStats(selectedGroup, selectedMonth)]);
    setRefreshing(false);
  };

  const onGroupChange = (val) => { setSelectedGroup(val); setSelectedMonth('all'); };

  const groupOptions = [
    { label: 'All Groups', value: 'all' },
    ...groups.map(g => ({ label: g.name, value: g._id })),
  ];
  const activeGroup = groups.find(g => g._id === selectedGroup);
  const maxMonth = activeGroup
    ? (activeGroup.totalMonths || 24)
    : groups.length > 0 ? Math.max(...groups.map(g => g.totalMonths || 0)) : 24;
  const monthOptions = [
    { label: 'All Months', value: 'all' },
    ...Array.from({ length: maxMonth }, (_, i) => ({ label: `Month ${i + 1}`, value: i + 1 })),
  ];

  const stats = dashData?.stats || {};
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Donut percentages from filtered stats
  const totalPayments = (filteredStats?.verifiedCount || 0) + (filteredStats?.pendingCount || 0);
  const verifiedPct   = totalPayments > 0 ? Math.round((filteredStats.verifiedCount / totalPayments) * 100) : 0;
  const pendingPct    = totalPayments > 0 ? Math.round((filteredStats.pendingCount  / totalPayments) * 100) : 0;

  const fmt = (val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : val >= 1000 ? `₹${(val / 1000).toFixed(1)}K` : `₹${val}`;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}, Admin</Text>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <NotificationsBell />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Groups & Members ── */}
        <View style={styles.summaryRow}>
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryCardTop}>
              <Text style={styles.summaryCardLabel}>GROUPS</Text>
              <Ionicons name="people" size={24} color="rgba(255,255,255,0.18)" />
            </View>
            <Text style={styles.summaryCardValue}>{stats.totalGroups ?? 0}</Text>
            <View style={styles.summaryCardBottom}>
              <View style={styles.summaryCardDot} />
              <Text style={styles.summaryCardSub}>{stats.activeGroups ?? 0} active</Text>
            </View>
          </LinearGradient>

          <LinearGradient
            colors={['#1e293b', '#334155']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.summaryCard}
          >
            <View style={styles.summaryCardTop}>
              <Text style={styles.summaryCardLabel}>MEMBERS</Text>
              <Ionicons name="person" size={24} color="rgba(255,255,255,0.18)" />
            </View>
            <Text style={styles.summaryCardValue}>{stats.totalUsers ?? 0}</Text>
            <View style={styles.summaryCardBottom}>
              <View style={[styles.summaryCardDot, { backgroundColor: '#60a5fa' }]} />
              <Text style={styles.summaryCardSub}>registered</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Filter Dropdowns ── */}
        <Text style={styles.sectionTitle}>PAYMENT OVERVIEW</Text>
        <View style={styles.filterRow}>
          <View style={styles.dropWrap}>
            <Dropdown label="Group" value={selectedGroup} options={groupOptions} onSelect={onGroupChange} colors={colors} styles={styles} icon="people" />
          </View>
          <View style={styles.dropWrap}>
            <Dropdown label="Month" value={selectedMonth} options={monthOptions} onSelect={val => setSelectedMonth(val)} colors={colors} styles={styles} icon="calendar" />
          </View>
        </View>

        {/* ── 3 Stat Cards in one row ── */}
        {statsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : filteredStats ? (
          <>
            <View style={styles.statCard}>
              {[
                { label: 'Collected', filter: 'verified', amount: filteredStats.verifiedAmount, count: filteredStats.verifiedCount, color: colors.success, bg: colors.successLight },
                { label: 'Pending',   filter: 'pending',  amount: filteredStats.pendingAmount,  count: filteredStats.pendingCount,  color: colors.warning, bg: colors.warningLight },
                { label: 'Total EMI', filter: 'all',      amount: filteredStats.verifiedAmount + filteredStats.pendingAmount, count: totalPayments, color: colors.primary, bg: colors.primaryLight },
              ].map((s, i) => (
                <React.Fragment key={s.label}>
                  {i > 0 && <View style={styles.statVDivider} />}
                  <TouchableOpacity
                    style={styles.statSection}
                    activeOpacity={0.65}
                    onPress={() => navigation.navigate('Payments', {
                      activeFilter: s.filter,
                      group: selectedGroup,
                      month: selectedMonth,
                    })}
                  >
                    <View style={[styles.statAccent, { backgroundColor: s.color }]} />
                    <View style={[styles.statBadge, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statBadgeText, { color: s.color }]}>{s.count}</Text>
                    </View>
                    <Text style={[styles.statAmount, { color: s.color }]}>{fmt(s.amount)}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                    <Ionicons name="arrow-forward" size={11} color={s.color} style={{ marginTop: 4, opacity: 0.7 }} />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>

            {/* ── Payment Status Donut ── */}
            {totalPayments > 0 && (
              <>
                <Text style={styles.sectionTitle}>PAYMENT STATUS</Text>
                <View style={styles.donutCard}>
                  <DonutChart
                    verifiedPct={verifiedPct}
                    pendingPct={pendingPct}
                    textColor={colors.text}
                    trackColor={colors.backgroundTertiary}
                  />
                  <View style={styles.legend}>
                    {[
                      { label: 'Verified', pct: verifiedPct, color: '#10B981', count: filteredStats.verifiedCount },
                      { label: 'Pending',  pct: pendingPct,  color: '#F59E0B', count: filteredStats.pendingCount  },
                      { label: 'Other',    pct: Math.max(0, 100 - verifiedPct - pendingPct), color: '#EF4444', count: 0 },
                    ].map(item => (
                      <View key={item.label} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={styles.legendLabel}>{item.label}</Text>
                        <Text style={styles.legendPct}>{item.pct}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </>
        ) : null}

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors) {
  const STAT_W = (W - 32 - 16) / 3;
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: colors.backgroundSecondary },
    center:  { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundSecondary },
    scroll:  { flex: 1 },
    content: { paddingBottom: 30 },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    greeting:    { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary },
    headerTitle: { fontSize: 22, fontFamily: F.bold, color: colors.text },

    // Summary
    summaryRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 10 },
    summaryCard: {
      flex: 1, borderRadius: 14, padding: 12,
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
    },
    summaryCardTop: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
    },
    summaryCardLabel: { fontSize: 10, fontFamily: F.bold, color: 'rgba(255,255,255,0.65)', letterSpacing: 1 },
    summaryCardValue: { fontSize: 28, fontFamily: F.bold, color: '#fff', marginBottom: 6 },
    summaryCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    summaryCardDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' },
    summaryCardSub:    { fontSize: 11, fontFamily: F.medium, color: 'rgba(255,255,255,0.7)' },

    sectionTitle: {
      fontSize: 11, fontFamily: F.bold, color: colors.textTertiary,
      letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10,
    },

    // Filters
    filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
    dropWrap:  { flex: 1 },
    dropBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 7,
      backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    },
    dropValue: { flex: 1, fontSize: 13, fontFamily: F.medium, color: colors.text },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      paddingBottom: 36, maxHeight: '65%',
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center', marginTop: 10, marginBottom: 16,
    },
    modalHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 16, paddingBottom: 14,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      marginBottom: 8,
    },
    modalHeaderIcon: {
      width: 32, height: 32, borderRadius: 9,
      alignItems: 'center', justifyContent: 'center',
    },
    modalTitle: { fontSize: 15, fontFamily: F.semibold, color: colors.text },
    modalList:  { paddingHorizontal: 12, paddingTop: 4, gap: 6 },
    modalOption: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 13,
      borderRadius: 12, borderWidth: 1, borderColor: 'transparent',
    },
    modalOptionText: { fontSize: 14, fontFamily: F.regular, color: colors.text },
    modalCheck: {
      width: 20, height: 20, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },

    // Single stat card with vertical dividers
    statCard: {
      flexDirection: 'row',
      marginHorizontal: 16, marginTop: 12,
      backgroundColor: colors.background,
      borderRadius: 20, borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
      overflow: 'hidden',
    },
    statSection:  { flex: 1, alignItems: 'center', paddingBottom: 16, paddingHorizontal: 6 },
    statVDivider: { width: 1, backgroundColor: colors.border, marginVertical: 0 },
    statAccent:   { width: '100%', height: 3, borderRadius: 0, marginBottom: 12 },
    statBadge: {
      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10,
    },
    statBadgeText: { fontSize: 11, fontFamily: F.bold },
    statAmount:    { fontSize: 18, fontFamily: F.bold, marginBottom: 4 },
    statLabel:     { fontSize: 11, fontFamily: F.medium, color: colors.textSecondary },

    // Donut card
    donutCard: {
      marginHorizontal: 16, marginTop: 2,
      backgroundColor: colors.background, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      padding: 16, flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    legend:     { flex: 1, paddingLeft: 16, gap: 14 },
    legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot:  { width: 8, height: 8, borderRadius: 4 },
    legendLabel:{ flex: 1, fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },
    legendPct:  { fontSize: 13, fontFamily: F.semibold, color: colors.text },
  });
}
