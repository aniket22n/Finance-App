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
const COL = { month: 50, name: 90, winner: 130, winnerEmi: 100, otherEmi: 100 };

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

                const init = Array.from({ length: totalMonths }, (_, i) => {
                    const month = i + 1;
                    const prev  = existingByKey.get(month);
                    return {
                        month,
                        monthName:      calculateMonthName(startDate, month),
                        selectedWinner: prev?.winner ? (typeof prev.winner === 'object' ? prev.winner._id : prev.winner) : '',
                        winnerEMI:      prev?.reducedEmi != null ? String(prev.reducedEmi) : String(g.reducedEmi || ''),
                        otherMemberEMI: prev?.emiAmount  != null ? String(prev.emiAmount)  : String(g.emiAmount  || ''),
                        locked:         isLockedMonth(g.currentMonth, month),
                    };
                });
                setRows(init);
            } catch (err) {
                Alert.alert('Error', err?.response?.data?.error || 'Failed to load group');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [groupId]);

    const updateRow = (month, patch) => {
        setRows(prev => prev.map(r => r.month === month ? { ...r, ...patch } : r));
    };

    const handleSave = async () => {
        // Only rows with a winner picked are saved. Unselected rows are skipped.
        const filled = rows.filter(r => !r.locked && r.selectedWinner);
        for (const r of filled) {
            const w = Number(r.winnerEMI);
            const o = Number(r.otherMemberEMI);
            if (!Number.isFinite(w) || w <= 0) {
                Alert.alert('Invalid amount', `Winner EMI for ${r.monthName} must be positive`);
                return;
            }
            if (!Number.isFinite(o) || o <= 0) {
                Alert.alert('Invalid amount', `Other Member EMI for ${r.monthName} must be positive`);
                return;
            }
        }

        if (filled.length === 0) {
            Alert.alert('Nothing to save', 'Select a winner for at least one month.');
            return;
        }

        const payload = filled.map(r => ({
            month:          r.month,
            selectedWinner: r.selectedWinner,
            winnerEMI:      Number(r.winnerEMI),
            otherMemberEMI: Number(r.otherMemberEMI),
        }));

        setSaving(true);
        try {
            await configurePot(groupId, payload);
            show('POT configured successfully');
            setTimeout(() => navigation.replace('GroupDetail', { groupId }), 600);
        } catch (err) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to save POT config');
        } finally {
            setSaving(false);
        }
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

            {/* Instructions */}
            <Text style={styles.instructions}>
                Select winner for each month and set EMI amounts. Past months are locked.
            </Text>

            {/* Table */}
            <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                    {/* Header row */}
                    <View style={[styles.row, styles.headerRow]}>
                        <Text style={[styles.cellHeader, { width: COL.month     }]}>Month</Text>
                        <Text style={[styles.cellHeader, { width: COL.name      }]}>Month Name</Text>
                        <Text style={[styles.cellHeader, { width: COL.winner    }]}>Winner</Text>
                        <Text style={[styles.cellHeader, { width: COL.winnerEmi }]}>Winner EMI</Text>
                        <Text style={[styles.cellHeader, { width: COL.otherEmi  }]}>Other EMI</Text>
                    </View>

                    {/* Data rows */}
                    <ScrollView style={styles.body}>
                        {rows.map((r, idx) => {
                            const alt    = idx % 2 === 1;
                            const locked = r.locked;
                            return (
                                <View
                                    key={r.month}
                                    style={[
                                        styles.row,
                                        { backgroundColor: alt ? colors.backgroundSecondary : colors.background },
                                        locked && styles.lockedRow,
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

                                    {/* Winner EMI input */}
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

            <Toast {...toast} />
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

        instructions: {
            fontSize: 12, fontFamily: F.regular, color: colors.textSecondary,
            paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8,
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
        inputLocked: { color: colors.textTertiary, backgroundColor: colors.backgroundTertiary },

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
    });
}
