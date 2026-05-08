import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

function App() {
    useEffect(() => {
        registerForPushNotifications();
    }, []);

    const registerForPushNotifications = async () => {
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Push notification permission not granted');
                return;
            }

            const token = (await Notifications.getExpoPushTokenAsync()).data;
            console.log('Expo Push Token:', token);
            // Token will be sent to backend when user updates profile
        } catch (err) {
            console.log('Push notification setup error:', err);
        }
    };

    return (
        <AuthProvider>
            <StatusBar style="light" />
            <AppNavigator />
        </AuthProvider>
    );
}

registerRootComponent(App);
export default App;
