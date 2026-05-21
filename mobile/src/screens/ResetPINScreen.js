import React, { useMemo, useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { resetPin as resetPinApi } from '../services/api';
import { apiErrMsg } from '../utils/error';
import { savePIN } from '../utils/pinStorage';
import { F } from '../theme';
import { webOutlineReset } from '../hooks/useInputFocus';

const PIN_LENGTH = 4;

export default function ResetPINScreen({ route, navigation }) {
    const { phone, otp } = route.params || {};
    const { colors } = useTheme();
    const [pinDigits, setPinDigits] = useState(Array(PIN_LENGTH).fill(''));
    const [confirmDigits, setConfirmDigits] = useState(Array(PIN_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const pinRefs = useRef([]);
    const confirmRefs = useRef([]);

    const pin = pinDigits.join('');
    const confirmPin = confirmDigits.join('');
    const canSubmit = pin.length === PIN_LENGTH && confirmPin.length === PIN_LENGTH;

    const handleChange = (i, value, setDigits, digits, nextRefs) => {
        if (!/^\d*$/.test(value)) return;
        const next = [...digits];
        next[i] = value.slice(-1);
        setDigits(next);
        if (value && i < PIN_LENGTH - 1) nextRefs.current[i + 1]?.focus();
    };

    const handleKey = (i, key, setDigits, digits, refs) => {
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
            await resetPinApi(phone, pin);
            await savePIN(phone, pin);
            Alert.alert('Success', 'PIN updated successfully', [
                { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
            ]);
        } catch (err) {
            Alert.alert('Error', apiErrMsg(err, 'Could not update PIN'));
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
                    <Text style={styles.title}>Set New PIN</Text>
                    <Text style={styles.subtitle}>Create a 4-digit PIN</Text>
                </View>

                <View style={styles.pinRow}>
                    {pinDigits.map((digit, i) => (
                        <TextInput
                            key={i}
                            ref={el => (pinRefs.current[i] = el)}
                            style={[styles.pinBox, webOutlineReset, digit ? styles.pinBoxFilled : null]}
                            value={digit}
                            onChangeText={v => handleChange(i, v, setPinDigits, pinDigits, pinRefs)}
                            onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key, setPinDigits, pinDigits, pinRefs)}
                            keyboardType="number-pad"
                            maxLength={1}
                            textAlign="center"
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <Text style={styles.confirmLabel}>Confirm PIN</Text>

                <View style={styles.pinRow}>
                    {confirmDigits.map((digit, i) => (
                        <TextInput
                            key={i}
                            ref={el => (confirmRefs.current[i] = el)}
                            style={[styles.pinBox, webOutlineReset, digit ? styles.pinBoxFilled : null]}
                            value={digit}
                            onChangeText={v => handleChange(i, v, setConfirmDigits, confirmDigits, confirmRefs)}
                            onKeyPress={({ nativeEvent }) => handleKey(i, nativeEvent.key, setConfirmDigits, confirmDigits, confirmRefs)}
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
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Update PIN</Text>}
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
