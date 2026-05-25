import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { adminVerifyPayment, adminRejectPayment, adminChangePaymentStatus, requestPaymentActionOtp } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import { apiErrMsg } from '../utils/error';
import Toast, { useToast } from '../components/Toast';
import { webOutlineReset } from '../hooks/useInputFocus';

const OTP_LENGTH = 4;

const ACTION_META = {
    'verify':             { title: 'Verify Payment',          desc: 'Enter OTP to verify this payment',           color: '#10B981' },
    'reject':             { title: 'Reject Payment',           desc: 'Enter OTP to reject this payment',            color: '#EF4444' },
    'change-to-verified': { title: 'Change to Verified',       desc: 'Enter OTP to mark this payment as verified',  color: '#10B981' },
    'change-to-rejected': { title: 'Change to Rejected',       desc: 'Enter OTP to mark this payment as rejected',  color: '#EF4444' },
};

export default function AdminPaymentOTPScreen({ route, navigation }) {
    const { paymentId, action, amount, memberName } = route.params;
    const { colors } = useTheme();
    const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
    const [otpError, setOtpError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const { toast, show } = useToast();
    const refs = useRef([]);

    const otp = digits.join('');
    const canConfirm = otp.length === OTP_LENGTH;
    const meta = ACTION_META[action] || ACTION_META['verify'];

    useEffect(() => {
        setTimeout(() => refs.current[0]?.focus(), 200);
    }, []);

    const handleChange = (i, value) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...digits];
        next[i] = value.slice(-1);
        setDigits(next);
        if (otpError) setOtpError('');
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

    const handleConfirm = async () => {
        if (!canConfirm) return;
        setOtpError('');
        setLoading(true);
        try {
            let res;
            if (action === 'verify') {
                res = await adminVerifyPayment(paymentId, otp);
            } else if (action === 'reject') {
                res = await adminRejectPayment(paymentId, otp);
            } else if (action === 'change-to-verified') {
                res = await adminChangePaymentStatus(paymentId, 'verified', otp);
            } else if (action === 'change-to-rejected') {
                res = await adminChangePaymentStatus(paymentId, 'rejected', otp);
            }

            const isAccepted = action === 'verify' || action === 'change-to-verified';
            const targetFilter = isAccepted ? 'verified' : 'rejected';
            const successMsg = isAccepted ? 'Payment accepted' : 'Payment rejected';

            show(successMsg);
            setTimeout(() => {
                navigation.navigate('Main', {
                    screen: 'Payments',
                    params: { activeFilter: targetFilter },
                });
            }, 800);
        } catch (err) {
            const msg = apiErrMsg(err, 'Action failed. Check your OTP.');
            setOtpError(msg);
            setDigits(Array(OTP_LENGTH).fill(''));
            refs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true);
        setOtpError('');
        setDigits(Array(OTP_LENGTH).fill(''));
        try {
            await requestPaymentActionOtp(paymentId);
            show('OTP sent');
            setTimeout(() => refs.current[0]?.focus(), 100);
        } catch (err) {
            show(apiErrMsg(err, 'Could not resend OTP'), 'error');
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
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    disabled={loading}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
            </View>

            <View style={styles.body}>
                <Text style={[styles.title, { color: meta.color }]}>{meta.title}</Text>
                <Text style={styles.subtitle}>{meta.desc}</Text>
                <Text style={styles.paymentInfo}>
                    ₹{amount?.toLocaleString()} · {memberName}
                </Text>

                <View style={styles.otpRow}>
                    {digits.map((digit, i) => (
                        <TextInput
                            key={i}
                            ref={el => (refs.current[i] = el)}
                            style={[
                                styles.otpBox,
                                webOutlineReset,
                                digit ? styles.otpBoxFilled : null,
                                otpError ? styles.otpBoxError : null,
                            ]}
                            value={digit}
                            onChangeText={v => handleChange(i, v)}
                            onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key)}
                            keyboardType="number-pad"
                            maxLength={1}
                            textAlign="center"
                            selectTextOnFocus
                            editable={!loading}
                        />
                    ))}
                </View>

                {otpError ? (
                    <View style={styles.errorRow}>
                        <Ionicons name="alert-circle" size={14} color={colors.error} />
                        <Text style={styles.errorText}>{otpError}</Text>
                    </View>
                ) : null}

                <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleResend}
                    disabled={loading || resending}
                    activeOpacity={0.7}
                >
                    {resending
                        ? <ActivityIndicator size="small" color={colors.textSecondary} />
                        : <Text style={styles.resendText}>Resend OTP</Text>
                    }
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.confirmBtn,
                        { backgroundColor: meta.color },
                        (!canConfirm || loading) && styles.confirmBtnDisabled,
                    ]}
                    onPress={handleConfirm}
                    disabled={!canConfirm || loading}
                    activeOpacity={0.85}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.confirmText}>Confirm</Text>
                    }
                </TouchableOpacity>
            </View>

            <Toast {...toast} />
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        headerRow: {
            paddingTop: 60,
            paddingHorizontal: 16,
            height: 100,
            justifyContent: 'center',
        },
        backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },

        body: { paddingHorizontal: 24 },
        title: { fontSize: 22, fontFamily: F.bold, marginBottom: 6 },
        subtitle: { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 4 },
        paymentInfo: {
            fontSize: 14,
            fontFamily: F.semibold,
            color: colors.text,
            marginBottom: 40,
        },

        otpRow: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 20,
            marginBottom: 24,
        },
        otpBox: {
            width: 60,
            height: 60,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            fontSize: 24,
            fontFamily: F.bold,
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
            textAlign: 'center',
        },
        otpBoxFilled: { borderColor: colors.primary, borderWidth: 2 },
        otpBoxError:  { borderColor: colors.error, borderWidth: 2 },

        errorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: colors.errorLight || '#FEE2E2',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.error,
        },
        errorText: { flex: 1, fontSize: 12, fontFamily: F.medium, color: colors.error },

        resendBtn: {
            alignSelf: 'center',
            paddingVertical: 10,
            paddingHorizontal: 20,
            marginBottom: 16,
            minHeight: 36,
            justifyContent: 'center',
        },
        resendText: { fontSize: 13, fontFamily: F.medium, color: colors.textSecondary, textDecorationLine: 'underline' },

        confirmBtn: {
            height: 56,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
        },
        confirmBtnDisabled: { opacity: 0.45, elevation: 0 },
        confirmText: { fontSize: 16, fontFamily: F.bold, color: '#fff' },
    });
}
