import React, { useMemo, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
    Modal, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getGroups, createGroup, updateGroup, deleteGroup, sendOtp, verifyOtp } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import Toast, { useToast } from '../components/Toast';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

function FormField({ label, value, onChangeText, placeholder, keyboard, prefix, styles, colors }) {
    const [focused, focusProps] = useInputFocus();
    return (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={[styles.inputWrap, focusBorder(colors, focused)]}>
                {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}
                <TextInput
                    style={[styles.input, webOutlineReset, prefix && { paddingLeft: 8 }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType={keyboard}
                    {...focusProps}
                />
            </View>
        </View>
    );
}

const EMPTY_FORM = { name: '', potAmount: '', emiAmount: '', reducedEmi: '', maxMembers: '', dueDay: '' };

export default function AdminGroupsScreen({ navigation }) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [groups, setGroups] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [agreed, setAgreed] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    // OTP-confirm flow for edits
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [otpError, setOtpError] = useState('');
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [pendingEdit, setPendingEdit] = useState(null);   // { groupId, payload }
    const [otpFocused, otpFocusProps] = useInputFocus();

    const { toast, show } = useToast();

    const loadGroups = async () => {
        try {
            const res = await getGroups();
            setGroups(res.data.groups || []);
        } catch (err) {
            console.log('Groups load error:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadGroups(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadGroups();
        setRefreshing(false);
    };

    const openCreate = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setAgreed(false);
        setShowModal(true);
    };

    const openEdit = (group) => {
        setEditTarget(group);
        setForm({
            name: group.name || '',
            potAmount: String(group.potAmount || ''),
            emiAmount: String(group.emiAmount || ''),
            reducedEmi: String(group.reducedEmi || ''),
            maxMembers: String(group.maxMembers || ''),
            dueDay: String(group.dueDay || ''),
        });
        setAgreed(true);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditTarget(null);
    };

    const handleSubmit = async () => {
        const { name, emiAmount, reducedEmi, maxMembers } = form;
        if (!name.trim() || !emiAmount || !maxMembers) {
            Alert.alert('Required', 'Fill in name, EMI amount, and number of members');
            return;
        }
        if (!agreed && !editTarget) {
            Alert.alert('Required', 'Please accept the terms & conditions');
            return;
        }
        const emi = parseFloat(emiAmount);
        const members = parseInt(maxMembers);
        const potEntered = parseFloat(form.potAmount);
        const payload = {
            name: name.trim(),
            emiAmount: emi,
            potAmount: Number.isFinite(potEntered) && potEntered > 0 ? potEntered : emi * members,
            reducedEmi: parseFloat(reducedEmi) || Math.round(emi * 0.5),
            maxMembers: members,
            totalMonths: members,
            dueDay: parseInt(form.dueDay) || 5,
        };

        setSubmitting(true);
        try {
            if (editTarget) {
                // Mid-scheme edits (name, pot amount, EMI) are risky — gate behind OTP.
                await sendOtp(user?.phone);
                setPendingEdit({ groupId: editTarget._id, payload });
                setOtpCode('');
                setOtpError('');
                setShowOtpModal(true);
            } else {
                const res = await createGroup(payload);
                const newId = res?.data?.group?._id;
                show('Group created successfully');
                closeModal();
                await loadGroups();
                if (newId) {
                    // Flow: create → add members → POT config.
                    navigation.navigate('AdminAddMembers', { groupId: newId });
                }
            }
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || (editTarget ? 'Failed to send OTP. Try again.' : 'Failed to save group'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmEdit = async () => {
        if (otpCode.length < 4) {
            setOtpError('Enter the OTP sent to your phone');
            return;
        }
        if (!pendingEdit) return;
        setVerifyingOtp(true);
        setOtpError('');
        try {
            await verifyOtp(user?.phone, otpCode);
            await updateGroup(pendingEdit.groupId, pendingEdit.payload);
            setShowOtpModal(false);
            setPendingEdit(null);
            show('Group updated successfully');
            closeModal();
            await loadGroups();
        } catch (err) {
            const msg = err.response?.data?.error || err.response?.data?.message || '';
            if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('invalid') || err.response?.status === 400) {
                setOtpError('Invalid OTP. Please try again.');
            } else {
                Alert.alert('Error', msg || 'Failed to update group');
                setShowOtpModal(false);
                setPendingEdit(null);
            }
        } finally {
            setVerifyingOtp(false);
        }
    };

    const cancelOtp = () => {
        setShowOtpModal(false);
        setPendingEdit(null);
        setOtpCode('');
        setOtpError('');
    };

    const handleDelete = (group) => {
        Alert.alert(
            'Delete Group',
            `Delete "${group.name}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            await deleteGroup(group._id);
                            setGroups(prev => prev.filter(g => g._id !== group._id));
                            show('Group deleted', 'error');
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || 'Failed to delete');
                        }
                    },
                },
            ]
        );
    };

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const [searchFocused, searchFocusProps] = useInputFocus();

    const filtered = search
        ? groups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()))
        : groups;

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Groups</Text>
                <TouchableOpacity style={styles.createBtn} onPress={openCreate} activeOpacity={0.8}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchWrap, focusBorder(colors, searchFocused)]}>
                <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={[styles.searchInput, webOutlineReset]}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search groups..."
                    placeholderTextColor={colors.textSecondary}
                    {...searchFocusProps}
                />
                {search ? (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* Count */}
            <Text style={styles.countLabel}>ALL GROUPS ({filtered.length})</Text>

            <ScrollView
                style={styles.list}
                contentContainerStyle={{ paddingBottom: 90 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                {loading ? (
                    <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /></View>
                ) : filtered.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyText}>{search ? 'No groups found' : 'No groups yet'}</Text>
                    </View>
                ) : (
                    filtered.map(group => (
                        <TouchableOpacity
                            key={group._id}
                            style={styles.card}
                            onPress={() => navigation.navigate('GroupDetail', { groupId: group._id })}
                            activeOpacity={0.75}
                        >
                            <View style={styles.cardHeader}>
                                <Text style={styles.groupName}>{group.name}</Text>
                                <View style={styles.cardActions}>
                                    <TouchableOpacity
                                        style={[styles.iconBtn, { marginRight: 8 }]}
                                        onPress={() => navigation.navigate('AdminPOTWinnerConfig', { groupId: group._id })}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.iconBtn}
                                        onPress={() => openEdit(group)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <Text style={styles.cardMeta}>
                                👥 {group.members?.length || 0}/{group.maxMembers || '?'} members
                                {(group.currentMonth || 0) > 0
                                    ? ` • Month ${group.currentMonth}/${group.totalMonths}`
                                    : ` • ${group.status || 'pending'}`}
                            </Text>
                            <Text style={styles.cardDetail}>
                                ₹{group.emiAmount?.toLocaleString()}/month • Due day {group.dueDay || 5}
                            </Text>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Create / Edit Modal */}
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
                <View style={styles.overlay}>
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{editTarget ? 'Edit Group' : 'Create Group'}</Text>
                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {[
                                { key: 'name',       label: 'Group Name',                       placeholder: 'e.g. Alpha Chit Fund', keyboard: 'default' },
                                { key: 'potAmount',  label: 'POT amount',                       placeholder: '500000',               keyboard: 'numeric', prefix: '₹' },
                                { key: 'emiAmount',  label: 'EMI (POT winners)',                placeholder: '5000',                 keyboard: 'numeric', prefix: '₹' },
                                { key: 'reducedEmi', label: 'Reducing EMI (Non winners)',       placeholder: '2500',                 keyboard: 'numeric', prefix: '₹' },
                                { key: 'maxMembers', label: 'Number of members',                placeholder: '20',                   keyboard: 'numeric' },
                                { key: 'dueDay',     label: 'Due date (Day of month)',          placeholder: '5',                    keyboard: 'numeric' },
                            ].map(({ key, label, placeholder, keyboard, prefix }) => (
                                <FormField
                                    key={key}
                                    label={label}
                                    value={form[key]}
                                    onChangeText={v => setField(key, v)}
                                    placeholder={placeholder}
                                    keyboard={keyboard}
                                    prefix={prefix}
                                    styles={styles}
                                    colors={colors}
                                />
                            ))}

                            {!editTarget && (
                                <TouchableOpacity
                                    style={styles.checkRow}
                                    onPress={() => setAgreed(v => !v)}
                                    activeOpacity={0.75}
                                >
                                    <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
                                        {agreed && <Ionicons name="checkmark" size={12} color="#fff" />}
                                    </View>
                                    <Text style={styles.checkText}>
                                        I agree to{' '}
                                        <Text style={{ color: colors.primary }}>terms & conditions</Text>
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {editTarget && (
                                <View style={styles.noticeBox}>
                                    <Ionicons name="shield-checkmark-outline" size={14} color={colors.primary} style={{ marginRight: 6 }} />
                                    <Text style={styles.noticeText}>
                                        Edits to an active group require OTP confirmation.
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                {submitting
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.submitText}>{editTarget ? 'Continue with OTP' : 'Create Group'}</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.cancelLink} onPress={closeModal}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* OTP Confirm Modal (edit only) */}
            <Modal visible={showOtpModal} transparent animationType="fade" onRequestClose={cancelOtp}>
                <View style={styles.otpOverlay}>
                    <View style={styles.otpBox}>
                        <View style={styles.otpIconWrap}>
                            <Ionicons name="shield-checkmark-outline" size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.otpTitle}>Confirm Edit</Text>
                        <Text style={styles.otpSub}>
                            Enter the OTP sent to{'\n'}+91 {user?.phone} to save your changes.
                        </Text>

                        <TextInput
                            style={[styles.otpInput, webOutlineReset, focusBorder(colors, otpFocused), otpError && styles.otpInputError]}
                            value={otpCode}
                            onChangeText={v => { setOtpCode(v); setOtpError(''); }}
                            placeholder="Enter OTP"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="number-pad"
                            maxLength={6}
                            {...otpFocusProps}
                            autoFocus
                            textAlign="center"
                        />

                        {otpError ? (
                            <View style={styles.otpErrorRow}>
                                <Ionicons name="alert-circle" size={13} color={colors.error} />
                                <Text style={styles.otpErrorText}>{otpError}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.otpConfirmBtn, verifyingOtp && { opacity: 0.6 }]}
                            onPress={handleConfirmEdit}
                            disabled={verifyingOtp}
                            activeOpacity={0.85}
                        >
                            {verifyingOtp
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.otpConfirmText}>Confirm Changes</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.otpCancelBtn} onPress={cancelOtp}>
                            <Text style={styles.otpCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.backgroundSecondary },
        header: {
            backgroundColor: colors.background,
            paddingHorizontal: 16,
            paddingTop: 56,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
        },
        title: { fontSize: 20, fontFamily: F.bold, color: colors.text },
        createBtn: {
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
        },
        searchWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.backgroundSecondary,
            marginHorizontal: 16,
            marginTop: 12,
            borderRadius: 10,
            paddingHorizontal: 14,
            height: 48,
            borderWidth: 1,
            borderColor: colors.border,
        },
        searchInput:  { flex: 1, fontSize: 14, fontFamily: F.regular, color: colors.text },
        countLabel: {
            fontSize: 12,
            fontFamily: F.semibold,
            color: colors.textSecondary,
            letterSpacing: 0.5,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 8,
        },
        list:         { flex: 1, paddingHorizontal: 16 },
        loadingBox:   { paddingTop: 60, alignItems: 'center' },
        emptyCard: {
            height: 200,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.border,
            marginTop: 8,
        },
        emptyText:    { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, marginTop: 12 },
        card: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            marginBottom: 8,
            padding: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
        },
        cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
        groupName:    { fontSize: 14, fontFamily: F.bold, color: colors.text, flex: 1 },
        cardActions:  { flexDirection: 'row', alignItems: 'center' },
        iconBtn: {
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
        },
        cardMeta:     { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 2 },
        cardDetail:   { fontSize: 13, fontFamily: F.regular, color: colors.text },
        overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 36,
            maxHeight: '90%',
        },
        handle: {
            width: 40,
            height: 4,
            backgroundColor: colors.border,
            borderRadius: 2,
            alignSelf: 'center',
            marginBottom: 20,
        },
        sheetHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        sheetTitle:   { fontSize: 20, fontFamily: F.bold, color: colors.text },
        field:        { marginBottom: 12 },
        fieldLabel:   { fontSize: 13, fontFamily: F.medium, color: colors.text, marginBottom: 6 },
        inputWrap: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.backgroundSecondary,
            height: 56,
            paddingHorizontal: 14,
        },
        inputPrefix:  { fontSize: 16, fontFamily: F.semibold, color: colors.primary, marginRight: 2 },
        input:        { flex: 1, fontSize: 14, fontFamily: F.regular, color: colors.text, height: 56 },
        checkRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
        checkbox: {
            width: 20,
            height: 20,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
        },
        checkboxOn:   { backgroundColor: colors.primary, borderColor: colors.primary },
        checkText:    { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, flex: 1 },
        submitBtn: {
            height: 56,
            backgroundColor: colors.primary,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
        },
        submitText:   { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
        cancelLink:   { alignItems: 'center', marginTop: 12, paddingVertical: 10 },
        cancelText:   { fontSize: 14, fontFamily: F.medium, color: colors.textSecondary },

        // Edit-only OTP notice strip
        noticeBox: {
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.primaryLight,
            borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
            marginTop: 8, marginBottom: 4,
            borderWidth: 1, borderColor: colors.primary,
        },
        noticeText: { fontSize: 12, fontFamily: F.medium, color: colors.primaryDark, flex: 1 },

        // OTP modal
        otpOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
        otpBox: {
            width: '100%', backgroundColor: colors.background,
            borderRadius: 20, padding: 28, alignItems: 'center',
        },
        otpIconWrap: {
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        },
        otpTitle:   { fontSize: 18, fontFamily: F.bold, color: colors.text, marginBottom: 8 },
        otpSub:     { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
        otpInput: {
            width: '100%', height: 56, borderRadius: 12, borderWidth: 1,
            borderColor: colors.border, backgroundColor: colors.backgroundSecondary,
            fontSize: 22, fontFamily: F.bold, color: colors.text,
            letterSpacing: 8, textAlign: 'center', marginBottom: 4,
        },
        otpInputError:   { borderColor: colors.error },
        otpErrorRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
        otpErrorText:    { fontSize: 12, fontFamily: F.regular, color: colors.error },
        otpConfirmBtn: {
            width: '100%', height: 52, borderRadius: 12,
            backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12,
        },
        otpConfirmText: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
        otpCancelBtn:   { marginTop: 10, paddingVertical: 10 },
        otpCancelText:  { fontSize: 14, fontFamily: F.medium, color: colors.textSecondary },
    });
}
