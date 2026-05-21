import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { checkPhone, sendOtp, verifyOtp } from '../services/api';
import { F } from '../theme';

export default function LoginScreen({ navigation }) {
    const { login } = useAuth();
    const { colors } = useTheme();
    const [phone, setPhone] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
    const [step, setStep] = useState('phone'); // 'phone' | 'otp'
    const [loading, setLoading] = useState(false);
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

    const handleGetOtp = async () => {
        if (phone.length < 10) {
            Alert.alert('Invalid', 'Enter a valid 10-digit phone number');
            return;
        }
        setLoading(true);
        try {
            const checkRes = await checkPhone(phone);
            if (!checkRes.data.exists) {
                navigation.navigate('SignUp', { phone });
                return;
            }
            await sendOtp(phone);
            setStep('otp');
            setTimeout(() => otpRefs[0].current?.focus(), 300);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Something went wrong');
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
            await login(res.data.token, res.data.user);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const styles = makeStyles(colors);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* Logo */}
                <View style={styles.topSection}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="wallet" size={30} color={colors.primary} />
                    </View>
                    <Text style={styles.title}>EMI Group</Text>
                    <Text style={styles.subtitle}>Manage your rotating pot schemes</Text>
                </View>

                {step === 'phone' ? (
                    <View style={styles.formSection}>
                        <Text style={styles.label}>Mobile Number</Text>

                        <View style={styles.phoneRow}>
                            <Text style={styles.prefixText}>+91</Text>
                            <View style={styles.prefixDivider} />
                            <TextInput
                                style={styles.phoneInput}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="9876543210"
                                placeholderTextColor={colors.textSecondary}
                                keyboardType="phone-pad"
                                maxLength={10}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={handleGetOtp}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.btnLarge, phone.length < 10 && styles.btnDisabled]}
                            onPress={handleGetOtp}
                            disabled={loading || phone.length < 10}
                            activeOpacity={0.85}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.btnText}>Get OTP</Text>}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.formSection}>
                        <Text style={styles.label}>OTP sent to +91 {phone}</Text>

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
                                : <Text style={styles.btnText}>Verify & Login</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.changeRow}
                            onPress={() => { setStep('phone'); setOtpDigits(['', '', '', '']); }}
                        >
                            <Ionicons name="arrow-back" size={14} color={colors.primary} />
                            <Text style={styles.changeText}> Change number</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerNote}>
                        By continuing, you agree to our Terms & Privacy Policy
                    </Text>
                    {step === 'phone' && (
                        <View style={styles.signupRow}>
                            <Text style={styles.signupNote}>New here? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                                <Text style={styles.signupLink}>Create account</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container:    { flex: 1, backgroundColor: colors.background },
        scroll:       { paddingTop: 72, paddingBottom: 90 },
        topSection:   { alignItems: 'center', marginBottom: 48, paddingHorizontal: 24 },
        logoCircle: {
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: colors.primaryLight,
            borderWidth: 2,
            borderColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            elevation: 3,
        },
        title:        { fontSize: 32, fontFamily: F.bold, color: colors.text, marginBottom: 6 },
        subtitle:     { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center' },
        formSection:  { marginBottom: 32 },
        label:        { fontSize: 16, fontFamily: F.medium, color: colors.text, marginBottom: 12, marginHorizontal: 16 },
        phoneRow: {
            flexDirection: 'row',
            alignItems: 'center',
            height: 56,
            marginHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            backgroundColor: colors.background,
            marginBottom: 0,
        },
        prefixText:    { fontSize: 15, fontFamily: F.semibold, color: colors.primary, paddingHorizontal: 16 },
        prefixDivider: { width: 1, height: 24, backgroundColor: colors.border },
        phoneInput: {
            flex: 1,
            height: 56,
            paddingHorizontal: 16,
            fontSize: 15,
            fontFamily: F.regular,
            color: colors.text,
        },
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
            marginHorizontal: 16,
            marginTop: 16,
        },
        btnDisabled:  { backgroundColor: colors.textTertiary, shadowOpacity: 0, elevation: 0 },
        btnText:      { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
        otpRow:       { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
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
        otpBoxFilled: { borderColor: colors.primary, borderWidth: 2 },
        changeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
        changeText:   { fontSize: 14, fontFamily: F.regular, color: colors.primary },
        footer:       { alignItems: 'center', gap: 12, paddingHorizontal: 24 },
        footerNote:   { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center' },
        signupRow:    { flexDirection: 'row', alignItems: 'center' },
        signupNote:   { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },
        signupLink:   { fontSize: 14, fontFamily: F.semibold, color: colors.primary },
    });
}
