import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { checkPhone, sendOtp, verifyOtp, updateProfile } from '../services/api';
import { F } from '../theme';

export default function SignUpScreen({ route, navigation }) {
    const { login } = useAuth();
    const { colors } = useTheme();
    const [phone, setPhone] = useState(route?.params?.phone || '');
    const [name, setName] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [phoneError, setPhoneError] = useState('');
    const [step, setStep] = useState('details'); // 'details' | 'otp'
    const [loading, setLoading] = useState(false);
    const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
    const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

    const otp = otpDigits.join('');

    const handleOtpChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...otpDigits];
        next[index] = value.slice(-1);
        setOtpDigits(next);
        if (value && index < 3) otpRefs[index + 1].current?.focus();
    };

    const handleOtpKey = (index, key) => {
        if (key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs[index - 1].current?.focus();
        }
    };

    const handleSendOtp = async () => {
        setPhoneError('');
        if (!name.trim()) {
            Alert.alert('Required', 'Enter your full name');
            return;
        }
        if (phone.length < 10) {
            Alert.alert('Invalid', 'Enter a valid 10-digit phone number');
            return;
        }
        if (!agreed) {
            Alert.alert('Required', 'Please accept the Terms & Privacy Policy');
            return;
        }
        setLoading(true);
        try {
            const checkRes = await checkPhone(phone);
            if (checkRes.data.exists) {
                setPhoneError('This number is already registered. Please log in.');
                return;
            }
            await sendOtp(phone);
            setStep('otp');
            setTimeout(() => otpRefs[0].current?.focus(), 300);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (otp.length < 4) {
            Alert.alert('Invalid', 'Enter the 4-digit OTP');
            return;
        }
        setLoading(true);
        try {
            const res = await verifyOtp(phone, otp);
            await SecureStore.setItemAsync('authToken', res.data.token);
            if (name.trim()) {
                await updateProfile({ name: name.trim() }).catch(() => {});
            }
            await login(res.data.token, { ...res.data.user, name: name.trim() || res.data.user.name });
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const canSend = name.trim().length > 0 && phone.length === 10 && agreed;
    const styles = makeStyles(colors);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={20} color={colors.primary} />
                    <Text style={styles.backText}>  Back to Login</Text>
                </TouchableOpacity>

                <View style={styles.topSection}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="person-add" size={26} color={colors.primary} />
                    </View>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join your EMI group as a member</Text>
                </View>

                {step === 'details' ? (
                    <View style={styles.formSection}>
                        <Text style={styles.fieldLabel}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Your full name"
                            placeholderTextColor={colors.textSecondary}
                            autoFocus
                            returnKeyType="next"
                        />

                        <Text style={styles.fieldLabel}>Mobile Number</Text>
                        <View style={styles.phoneRow}>
                            <View style={styles.prefix}>
                                <Text style={styles.prefixText}>+91</Text>
                            </View>
                            <TextInput
                                style={[styles.phoneInput, phoneError ? styles.inputError : null]}
                                value={phone}
                                onChangeText={v => { setPhone(v); setPhoneError(''); }}
                                placeholder="9876543210"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="phone-pad"
                                maxLength={10}
                            />
                        </View>
                        {phoneError ? (
                            <View style={styles.errorRow}>
                                <Ionicons name="alert-circle" size={13} color={colors.error} />
                                <Text style={styles.errorText}>{phoneError}</Text>
                            </View>
                        ) : null}

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
                            style={[styles.btnLarge, !canSend && styles.btnDisabled]}
                            onPress={handleSendOtp}
                            disabled={loading || !canSend}
                            activeOpacity={0.85}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.btnText}>Send OTP</Text>}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.formSection}>
                        <Text style={styles.fieldLabel}>OTP sent to +91 {phone}</Text>

                        <View style={styles.otpRow}>
                            {otpDigits.map((digit, i) => (
                                <TextInput
                                    key={i}
                                    ref={otpRefs[i]}
                                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                                    value={digit}
                                    onChangeText={v => handleOtpChange(i, v)}
                                    onKeyPress={({ nativeEvent }) => handleOtpKey(i, nativeEvent.key)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    textAlign="center"
                                    selectTextOnFocus
                                />
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.btnLarge, otp.length < 4 && styles.btnDisabled]}
                            onPress={handleVerify}
                            disabled={loading || otp.length < 4}
                            activeOpacity={0.85}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.btnText}>Create Account</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.changeRow}
                            onPress={() => { setStep('details'); setOtpDigits(['', '', '', '']); }}
                        >
                            <Ionicons name="arrow-back" size={14} color={colors.primary} />
                            <Text style={styles.changeText}> Change details</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.loginRow}>
                    <Text style={styles.loginNote}>Already have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.loginLink}>Log in</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.memberNote}>
                    Accounts are created as members.{'\n'}
                    An admin will add you to your group.
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container:      { flex: 1, backgroundColor: colors.background },
        scroll:         { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 90 },
        backRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
        backText:       { fontSize: 14, fontFamily: F.semibold, color: colors.primary },
        topSection:     { alignItems: 'center', marginBottom: 36 },
        logoCircle: {
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: colors.primaryLight,
            borderWidth: 2,
            borderColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
        },
        title:          { fontSize: 24, fontFamily: F.semibold, color: colors.text, marginBottom: 6 },
        subtitle:       { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center' },
        formSection:    { marginBottom: 24 },
        fieldLabel:     { fontSize: 14, fontFamily: F.medium, color: colors.text, marginBottom: 8, marginTop: 16 },
        input: {
            height: 56,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            fontSize: 14,
            fontFamily: F.regular,
            color: colors.text,
            backgroundColor: colors.background,
        },
        phoneRow:       { flexDirection: 'row', gap: 8 },
        prefix: {
            width: 64,
            height: 56,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        prefixText:     { fontSize: 15, fontFamily: F.semibold, color: colors.primary },
        phoneInput: {
            height: 56,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            fontSize: 14,
            fontFamily: F.regular,
            color: colors.text,
            backgroundColor: colors.background,
            flex: 1,
        },
        inputError:     { borderColor: colors.error, borderWidth: 1.5 },
        errorRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
        errorText:      { fontSize: 12, fontFamily: F.medium, color: colors.error, flex: 1 },
        checkboxRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 4 },
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
        checkboxText:   { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, flex: 1 },
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
            marginTop: 20,
        },
        btnDisabled:    { backgroundColor: colors.textTertiary, shadowOpacity: 0, elevation: 0 },
        btnText:        { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
        otpRow:         { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24, marginTop: 8 },
        otpBox: {
            width: 52,
            height: 52,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            fontSize: 24,
            fontFamily: F.bold,
            color: colors.text,
            backgroundColor: colors.background,
            textAlign: 'center',
        },
        otpBoxFilled:   { borderColor: colors.primary, borderWidth: 2 },
        changeRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
        changeText:     { fontSize: 14, fontFamily: F.regular, color: colors.primary },
        loginRow:       { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
        loginNote:      { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },
        loginLink:      { fontSize: 14, fontFamily: F.semibold, color: colors.primary },
        memberNote:     { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 20, lineHeight: 18 },
    });
}
