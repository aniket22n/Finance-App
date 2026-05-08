import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function Avatar({ uri, name, size = 60, style }) {
    const initials = name
        ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    if (uri) {
        return (
            <Image
                source={{ uri }}
                style={[styles.image, { width: size, height: size, borderRadius: size / 2 }, style]}
            />
        );
    }

    return (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }, style]}>
            <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    image: {
        borderWidth: 2,
        borderColor: '#e94560',
    },
    placeholder: {
        backgroundColor: '#16213e',
        borderWidth: 2,
        borderColor: '#e94560',
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: {
        color: '#e94560',
        fontWeight: '700',
    },
});
