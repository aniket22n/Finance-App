import React, { useMemo, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Alert, Linking,
    StyleSheet, RefreshControl, ActivityIndicator, Modal, TextInput, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUserPayments, getGroups, initiatePayment, getPaymentConfig } from '../services/api';
import PaymentCard from '../components/PaymentCard';
import { F } from '../theme';
import Toast, { useToast } from '../components/Toast';
import { useInputFocus, focusBorder, webOutlineReset } from '../hooks/useInputFocus';

const buildMethods = (colors) => [
    { id: 'upi',   icon: 'qr-code',   color: colors.success, label: 'UPI',            sub: 'GPay, PhonePe, Paytm — 0% fee' },
    { id: 'bank',  icon: 'business',  color: colors.info,    label: 'Bank Transfer',  sub: 'NEFT / IMPS / RTGS' },
    { id: 'cash',  icon: 'cash',      color: colors.warning, label: 'Cash',           sub: 'Admin verifies in person' },
    { id: 'other', icon: 'image',     color: colors.primary, label: 'Upload Receipt', sub: 'Screenshot / photo proof' },
];

export default function PaymentScreen() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const [payments, setPayments] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [upiVpa, setUpiVpa] = useState('admin@upi');
    const { toast, show } = useToast();

    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPending, setSelectedPending] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [utrNumber, setUtrNumber] = useState('');
    const [receiptBase64, setReceiptBase64] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [utrFocused, utrFocusProps] = useInputFocus();

    const loadData = async () => {
        try {
            const [paymentsRes, groupsRes, configRes] = await Promise.all([
                getUserPayments(user._id),
                getGroups(),
                getPaymentConfig(),
            ]);
            setPayments(paymentsRes.data.payments || []);
            setGroups(groupsRes.data.groups || []);
            if (configRes.data.upiVpa) setUpiVpa(configRes.data.upiVpa);
        } catch (err) {
            console.log('Payment load error:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handlePayPress = (group, amount, month) => {
        setSelectedPending({ group, amount, month });
        setPaymentMethod('');
        setUtrNumber('');
        setReceiptBase64(null);
        setModalVisible(true);
    };

    const submitPayment = async (method = paymentMethod) => {
        if (!selectedPending || submitting) return;
        setSubmitting(true);
        try {
            await initiatePayment({
                groupId: selectedPending.group._id,
                month: selectedPending.month,
                amount: selectedPending.amount,
                paymentMethod: method,
                upiTransactionId: utrNumber,
                receipt: receiptBase64,
            });
            setModalVisible(false);
            setPaymentMethod('');
            setUtrNumber('');
            setReceiptBase64(null);
            show('Payment submitted — pending verification');
            setTimeout(() => loadData(), 600);
        } catch (err) {
            show(err.response?.data?.error || 'Payment failed. Try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUPIPay = () => {
        const { group, amount, month } = selectedPending;
        const upiUrl = `upi://pay?pa=${upiVpa}&pn=EMI+Group&am=${amount}&tn=EMI+Month+${month}+${group.name}&cu=INR`;
        Alert.alert(
            `Pay ₹${amount.toLocaleString()}`,
            `${group.name} · Month ${month}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open UPI App',
                    onPress: async () => {
                        const supported = await Linking.canOpenURL(upiUrl).catch(() => false);
                        if (supported) {
                            await Linking.openURL(upiUrl);
                            await submitPayment('upi');
                        } else {
                            show('No UPI app found. Install Google Pay, PhonePe, or Paytm.', 'error');
                        }
                    },
                },
            ]
        );
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
            setReceiptBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    const styles = useMemo(() => makeStyles(colors), [colors]);

    if (loading) {
        return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
    }

    const pendingPayments = payments.filter(p => p.status === 'pending');
    const completedPayments = payments.filter(p => p.status !== 'pending');

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Payments</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >

            {pendingPayments.length > 0 && (
                <View style={styles.pendingBanner}>
                    <Ionicons name="alert-circle" size={18} color={colors.warning} />
                    <Text style={styles.pendingBannerText}>
                        {pendingPayments.length} pending payment{pendingPayments.length > 1 ? 's' : ''} due
                    </Text>
                </View>
            )}

            {pendingPayments.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>Due Payments</Text>
                    {pendingPayments.map(payment => {
                        const group = groups.find(g => g._id === (payment.group?._id || payment.group));
                        return (
                            <View key={payment._id} style={styles.dueRow}>
                                <View style={styles.dueInfo}>
                                    <Text style={styles.dueName}>{payment.group?.name || `Month ${payment.month}`}</Text>
                                    <Text style={styles.dueAmount}>₹{payment.amount?.toLocaleString()}</Text>
                                    <Text style={styles.dueSub}>Month {payment.month}</Text>
                                </View>
                                {group && (
                                    <TouchableOpacity
                                        style={styles.payBtn}
                                        onPress={() => handlePayPress(group, payment.amount, payment.month)}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={styles.payBtnText}>Pay Now</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </>
            )}

            <Text style={styles.sectionTitle}>Payment History</Text>
            {completedPayments.length > 0 ? (
                completedPayments.map(p => <PaymentCard key={p._id} payment={p} />)
            ) : (
                <View style={styles.emptyBox}>
                    <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.emptyTitle}>No History Yet</Text>
                    <Text style={styles.emptyBody}>Your payment history will appear here.</Text>
                </View>
            )}

            <View style={{ height: 90 }} />
            </ScrollView>

            {/* Payment Method Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => !submitting && setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Choose Payment Method</Text>
                                {selectedPending && (
                                    <Text style={styles.modalSub}>
                                        ₹{selectedPending.amount?.toLocaleString()} · {selectedPending.group?.name}
                                    </Text>
                                )}
                            </View>
                            {!submitting && (
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {!paymentMethod ? (
                            <View style={styles.methodGrid}>
                                {buildMethods(colors).map(m => (
                                    <TouchableOpacity
                                        key={m.id}
                                        style={styles.methodCard}
                                        onPress={() => m.id === 'upi' ? handleUPIPay() : setPaymentMethod(m.id)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.methodIconCircle, { backgroundColor: (m.color || colors.primary) + '18' }]}>
                                            <Ionicons name={m.icon} size={24} color={m.color || colors.primary} />
                                        </View>
                                        <View style={styles.methodTextCol}>
                                            <Text style={styles.methodLabel}>{m.label}</Text>
                                            <Text style={styles.methodSub}>{m.sub}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <ScrollView>
                                {paymentMethod === 'bank' && (
                                    <>
                                        <Text style={styles.infoLabel}>Bank Account Details</Text>
                                        <View style={styles.bankCard}>
                                            {[
                                                ['Account Name', 'EMI Group Admin'],
                                                ['Account No', '1234567890'],
                                                ['IFSC Code', 'HDFC0001234'],
                                                ['Bank', 'HDFC Bank'],
                                            ].map(([k, v]) => (
                                                <View key={k} style={styles.bankRow}>
                                                    <Text style={styles.bankKey}>{k}</Text>
                                                    <Text style={styles.bankVal}>{v}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <Text style={styles.infoLabel}>UTR / Reference Number</Text>
                                        <TextInput
                                            style={[styles.textInput, webOutlineReset, focusBorder(colors, utrFocused)]}
                                            placeholder="Enter transaction reference"
                                            placeholderTextColor={colors.textSecondary}
                                            value={utrNumber}
                                            onChangeText={setUtrNumber}
                                            {...utrFocusProps}
                                        />
                                    </>
                                )}

                                {paymentMethod === 'cash' && (
                                    <View style={styles.infoBox}>
                                        <Ionicons name="information-circle" size={20} color={colors.warning} />
                                        <Text style={styles.infoText}>
                                            Hand over cash to the admin and submit to mark as pending verification.
                                        </Text>
                                    </View>
                                )}

                                {paymentMethod === 'other' && (
                                    <>
                                        <Text style={styles.infoLabel}>Upload Payment Receipt</Text>
                                        <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                                            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
                                            <Text style={styles.uploadText}>
                                                {receiptBase64 ? 'Change Receipt' : 'Select Image'}
                                            </Text>
                                        </TouchableOpacity>
                                        {receiptBase64 && (
                                            <Image source={{ uri: receiptBase64 }} style={styles.receiptPreview} />
                                        )}
                                    </>
                                )}

                                <TouchableOpacity
                                    style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                    onPress={() => submitPayment(paymentMethod)}
                                    disabled={submitting}
                                    activeOpacity={0.85}
                                >
                                    {submitting
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={styles.submitText}>Submit Payment</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.backBtn}
                                    onPress={() => setPaymentMethod('')}
                                >
                                    <Text style={styles.backBtnText}>← Back to methods</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
            <Toast {...toast} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.backgroundSecondary },
        center:    { flex: 1, backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
        header: {
            backgroundColor: colors.background,
            paddingHorizontal: 16,
            paddingTop: 56,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            zIndex: 10,
        },
        headerTitle:   { fontSize: 20, fontFamily: F.bold, color: colors.text },
        sectionTitle:  { fontSize: 16, fontFamily: F.medium, color: colors.text, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
        pendingBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.warningLight,
            marginHorizontal: 16,
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            borderLeftWidth: 3,
            borderLeftColor: colors.warning,
            gap: 8,
        },
        pendingBannerText: { fontSize: 14, fontFamily: F.medium, color: colors.warning },
        dueRow: {
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 3,
            marginHorizontal: 16,
            marginBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        dueInfo:   { flex: 1 },
        dueName:   { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        dueAmount: { fontSize: 22, fontFamily: F.bold, color: colors.primary, marginTop: 2 },
        dueSub:    { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary },
        payBtn: {
            height: 40,
            paddingHorizontal: 18,
            borderRadius: 10,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 3,
        },
        payBtnText: { fontSize: 13, fontFamily: F.semibold, color: '#fff' },
        emptyBox: {
            marginHorizontal: 16,
            marginTop: 8,
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.border,
            backgroundColor: colors.background,
            padding: 32,
            alignItems: 'center',
        },
        emptyTitle: { fontSize: 16, fontFamily: F.medium, color: colors.text, marginTop: 10 },
        emptyBody:  { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
        // Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        modalSheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
            maxHeight: '85%',
        },
        sheetHandle: {
            width: 32,
            height: 4,
            backgroundColor: colors.border,
            borderRadius: 2,
            alignSelf: 'center',
            marginBottom: 16,
        },
        modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
        modalTitle:   { fontSize: 20, fontFamily: F.semibold, color: colors.text },
        modalSub:     { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, marginTop: 3 },
        methodGrid:   { gap: 10 },
        methodCard: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            padding: 14,
            backgroundColor: colors.background,
            gap: 12,
        },
        methodIconCircle: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
        methodTextCol:    { flex: 1 },
        methodLabel:      { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        methodSub:        { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        infoLabel:        { fontSize: 14, fontFamily: F.medium, color: colors.text, marginBottom: 8, marginTop: 4 },
        bankCard: {
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
        },
        bankRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
        bankKey:  { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary },
        bankVal:  { fontSize: 14, fontFamily: F.semibold, color: colors.text },
        textInput: {
            height: 56,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 10,
            fontSize: 14,
            fontFamily: F.regular,
            color: colors.text,
            backgroundColor: colors.backgroundSecondary,
            marginBottom: 8,
        },
        infoBox: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: colors.warningLight,
            borderRadius: 10,
            padding: 14,
            gap: 10,
            marginBottom: 8,
        },
        infoText: { fontSize: 14, fontFamily: F.regular, color: colors.warning, flex: 1, lineHeight: 20 },
        uploadBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 48,
            borderRadius: 10,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.primary,
            gap: 8,
            marginBottom: 12,
        },
        uploadText:     { fontSize: 14, fontFamily: F.medium, color: colors.primary },
        receiptPreview: { width: '100%', height: 180, borderRadius: 12, resizeMode: 'cover', marginBottom: 12 },
        submitBtn: {
            height: 56,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 4,
        },
        submitText:  { fontSize: 14, fontFamily: F.semibold, color: '#FFFFFF' },
        backBtn:     { alignItems: 'center', marginTop: 14 },
        backBtnText: { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary },
    });
}
