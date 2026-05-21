import React, { useState, useMemo, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { sendOtp, checkUserType, loginWithPin, checkPhone } from '../services/api';
import { verifyPIN } from '../utils/pinStorage';
import { apiErrMsg } from '../utils/error';
import { F } from '../theme';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

const PIN_LENGTH = 4;

export default function LoginScreen({ navigation }) {
    const { login } = useAuth();
    const { colors } = useTheme();

    const [phone, setPhone] = useState('');
    const [mode, setMode] = useState('pin');
    const [isAdmin, setIsAdmin] = useState(false);
    const [checkingType, setCheckingType] = useState(false);
    const [pinDigits, setPinDigits] = useState(Array(PIN_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const [phoneFocused, phoneFocusProps] = useInputFocus();
    const pinRefs = useRef([]);

    const phoneValid = phone.length === 10;
    const pin = pinDigits.join('');
    const canSubmitPin = phoneValid && pin.length === PIN_LENGTH;
    const canSubmitOtp = phoneValid;

    const handlePhoneBlur = async (e) => {
        phoneFocusProps.onBlur(e);
        if (phone.length !== 10) return;
        setCheckingType(true);
        try {
            const res = await checkUserType(phone);
            const admin = res.data?.isAdmin || false;
            setIsAdmin(admin);
            if (admin) setMode('otp');
        } catch {
            setIsAdmin(false);
        } finally {
            setCheckingType(false);
        }
    };

    const handlePinChange = (i, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...pinDigits];
        next[i] = value.slice(-1);
        setPinDigits(next);
        if (value && i < PIN_LENGTH - 1) pinRefs.current[i + 1]?.focus();
    };

    const handlePinKey = (i, key) => {
        if (key === 'Backspace' && !pinDigits[i] && i > 0) {
            const next = [...pinDigits];
            next[i - 1] = '';
            setPinDigits(next);
            pinRefs.current[i - 1]?.focus();
        }
    };

    // Returns true if phone passes registration check, false if an alert was shown
    const checkRegistration = async () => {
        try {
            const res = await checkPhone(phone);
            if (res.data.pendingRequest) {
                Alert.alert('Account Pending', 'Your account is awaiting admin approval.');
                return false;
            }
            if (res.data.rejectedRequest) {
                Alert.alert('Account Rejected', 'Your account request was rejected. Please contact admin.');
                return false;
            }
            if (!res.data.exists) {
                Alert.alert(
                    'Not Registered',
                    'This number has no account. Would you like to sign up?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Sign Up', onPress: () => navigation.navigate('SignUp', { phone }) },
                    ]
                );
                return false;
            }
            return true;
        } catch {
            return true; // allow through if check fails — backend will catch it
        }
    };

    const handlePinLogin = async () => {
        if (!canSubmitPin) return;
        setLoading(true);
        try {
            const registered = await checkRegistration();
            if (!registered) return;
            const valid = await verifyPIN(phone, pin);
            if (!valid) {
                Alert.alert('Wrong PIN', 'Incorrect PIN. Try again or use OTP.');
                setPinDigits(Array(PIN_LENGTH).fill(''));
                pinRefs.current[0]?.focus();
                return;
            }
            const res = await loginWithPin(phone, pin);
            await login(res.data.token, res.data.user);
        } catch (err) {
            const status = err?.response?.status;
            if (status === 403) {
                Alert.alert('Access Denied', apiErrMsg(err, 'Account not accessible'));
            } else {
                Alert.alert('Login failed', apiErrMsg(err, 'Could not login'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGetOtp = async () => {
        if (!canSubmitOtp) return;
        setLoading(true);
        try {
            const registered = await checkRegistration();
            if (!registered) return;
            await sendOtp(phone);
            navigation.navigate('OTPVerification', { phone, purpose: 'login' });
        } catch (err) {
            Alert.alert('Error', apiErrMsg(err, 'Could not send OTP'));
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
                <View style={styles.topSection}>
                    <View style={styles.logoSquare}>
                        <Ionicons name="wallet" size={30} color="#fff" />
                    </View>
                    <Text style={styles.title}>Fast Cash</Text>
                    <Text style={styles.subtitle}>Welcome to Fast Cash</Text>
                </View>

                <View style={styles.formSection}>
                    <View style={[styles.phoneRow, focusBorder(colors, phoneFocused)]}>
                        <Text style={styles.prefixText}>+91</Text>
                        <View style={styles.prefixDivider} />
                        <TextInput
                            style={[styles.phoneInput, webOutlineReset]}
                            value={phone}
                            onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                            placeholder="9876543210"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="phone-pad"
                            maxLength={10}
                            returnKeyType="done"
                            {...phoneFocusProps}
                            onBlur={handlePhoneBlur}
                        />
                        {checkingType && (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />
                        )}
                    </View>

                    {isAdmin && (
                        <Text style={styles.adminNote}>Admins login with OTP only</Text>
                    )}

                    <View style={styles.toggleRow}>
                        <TouchableOpacity
                            style={[styles.toggleBtn, mode === 'pin' && !isAdmin && styles.toggleBtnActive, isAdmin && styles.toggleBtnDisabled]}
                            onPress={() => !isAdmin && setMode('pin')}
                            activeOpacity={isAdmin ? 1 : 0.8}
                            disabled={isAdmin}
                        >
                            <Ionicons
                                name={mode === 'pin' && !isAdmin ? 'radio-button-on' : 'radio-button-off'}
                                size={16}
                                color={isAdmin ? colors.textTertiary : (mode === 'pin' ? colors.primary : colors.textSecondary)}
                            />
                            <Text style={[
                                styles.toggleText,
                                mode === 'pin' && !isAdmin && styles.toggleTextActive,
                                isAdmin && styles.toggleTextDisabled,
                            ]}>
                                Login with PIN
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.toggleBtn, mode === 'otp' && styles.toggleBtnActive]}
                            onPress={() => setMode('otp')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name={mode === 'otp' ? 'radio-button-on' : 'radio-button-off'}
                                size={16}
                                color={mode === 'otp' ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[styles.toggleText, mode === 'otp' && styles.toggleTextActive]}>
                                Login with OTP
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {mode === 'pin' && !isAdmin && (
                        <>
                            <View style={styles.pinRow}>
                                {pinDigits.map((digit, i) => (
                                    <TextInput
                                        key={i}
                                        ref={el => (pinRefs.current[i] = el)}
                                        style={[styles.pinBox, webOutlineReset, digit ? styles.pinBoxFilled : null]}
                                        value={digit}
                                        onChangeText={v => handlePinChange(i, v)}
                                        onKeyPress={({ nativeEvent }) => handlePinKey(i, nativeEvent.key)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        textAlign="center"
                                        selectTextOnFocus
                                    />
                                ))}
                            </View>

                            <TouchableOpacity
                                style={styles.forgotWrap}
                                onPress={() => navigation.navigate('ForgotPIN')}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.forgotText}>Forgot PIN?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.btnLarge, !canSubmitPin && styles.btnDisabled]}
                                onPress={handlePinLogin}
                                disabled={loading || !canSubmitPin}
                                activeOpacity={0.85}
                            >
                                {loading
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.btnText}>Login</Text>}
                            </TouchableOpacity>
                        </>
                    )}

                    {mode === 'otp' && (
                        <TouchableOpacity
                            style={[styles.btnLarge, !canSubmitOtp && styles.btnDisabled]}
                            onPress={handleGetOtp}
                            disabled={loading || !canSubmitOtp}
                            activeOpacity={0.85}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.btnText}>Get OTP</Text>}
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerNote}>
                        By continuing, you agree to our Terms &amp; Privacy Policy
                    </Text>
                    <View style={styles.signupRow}>
                        <Text style={styles.signupNote}>New here? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                            <Text style={styles.signupLink}>Create account</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container:   { flex: 1, backgroundColor: colors.background },
        scroll:      { paddingTop: 60, paddingBottom: 90 },
        topSection:  { alignItems: 'center', marginBottom: 32, paddingHorizontal: 24 },
        logoSquare: {
            width: 60, height: 60, borderRadius: 14,
            backgroundColor: colors.primary, alignItems: 'center',
            justifyContent: 'center', marginBottom: 16, elevation: 6,
        },
        title:        { fontSize: 24, fontFamily: F.bold, color: colors.text, marginBottom: 4 },
        subtitle:     { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },
        formSection:  { marginBottom: 24 },
        phoneRow: {
            flexDirection: 'row', alignItems: 'center', height: 56,
            marginHorizontal: 16, borderWidth: 1, borderColor: colors.border,
            borderRadius: 10, backgroundColor: colors.backgroundSecondary,
        },
        prefixText:    { fontSize: 15, fontFamily: F.semibold, color: colors.primary, paddingHorizontal: 16 },
        prefixDivider: { width: 1, height: 24, backgroundColor: colors.border },
        phoneInput: {
            flex: 1, height: 56, paddingHorizontal: 16,
            fontSize: 15, fontFamily: F.regular, color: colors.text,
        },
        adminNote:  { fontSize: 12, fontFamily: F.medium, color: colors.primary, marginHorizontal: 16, marginTop: 8 },
        toggleRow:  { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 8 },
        toggleBtn: {
            flex: 1, flexDirection: 'row', alignItems: 'center',
            paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10,
            borderWidth: 1, borderColor: colors.border,
            backgroundColor: colors.backgroundSecondary, gap: 6,
        },
        toggleBtnActive:   { borderColor: colors.primary, backgroundColor: colors.primaryLight },
        toggleBtnDisabled: { opacity: 0.4 },
        toggleText:        { fontSize: 12, fontFamily: F.medium, color: colors.textSecondary, flexShrink: 1 },
        toggleTextActive:  { color: colors.primary, fontFamily: F.semibold },
        toggleTextDisabled:{ color: colors.textTertiary },
        pinRow: {
            flexDirection: 'row', justifyContent: 'center',
            gap: 20, marginVertical: 24, marginHorizontal: 16,
        },
        pinBox: {
            width: 60, height: 60, borderRadius: 10, borderWidth: 1,
            borderColor: colors.border, fontSize: 24, fontFamily: F.bold,
            color: colors.text, backgroundColor: colors.backgroundSecondary, textAlign: 'center',
        },
        pinBoxFilled: { borderColor: colors.primary, borderWidth: 2 },
        forgotWrap:   { alignSelf: 'flex-end', marginHorizontal: 16, marginBottom: 8 },
        forgotText:   { fontSize: 12, fontFamily: F.semibold, color: colors.primary },
        btnLarge: {
            height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary, elevation: 4, marginHorizontal: 16, marginTop: 8,
        },
        btnDisabled: { backgroundColor: colors.textTertiary, elevation: 0 },
        btnText:     { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
        footer:      { alignItems: 'center', gap: 12, paddingHorizontal: 24 },
        footerNote:  { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center' },
        signupRow:   { flexDirection: 'row', alignItems: 'center' },
        signupNote:  { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },
        signupLink:  { fontSize: 13, fontFamily: F.semibold, color: colors.primary },
    });
}
