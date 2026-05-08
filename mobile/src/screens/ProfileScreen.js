import React, { useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/api';
import Avatar from '../components/Avatar';
import ProgressRing from '../components/ProgressRing';

export default function ProfileScreen() {
    const { user, updateUser, logout } = useAuth();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await updateProfile({ name, email });
            updateUser(res.data.user);
            setEditing(false);
            Alert.alert('Success', 'Profile updated!');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    const handlePickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
            try {
                const res = await updateProfile({ avatar: base64Uri });
                updateUser(res.data.user);
            } catch (err) {
                Alert.alert('Error', 'Failed to update avatar');
            }
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.header}>Profile</Text>

            {/* Avatar Section */}
            <View style={styles.avatarSection}>
                <TouchableOpacity onPress={handlePickAvatar}>
                    <Avatar uri={user?.avatar} name={user?.name} size={100} />
                    <View style={styles.cameraIcon}>
                        <Ionicons name="camera" size={16} color="#fff" />
                    </View>
                </TouchableOpacity>
                <Text style={styles.userName}>{user?.name || 'Set your name'}</Text>
                <Text style={styles.userPhone}>{user?.phone}</Text>
                <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
                </View>
            </View>

            {/* Progress */}
            <View style={styles.progressCard}>
                <Text style={styles.cardTitle}>Overall Progress</Text>
                <View style={styles.progressRow}>
                    <ProgressRing progress={0} size={80} strokeWidth={6} label="Groups" />
                    <View style={styles.progressInfo}>
                        <Text style={styles.progressLabel}>You're part of active groups.</Text>
                        <Text style={styles.progressLabel}>Keep your payments on track!</Text>
                    </View>
                </View>
            </View>

            {/* Profile Form */}
            <View style={styles.formCard}>
                <View style={styles.formHeader}>
                    <Text style={styles.cardTitle}>Personal Info</Text>
                    {!editing && (
                        <TouchableOpacity onPress={() => setEditing(true)}>
                            <Ionicons name="create-outline" size={20} color="#e94560" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Full Name</Text>
                    {editing ? (
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter your name"
                            placeholderTextColor="#556677"
                        />
                    ) : (
                        <Text style={styles.fieldValue}>{user?.name || '—'}</Text>
                    )}
                </View>

                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    {editing ? (
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter email"
                            placeholderTextColor="#556677"
                            keyboardType="email-address"
                        />
                    ) : (
                        <Text style={styles.fieldValue}>{user?.email || '—'}</Text>
                    )}
                </View>

                <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Phone</Text>
                    <Text style={styles.fieldValue}>{user?.phone}</Text>
                </View>

                {editing && (
                    <View style={styles.editActions}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                                <Text style={styles.saveText}>Save</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Account Actions */}
            <View style={styles.actionsCard}>
                <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={22} color="#e94560" />
                    <Text style={styles.actionText}>Logout</Text>
                    <Ionicons name="chevron-forward" size={18} color="#555" />
                </TouchableOpacity>
            </View>

            <Text style={styles.version}>EMI Group v1.0.0</Text>
            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e', paddingHorizontal: 20 },
    header: {
        color: '#fff', fontSize: 24, fontWeight: '800', paddingTop: 60, paddingBottom: 16,
    },
    avatarSection: { alignItems: 'center', marginBottom: 24 },
    cameraIcon: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: '#e94560', borderRadius: 14, width: 28, height: 28,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#1a1a2e',
    },
    userName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 12 },
    userPhone: { color: '#8899aa', fontSize: 14, marginTop: 4 },
    roleBadge: {
        backgroundColor: '#e9456020', borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 4, marginTop: 8,
    },
    roleText: { color: '#e94560', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    progressCard: {
        backgroundColor: '#0f3460', borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1, borderColor: '#1a1a4e',
    },
    cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
    progressRow: { flexDirection: 'row', alignItems: 'center' },
    progressInfo: { flex: 1, marginLeft: 16 },
    progressLabel: { color: '#8899aa', fontSize: 13, lineHeight: 20 },
    formCard: {
        backgroundColor: '#0f3460', borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1, borderColor: '#1a1a4e',
    },
    formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    field: { marginTop: 14 },
    fieldLabel: { color: '#8899aa', fontSize: 12, fontWeight: '600', marginBottom: 4 },
    fieldValue: { color: '#fff', fontSize: 15 },
    input: {
        backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 14,
        paddingVertical: 10, color: '#fff', fontSize: 15,
        borderWidth: 1, borderColor: '#1a1a4e',
    },
    editActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 10 },
    cancelBtn: {
        backgroundColor: '#1a1a2e', borderRadius: 10,
        paddingHorizontal: 20, paddingVertical: 10,
    },
    cancelText: { color: '#8899aa', fontWeight: '600' },
    saveBtn: {
        backgroundColor: '#e94560', borderRadius: 10,
        paddingHorizontal: 24, paddingVertical: 10,
    },
    saveText: { color: '#fff', fontWeight: '700' },
    actionsCard: {
        backgroundColor: '#0f3460', borderRadius: 16, padding: 4,
        marginBottom: 16, borderWidth: 1, borderColor: '#1a1a4e',
    },
    actionRow: {
        flexDirection: 'row', alignItems: 'center', padding: 14,
    },
    actionText: { color: '#e94560', fontSize: 15, fontWeight: '600', flex: 1, marginLeft: 12 },
    version: { color: '#334455', fontSize: 12, textAlign: 'center', marginTop: 8 },
});
