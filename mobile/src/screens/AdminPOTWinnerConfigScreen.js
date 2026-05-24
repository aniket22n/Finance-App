import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getGroup, configurePot } from '../services/api';
import Toast, { useToast } from '../components/Toast';
import { F } from '../theme';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Column widths (must match header + row layout)
const COL = { month: 50, name: 90, winner: 130, winnerEmi: 110, otherEmi: 170 };

function calculateMonthName(startDate, monthOffset) {
    const base = startDate ? new Date(startDate) : new Date();
    const d = new Date(base.getFullYear(), base.getMonth() + (monthOffset - 1), 1);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// A row is locked once its cycle has been run (month <= group.currentMonth).
// This is the source of truth — calendar dates don't matter; what matters is whether
// the admin has executed that month's draw yet.
function isLockedMonth(currentMonth, month) {
    return month <= (currentMonth || 0);
}

export default function AdminPOTWinnerConfigScreen({ route, navigation }) {
    const { groupId } = route.params || {};
    const { colors } = useTheme();
    const { toast, show } = useToast();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const [group, setGroup]   = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [rows, setRows]       = useState([]);

    // Winner picker modal
    const [pickerMonth, setPickerMonth] = useState(null);

    // Save-warning modal (shown when at least one row's Winner EMI differs from group default)
    const [warn, setWarn] = useState(null);  // { payload, divergent: [{ month, monthName, winnerEMI }], groupWinnerEmi }
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getGroup(groupId);
                if (cancelled) return;
                const g = res.data.group;
                setGroup(g);

                const totalMonths   = g.totalMonths || 0;
                const startDate     = g.startDate || g.createdAt;
                const existing      = Array.isArray(g.monthlyConfig) ? g.monthlyConfig : [];
                const existingByKey = new Map(existing.map(c => [c.month, c]));

                const activeMonth = (g.currentMonth || 0) + 1;
                const init = Array.from({ length: totalMonths }, (_, i) => {
                    const month = i + 1;
                    const prev  = existingByKey.get(month);
                    return {
                        month,
                        monthName:      calculateMonthName(startDate, month),
                        selectedWinner: prev?.winner ? (typeof prev.winner === 'object' ? prev.winner._id : prev.winner) : '',
                        winnerEMI:      prev?.emiAmount  != null ? String(prev.emiAmount)  : String(g.emiAmount  || ''),
                        otherMemberEMI: prev?.reducedEmi != null ? String(prev.reducedEmi) : String(g.reducedEmi || ''),
                        locked:         isLockedMonth(g.currentMonth, month),
                        current:        month === activeMonth,
                    };
                });
                setRows(init);
            } catch (err) {
                const candidates = [
                    err?.response?.data?.error,
                    err?.response?.data?.message,
                    err?.message,
                ];
                const msg = candidates.find(v => typeof v === 'string' && v.length > 0)
                    || 'Failed to load group';
                Alert.alert('Error', msg);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [groupId]);

    const updateRow = (month, patch) => {
        setRows(prev => prev.map(r => r.month === month ? { ...r, ...patch } : r));
    };

    const persistConfig = async (payload) => {
        setSaving(true);
        try {
            await configurePot(groupId, payload);
            setWarn(null);
            show('POT configured successfully');
            setTimeout(() => navigation.replace('GroupDetail', { groupId }), 600);
        } catch (err) {
            console.log('configurePot error:', err?.response?.status, err?.response?.data, err?.message);
            // Server returns { error: true, message: '...' } from the global handler — so
            // the OR chain must filter for strings, otherwise `error: true` blocks `message`.
            const candidates = [
                err?.response?.data?.error,
                err?.response?.data?.message,
                err?.message,
            ];
            const msg = candidates.find(v => typeof v === 'string' && v.length > 0)
                || 'Failed to save POT config';
            setWarn(null);
            show(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        // Only rows with a winner picked are saved. Unselected rows are skipped.
        const filled = rows.filter(r => !r.locked && r.selectedWinner);
        for (const r of filled) {
            const w = Number(r.winnerEMI);
            const o = Number(r.otherMemberEMI);
            if (!Number.isFinite(w) || w <= 0) {
                show(`Winner EMI for ${r.monthName} must be positive`, 'warning');
                return;
            }
            if (!Number.isFinite(o) || o <= 0) {
                show(`Reducing EMI for ${r.monthName} must be positive`, 'warning');
                return;
            }
        }

        if (filled.length === 0) {
            show('Select a winner for at least one month', 'warning');
            return;
        }

        const payload = filled.map(r => ({
            month:          r.month,
            selectedWinner: r.selectedWinner,
            winnerEMI:      Number(r.winnerEMI),
            otherMemberEMI: Number(r.otherMemberEMI),
        }));

        // Warn only if at least one row's Winner EMI deviates from the group-level default.
        const groupWinnerEmi = Number(group?.emiAmount);
        const divergent = filled
            .filter(r => Number(r.winnerEMI) !== groupWinnerEmi)
            .map(r => ({ month: r.month, monthName: r.monthName, winnerEMI: Number(r.winnerEMI) }));

        if (Number.isFinite(groupWinnerEmi) && divergent.length > 0) {
            setWarn({ payload, divergent, groupWinnerEmi });
            return;
        }

        await persistConfig(payload);
    };

    if (loading) {
        return (
            <View style={[styles.root, styles.center]}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    const members = group?.members || [];
    const memberLabel = (id) => {
        const m = members.find(x => String(x._id) === String(id));
        return m ? (m.name || m.phone) : 'Select…';
    };

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                    <Text style={styles.backTxt}>Groups</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Configure POT Winners</Text>
                <Text style={styles.groupName}>{group?.name}</Text>
            </View>

            {/* Group Summary Card with info-icon (tap to view instructions) */}
            <View style={styles.summaryCard}>
                <TouchableOpacity
                    style={styles.summaryInfoBtn}
                    onPress={() => setShowInfo(true)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.summaryRow}>
                    <SummaryTile
                        label="POT Amount"
                        value={`₹${(group?.potAmount || 0).toLocaleString('en-IN')}`}
                        accent
                        colors={colors}
                        styles={styles}
                    />
                    <SummaryTile
                        label="Members"
                        value={String(group?.members?.length || 0)}
                        colors={colors}
                        styles={styles}
                    />
                </View>
                <View style={styles.summaryRow}>
                    <SummaryTile
                        label="Duration"
                        value={`${group?.totalMonths || 0} months`}
                        colors={colors}
                        styles={styles}
                    />
                    <SummaryTile
                        label="Fixed EMI (Winner)"
                        value={`₹${(group?.emiAmount || 0).toLocaleString('en-IN')}`}
                        colors={colors}
                        styles={styles}
                    />
                </View>
            </View>

            {/* Table */}
            <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                    {/* Header row */}
                    <View style={[styles.row, styles.headerRow]}>
                        <Text style={[styles.cellHeader, { width: COL.month     }]}>Month</Text>
                        <Text style={[styles.cellHeader, { width: COL.name      }]}>Month Name</Text>
                        <Text style={[styles.cellHeader, { width: COL.winner    }]}>POT Winner</Text>
                        <Text style={[styles.cellHeader, { width: COL.winnerEmi }]}>Winner EMI</Text>
                        <Text style={[styles.cellHeader, { width: COL.otherEmi  }]}>Reducing EMI (non winners)</Text>
                    </View>

                    {/* Data rows */}
                    <ScrollView style={styles.body}>
                        {rows.map((r, idx) => {
                            const alt     = idx % 2 === 1;
                            const locked  = r.locked;
                            const current = r.current;
                            return (
                                <View
                                    key={r.month}
                                    style={[
                                        styles.row,
                                        { backgroundColor: alt ? colors.backgroundSecondary : colors.background },
                                        locked && styles.lockedRow,
                                        current && styles.currentRow,
                                    ]}
                                >
                                    <Text style={[styles.cell, { width: COL.month, textAlign: 'center' }]}>
                                        {r.month}
                                    </Text>
                                    <Text style={[styles.cell, { width: COL.name }]}>{r.monthName}</Text>

                                    {/* Winner picker */}
                                    <TouchableOpacity
                                        style={[styles.pickerBtn, { width: COL.winner - 8 }]}
                                        disabled={locked}
                                        onPress={() => setPickerMonth(r.month)}
                                        activeOpacity={0.75}
                                    >
                                        <Text
                                            style={[
                                                styles.pickerTxt,
                                                !r.selectedWinner && { color: colors.textSecondary },
                                                locked && { color: colors.textTertiary },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {r.selectedWinner ? memberLabel(r.selectedWinner) : 'Select…'}
                                        </Text>
                                        {!locked && <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />}
                                    </TouchableOpacity>

                                    {/* Winner EMI input (editable; warns on save if it differs from group default) */}
                                    <TextInput
                                        style={[styles.input, { width: COL.winnerEmi - 8 }, locked && styles.inputLocked]}
                                        value={r.winnerEMI}
                                        onChangeText={v => updateRow(r.month, { winnerEMI: v.replace(/[^0-9.]/g, '') })}
                                        editable={!locked}
                                        keyboardType="numeric"
                                        placeholder="0"
                                        placeholderTextColor={colors.textTertiary}
                                    />

                                    {/* Other Member EMI input */}
                                    <TextInput
                                        style={[styles.input, { width: COL.otherEmi - 8 }, locked && styles.inputLocked]}
                                        value={r.otherMemberEMI}
                                        onChangeText={v => updateRow(r.month, { otherMemberEMI: v.replace(/[^0-9.]/g, '') })}
                                        editable={!locked}
                                        keyboardType="numeric"
                                        placeholder="0"
                                        placeholderTextColor={colors.textTertiary}
                                    />
                                </View>
                            );
                        })}
                        <View style={{ height: 120 }} />
                    </ScrollView>
                </View>
            </ScrollView>

            {/* Save button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.85}
                >
                    {saving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.saveBtnText}>Save POT Config</Text>}
                </TouchableOpacity>
            </View>

            {/* Winner picker modal */}
            <Modal visible={!!pickerMonth} transparent animationType="fade" onRequestClose={() => setPickerMonth(null)}>
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerMonth(null)}>
                    <View style={styles.pickerSheet}>
                        <Text style={styles.pickerTitle}>Select Winner</Text>
                        {(() => {
                            // Hide members already picked as winner for another month.
                            const currentPick   = rows.find(r => r.month === pickerMonth)?.selectedWinner;
                            const winnersTaken  = new Set(
                                rows
                                    .filter(r => r.month !== pickerMonth && r.selectedWinner)
                                    .map(r => String(r.selectedWinner))
                            );
                            const available = members.filter(m => !winnersTaken.has(String(m._id)));
                            return (
                                <FlatList
                                    data={available}
                                    keyExtractor={m => String(m._id)}
                                    ItemSeparatorComponent={() => <View style={styles.sep} />}
                                    ListHeaderComponent={currentPick ? (
                                        <>
                                            <TouchableOpacity
                                                style={styles.pickerRow}
                                                onPress={() => {
                                                    updateRow(pickerMonth, { selectedWinner: '' });
                                                    setPickerMonth(null);
                                                }}
                                            >
                                                <Ionicons name="close-circle-outline" size={16} color={colors.error} style={{ marginRight: 8 }} />
                                                <Text style={[styles.pickerName, { color: colors.error }]}>Clear selection</Text>
                                            </TouchableOpacity>
                                            <View style={styles.sep} />
                                        </>
                                    ) : null}
                                    ListEmptyComponent={
                                        <Text style={styles.empty}>All members have already been assigned as winners.</Text>
                                    }
                                    renderItem={({ item }) => {
                                        const selected = currentPick === String(item._id);
                                        return (
                                            <TouchableOpacity
                                                style={styles.pickerRow}
                                                onPress={() => {
                                                    updateRow(pickerMonth, { selectedWinner: String(item._id) });
                                                    setPickerMonth(null);
                                                }}
                                            >
                                                <Text style={styles.pickerName}>{item.name || '(no name)'}</Text>
                                                <Text style={styles.pickerPhone}>+91 {item.phone}</Text>
                                                {selected && <Ionicons name="checkmark" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                            );
                        })()}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Save-warning modal — only shown when one or more rows override the group Winner EMI */}
            <Modal visible={!!warn} transparent animationType="fade" onRequestClose={() => setWarn(null)}>
                <View style={styles.warnOverlay}>
                    {warn ? (
                        <View style={styles.warnBox}>
                            <View style={styles.warnIconWrap}>
                                <Ionicons name="alert-circle-outline" size={30} color={colors.warning} />
                            </View>
                            <Text style={styles.warnTitle}>Winner EMI overrides</Text>
                            <Text style={styles.warnSub}>
                                Group default is{'  '}
                                <Text style={styles.warnEmph}>₹{(warn.groupWinnerEmi || 0).toLocaleString('en-IN')}</Text>.
                                {'\n'}{warn.divergent.length} month{warn.divergent.length === 1 ? '' : 's'} will use a different amount:
                            </Text>

                            <View style={styles.warnList}>
                                {warn.divergent.slice(0, 4).map((d, i) => (
                                    <View key={d.month} style={[styles.warnRow, i > 0 && styles.warnRowDivider]}>
                                        <Text style={styles.warnRowMonth}>{d.monthName}</Text>
                                        <Text style={styles.warnRowAmt}>₹{d.winnerEMI.toLocaleString('en-IN')}</Text>
                                    </View>
                                ))}
                                {warn.divergent.length > 4 ? (
                                    <Text style={styles.warnMore}>… and {warn.divergent.length - 4} more</Text>
                                ) : null}
                            </View>

                            <TouchableOpacity
                                style={[styles.warnConfirmBtn, saving && { opacity: 0.6 }]}
                                onPress={() => persistConfig(warn.payload)}
                                disabled={saving}
                                activeOpacity={0.85}
                            >
                                {saving
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.warnConfirmTxt}>Save with overrides</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.warnCancelBtn} onPress={() => setWarn(null)} disabled={saving}>
                                <Text style={styles.warnCancelTxt}>Review changes</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </Modal>

            {/* Instructions modal — opened from the (i) icon on the summary card */}
            <Modal visible={showInfo} transparent animationType="fade" onRequestClose={() => setShowInfo(false)}>
                <View style={styles.infoOverlay}>
                    <View style={styles.infoBox}>
                        <View style={styles.infoHeader}>
                            <View style={styles.infoIconWrap}>
                                <Ionicons name="information-circle-outline" size={22} color={colors.primary} />
                            </View>
                            <Text style={styles.infoTitle}>How POT Config works</Text>
                            <TouchableOpacity onPress={() => setShowInfo(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.infoLine}>
                            <Ionicons name="ellipse" size={6} color={colors.primary} style={styles.infoBullet} />
                            <Text style={styles.infoText}>Select a <Text style={styles.infoBold}>POT winner</Text> for each month.</Text>
                        </View>
                        <View style={styles.infoLine}>
                            <Ionicons name="ellipse" size={6} color={colors.primary} style={styles.infoBullet} />
                            <Text style={styles.infoText}>
                                <Text style={styles.infoBold}>Winner EMI</Text> defaults to the group value. Editing a row prompts for confirmation on save.
                            </Text>
                        </View>
                        <View style={styles.infoLine}>
                            <Ionicons name="ellipse" size={6} color={colors.primary} style={styles.infoBullet} />
                            <Text style={styles.infoText}>
                                <Text style={styles.infoBold}>Reducing EMI</Text> can be set per month for non-winners.
                            </Text>
                        </View>
                        <View style={styles.infoLine}>
                            <Ionicons name="ellipse" size={6} color={colors.primary} style={styles.infoBullet} />
                            <Text style={styles.infoText}>
                                <Text style={styles.infoBold}>Past months are locked</Text> once their draw has been executed.
                            </Text>
                        </View>
                        <View style={styles.infoLine}>
                            <Ionicons name="ellipse" size={6} color={colors.primary} style={styles.infoBullet} />
                            <Text style={styles.infoText}>
                                The <Text style={styles.infoBold}>current month</Text> is highlighted so you can find it at a glance.
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.infoOkBtn} onPress={() => setShowInfo(false)} activeOpacity={0.85}>
                            <Text style={styles.infoOkTxt}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Toast {...toast} />
        </View>
    );
}

function SummaryTile({ label, value, accent, colors, styles }) {
    return (
        <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={[styles.summaryValue, accent && { color: colors.primary }]} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:   { flex: 1, backgroundColor: colors.background },
        center: { alignItems: 'center', justifyContent: 'center' },

        // Header
        header: {
            paddingTop: 56, paddingHorizontal: 16, paddingBottom: 10,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            backgroundColor: colors.background,
        },
        backBtn:   { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
        backTxt:   { fontSize: 13, fontFamily: F.medium, color: colors.text, marginLeft: 2 },
        title:     { fontSize: 20, fontFamily: F.bold, color: colors.text, marginTop: 4 },
        groupName: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginTop: 2 },

        // Group Summary Card
        summaryCard: {
            marginHorizontal: 16, marginTop: 12, marginBottom: 8,
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12, borderWidth: 1, borderColor: colors.border,
            padding: 12, position: 'relative',
        },
        summaryInfoBtn: {
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            width: 28, height: 28, borderRadius: 14,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.background,
            borderWidth: 1, borderColor: colors.primary,
        },
        summaryRow: {
            flexDirection: 'row',
        },
        summaryTile: {
            flex: 1, paddingVertical: 8, paddingHorizontal: 4,
        },
        summaryLabel: {
            fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 4,
        },
        summaryValue: {
            fontSize: 15, fontFamily: F.semibold, color: colors.text,
        },

        // Table
        headerRow: {
            backgroundColor: colors.backgroundTertiary,
            borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        row: {
            flexDirection: 'row', alignItems: 'center',
            borderBottomWidth: 1, borderBottomColor: colors.border,
            paddingVertical: 8, paddingHorizontal: 8,
        },
        lockedRow:   { opacity: 0.6, backgroundColor: colors.backgroundTertiary },
        currentRow:  {
            backgroundColor: colors.primaryLight,
            borderLeftWidth: 3, borderLeftColor: colors.primary,
        },
        cellHeader:  { fontSize: 11, fontFamily: F.semibold, color: colors.textSecondary, paddingHorizontal: 4 },
        cell:        { fontSize: 12, fontFamily: F.regular,  color: colors.text,          paddingHorizontal: 4 },

        // Picker button (winner cell)
        pickerBtn: {
            height: 40, paddingHorizontal: 8, marginRight: 8,
            borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: colors.background,
        },
        pickerTxt: { fontSize: 12, fontFamily: F.regular, color: colors.text, flex: 1 },

        // Inputs
        input: {
            height: 40, paddingHorizontal: 8, marginRight: 8,
            borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            fontSize: 13, fontFamily: F.regular, color: colors.text,
            backgroundColor: colors.background,
        },
        inputLocked:    { color: colors.textTertiary, backgroundColor: colors.backgroundTertiary },

        body: { maxHeight: '100%' },

        // Footer
        footer: {
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: 16, backgroundColor: colors.background,
            borderTopWidth: 1, borderTopColor: colors.border,
        },
        saveBtn: {
            height: 56, borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
        },
        saveBtnText: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },

        // Picker modal
        overlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center', paddingHorizontal: 32,
        },
        pickerSheet: {
            backgroundColor: colors.background,
            borderRadius: 14, paddingVertical: 16, paddingHorizontal: 8,
            maxHeight: '70%',
        },
        pickerTitle: {
            fontSize: 14, fontFamily: F.semibold, color: colors.text,
            paddingHorizontal: 12, paddingBottom: 12,
        },
        pickerRow: {
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 12, paddingVertical: 12,
        },
        pickerName:  { fontSize: 14, fontFamily: F.medium,  color: colors.text },
        pickerPhone: { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginLeft: 8 },
        sep:         { height: 1, backgroundColor: colors.border, marginHorizontal: 12 },
        empty:       { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', padding: 20 },

        // Save-warning modal
        warnOverlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center', alignItems: 'center', padding: 24,
        },
        warnBox: {
            width: '100%', maxWidth: 400,
            backgroundColor: colors.background,
            borderRadius: 18, padding: 24,
            borderWidth: 1, borderColor: colors.border,
        },
        warnIconWrap: {
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: colors.warningLight,
            alignItems: 'center', justifyContent: 'center',
            alignSelf: 'center', marginBottom: 14,
        },
        warnTitle: {
            fontSize: 17, fontFamily: F.bold, color: colors.text,
            textAlign: 'center', marginBottom: 8,
        },
        warnSub: {
            fontSize: 13, fontFamily: F.regular, color: colors.textSecondary,
            textAlign: 'center', lineHeight: 20, marginBottom: 14,
        },
        warnEmph: { fontFamily: F.semibold, color: colors.text },
        warnList: {
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 10, borderWidth: 1, borderColor: colors.border,
            paddingHorizontal: 12, paddingVertical: 4, marginBottom: 18,
        },
        warnRow: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 10,
        },
        warnRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
        warnRowMonth:   { fontSize: 13, fontFamily: F.medium,  color: colors.text },
        warnRowAmt:     { fontSize: 13, fontFamily: F.semibold, color: colors.primary },
        warnMore: {
            fontSize: 12, fontFamily: F.regular, color: colors.textSecondary,
            textAlign: 'center', paddingTop: 6, paddingBottom: 4,
        },
        warnConfirmBtn: {
            height: 50, borderRadius: 12, backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
        },
        warnConfirmTxt: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
        warnCancelBtn:  { marginTop: 10, paddingVertical: 10, alignItems: 'center' },
        warnCancelTxt:  { fontSize: 13, fontFamily: F.medium, color: colors.textSecondary },

        // Instructions modal
        infoOverlay: {
            flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center', alignItems: 'center', padding: 24,
        },
        infoBox: {
            width: '100%', maxWidth: 420,
            backgroundColor: colors.background,
            borderRadius: 18, padding: 20,
            borderWidth: 1, borderColor: colors.border,
        },
        infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
        infoIconWrap: {
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.primaryLight,
            alignItems: 'center', justifyContent: 'center', marginRight: 10,
            borderWidth: 1, borderColor: colors.primary,
        },
        infoTitle:  { fontSize: 16, fontFamily: F.bold, color: colors.text, flex: 1 },
        infoLine:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
        infoBullet: { marginTop: 7, marginRight: 8 },
        infoText:   { flex: 1, fontSize: 13, fontFamily: F.regular, color: colors.text, lineHeight: 19 },
        infoBold:   { fontFamily: F.semibold, color: colors.text },
        infoOkBtn: {
            height: 46, borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: 'center', justifyContent: 'center',
            marginTop: 8,
        },
        infoOkTxt: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
    });
}
