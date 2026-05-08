import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { sendOtp, verifyOtp } from '../services/api';

export default function LoginScreen() {
    const { login } = useAuth();
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' | 'otp'
    const [loading, setLoading] = useState(false);
    const otpRef = useRef(null);

    const handleSendOtp = async () => {
        if (phone.length < 10) {
            Alert.alert('Invalid', 'Enter a valid 10-digit phone number');
            return;
        }
        setLoading(true);
        try {
            await sendOtp(phone);
            setStep('otp');
            setTimeout(() => otpRef.current?.focus(), 300);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
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

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.topSection}>
                <View style={styles.logoCircle}>
                    <Ionicons name="wallet" size={48} color="#e94560" />
                </View>
                <Text style={styles.title}>EMI Group</Text>
                <Text style={styles.subtitle}>Manage your rotating pot schemes</Text>
            </View>

            <View style={styles.formSection}>
                {step === 'phone' ? (
                    <>
                        <Text style={styles.label}>Enter your mobile number</Text>
                        <View style={styles.inputRow}>
                            <View style={styles.prefix}>
                                <Text style={styles.prefixText}>+91</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="9876543210"
                                placeholderTextColor="#556677"
                                keyboardType="phone-pad"
                                maxLength={10}
                                autoFocus
                            />
                        </View>
                        <TouchableOpacity
                            style={[styles.button, phone.length < 10 && styles.buttonDisabled]}
                            onPress={handleSendOtp}
                            disabled={loading || phone.length < 10}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Send OTP</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.label}>Enter OTP sent to +91 {phone}</Text>
                        <TextInput
                            ref={otpRef}
                            style={[styles.input, styles.otpInput]}
                            value={otp}
                            onChangeText={setOtp}
                            placeholder="1234"
                            placeholderTextColor="#556677"
                            keyboardType="number-pad"
                            maxLength={4}
                            textAlign="center"
                        />
                        <TouchableOpacity
                            style={[styles.button, otp.length < 4 && styles.buttonDisabled]}
                            onPress={handleVerifyOtp}
                            disabled={loading || otp.length < 4}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>Verify & Login</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => { setStep('phone'); setOtp(''); }}
                        >
                            <Text style={styles.backText}>← Change number</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <Text style={styles.footer}>
                By continuing, you agree to our Terms of Service & Privacy Policy
            </Text>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    topSection: { alignItems: 'center', marginBottom: 48 },
    logoCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#0f3460',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#e94560',
    },
    title: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: 1 },
    subtitle: { color: '#8899aa', fontSize: 14, marginTop: 6 },
    formSection: { marginBottom: 32 },
    label: { color: '#ccc', fontSize: 14, marginBottom: 12 },
    inputRow: { flexDirection: 'row', marginBottom: 16 },
    prefix: {
        backgroundColor: '#0f3460',
        borderRadius: 12,
        paddingHorizontal: 16,
        justifyContent: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    prefixText: { color: '#e94560', fontSize: 16, fontWeight: '700' },
    input: {
        flex: 1,
        backgroundColor: '#0f3460',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    otpInput: { fontSize: 28, letterSpacing: 12, paddingVertical: 16, marginBottom: 16 },
    button: {
        backgroundColor: '#e94560',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    backButton: { marginTop: 16, alignItems: 'center' },
    backText: { color: '#e94560', fontSize: 14 },
    footer: { color: '#556677', fontSize: 11, textAlign: 'center' },
});
