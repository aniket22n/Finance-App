import React, { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import {
    useFonts,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';

function ThemedStatusBar() {
    const { isDark } = useTheme();
    return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

const isExpoGo = Constants.executionEnvironment === 'storeClient';

SplashScreen.preventAutoHideAsync();

if (!isExpoGo) {
    const Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        }),
    });
}

function App() {
    const [fontsLoaded, fontError] = useFonts({
        Poppins_400Regular,
        Poppins_500Medium,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    const onLayoutRootView = useCallback(() => {
        if (fontsLoaded || fontError) {
            SplashScreen.hide();
        }
    }, [fontsLoaded, fontError]);

    useEffect(() => {
        if (isExpoGo) return; // Push notifications unsupported in Expo Go since SDK 53
        registerForPushNotifications();
    }, []);

    const registerForPushNotifications = async () => {
        try {
            const Notifications = require('expo-notifications');
            const { status: existing } = await Notifications.getPermissionsAsync();
            let finalStatus = existing;
            if (existing !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') return;
            await Notifications.getExpoPushTokenAsync();
        } catch (err) {
            // Permission not granted or device doesn't support push
        }
    };

    if (!fontsLoaded && !fontError) return null;

    return (
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <ThemeProvider>
                <AuthProvider>
                    <ThemedStatusBar />
                    <AppNavigator />
                </AuthProvider>
            </ThemeProvider>
        </View>
    );
}

registerRootComponent(App);
export default App;
