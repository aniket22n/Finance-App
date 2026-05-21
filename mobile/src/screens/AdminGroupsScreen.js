import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
    Modal, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getGroups, createGroup, updateGroup, deleteGroup } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import Toast, { useToast } from '../components/Toast';

const EMPTY_FORM = { name: '', emiAmount: '', reducedEmi: '', maxMembers: '', dueDate: '' };

export default function AdminGroupsScreen({ navigation }) {
    const { colors } = useTheme();
    const [groups, setGroups] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [agreed, setAgreed] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

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
            emiAmount: String(group.emiAmount || ''),
            reducedEmi: String(group.reducedEmi || ''),
            maxMembers: String(group.maxMembers || ''),
            dueDate: String(group.dueDate || ''),
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
        const payload = {
            name: name.trim(),
            emiAmount: emi,
            potAmount: emi * members,
            reducedEmi: parseFloat(reducedEmi) || Math.round(emi * 0.5),
            maxMembers: members,
            totalMonths: members,
            dueDate: parseInt(form.dueDate) || 5,
        };

        setSubmitting(true);
        try {
            if (editTarget) {
                await updateGroup(editTarget._id, payload);
                show('Group updated successfully');
            } else {
                await createGroup(payload);
                show('Group created successfully');
            }
            closeModal();
            await loadGroups();
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to save group');
        } finally {
            setSubmitting(false);
        }
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

    const filtered = search
        ? groups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()))
        : groups;

    const styles = makeStyles(colors);

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
            <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search groups..."
                    placeholderTextColor={colors.textSecondary}
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
                                        style={styles.iconBtn}
                                        onPress={() => openEdit(group)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <Text style={styles.cardMeta}>
                                👥 {group.members?.length || 0} members • {group.currentMonth || 0}% paid
                            </Text>
                            <Text style={styles.cardDetail}>
                                ₹{group.emiAmount?.toLocaleString()}/month • Due day {group.dueDate || 5}
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
                                { key: 'name',       label: 'Group Name',             placeholder: 'e.g. Alpha Chit Fund',   keyboard: 'default' },
                                { key: 'emiAmount',  label: 'Amount per month (₹)',    placeholder: '5000',                   keyboard: 'numeric' },
                                { key: 'reducedEmi', label: "Winner's Reduced EMI (₹)", placeholder: '2500',                  keyboard: 'numeric' },
                                { key: 'maxMembers', label: 'Number of members',       placeholder: '20',                     keyboard: 'numeric' },
                                { key: 'dueDate',    label: 'Due date (day of month)',  placeholder: '5',                     keyboard: 'numeric' },
                            ].map(({ key, label, placeholder, keyboard }) => (
                                <View key={key} style={styles.field}>
                                    <Text style={styles.fieldLabel}>{label}</Text>
                                    <View style={styles.inputWrap}>
                                        {key === 'emiAmount' || key === 'reducedEmi' ? (
                                            <Text style={styles.inputPrefix}>₹</Text>
                                        ) : null}
                                        <TextInput
                                            style={[styles.input, (key === 'emiAmount' || key === 'reducedEmi') && { paddingLeft: 8 }]}
                                            value={form[key]}
                                            onChangeText={v => setField(key, v)}
                                            placeholder={placeholder}
                                            placeholderTextColor={colors.textSecondary}
                                            keyboardType={keyboard}
                                        />
                                    </View>
                                </View>
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

                            <TouchableOpacity
                                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.85}
                            >
                                {submitting
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.submitText}>{editTarget ? 'Save Changes' : 'Create Group'}</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.cancelLink} onPress={closeModal}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </ScrollView>
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
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
        },
        title: { fontSize: 24, fontFamily: F.semibold, color: colors.text },
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
            backgroundColor: colors.background,
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
            backgroundColor: colors.background,
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
    });
}
