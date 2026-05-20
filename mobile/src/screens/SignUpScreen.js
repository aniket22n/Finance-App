import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { sendOtp, verifyOtp, updateProfile } from '../services/api';

export default function SignUpScreen({ navigation }) {
    const { login } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState('details'); // 'details' | 'otp'
    const [loading, setLoading] = useState(false);
    const otpRef = useRef(null);

    const handleSendOtp = async () => {
        if (!name.trim()) {
            Alert.alert('Required', 'Please enter your name');
            return;
        }
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

    const handleVerify = async () => {
        if (otp.length < 4) {
            Alert.alert('Invalid', 'Enter the 4-digit OTP');
            return;
        }
        setLoading(true);
        try {
            const res = await verifyOtp(phone, otp);
            const token = res.data.token;
            // Store token so the API interceptor can use it for the profile update
            await SecureStore.setItemAsync('authToken', token);
            // Set the name on the new account
            if (name.trim()) {
                await updateProfile({ name: name.trim() }).catch(() => {});
            }
            await login(token, { ...res.data.user, name: name.trim() || res.data.user.name });
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
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={20} color="#e94560" />
                    <Text style={styles.backText}>Back to Login</Text>
                </TouchableOpacity>

                <View style={styles.topSection}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="person-add" size={44} color="#e94560" />
                    </View>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Join your EMI group as a member</Text>
                </View>

                <View style={styles.formSection}>
                    {step === 'details' ? (
                        <>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Your full name"
                                placeholderTextColor="#556677"
                                autoFocus
                                returnKeyType="next"
                            />

                            <Text style={styles.label}>Mobile Number</Text>
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
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, (!name.trim() || phone.length < 10) && styles.buttonDisabled]}
                                onPress={handleSendOtp}
                                disabled={loading || !name.trim() || phone.length < 10}
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
                            <Text style={styles.label}>OTP sent to +91 {phone}</Text>
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
                                onPress={handleVerify}
                                disabled={loading || otp.length < 4}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Create Account</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.changeRow}
                                onPress={() => { setStep('details'); setOtp(''); }}
                            >
                                <Text style={styles.changeText}>← Change details</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <Text style={styles.note}>
                    Your account will be created as a member.{'\n'}
                    An admin will add you to your group.
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
    backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
    backText: { color: '#e94560', fontSize: 14, marginLeft: 6, fontWeight: '600' },
    topSection: { alignItems: 'center', marginBottom: 40 },
    logoCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#0f3460',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#e94560',
    },
    title: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 0.5 },
    subtitle: { color: '#8899aa', fontSize: 14, marginTop: 6 },
    formSection: { marginBottom: 24 },
    label: { color: '#ccc', fontSize: 13, marginBottom: 8, marginTop: 16 },
    inputRow: { flexDirection: 'row', marginBottom: 4 },
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
        fontSize: 16,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: '#1a1a4e',
        marginBottom: 4,
    },
    otpInput: { fontSize: 28, letterSpacing: 12, paddingVertical: 16, marginBottom: 16 },
    button: {
        backgroundColor: '#e94560',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    changeRow: { marginTop: 16, alignItems: 'center' },
    changeText: { color: '#e94560', fontSize: 14 },
    note: { color: '#556677', fontSize: 12, textAlign: 'center', lineHeight: 20 },
});
