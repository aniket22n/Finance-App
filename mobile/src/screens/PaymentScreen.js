import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Alert, Linking,
    StyleSheet, RefreshControl, ActivityIndicator, Modal, TextInput, Image
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { getUserPayments, getGroups, initiatePayment, getPaymentConfig } from '../services/api';
import PaymentCard from '../components/PaymentCard';

export default function PaymentScreen() {
    const { user } = useAuth();
    const [payments, setPayments] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [upiVpa, setUpiVpa] = useState('admin@upi'); // Default fallback

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPending, setSelectedPending] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [utrNumber, setUtrNumber] = useState('');
    const [receiptBase64, setReceiptBase64] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        try {
            const [paymentsRes, groupsRes, configRes] = await Promise.all([
                getUserPayments(user._id),
                getGroups(),
                getPaymentConfig(),
            ]);
            setPayments(paymentsRes.data.payments || []);
            setGroups(groupsRes.data.groups || []);
            if (configRes.data.upiVpa) {
                setUpiVpa(configRes.data.upiVpa);
            }
        } catch (err) {
            console.log('Error:', err.message);
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
            // Clear form
            setPaymentMethod('');
            setUtrNumber('');
            setReceiptBase64(null);
            Alert.alert(
                '✅ Payment Submitted',
                'Your payment is pending verification. You will be notified once verified.',
                [{ text: 'OK', onPress: () => loadData() }]
            );
        } catch (err) {
            Alert.alert(
                '❌ Payment Failed',
                err.response?.data?.error || 'Something went wrong. Please try again.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleUPIPay = () => {
        const { group, amount, month } = selectedPending;
        const upiUrl = `upi://pay?pa=${upiVpa}&pn=EMI+Group&am=${amount}&tn=EMI+Month+${month}+${group.name}&cu=INR`;
        
        Alert.alert(
            'Pay via UPI',
            `Pay ₹${amount.toLocaleString()} for ${group.name} (Month ${month})`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open UPI App',
                    onPress: async () => {
                        try {
                            const supported = await Linking.canOpenURL(upiUrl);
                            if (supported) {
                                await Linking.openURL(upiUrl);
                                await submitPayment('upi');
                            } else {
                                Alert.alert('Error', 'No UPI app found. Please install Google Pay, PhonePe, or Paytm.');
                            }
                        } catch (err) {
                            Alert.alert('Error', 'Failed to open UPI app');
                        }
                    },
                },
            ]
        );
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            setReceiptBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    const pendingPayments = payments.filter(p => p.status === 'pending');
    const completedPayments = payments.filter(p => p.status !== 'pending');

    return (
        <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}>
            <Text style={styles.header}>Payments</Text>

            {pendingPayments.length > 0 && (
                <>
                    {pendingPayments.length > 0 && (
                        <View style={styles.pendingBanner}>
                            <Ionicons name="alert-circle" size={18} color="#f0a500" />
                            <Text style={styles.pendingBannerText}>
                                You have {pendingPayments.length} pending payment{pendingPayments.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.sectionTitle}>Pending ({pendingPayments.length})</Text>
                    {pendingPayments.map((payment) => {
                        const group = groups.find(g => g._id === (payment.group?._id || payment.group));
                        return (
                            <View key={payment._id} style={styles.pendingRow}>
                                <View style={styles.pendingInfo}>
                                    <PaymentCard payment={payment} />
                                </View>
                                {group && (
                                    <TouchableOpacity style={styles.payBtn} onPress={() => handlePayPress(group, payment.amount, payment.month)}>
                                        <Ionicons name="wallet" size={16} color="#fff" />
                                        <Text style={styles.payBtnText}>PAY</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </>
            )}

            <Text style={styles.sectionTitle}>Payment History</Text>
            {completedPayments.length > 0 ? (
                completedPayments.map((payment) => <PaymentCard key={payment._id} payment={payment} />)
            ) : (
                <View style={styles.empty}>
                    <Ionicons name="receipt-outline" size={48} color="#334455" />
                    <Text style={styles.emptyText}>No payment history yet</Text>
                </View>
            )}

            <View style={{ height: 40 }} />

            {/* Payment Options Modal */}
            <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => !submitting && setModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Choose Payment Method</Text>
                            {!submitting && (
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#8899aa" />
                            </TouchableOpacity>
                            )}
                        </View>

                        {!paymentMethod ? (
                            <View style={styles.methodList}>
                                <TouchableOpacity style={styles.methodBtn} onPress={handleUPIPay}>
                                    <Ionicons name="qr-code" size={24} color="#00b894" />
                                    <Text style={styles.methodText}>Pay via UPI (GPay, PhonePe)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.methodBtn} onPress={() => setPaymentMethod('bank')}>
                                    <Ionicons name="business" size={24} color="#6c5ce7" />
                                    <Text style={styles.methodText}>Bank Transfer (NEFT/IMPS)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.methodBtn} onPress={() => setPaymentMethod('cash')}>
                                    <Ionicons name="cash" size={24} color="#f0a500" />
                                    <Text style={styles.methodText}>Pay in Cash</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.methodBtn} onPress={() => setPaymentMethod('other')}>
                                    <Ionicons name="image" size={24} color="#e94560" />
                                    <Text style={styles.methodText}>Upload Payment Receipt</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.methodDetail}>
                                {paymentMethod === 'bank' && (
                                    <>
                                        <Text style={styles.infoText}>Transfer to Admin's Bank Account:</Text>
                                        <View style={styles.bankInfoCard}>
                                            <Text style={styles.bankInfoText}>Acct Name: EMI Group Admin</Text>
                                            <Text style={styles.bankInfoText}>Acct No: 1234567890</Text>
                                            <Text style={styles.bankInfoText}>IFSC: HDFC0001234</Text>
                                        </View>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter UTR / Reference Number"
                                            placeholderTextColor="#8899aa"
                                            value={utrNumber}
                                            onChangeText={setUtrNumber}
                                        />
                                    </>
                                )}
                                {paymentMethod === 'cash' && (
                                    <Text style={styles.infoText}>Please hand over the cash to the Admin. Submit to mark this payment as pending cash verification.</Text>
                                )}
                                {paymentMethod === 'other' && (
                                    <>
                                        <Text style={styles.infoText}>Upload a screenshot of your payment receipt.</Text>
                                        <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                                            <Ionicons name="cloud-upload" size={24} color="#fff" />
                                            <Text style={styles.uploadBtnText}>{receiptBase64 ? 'Change Receipt' : 'Select Receipt Image'}</Text>
                                        </TouchableOpacity>
                                        {receiptBase64 && <Image source={{ uri: receiptBase64 }} style={styles.receiptPreview} />}
                                    </>
                                )}

                                <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={() => submitPayment(paymentMethod)} disabled={submitting}>
                                    <Text style={styles.submitBtnText}>Submit Payment Details</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#334455', marginTop: 10 }]} onPress={() => setPaymentMethod('')}>
                                    <Text style={styles.submitBtnText}>Back</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e', paddingHorizontal: 20 },
    center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
    header: { color: '#fff', fontSize: 24, fontWeight: '800', paddingTop: 60, paddingBottom: 16 },
    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 8 },
    pendingBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0a50020', padding: 12, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#f0a500' },
    pendingBannerText: { color: '#f0a500', fontSize: 14, fontWeight: '600', marginLeft: 8 },
    pendingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    pendingInfo: { flex: 1 },
    payBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e94560', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginLeft: 8 },
    payBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', marginLeft: 4 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#556677', fontSize: 14, marginTop: 12 },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1f1f3a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    methodList: { gap: 12 },
    methodBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16162a', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a4a' },
    methodText: { color: '#fff', fontSize: 16, marginLeft: 16 },
    methodDetail: { gap: 16 },
    infoText: { color: '#8899aa', fontSize: 14, lineHeight: 20 },
    bankInfoCard: { backgroundColor: '#16162a', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#6c5ce7' },
    bankInfoText: { color: '#fff', fontSize: 14, marginBottom: 4 },
    input: { backgroundColor: '#16162a', color: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a4a', fontSize: 16 },
    uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e94560', padding: 16, borderRadius: 12 },
    uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
    receiptPreview: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover', marginTop: 12 },
    submitBtn: { backgroundColor: '#00b894', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
