import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import GroupListScreen from '../screens/GroupListScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import PaymentScreen from '../screens/PaymentScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#0f3460',
                    borderTopColor: '#1a1a4e',
                    borderTopWidth: 1,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 6,
                },
                tabBarActiveTintColor: '#e94560',
                tabBarInactiveTintColor: '#556677',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'Groups') iconName = focused ? 'people' : 'people-outline';
                    else if (route.name === 'Payments') iconName = focused ? 'card' : 'card-outline';
                    else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
                    return <Ionicons name={iconName} size={22} color={color} />;
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Groups" component={GroupListScreen} />
            <Tab.Screen name="Payments" component={PaymentScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: '#1a1a2e' },
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
                                headerStyle: { backgroundColor: '#1a1a2e' },
                                headerTintColor: '#fff',
                                headerShadowVisible: false,
                            }}
                        />
                    </>
                ) : (
                    <Stack.Screen name="Login" component={LoginScreen} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
