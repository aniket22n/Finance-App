import React, { useMemo, useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { signup, setPin as setPinApi } from '../services/api';
import { savePIN } from '../utils/pinStorage';
import { apiErrMsg } from '../utils/error';
import { F } from '../theme';
import { webOutlineReset } from '../hooks/useInputFocus';

const PIN_LENGTH = 4;

export default function SetPINScreen({ route, navigation }) {
    const { phone, otp, name, token, user, mode = 'signup' } = route.params || {};
    const { login } = useAuth();
    const { colors } = useTheme();
    const [pinDigits, setPinDigits] = useState(Array(PIN_LENGTH).fill(''));
    const [confirmDigits, setConfirmDigits] = useState(Array(PIN_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const pinRefs = useRef([]);
    const confirmRefs = useRef([]);

    const pin = pinDigits.join('');
    const confirmPin = confirmDigits.join('');
    const canSubmit = pin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH;

    const handlePinChange = (i, value, setDigits, digits, nextRefs) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...digits];
        next[i] = value.slice(-1);
        setDigits(next);
        if (value && i < PIN_LENGTH - 1) nextRefs.current[i + 1]?.focus();
    };

    const handlePinKey = (i, key, setDigits, digits, refs) => {
        if (key === 'Backspace' && !digits[i] && i > 0) {
            const next = [...digits];
            next[i - 1] = '';
            setDigits(next);
            refs.current[i - 1]?.focus();
        }
    };

    const handleSubmit = async () => {
        if (!canSubmit) return;
        if (pin !== confirmPin) {
            Alert.alert('Mismatch', 'PINs do not match. Try again.');
            setConfirmDigits(Array(PIN_LENGTH).fill(''));
            confirmRefs.current[0]?.focus();
            return;
        }
        setLoading(true);
        try {
            await savePIN(phone, pin);
            if (mode === 'signup') {
                const res = await signup({ name, phone, otp, pin });
                await login(res.data.token, res.data.user);
            } else {
                // Authenticated via OTP — store PIN on backend using the OTP-issued token
                await setPinApi(phone, pin);
                await login(token, user);
            }
        } catch (err) {
            Alert.alert('Error', apiErrMsg(err));
        } finally {
            setLoading(false);
        }
    };

    const styles = useMemo(() => makeStyles(colors), [colors]);
    const buttonLabel = mode === 'signup' ? 'Create Account' : 'Continue';

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
                    <Text style={styles.title}>Set Your PIN</Text>
                    <Text style={styles.subtitle}>Create a 4-digit PIN for easy login</Text>
                </View>

                <View style={styles.pinRow}>
                    {pinDigits.map((digit, i) => (
                        <TextInput
                            key={i}
                            ref={el => (pinRefs.current[i] = el)}
                            style={[styles.pinBox, webOutlineReset, digit ? styles.pinBoxFilled : null]}
                            value={digit}
                            onChangeText={v => handlePinChange(i, v, setPinDigits, pinDigits, pinRefs)}
                            onKeyPress={({ nativeEvent }) => handlePinKey(i, nativeEvent.key, setPinDigits, pinDigits, pinRefs)}
                            keyboardType="number-pad"
                            maxLength={1}
                            textAlign="center"
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <Text style={styles.confirmLabel}>Confirm your PIN</Text>

                <View style={styles.pinRow}>
                    {confirmDigits.map((digit, i) => (
                        <TextInput
                            key={i}
                            ref={el => (confirmRefs.current[i] = el)}
                            style={[styles.pinBox, webOutlineReset, digit ? styles.pinBoxFilled : null]}
                            value={digit}
                            onChangeText={v => handlePinChange(i, v, setConfirmDigits, confirmDigits, confirmRefs)}
                            onKeyPress={({ nativeEvent }) => handlePinKey(i, nativeEvent.key, setConfirmDigits, confirmDigits, confirmRefs)}
                            keyboardType="number-pad"
                            maxLength={1}
                            textAlign="center"
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.btnLarge, !canSubmit && styles.btnDisabled]}
                    onPress={handleSubmit}
                    disabled={loading || !canSubmit}
                    activeOpacity={0.85}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{buttonLabel}</Text>}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container:    { flex: 1, backgroundColor: colors.background },
        scroll:       { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 90 },
        backRow:      { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center', marginBottom: 16 },
        topSection:   { alignItems: 'flex-start', marginBottom: 32 },
        title:        { fontSize: 20, fontFamily: F.bold, color: colors.text, marginBottom: 6 },
        subtitle:     { fontSize: 13, fontFamily: F.regular, color: colors.textSecondary },
        pinRow:       { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 16 },
        confirmLabel: { fontSize: 14, fontFamily: F.bold, color: colors.text, textAlign: 'center', marginBottom: 16, marginTop: 8 },
        pinBox: {
            width: 60, height: 60, borderRadius: 10, borderWidth: 1,
            borderColor: colors.border, fontSize: 24, fontFamily: F.bold,
            color: colors.text, backgroundColor: colors.backgroundSecondary, textAlign: 'center',
        },
        pinBoxFilled: { borderColor: colors.primary, borderWidth: 2 },
        btnLarge: {
            height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.primary, elevation: 4, marginTop: 24,
        },
        btnDisabled: { backgroundColor: colors.textTertiary, elevation: 0 },
        btnText:     { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
    });
}
