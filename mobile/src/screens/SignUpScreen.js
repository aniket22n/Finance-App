import React, { useMemo, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { checkPhone, sendOtp } from '../services/api';
import { apiErrMsg } from '../utils/error';
import { F } from '../theme';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

export default function SignUpScreen({ route, navigation }) {
    const { colors } = useTheme();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState(route?.params?.phone || '');
    const [phoneError, setPhoneError] = useState('');
    const [loading, setLoading] = useState(false);
    const [nameFocused, nameFocusProps] = useInputFocus();
    const [phoneFocused, phoneFocusProps] = useInputFocus();

    const canSubmit = name.trim().length > 0 && phone.length === 10;

    const handleSendOtp = async () => {
        setPhoneError('');
        if (!name.trim()) return Alert.alert('Required', 'Enter your full name');
        if (phone.length !== 10) return Alert.alert('Invalid', 'Enter a valid 10-digit phone number');
        setLoading(true);
        try {
            const checkRes = await checkPhone(phone);
            if (checkRes.data.exists) {
                setPhoneError('This number is already registered. Please log in.');
                return;
            }
            if (checkRes.data.pendingRequest) {
                setPhoneError('Account request already submitted. Please wait for admin approval.');
                return;
            }
            if (checkRes.data.rejectedRequest) {
                setPhoneError('Previous request was rejected. Please contact admin.');
                return;
            }
            await sendOtp(phone);
            navigation.navigate('SignUpOTP', { phone, name: name.trim() });
        } catch (err) {
            Alert.alert('Error', apiErrMsg(err, 'Failed to send OTP'));
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
                    <Text style={styles.subtitle}>Join your EMI group as a member</Text>
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

                    <View style={[styles.phoneRow, focusBorder(colors, phoneFocused), { marginTop: 14 }, phoneError && styles.inputError]}>
                        <Text style={styles.prefixText}>+91</Text>
                        <View style={styles.prefixDivider} />
                        <TextInput
                            style={[styles.phoneInput, webOutlineReset]}
                            value={phone}
                            onChangeText={v => { setPhone(v.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }}
                            placeholder="9876543210"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                            maxLength={10}
                            returnKeyType="done"
                            onSubmitEditing={handleSendOtp}
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
                        style={[styles.btnLarge, !canSubmit && styles.btnDisabled]}
                        onPress={handleSendOtp}
                        disabled={loading || !canSubmit}
                        activeOpacity={0.85}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>Send OTP</Text>}
                    </TouchableOpacity>
                </View>

                <View style={styles.loginRow}>
                    <Text style={styles.loginNote}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.loginLink}>Log in</Text>
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
        topSection:  { alignItems: 'flex-start', marginBottom: 32 },
        title:       { fontSize: 20, fontFamily: F.bold, color: colors.text, marginBottom: 4 },
        subtitle:    { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },
        formSection: { marginBottom: 24 },
        input: {
            height: 56, paddingHorizontal: 16, borderWidth: 1,
            borderColor: colors.border, borderRadius: 10, fontSize: 14,
            fontFamily: F.regular, color: colors.text, backgroundColor: colors.backgroundSecondary,
        },
        phoneRow: {
            flexDirection: 'row', alignItems: 'center', height: 56,
            borderWidth: 1, borderColor: colors.border, borderRadius: 10,
            backgroundColor: colors.backgroundSecondary,
        },
        prefixText:    { fontSize: 15, fontFamily: F.semibold, color: colors.primary, paddingHorizontal: 16 },
        prefixDivider: { width: 1, height: 24, backgroundColor: colors.border },
        phoneInput:    { flex: 1, height: 56, paddingHorizontal: 16, fontSize: 14, fontFamily: F.regular, color: colors.text },
        inputError:    { borderColor: colors.error },
        errorRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
        errorText:     { fontSize: 12, fontFamily: F.medium, color: colors.error, flex: 1 },
        btnLarge: {
            height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary, elevation: 4, marginTop: 20,
        },
        btnDisabled: { backgroundColor: colors.textTertiary, elevation: 0 },
        btnText:     { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
        loginRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
        loginNote:   { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },
        loginLink:   { fontSize: 13, fontFamily: F.semibold, color: colors.primary },
    });
}
