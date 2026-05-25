import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import { getPendingPayments } from '../services/api';

// Auth screens
import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import SignUpOTPScreen from '../screens/SignUpOTPScreen';
import SetPINScreen from '../screens/SetPINScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import ForgotPINScreen from '../screens/ForgotPINScreen';
import ResetPINOTPScreen from '../screens/ResetPINOTPScreen';
import ResetPINScreen from '../screens/ResetPINScreen';
import SignupPendingScreen from '../screens/SignupPendingScreen';

// Main screens
import HomeScreen from '../screens/HomeScreen';
import GroupListScreen from '../screens/GroupListScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import PaymentScreen from '../screens/PaymentScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminGroupsScreen from '../screens/AdminGroupsScreen';
import AdminPaymentsScreen from '../screens/AdminPaymentsScreen';
import AdminControlsScreen from '../screens/AdminControlsScreen';
import AdminPaymentDetailScreen from '../screens/AdminPaymentDetailScreen';
import AdminAccountRequestsScreen from '../screens/AdminAccountRequestsScreen';
import AdminPOTWinnerConfigScreen from '../screens/AdminPOTWinnerConfigScreen';
import AdminAddMembersScreen from '../screens/AdminAddMembersScreen';
import AdminPaymentOTPScreen from '../screens/AdminPaymentOTPScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    const { user } = useAuth();
    const { colors } = useTheme();
    const isAdmin = user?.role === 'admin';

    // Admin-only: poll the pending-payments count to drive the Payments tab badge.
    const [pendingPayments, setPendingPayments] = useState(0);
    useEffect(() => {
        if (!isAdmin) return;
        let active = true;
        const fetchCount = async () => {
            try {
                const r = await getPendingPayments();
                if (active) setPendingPayments((r.data?.payments || []).length);
            } catch { /* silent — badge just won't update this tick */ }
        };
        fetchCount();
        const t = setInterval(fetchCount, 30_000);
        return () => { active = false; clearInterval(t); };
    }, [isAdmin]);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.background,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: 72,
                    paddingBottom: 14,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarLabelStyle: { fontSize: 11 },
                tabBarBadgeStyle: {
                    backgroundColor: colors.error,
                    color: '#fff',
                    fontSize: 10,
                    fontFamily: F.bold,
                    minWidth: 16,
                    height: 16,
                    lineHeight: 14,
                },
                tabBarIcon: ({ focused, color }) => {
                    let iconName;
                    if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'Groups') iconName = focused ? 'people' : 'people-outline';
                    else if (route.name === 'Payments') iconName = focused ? 'card' : 'card-outline';
                    else if (route.name === 'Admin') iconName = focused ? 'shield' : 'shield-outline';
                    else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
                    return <Ionicons name={iconName} size={24} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={isAdmin ? AdminDashboardScreen : HomeScreen} />
            <Tab.Screen name="Groups" component={isAdmin ? AdminGroupsScreen : GroupListScreen} />
            <Tab.Screen
                name="Payments"
                component={isAdmin ? AdminPaymentsScreen : PaymentScreen}
                options={isAdmin && pendingPayments > 0 ? { tabBarBadge: pendingPayments > 99 ? '99+' : pendingPayments } : {}}
            />
            {isAdmin && <Tab.Screen name="Admin" component={AdminControlsScreen} />}
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const { user, loading } = useAuth();
    const { colors } = useTheme();

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    animation: 'slide_from_right',
                }}
            >
                {user ? (
                    <>
                        <Stack.Screen name="Main" component={MainTabs} />
                        <Stack.Screen
                            name="GroupDetail"
                            component={GroupDetailScreen}
                            options={{
                                headerShown: true,
                                headerTitle: 'Group Details',
                                headerStyle: { backgroundColor: colors.background },
                                headerTintColor: colors.text,
                                headerShadowVisible: false,
                                headerTitleStyle: { fontFamily: F.semibold, fontSize: 16 },
                                headerBackTitle: '',
                            }}
                        />
                        <Stack.Screen
                            name="AdminPaymentDetail"
                            component={AdminPaymentDetailScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="AdminAccountRequests"
                            component={AdminAccountRequestsScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="AdminPOTWinnerConfig"
                            component={AdminPOTWinnerConfigScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="AdminAddMembers"
                            component={AdminAddMembersScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="AdminPaymentOTP"
                            component={AdminPaymentOTPScreen}
                            options={{ headerShown: false }}
                        />
                    </>
                ) : (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="SignUp" component={SignUpScreen} />
                        <Stack.Screen name="SignUpOTP" component={SignUpOTPScreen} />
                        <Stack.Screen name="SetPIN" component={SetPINScreen} />
                        <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
                        <Stack.Screen name="ForgotPIN" component={ForgotPINScreen} />
                        <Stack.Screen name="ResetPINOTP" component={ResetPINOTPScreen} />
                        <Stack.Screen name="ResetPIN" component={ResetPINScreen} />
                        <Stack.Screen name="SignupPending" component={SignupPendingScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
