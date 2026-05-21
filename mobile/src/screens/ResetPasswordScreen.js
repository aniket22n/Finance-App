import React, { useMemo, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { resetPassword } from '../services/api';
import { F } from '../theme';
import Toast, { useToast } from '../components/Toast';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

export default function ResetPasswordScreen({ route, navigation }) {
    const { colors } = useTheme();
    const { phone, otp } = route.params || {};
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast, show } = useToast();
    const [pwFocused, pwFocusProps] = useInputFocus();
    const [confirmFocused, confirmFocusProps] = useInputFocus();

    const canSubmit = newPassword.length >= 6 && confirm === newPassword;

    const handleSubmit = async () => {
        if (newPassword.length < 6) return Alert.alert('Invalid', 'Password must be at least 6 characters');
        if (confirm !== newPassword) return Alert.alert('Mismatch', 'Passwords do not match');

        setLoading(true);
        try {
            await resetPassword({ phone, otp, newPassword });
            show('Password updated successfully');
            setTimeout(() => {
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }, 800);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Could not reset password');
        } finally {
            setLoading(false);
        }
    };

    const styles = useMemo(() => makeStyles(colors), [colors]);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.body}>
                <Text style={styles.title}>Set New Password</Text>
                <Text style={styles.subtitle}>Choose a strong password (min 6 characters)</Text>

                <View style={[styles.passwordRow, focusBorder(colors, pwFocused)]}>
                    <TextInput
                        style={[styles.passwordInput, webOutlineReset]}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="New Password"
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry={!showPassword}
                        {...pwFocusProps}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.passwordRow, focusBorder(colors, confirmFocused), { marginTop: 14 }]}>
                    <TextInput
                        style={[styles.passwordInput, webOutlineReset]}
                        value={confirm}
                        onChangeText={setConfirm}
                        placeholder="Confirm Password"
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry={!showConfirm}
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
                        {...confirmFocusProps}
                    />
                    <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                        <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.btnLarge, !canSubmit && styles.btnDisabled]}
                    onPress={handleSubmit}
                    disabled={loading || !canSubmit}
                    activeOpacity={0.85}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>Update Password</Text>}
                </TouchableOpacity>
            </View>

            <Toast {...toast} />
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        headerRow: { paddingTop: 60, paddingHorizontal: 16, height: 100, justifyContent: 'center' },
        backBtn:   { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
        body:      { paddingHorizontal: 24 },
        title:     { fontSize: 20, fontFamily: F.bold, color: colors.text, marginBottom: 6 },
        subtitle:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 24 },
        label:     { fontSize: 13, fontFamily: F.medium, color: colors.text, marginBottom: 8, marginTop: 14 },
        passwordRow: {
            flexDirection: 'row',
            alignItems: 'center',
            height: 56,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.backgroundSecondary,
        },
        passwordInput: {
            flex: 1,
            height: 56,
            paddingHorizontal: 16,
            fontSize: 14,
            fontFamily: F.regular,
            color: colors.text,
        },
        eyeBtn: { paddingHorizontal: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
        btnLarge: {
            height: 56,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
            marginTop: 24,
        },
        btnDisabled: { backgroundColor: colors.textTertiary, shadowOpacity: 0, elevation: 0 },
        btnText:     { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
    });
}
