import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
    TextInput, ActivityIndicator, Alert, RefreshControl, FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
    getAdminDashboard, getAdminUsers, updateUserRole, sendBulkNotification,
    triggerReminders, getGroupHealth, getPendingPayments, verifyPayment,
    createEmiCycle, getEligibleMembers, createGroup, getGroups,
} from '../services/api';

const TABS = [
    { id: 'overview', label: 'Overview', icon: 'stats-chart' },
    { id: 'payments', label: 'Payments', icon: 'card' },
    { id: 'groups', label: 'Groups', icon: 'people' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function AdminDashboardScreen({ navigation }) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [refreshing, setRefreshing] = useState(false);

    // Data
    const [stats, setStats] = useState(null);
    const [groupHealth, setGroupHealth] = useState([]);
    const [pendingPayments, setPendingPayments] = useState([]);
    const [allGroups, setAllGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');

    // Loading states
    const [loadingTab, setLoadingTab] = useState(false);
    const [verifying, setVerifying] = useState({});
    const [updatingRole, setUpdatingRole] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Create Group Modal
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupForm, setGroupForm] = useState({
        name: '', emiAmount: '', potAmount: '', reducedEmi: '', maxMembers: '20', totalMonths: '20',
    });

    // Create Cycle Modal (2 steps)
    const [showCreateCycle, setShowCreateCycle] = useState(false);
    const [cycleStep, setCycleStep] = useState(1);
    const [cycleGroupId, setCycleGroupId] = useState('');
    const [cycleEligible, setCycleEligible] = useState([]);
    const [cycleWinnerId, setCycleWinnerId] = useState('');
    const [loadingEligible, setLoadingEligible] = useState(false);

    // Notify Modal
    const [showNotify, setShowNotify] = useState(false);
    const [notifyForm, setNotifyForm] = useState({ title: '', body: '', groupId: '' });

    const loadTabData = async (tab) => {
        setLoadingTab(true);
        try {
            if (tab === 'overview') {
                const [dashRes, healthRes] = await Promise.all([
                    getAdminDashboard(),
                    getGroupHealth(),
                ]);
                setStats(dashRes.data.stats);
                setGroupHealth(healthRes.data.groups || []);
            } else if (tab === 'payments') {
                const res = await getPendingPayments();
                setPendingPayments(res.data.payments || []);
            } else if (tab === 'groups') {
                const res = await getGroups();
                setAllGroups(res.data.groups || []);
            } else if (tab === 'settings') {
                const res = await getAdminUsers({ limit: 100 });
                setUsers(res.data.users || []);
            }
        } catch (err) {
            console.log('Admin load error:', err.message);
        } finally {
            setLoadingTab(false);
        }
    };

    useFocusEffect(useCallback(() => {
        loadTabData(activeTab);
    }, [activeTab]));

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        loadTabData(tab);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadTabData(activeTab);
        setRefreshing(false);
    };

    // ── Payment Actions ──

    const handleVerify = async (paymentId, approve) => {
        setVerifying(prev => ({ ...prev, [paymentId]: true }));
        try {
            await verifyPayment(paymentId, approve ? 'verified' : 'failed');
            setPendingPayments(prev => prev.filter(p => p._id !== paymentId));
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Action failed');
        } finally {
            setVerifying(prev => ({ ...prev, [paymentId]: false }));
        }
    };

    // ── Create Group ──

    const handleCreateGroup = async () => {
        const { name, emiAmount, potAmount, reducedEmi, maxMembers, totalMonths } = groupForm;
        if (!name.trim() || !emiAmount || !potAmount || !reducedEmi) {
            Alert.alert('Required', 'Fill in name, EMI amount, pot amount, and reduced EMI');
            return;
        }
        setSubmitting(true);
        try {
            await createGroup({
                name: name.trim(),
                emiAmount: parseFloat(emiAmount),
                potAmount: parseFloat(potAmount),
                reducedEmi: parseFloat(reducedEmi),
                maxMembers: parseInt(maxMembers) || 20,
                totalMonths: parseInt(totalMonths) || 20,
            });
            setShowCreateGroup(false);
            setGroupForm({ name: '', emiAmount: '', potAmount: '', reducedEmi: '', maxMembers: '20', totalMonths: '20' });
            await loadTabData('groups');
            Alert.alert('Success', 'Group created successfully');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to create group');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Create Cycle ──

    const handleSelectCycleGroup = async (groupId) => {
        setCycleGroupId(groupId);
        setLoadingEligible(true);
        try {
            const res = await getEligibleMembers(groupId);
            setCycleEligible(res.data.members || []);
            setCycleStep(2);
        } catch (err) {
            Alert.alert('Error', 'Failed to load eligible members');
        } finally {
            setLoadingEligible(false);
        }
    };

    const handleCreateCycle = async () => {
        if (!cycleGroupId || !cycleWinnerId) {
            Alert.alert('Required', 'Select a group and winner');
            return;
        }
        setSubmitting(true);
        try {
            await createEmiCycle({ groupId: cycleGroupId, winnerId: cycleWinnerId });
            setShowCreateCycle(false);
            setCycleStep(1);
            setCycleGroupId('');
            setCycleWinnerId('');
            setCycleEligible([]);
            Alert.alert('Success', 'New EMI cycle created and members notified');
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to create cycle');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Notify ──

    const handleSendNotify = async () => {
        if (!notifyForm.title.trim() || !notifyForm.body.trim()) {
            Alert.alert('Required', 'Enter title and message');
            return;
        }
        setSubmitting(true);
        try {
            const payload = { title: notifyForm.title.trim(), body: notifyForm.body.trim() };
            if (notifyForm.groupId) payload.groupId = notifyForm.groupId;
            const res = await sendBulkNotification(payload);
            setShowNotify(false);
            setNotifyForm({ title: '', body: '', groupId: '' });
            Alert.alert('Sent', `Notification delivered to ${res.data.sent} members`);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to send notification');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Role Toggle ──

    const handleToggleRole = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'member' : 'admin';
        Alert.alert(
            'Change Role',
            `Make this user a ${newRole}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm', onPress: async () => {
                        setUpdatingRole(prev => ({ ...prev, [userId]: true }));
                        try {
                            await updateUserRole(userId, newRole);
                            setUsers(prev => prev.map(u =>
                                u._id === userId ? { ...u, role: newRole } : u
                            ));
                        } catch (err) {
                            Alert.alert('Error', err.response?.data?.error || 'Failed to update role');
                        } finally {
                            setUpdatingRole(prev => ({ ...prev, [userId]: false }));
                        }
                    }
                },
            ]
        );
    };

    // ── Tab Renderers ──

    const renderOverview = () => (
        <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        >
            {stats ? (
                <>
                    <View style={styles.statsGrid}>
                        <StatCard icon="people" color="#e94560" value={stats.totalGroups} label="Total Groups" />
                        <StatCard icon="person" color="#00b894" value={stats.totalUsers} label="Members" />
                        <StatCard icon="time" color="#f0a500" value={stats.pendingCount} label="Pending" />
                        <StatCard icon="wallet" color="#6c5ce7"
                            value={`₹${((stats.verifiedAmount || 0) / 1000).toFixed(0)}K`}
                            label="Collected" />
                    </View>

                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsGrid}>
                        <ActionBtn icon="card-outline" label="Verify Payments"
                            badge={stats.pendingCount}
                            onPress={() => handleTabChange('payments')} />
                        <ActionBtn icon="refresh-circle-outline" label="Create Cycle"
                            onPress={() => setShowCreateCycle(true)} />
                        <ActionBtn icon="notifications-outline" label="Send Notify"
                            onPress={() => setShowNotify(true)} />
                        <ActionBtn icon="people-outline" label="Manage Users"
                            onPress={() => handleTabChange('settings')} />
                    </View>

                    {groupHealth.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>Group Health</Text>
                            {groupHealth.map(g => (
                                <View key={g._id} style={styles.healthCard}>
                                    <View style={styles.healthHeader}>
                                        <Text style={styles.healthName}>{g.name}</Text>
                                        <Text style={styles.healthPct}>{g.percentage}%</Text>
                                    </View>
                                    <View style={styles.progressBar}>
                                        <View style={[styles.progressFill, { width: `${g.percentage}%` }]} />
                                    </View>
                                    <Text style={styles.healthSub}>
                                        {g.paid}/{g.totalMembers} paid · {g.pending} pending
                                    </Text>
                                </View>
                            ))}
                        </>
                    )}
                </>
            ) : (
                <View style={styles.tabLoading}>
                    <ActivityIndicator color="#e94560" />
                </View>
            )}
            <View style={{ height: 40 }} />
        </ScrollView>
    );

    const renderPayments = () => (
        <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        >
            <Text style={styles.countLabel}>
                {pendingPayments.length} payment{pendingPayments.length !== 1 ? 's' : ''} awaiting verification
            </Text>

            {loadingTab ? (
                <View style={styles.tabLoading}><ActivityIndicator color="#e94560" /></View>
            ) : pendingPayments.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Ionicons name="checkmark-done-circle" size={48} color="#00b894" />
                    <Text style={styles.emptyText}>All payments verified</Text>
                </View>
            ) : (
                pendingPayments.map(payment => (
                    <View key={payment._id} style={styles.paymentCard}>
                        <View style={styles.paymentRow}>
                            <View style={styles.paymentInfo}>
                                <Text style={styles.paymentName}>
                                    {payment.user?.name || payment.user?.phone || 'Member'}
                                </Text>
                                <Text style={styles.paymentGroup}>
                                    {payment.group?.name || 'Unknown group'}
                                </Text>
                                <Text style={styles.paymentMeta}>
                                    {payment.paymentMethod?.toUpperCase()} · {new Date(payment.paidAt || payment.createdAt).toLocaleDateString('en-IN')}
                                </Text>
                                {payment.upiRef ? (
                                    <Text style={styles.paymentRef}>Ref: {payment.upiRef}</Text>
                                ) : null}
                            </View>
                            <View style={styles.paymentAmountCol}>
                                <Text style={styles.paymentAmount}>₹{payment.amount?.toLocaleString()}</Text>
                                <View style={[styles.methodBadge,
                                    payment.paymentMethod === 'upi' ? styles.badgeUpi :
                                    payment.paymentMethod === 'cash' ? styles.badgeCash : styles.badgeBank
                                ]}>
                                    <Text style={styles.methodBadgeText}>
                                        {payment.paymentMethod || 'upi'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.verifyRow}>
                            <TouchableOpacity
                                style={[styles.rejectBtn, verifying[payment._id] && styles.btnDisabled]}
                                onPress={() => handleVerify(payment._id, false)}
                                disabled={!!verifying[payment._id]}
                            >
                                {verifying[payment._id] ? (
                                    <ActivityIndicator size="small" color="#ff6b6b" />
                                ) : (
                                    <>
                                        <Ionicons name="close" size={14} color="#ff6b6b" />
                                        <Text style={styles.rejectText}>Reject</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.verifyBtn, verifying[payment._id] && styles.btnDisabled]}
                                onPress={() => handleVerify(payment._id, true)}
                                disabled={!!verifying[payment._id]}
                            >
                                {verifying[payment._id] ? (
                                    <ActivityIndicator size="small" color="#00b894" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark" size={14} color="#00b894" />
                                        <Text style={styles.verifyText}>Verify</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}
            <View style={{ height: 40 }} />
        </ScrollView>
    );

    const renderGroups = () => (
        <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        >
            <TouchableOpacity style={styles.createGroupBtn} onPress={() => setShowCreateGroup(true)}>
                <Ionicons name="add-circle-outline" size={20} color="#e94560" />
                <Text style={styles.createGroupText}>Create New Group</Text>
            </TouchableOpacity>

            {loadingTab ? (
                <View style={styles.tabLoading}><ActivityIndicator color="#e94560" /></View>
            ) : allGroups.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No groups yet</Text>
                </View>
            ) : (
                allGroups.map(group => (
                    <TouchableOpacity
                        key={group._id}
                        style={styles.groupRow}
                        onPress={() => navigation.navigate('GroupDetail', { groupId: group._id })}
                    >
                        <View style={styles.groupRowLeft}>
                            <View style={[styles.statusDot, {
                                backgroundColor: group.status === 'active' ? '#00b894' : '#f0a500'
                            }]} />
                            <View>
                                <Text style={styles.groupRowName}>{group.name}</Text>
                                <Text style={styles.groupRowMeta}>
                                    {group.members?.length || 0} members · Month {group.currentMonth}/{group.totalMonths}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.groupRowRight}>
                            <Text style={styles.groupRowAmt}>₹{group.emiAmount?.toLocaleString()}</Text>
                            <Text style={styles.groupRowAmtLabel}>EMI</Text>
                        </View>
                    </TouchableOpacity>
                ))
            )}
            <View style={{ height: 40 }} />
        </ScrollView>
    );

    const filteredUsers = users.filter(u =>
        !userSearch ||
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone?.includes(userSearch)
    );

    const renderSettings = () => (
        <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />}
        >
            {/* Create Cycle */}
            <Text style={styles.sectionTitle}>EMI Cycles</Text>
            <TouchableOpacity style={styles.settingsCard} onPress={() => setShowCreateCycle(true)}>
                <View style={styles.settingsCardLeft}>
                    <Ionicons name="refresh-circle" size={28} color="#6c5ce7" />
                    <View style={styles.settingsCardInfo}>
                        <Text style={styles.settingsCardTitle}>Create Next Cycle</Text>
                        <Text style={styles.settingsCardSub}>Select group and BC draw winner</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#556677" />
            </TouchableOpacity>

            {/* Notifications */}
            <Text style={styles.sectionTitle}>Notifications</Text>
            <TouchableOpacity style={styles.settingsCard} onPress={() => setShowNotify(true)}>
                <View style={styles.settingsCardLeft}>
                    <Ionicons name="notifications" size={28} color="#f0a500" />
                    <View style={styles.settingsCardInfo}>
                        <Text style={styles.settingsCardTitle}>Send Bulk Notification</Text>
                        <Text style={styles.settingsCardSub}>Push message to all or specific group</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#556677" />
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.settingsCard}
                onPress={async () => {
                    try {
                        await triggerReminders();
                        Alert.alert('Done', 'EMI reminders sent to members with pending payments');
                    } catch (err) {
                        Alert.alert('Error', err.response?.data?.error || 'Failed');
                    }
                }}
            >
                <View style={styles.settingsCardLeft}>
                    <Ionicons name="alarm" size={28} color="#e94560" />
                    <View style={styles.settingsCardInfo}>
                        <Text style={styles.settingsCardTitle}>Trigger EMI Reminders</Text>
                        <Text style={styles.settingsCardSub}>Manually run the reminder scheduler</Text>
                    </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#556677" />
            </TouchableOpacity>

            {/* User Management */}
            <Text style={styles.sectionTitle}>User Management</Text>
            <TextInput
                style={styles.searchInput}
                value={userSearch}
                onChangeText={setUserSearch}
                placeholder="Search name or phone…"
                placeholderTextColor="#556677"
            />

            {loadingTab ? (
                <View style={styles.tabLoading}><ActivityIndicator color="#e94560" /></View>
            ) : (
                filteredUsers.map(u => (
                    <View key={u._id} style={styles.userRow}>
                        <View style={styles.userInfo}>
                            <Text style={styles.userName}>{u.name || '(no name)'}</Text>
                            <Text style={styles.userPhone}>{u.phone}</Text>
                        </View>
                        <View style={styles.userRight}>
                            <View style={[styles.roleBadge,
                                u.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeMember
                            ]}>
                                <Text style={styles.roleBadgeText}>{u.role}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.roleToggleBtn}
                                onPress={() => handleToggleRole(u._id, u.role)}
                                disabled={!!updatingRole[u._id]}
                            >
                                {updatingRole[u._id] ? (
                                    <ActivityIndicator size="small" color="#e94560" />
                                ) : (
                                    <Text style={styles.roleToggleText}>
                                        {u.role === 'admin' ? '→ Member' : '→ Admin'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}
            <View style={{ height: 40 }} />
        </ScrollView>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Admin Panel</Text>
                <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={14} color="#e94560" />
                    <Text style={styles.adminBadgeText}>ADMIN</Text>
                </View>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
                        onPress={() => handleTabChange(tab.id)}
                    >
                        <Ionicons
                            name={tab.icon}
                            size={18}
                            color={activeTab === tab.id ? '#e94560' : '#556677'}
                        />
                        <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tab Content */}
            <View style={styles.tabContent}>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'payments' && renderPayments()}
                {activeTab === 'groups' && renderGroups()}
                {activeTab === 'settings' && renderSettings()}
            </View>

            {/* Create Group Modal */}
            <Modal visible={showCreateGroup} transparent animationType="slide" onRequestClose={() => setShowCreateGroup(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create Group</Text>
                            <TouchableOpacity onPress={() => setShowCreateGroup(false)}>
                                <Ionicons name="close" size={22} color="#8899aa" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {[
                                { field: 'name', label: 'Group Name', placeholder: 'e.g. Alpha Chit Fund', keyboard: 'default' },
                                { field: 'emiAmount', label: 'EMI Amount (₹)', placeholder: '5000', keyboard: 'numeric' },
                                { field: 'potAmount', label: 'Pot Amount (₹)', placeholder: '100000', keyboard: 'numeric' },
                                { field: 'reducedEmi', label: "Winner's Reduced EMI (₹)", placeholder: '2000', keyboard: 'numeric' },
                                { field: 'maxMembers', label: 'Max Members', placeholder: '20', keyboard: 'numeric' },
                                { field: 'totalMonths', label: 'Total Months', placeholder: '20', keyboard: 'numeric' },
                            ].map(({ field, label, placeholder, keyboard }) => (
                                <View key={field} style={styles.formField}>
                                    <Text style={styles.formLabel}>{label}</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={groupForm[field]}
                                        onChangeText={v => setGroupForm(prev => ({ ...prev, [field]: v }))}
                                        placeholder={placeholder}
                                        placeholderTextColor="#556677"
                                        keyboardType={keyboard}
                                    />
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.modalBtn, submitting && styles.btnDisabled]}
                            onPress={handleCreateGroup}
                            disabled={submitting}
                        >
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Create Group</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Create Cycle Modal */}
            <Modal visible={showCreateCycle} transparent animationType="slide" onRequestClose={() => { setShowCreateCycle(false); setCycleStep(1); }}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {cycleStep === 1 ? 'Step 1: Select Group' : 'Step 2: Select Winner'}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowCreateCycle(false); setCycleStep(1); setCycleGroupId(''); setCycleWinnerId(''); }}>
                                <Ionicons name="close" size={22} color="#8899aa" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.cycleScroll}>
                            {cycleStep === 1 ? (
                                allGroups.filter(g => g.status === 'active').length === 0 ? (
                                    <Text style={styles.emptyText}>No active groups found</Text>
                                ) : (
                                    allGroups.filter(g => g.status === 'active').map(g => (
                                        <TouchableOpacity
                                            key={g._id}
                                            style={[styles.selectRow, cycleGroupId === g._id && styles.selectRowActive]}
                                            onPress={() => handleSelectCycleGroup(g._id)}
                                            disabled={loadingEligible}
                                        >
                                            <Text style={styles.selectRowText}>{g.name}</Text>
                                            <Text style={styles.selectRowSub}>
                                                Month {g.currentMonth}/{g.totalMonths} · {g.members?.length || 0} members
                                            </Text>
                                            {loadingEligible && cycleGroupId === g._id && (
                                                <ActivityIndicator size="small" color="#e94560" style={{ marginTop: 4 }} />
                                            )}
                                        </TouchableOpacity>
                                    ))
                                )
                            ) : (
                                <>
                                    <TouchableOpacity style={styles.backStepBtn} onPress={() => { setCycleStep(1); setCycleWinnerId(''); }}>
                                        <Ionicons name="arrow-back" size={14} color="#e94560" />
                                        <Text style={styles.backStepText}>Change Group</Text>
                                    </TouchableOpacity>
                                    {cycleEligible.length === 0 ? (
                                        <Text style={styles.emptyText}>No eligible members (all have won)</Text>
                                    ) : (
                                        cycleEligible.map(m => (
                                            <TouchableOpacity
                                                key={m._id}
                                                style={[styles.selectRow, cycleWinnerId === m._id && styles.selectRowActive]}
                                                onPress={() => setCycleWinnerId(m._id)}
                                            >
                                                <Text style={styles.selectRowText}>{m.name || m.phone}</Text>
                                                <Text style={styles.selectRowSub}>{m.phone}</Text>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </>
                            )}
                        </ScrollView>

                        {cycleStep === 2 && cycleWinnerId ? (
                            <TouchableOpacity
                                style={[styles.modalBtn, submitting && styles.btnDisabled]}
                                onPress={handleCreateCycle}
                                disabled={submitting}
                            >
                                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Create Cycle & Notify</Text>}
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* Notify Modal */}
            <Modal visible={showNotify} transparent animationType="slide" onRequestClose={() => setShowNotify(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Send Notification</Text>
                            <TouchableOpacity onPress={() => setShowNotify(false)}>
                                <Ionicons name="close" size={22} color="#8899aa" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.formField}>
                            <Text style={styles.formLabel}>Title *</Text>
                            <TextInput
                                style={styles.formInput}
                                value={notifyForm.title}
                                onChangeText={v => setNotifyForm(prev => ({ ...prev, title: v }))}
                                placeholder="e.g. EMI Reminder"
                                placeholderTextColor="#556677"
                            />
                        </View>
                        <View style={styles.formField}>
                            <Text style={styles.formLabel}>Message *</Text>
                            <TextInput
                                style={[styles.formInput, styles.formTextarea]}
                                value={notifyForm.body}
                                onChangeText={v => setNotifyForm(prev => ({ ...prev, body: v }))}
                                placeholder="Your message here…"
                                placeholderTextColor="#556677"
                                multiline
                                numberOfLines={3}
                            />
                        </View>
                        <View style={styles.formField}>
                            <Text style={styles.formLabel}>Target Group (optional)</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <TouchableOpacity
                                    style={[styles.groupChip, !notifyForm.groupId && styles.groupChipActive]}
                                    onPress={() => setNotifyForm(prev => ({ ...prev, groupId: '' }))}
                                >
                                    <Text style={styles.groupChipText}>All Members</Text>
                                </TouchableOpacity>
                                {allGroups.map(g => (
                                    <TouchableOpacity
                                        key={g._id}
                                        style={[styles.groupChip, notifyForm.groupId === g._id && styles.groupChipActive]}
                                        onPress={() => setNotifyForm(prev => ({ ...prev, groupId: g._id }))}
                                    >
                                        <Text style={styles.groupChipText}>{g.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        <TouchableOpacity
                            style={[styles.modalBtn, submitting && styles.btnDisabled]}
                            onPress={handleSendNotify}
                            disabled={submitting}
                        >
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Send to Members</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ── Small reusable components ──

function StatCard({ icon, color, value, label }) {
    return (
        <View style={[statStyles.card, { borderColor: color, backgroundColor: color + '18' }]}>
            <Ionicons name={icon} size={24} color={color} />
            <Text style={statStyles.value}>{value}</Text>
            <Text style={statStyles.label}>{label}</Text>
        </View>
    );
}

function ActionBtn({ icon, label, badge, onPress }) {
    return (
        <TouchableOpacity style={actionStyles.btn} onPress={onPress}>
            <View style={actionStyles.iconWrap}>
                <Ionicons name={icon} size={22} color="#e94560" />
                {badge > 0 && (
                    <View style={actionStyles.badge}>
                        <Text style={actionStyles.badgeText}>{badge}</Text>
                    </View>
                )}
            </View>
            <Text style={actionStyles.label}>{label}</Text>
        </TouchableOpacity>
    );
}

const statStyles = StyleSheet.create({
    card: {
        flex: 1,
        borderRadius: 14,
        padding: 14,
        marginHorizontal: 4,
        alignItems: 'center',
        borderWidth: 1,
    },
    value: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 6 },
    label: { color: '#8899aa', fontSize: 10, marginTop: 3, fontWeight: '600', textAlign: 'center' },
});

const actionStyles = StyleSheet.create({
    btn: { alignItems: 'center', flex: 1 },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#e9456018',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#e94560',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    label: { color: '#ccc', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 16,
    },
    headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
    adminBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e9456018',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#e94560',
    },
    adminBadgeText: { color: '#e94560', fontSize: 11, fontWeight: '800', marginLeft: 4, letterSpacing: 0.5 },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#0f3460',
        marginHorizontal: 16,
        borderRadius: 14,
        padding: 4,
        marginBottom: 12,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 10,
        flexDirection: 'column',
    },
    tabItemActive: { backgroundColor: '#1a1a2e' },
    tabLabel: { color: '#556677', fontSize: 10, fontWeight: '600', marginTop: 2 },
    tabLabelActive: { color: '#e94560' },
    tabContent: { flex: 1, paddingHorizontal: 16 },
    tabLoading: { flex: 1, alignItems: 'center', paddingTop: 60 },
    statsGrid: { flexDirection: 'row', marginBottom: 20 },
    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 4 },
    actionsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    countLabel: { color: '#8899aa', fontSize: 13, marginBottom: 12 },
    healthCard: {
        backgroundColor: '#0f3460',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    healthHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    healthName: { color: '#fff', fontSize: 14, fontWeight: '700' },
    healthPct: { color: '#e94560', fontSize: 14, fontWeight: '700' },
    progressBar: {
        height: 6,
        backgroundColor: '#1a1a4e',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressFill: { height: 6, backgroundColor: '#e94560', borderRadius: 3 },
    healthSub: { color: '#8899aa', fontSize: 11 },
    emptyBox: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: '#8899aa', fontSize: 15, marginTop: 12 },
    paymentCard: {
        backgroundColor: '#0f3460',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    paymentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    paymentInfo: { flex: 1 },
    paymentName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    paymentGroup: { color: '#8899aa', fontSize: 12, marginTop: 2 },
    paymentMeta: { color: '#556677', fontSize: 11, marginTop: 3 },
    paymentRef: { color: '#6c5ce7', fontSize: 11, marginTop: 2 },
    paymentAmountCol: { alignItems: 'flex-end' },
    paymentAmount: { color: '#e94560', fontSize: 18, fontWeight: '800' },
    methodBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
    badgeUpi: { backgroundColor: '#00b89420' },
    badgeCash: { backgroundColor: '#f0a50020' },
    badgeBank: { backgroundColor: '#6c5ce720' },
    methodBadgeText: { color: '#ccc', fontSize: 10, fontWeight: '700' },
    verifyRow: { flexDirection: 'row', gap: 8 },
    rejectBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#ff6b6b',
        borderRadius: 10,
        paddingVertical: 8,
        gap: 4,
    },
    rejectText: { color: '#ff6b6b', fontSize: 13, fontWeight: '700' },
    verifyBtn: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00b89420',
        borderWidth: 1,
        borderColor: '#00b894',
        borderRadius: 10,
        paddingVertical: 8,
        gap: 4,
    },
    verifyText: { color: '#00b894', fontSize: 13, fontWeight: '700' },
    btnDisabled: { opacity: 0.5 },
    createGroupBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f3460',
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e94560',
        justifyContent: 'center',
        gap: 8,
    },
    createGroupText: { color: '#e94560', fontSize: 15, fontWeight: '700' },
    groupRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0f3460',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    groupRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
    groupRowName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    groupRowMeta: { color: '#8899aa', fontSize: 12, marginTop: 2 },
    groupRowRight: { alignItems: 'flex-end' },
    groupRowAmt: { color: '#e94560', fontSize: 15, fontWeight: '800' },
    groupRowAmtLabel: { color: '#556677', fontSize: 10 },
    settingsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0f3460',
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    settingsCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    settingsCardInfo: { marginLeft: 14, flex: 1 },
    settingsCardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
    settingsCardSub: { color: '#8899aa', fontSize: 12, marginTop: 2 },
    searchInput: {
        backgroundColor: '#0f3460',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#1a1a4e',
        marginBottom: 12,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0f3460',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    userInfo: { flex: 1 },
    userName: { color: '#fff', fontSize: 14, fontWeight: '700' },
    userPhone: { color: '#8899aa', fontSize: 12, marginTop: 2 },
    userRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    roleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    roleBadgeAdmin: { backgroundColor: '#e9456020', borderWidth: 1, borderColor: '#e94560' },
    roleBadgeMember: { backgroundColor: '#0f3460', borderWidth: 1, borderColor: '#1a1a4e' },
    roleBadgeText: { color: '#ccc', fontSize: 10, fontWeight: '700' },
    roleToggleBtn: {
        backgroundColor: '#1a1a4e',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        minWidth: 72,
        alignItems: 'center',
    },
    roleToggleText: { color: '#e94560', fontSize: 11, fontWeight: '700' },
    // Modals
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: '#0f3460',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
    formField: { marginBottom: 14 },
    formLabel: { color: '#8899aa', fontSize: 12, marginBottom: 6, fontWeight: '600' },
    formInput: {
        backgroundColor: '#1a1a2e',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#fff',
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    formTextarea: { height: 80, textAlignVertical: 'top' },
    modalBtn: {
        backgroundColor: '#e94560',
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: 'center',
        marginTop: 16,
    },
    modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    cycleScroll: { maxHeight: 320 },
    selectRow: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    selectRowActive: { borderColor: '#e94560', backgroundColor: '#e9456018' },
    selectRowText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    selectRowSub: { color: '#8899aa', fontSize: 12, marginTop: 3 },
    backStepBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 6 },
    backStepText: { color: '#e94560', fontSize: 13, fontWeight: '600' },
    groupChip: {
        backgroundColor: '#1a1a2e',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#1a1a4e',
    },
    groupChipActive: { borderColor: '#e94560', backgroundColor: '#e9456018' },
    groupChipText: { color: '#ccc', fontSize: 12, fontWeight: '600' },
});
