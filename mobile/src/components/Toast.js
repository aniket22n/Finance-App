import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { F } from '../theme';

const nativeDriver = Platform.OS !== 'web';

const CONFIG = {
    success: { icon: 'checkmark-circle', bg: '#18A326' },
    error:   { icon: 'close-circle',     bg: '#ED2626' },
    warning: { icon: 'alert-circle',     bg: '#D97706' },
    info:    { icon: 'information-circle', bg: '#2563EB' },
};

export function useToast() {
    const [toast, setToast] = React.useState({ visible: false, message: '', type: 'success' });
    const timer = React.useRef(null);

    const show = (message, type = 'success') => {
        if (timer.current) clearTimeout(timer.current);
        setToast({ visible: true, message, type });
        timer.current = setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 2500);
    };

    return { toast, show };
}

export default function Toast({ message, type = 'success', visible }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity,    { toValue: visible ? 1 : 0,  duration: visible ? 220 : 180, useNativeDriver: nativeDriver }),
            Animated.timing(translateY, { toValue: visible ? 0 : 16, duration: visible ? 220 : 180, useNativeDriver: nativeDriver }),
        ]).start();
    }, [visible]);

    if (!message) return null;
    const { icon, bg } = CONFIG[type] || CONFIG.success;

    return (
        <Animated.View style={[styles.wrap, { opacity, transform: [{ translateY }], backgroundColor: bg, pointerEvents: visible ? 'auto' : 'none' }]}>
            <Ionicons name={icon} size={16} color="#fff" />
            <Text style={styles.text}>{message}</Text>
        </Animated.View>

    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        bottom: 88,
        left: 16,
        right: 16,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        ...Platform.select({
            web:     { boxShadow: '0 4px 12px rgba(0,0,0,0.2)' },
            default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
        }),
        zIndex: 9999,
    },
    text: { fontSize: 13, fontFamily: F.medium, color: '#fff', flex: 1 },
});
