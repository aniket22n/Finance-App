import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { verifyOtp, sendOtp, forgotPassword } from '../services/api';
import { getPIN } from '../utils/pinStorage';
import { apiErrMsg } from '../utils/error';
import { F } from '../theme';
import { webOutlineReset } from '../hooks/useInputFocus';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;

export default function OTPVerificationScreen({ route, navigation }) {
    const { phone, purpose = 'login' } = route.params || {};
    const { login } = useAuth();
    const { colors } = useTheme();
    const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
    const refs = useRef([]);

    const otp = digits.join('');
    const canVerify = otp.length === OTP_LENGTH;

    useEffect(() => {
        const t = setInterval(() => setSecondsLeft(s => (s > 0 ? s - 1 : 0)), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        setTimeout(() => refs.current[0]?.focus(), 200);
    }, []);

    const handleChange = (i, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...digits];
        next[i] = value.slice(-1);
        setDigits(next);
        if (value && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
    };

    const handleKey = (i, key) => {
        if (key === 'Backspace' && !digits[i] && i > 0) {
            const next = [...digits];
            next[i - 1] = '';
            setDigits(next);
            refs.current[i - 1]?.focus();
        }
    };

    const handleVerify = async () => {
        if (!canVerify) return;
        if (otp !== '1234') {
            Alert.alert('Verification failed', 'Invalid OTP');
            return;
        }
        setLoading(true);
        try {
            if (purpose === 'reset') {
                navigation.replace('ResetPINOTP', { phone, otp });
            } else {
                const res = await verifyOtp(phone, otp);
                const token = res.data.token;
                const user = res.data.user;
                if (user?.role === 'admin') {
                    await login(token, user);
                } else {
                    const existingPin = await getPIN(phone);
                    if (existingPin) {
                        await login(token, user);
                    } else {
                        navigation.replace('SetPIN', { phone, token, user, mode: 'login' });
                    }
                }
            }
        } catch (err) {
            Alert.alert('Verification failed', apiErrMsg(err, 'Invalid OTP'));
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (secondsLeft > 0) return;
        setResending(true);
        try {
            if (purpose === 'reset') {
                await forgotPassword(phone);
            } else {
                await sendOtp(phone);
            }
            setSecondsLeft(RESEND_SECONDS);
            setDigits(Array(OTP_LENGTH).fill(''));
            refs.current[0]?.focus();
        } catch (err) {
            Alert.alert('Error', apiErrMsg(err, 'Could not resend OTP'));
        } finally {
            setResending(false);
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
                <Text style={styles.title}>Verify OTP</Text>
                <Text style={styles.subtitle}>OTP sent to +91 {phone}</Text>
                <Text style={styles.timerText}>
                    {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'You can resend now'}
                </Text>

                <View style={styles.otpRow}>
                    {digits.map((digit, i) => (
                        <TextInput
                            key={i}
                            ref={el => (refs.current[i] = el)}
                            style={[styles.otpBox, webOutlineReset, digit ? styles.otpBoxFilled : null]}
                            value={digit}
                            onChangeText={v => handleChange(i, v)}
                            onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key)}
                            keyboardType="number-pad"
                            maxLength={1}
                            textAlign="center"
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.btnLarge, !canVerify && styles.btnDisabled]}
                    onPress={handleVerify}
                    disabled={loading || !canVerify}
                    activeOpacity={0.85}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleResend}
                    disabled={secondsLeft > 0 || resending}
                    style={styles.resendWrap}
                    activeOpacity={0.7}
                >
                    {resending
                        ? <ActivityIndicator color={colors.primary} size="small" />
                        : <Text style={[styles.resendText, secondsLeft > 0 && styles.resendDisabled]}>Resend OTP</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container:    { flex: 1, backgroundColor: colors.background },
        headerRow:    { paddingTop: 60, paddingHorizontal: 16, height: 100, justifyContent: 'center' },
        backBtn:      { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
        body:         { paddingHorizontal: 24 },
        title:        { fontSize: 20, fontFamily: F.bold, color: colors.text, marginBottom: 6 },
        subtitle:     { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 4 },
        timerText:    { fontSize: 12, fontFamily: F.regular, color: colors.textTertiary, marginBottom: 32 },
        otpRow:       { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 32 },
        otpBox: {
            width: 60, height: 60, borderRadius: 10, borderWidth: 1,
            borderColor: colors.border, fontSize: 24, fontFamily: F.bold,
            color: colors.text, backgroundColor: colors.backgroundSecondary, textAlign: 'center',
        },
        otpBoxFilled:   { borderColor: colors.primary, borderWidth: 2 },
        btnLarge:       { height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, elevation: 4 },
        btnDisabled:    { backgroundColor: colors.textTertiary, elevation: 0 },
        btnText:        { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
        resendWrap:     { alignItems: 'center', marginTop: 20, paddingVertical: 8 },
        resendText:     { fontSize: 13, fontFamily: F.semibold, color: colors.primary },
        resendDisabled: { color: colors.textTertiary },
    });
}
