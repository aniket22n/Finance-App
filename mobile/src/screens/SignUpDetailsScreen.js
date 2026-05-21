import React, { useMemo, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signupWithPassword } from '../services/api';
import { F } from '../theme';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

export default function SignUpDetailsScreen({ route, navigation }) {
    const { phone, otp } = route.params || {};
    const { login } = useAuth();
    const { colors } = useTheme();
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [nameFocused, nameFocusProps] = useInputFocus();
    const [pwFocused, pwFocusProps] = useInputFocus();
    const [confirmFocused, confirmFocusProps] = useInputFocus();

    const canSubmit = name.trim().length > 0 && password.length >= 6 && confirm === password && agreed;

    const handleCreate = async () => {
        if (!name.trim()) return Alert.alert('Required', 'Enter your full name');
        if (password.length < 6) return Alert.alert('Invalid', 'Password must be at least 6 characters');
        if (confirm !== password) return Alert.alert('Mismatch', 'Passwords do not match');
        if (!agreed) return Alert.alert('Required', 'Please accept the Terms & Privacy Policy');

        setLoading(true);
        try {
            const res = await signupWithPassword({
                phone,
                otp,
                name: name.trim(),
                password,
            });
            await login(res.data.token, res.data.user);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to create account');
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
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.topSection}>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Almost there — fill in your details</Text>
                </View>

                <View style={styles.formSection}>
                    <TextInput
                        style={[styles.input, webOutlineReset, focusBorder(colors, nameFocused)]}
                        value={name}
                        onChangeText={setName}
                        placeholder="Full Name"
                        placeholderTextColor={colors.textSecondary}
                        returnKeyType="next"
                        {...nameFocusProps}
                    />

                    <View style={[styles.passwordRow, focusBorder(colors, pwFocused), { marginTop: 14 }]}>
                        <TextInput
                            style={[styles.passwordInput, webOutlineReset]}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Password"
                            placeholderTextColor={colors.textSecondary}
                            secureTextEntry={!showPassword}
                            returnKeyType="next"
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
                            onSubmitEditing={handleCreate}
                            {...confirmFocusProps}
                        />
                        <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                            <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setAgreed(v => !v)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                            {agreed && <Ionicons name="checkmark" size={12} color="#fff" />}
                        </View>
                        <Text style={styles.checkboxText}>
                            I agree to the{' '}
                            <Text style={{ color: colors.primary }}>Terms & Privacy Policy</Text>
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btnLarge, !canSubmit && styles.btnDisabled]}
                        onPress={handleCreate}
                        disabled={loading || !canSubmit}
                        activeOpacity={0.85}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>Create Account</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container:   { flex: 1, backgroundColor: colors.background },
        scroll:      { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 90 },
        backRow:     { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginBottom: 16 },
        topSection:  { alignItems: 'flex-start', marginBottom: 28 },
        title:       { fontSize: 20, fontFamily: F.bold, color: colors.text, marginBottom: 4 },
        subtitle:    { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },
        formSection: { marginBottom: 24 },
        input: {
            height: 56,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            fontSize: 14,
            fontFamily: F.regular,
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
        },
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
        eyeBtn:          { paddingHorizontal: 14, height: 56, alignItems: 'center', justifyContent: 'center' },
        checkboxRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 4 },
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
        checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
        checkboxText:    { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, flex: 1 },
        btnLarge: {
            height: 56,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            elevation: 4,
            marginTop: 20,
        },
        btnDisabled:     { backgroundColor: colors.textTertiary, elevation: 0 },
        btnText:         { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
    });
}
