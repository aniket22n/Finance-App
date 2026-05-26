import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function Avatar({ uri, size = 60, style }) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

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
            <Ionicons name="person" size={size * 0.45} color={colors.textSecondary} />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        image: {
            borderWidth: 1,
            borderColor: colors.border,
        },
        placeholder: {
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });
}
