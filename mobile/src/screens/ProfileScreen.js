import React, { useMemo, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet,
    TextInput, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile } from '../services/api';
import { F } from '../theme';
import { PRIMARY_COLORS, AVAILABLE_THEMES } from '../theme/colors';
import Toast, { useToast } from '../components/Toast';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

function MenuItem({ icon, label, onPress, danger, colors }) {
    const styles = useMemo(() => makeStyles(colors), [colors]);
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
            <Ionicons name={icon} size={18} color={danger ? colors.error : colors.text} style={{ marginRight: 12 }} />
            <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
    );
}

export default function ProfileScreen({ navigation }) {
    const { user, updateUser, logout } = useAuth();
    const { colors, isDark, setIsDark, primaryTheme, setPrimaryTheme } = useTheme();
    const [showEdit, setShowEdit] = useState(false);
    // Prefer firstName/lastName; fall back to splitting legacy `name` so first edit pre-fills sensibly.
    const splitLegacyName = (n) => {
        const parts = String(n || '').trim().split(/\s+/);
        return { first: parts[0] || '', last: parts.slice(1).join(' ') };
    };
    const legacy = splitLegacyName(user?.name);
    const [firstName, setFirstName] = useState(user?.firstName || legacy.first);
    const [lastName,  setLastName]  = useState(user?.lastName  || legacy.last);
    const [email, setEmail] = useState(user?.email || '');
    const [saving, setSaving] = useState(false);
    const { toast, show } = useToast();
    const [firstFocused, firstFocusProps] = useInputFocus();
    const [lastFocused, lastFocusProps]   = useInputFocus();
    const [emailFocused, emailFocusProps] = useInputFocus();

    const isAdmin = user?.role === 'admin';
    const initials = (user?.name || user?.phone || 'U').charAt(0).toUpperCase();

    const handleSave = async () => {
        if (!firstName.trim()) { show('First name is required', 'warning'); return; }
        if (!lastName.trim())  { show('Last name is required',  'warning'); return; }
        setSaving(true);
        try {
            const res = await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), email });
            updateUser(res.data.user);
            setShowEdit(false);
            show('Profile updated');
        } catch (err) {
            show(err.response?.data?.error || 'Update failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handlePickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
            try {
                const res = await updateProfile({ avatar: `data:image/jpeg;base64,${result.assets[0].base64}` });
                updateUser(res.data.user);
                show('Avatar updated');
            } catch {
                show('Failed to update avatar', 'error');
            }
        }
    };

    const [confirmLogout, setConfirmLogout] = React.useState(false);

    const handleLogout = () => setConfirmLogout(true);

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <View style={styles.root}>
            <View style={styles.headerBar}>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 90 }}>
                {/* Gradient Profile Card */}
                <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.profileCard}
                >
                    <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarInitial}>{initials}</Text>
                        </View>
                    </TouchableOpacity>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{user?.name || 'Set your name'}</Text>
                        <Text style={styles.profilePhone}>+91 {user?.phone}</Text>
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>{user?.role?.toUpperCase()}</Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* ACCOUNT section */}
                <Text style={styles.sectionTitle}>ACCOUNT</Text>
                <View style={styles.menuCard}>
                    <MenuItem
                        icon="create-outline"
                        label="Edit Profile"
                        onPress={() => {
                            const lg = splitLegacyName(user?.name);
                            setFirstName(user?.firstName || lg.first);
                            setLastName(user?.lastName  || lg.last);
                            setEmail(user?.email || '');
                            setShowEdit(true);
                        }}
                        colors={colors}
                    />
                    <View style={styles.menuDivider} />
                    <MenuItem
                        icon="document-text-outline"
                        label="Privacy Policy"
                        onPress={() => Alert.alert('Privacy Policy', 'Available at emigroup.app/privacy')}
                        colors={colors}
                    />
                </View>

                {/* THEME */}
                <Text style={styles.sectionTitle}>APPEARANCE</Text>
                <View style={styles.menuCard}>
                    {/* Dark / Light Toggle */}
                    <View style={styles.themeRow}>
                        <View style={styles.themeRowLeft}>
                            <Ionicons
                                name={isDark ? 'moon' : 'sunny'}
                                size={18}
                                color={isDark ? colors.primary : colors.warning}
                                style={{ marginRight: 12 }}
                            />
                            <Text style={styles.themeRowLabel}>
                                {isDark ? 'Dark Mode' : 'Light Mode'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.switchTrack, isDark && styles.switchTrackOn]}
                            onPress={() => setIsDark(!isDark)}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.switchThumb, isDark && styles.switchThumbOn]} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.menuDivider} />

                    {/* Primary Color Picker */}
                    <View style={styles.colorSection}>
                        <Text style={styles.colorSectionLabel}>Primary Color</Text>
                        <View style={styles.colorSwatches}>
                            {Object.entries(AVAILABLE_THEMES).map(([key, label]) => {
                                const swatch = PRIMARY_COLORS[key]?.primary;
                                const selected = primaryTheme === key;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => setPrimaryTheme(key)}
                                        activeOpacity={0.8}
                                        style={[
                                            styles.swatch,
                                            { backgroundColor: swatch },
                                            selected && { borderColor: colors.text, borderWidth: 3 },
                                        ]}
                                    >
                                        {selected && (
                                            <Ionicons name="checkmark" size={20} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* DANGER ZONE */}
                <Text style={styles.sectionTitle}>DANGER ZONE</Text>
                <View style={styles.menuCard}>
                    <MenuItem
                        icon="log-out-outline"
                        label="Logout"
                        onPress={handleLogout}
                        danger
                        colors={colors}
                    />
                </View>

                <Text style={styles.version}>EMI Group v1.0.0</Text>
            </ScrollView>

            {/* Edit Profile Modal */}
            <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
                <View style={styles.overlay}>
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setShowEdit(false)}>
                                <Ionicons name="close" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>First Name</Text>
                            <TextInput
                                style={[styles.input, webOutlineReset, focusBorder(colors, firstFocused)]}
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholder="First name"
                                placeholderTextColor={colors.textSecondary}
                                autoCapitalize="words"
                                autoFocus
                                {...firstFocusProps}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>Last Name</Text>
                            <TextInput
                                style={[styles.input, webOutlineReset, focusBorder(colors, lastFocused)]}
                                value={lastName}
                                onChangeText={setLastName}
                                placeholder="Last name"
                                placeholderTextColor={colors.textSecondary}
                                autoCapitalize="words"
                                {...lastFocusProps}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>Email</Text>
                            <TextInput
                                style={[styles.input, webOutlineReset, focusBorder(colors, emailFocused)]}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="your@email.com"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                {...emailFocusProps}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>Phone (cannot change)</Text>
                            <View style={[styles.input, styles.disabledInput]}>
                                <Text style={styles.disabledText}>{user?.phone}</Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                            activeOpacity={0.85}
                        >
                            {saving
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.saveBtnText}>Save Changes</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Logout Confirm Modal */}
            <Modal visible={confirmLogout} transparent animationType="fade" onRequestClose={() => setConfirmLogout(false)}>
                <View style={styles.overlay}>
                    <View style={styles.confirmSheet}>
                        <Text style={styles.confirmTitle}>Logout</Text>
                        <Text style={styles.confirmBody}>Are you sure you want to logout?</Text>
                        <View style={styles.confirmBtns}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmLogout(false)} activeOpacity={0.8}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.logoutBtn} onPress={() => { setConfirmLogout(false); logout(); }} activeOpacity={0.8}>
                                <Text style={styles.logoutBtnText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        root:        { flex: 1 },
        container:   { flex: 1, backgroundColor: colors.backgroundSecondary },
        headerBar: {
            backgroundColor: colors.background,
            paddingHorizontal: 16,
            paddingTop: 56,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            zIndex: 10,
        },
        headerTitle: { fontSize: 20, fontFamily: F.bold, color: colors.text },
        profileCard: {
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 12,
            padding: 16,
        },
        avatarCircle: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: 'rgba(255,255,255,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarInitial: { fontSize: 20, fontFamily: F.bold, color: '#fff' },
        profileInfo:   { marginLeft: 14, flex: 1 },
        profileName:   { fontSize: 16, fontFamily: F.bold, color: '#fff' },
        profilePhone:  { fontSize: 12, fontFamily: F.regular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
        roleBadge: {
            alignSelf: 'flex-start',
            backgroundColor: colors.success,
            borderRadius: 6,
            paddingHorizontal: 8,
            paddingVertical: 3,
            marginTop: 6,
        },
        roleBadgeText: { fontSize: 11, fontFamily: F.semibold, color: '#fff' },
        sectionTitle: {
            fontSize: 12,
            fontFamily: F.semibold,
            color: colors.textSecondary,
            letterSpacing: 0.8,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: 8,
        },
        menuCard: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
            marginHorizontal: 16,
            padding: 0,
            overflow: 'hidden',
        },
        menuItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: colors.background,
            minHeight: 48,
        },
        menuLabel:    { flex: 1, fontSize: 14, fontFamily: F.regular, color: colors.text },
        menuDivider:  { height: 1, backgroundColor: colors.border, marginLeft: 16 },
        themeRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            minHeight: 48,
        },
        themeRowLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
        themeRowLabel: { fontSize: 14, fontFamily: F.medium, color: colors.text },
        switchTrack: {
            width: 48,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.border,
            padding: 2,
            justifyContent: 'center',
        },
        switchTrackOn: { backgroundColor: colors.primary },
        switchThumb: {
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#fff',
            alignSelf: 'flex-start',
        },
        switchThumbOn: { alignSelf: 'flex-end' },
        colorSection: { paddingHorizontal: 16, paddingVertical: 14 },
        colorSectionLabel: {
            fontSize: 13,
            fontFamily: F.medium,
            color: colors.textSecondary,
            marginBottom: 12,
        },
        colorSwatches: { flexDirection: 'row', justifyContent: 'space-between' },
        swatch: {
            width: 52,
            height: 52,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 0,
            borderColor: 'transparent',
        },
        version:      { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 24 },
        overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 36,
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
        sheetTitle:   { fontSize: 18, fontFamily: F.bold, color: colors.text },
        field:        { marginBottom: 14 },
        fieldLabel:   { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary, marginBottom: 6 },
        input: {
            height: 52,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            fontSize: 14,
            fontFamily: F.regular,
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
        },
        disabledInput: { backgroundColor: colors.backgroundSecondary, justifyContent: 'center' },
        disabledText:  { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },
        saveBtn: {
            height: 56,
            backgroundColor: colors.primary,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
        },
        saveBtnText: { fontSize: 15, fontFamily: F.semibold, color: '#fff' },
        confirmSheet: {
            backgroundColor: colors.background,
            borderRadius: 16,
            padding: 24,
            marginHorizontal: 32,
        },
        confirmTitle: { fontSize: 18, fontFamily: F.bold, color: colors.text, marginBottom: 8 },
        confirmBody:  { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 24 },
        confirmBtns:  { flexDirection: 'row', gap: 12 },
        cancelBtn: {
            flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundSecondary,
        },
        cancelBtnText: { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        logoutBtn: {
            flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.error,
        },
        logoutBtnText: { fontSize: 14, fontFamily: F.semibold, color: '#fff' },
    });
}
