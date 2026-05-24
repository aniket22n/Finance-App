import React, { useMemo, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { sendOtp } from '../services/api';
import { apiErrMsg } from '../utils/error';
import { F } from '../theme';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

export default function ForgotPINScreen({ navigation }) {
    const { colors } = useTheme();
    const [phone, setPhone] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [loading, setLoading] = useState(false);
    const [phoneFocused, phoneFocusProps] = useInputFocus();

    const phoneValid = phone.length === 10;

    const handleSend = async () => {
        setPhoneError('');
        if (!phoneValid) {
            setPhoneError('Enter a valid 10-digit phone number');
            return;
        }
        setLoading(true);
        try {
            await sendOtp(phone);
            navigation.navigate('ResetPINOTP', { phone });
        } catch (err) {
            setPhoneError(apiErrMsg(err, 'Could not send OTP'));
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
                <Text style={styles.title}>Forgot PIN?</Text>
                <Text style={styles.subtitle}>We'll help you reset your PIN</Text>

                <View style={[styles.phoneRow, focusBorder(colors, phoneFocused), phoneError && styles.inputError]}>
                    <Text style={styles.prefixText}>+91</Text>
                    <View style={styles.prefixDivider} />
                    <TextInput
                        style={[styles.phoneInput, webOutlineReset]}
                        value={phone}
                        onChangeText={t => { setPhone(t.replace(/\D/g, '').slice(0, 10)); if (phoneError) setPhoneError(''); }}
                        placeholder="9876543210"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="phone-pad"
                        maxLength={10}
                        returnKeyType="done"
                        onSubmitEditing={handleSend}
                        {...phoneFocusProps}
                    />
                </View>

                {phoneError ? (
                    <View style={styles.errorRow}>
                        <Ionicons name="alert-circle" size={13} color={colors.error} />
                        <Text style={styles.errorText}>{phoneError}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={[styles.btnLarge, !phoneValid && styles.btnDisabled]}
                    onPress={handleSend}
                    disabled={loading || !phoneValid}
                    activeOpacity={0.85}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container:     { flex: 1, backgroundColor: colors.background },
        headerRow:     { paddingTop: 60, paddingHorizontal: 16, height: 100, justifyContent: 'center' },
        backBtn:       { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
        body:          { paddingHorizontal: 24 },
        title:         { fontSize: 20, fontFamily: F.bold, color: colors.text, marginBottom: 6 },
        subtitle:      { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 24 },
        phoneRow: {
            flexDirection: 'row', alignItems: 'center', height: 56, borderWidth: 1,
            borderColor: colors.border, borderRadius: 10, backgroundColor: colors.backgroundSecondary,
        },
        prefixText:    { fontSize: 15, fontFamily: F.semibold, color: colors.primary, paddingHorizontal: 16 },
        prefixDivider: { width: 1, height: 24, backgroundColor: colors.border },
        phoneInput:    { flex: 1, height: 56, paddingHorizontal: 16, fontSize: 15, fontFamily: F.regular, color: colors.text },
        inputError:    { borderColor: colors.error },
        errorRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.errorLight, borderRadius: 8, borderWidth: 1, borderColor: colors.error },
        errorText:     { fontSize: 12, fontFamily: F.medium, color: colors.error, flex: 1 },
        btnLarge: {
            height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary, elevation: 4, marginTop: 24,
        },
        btnDisabled: { backgroundColor: colors.textTertiary, elevation: 0 },
        btnText:     { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
    });
}
