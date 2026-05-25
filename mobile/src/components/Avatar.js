import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';

export default function Avatar({ uri, name, size = 60, style }) {
    const { colors } = useTheme();
    const styles = makeStyles(colors);

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

function makeStyles(colors) {
    return StyleSheet.create({
        image: {
            borderWidth: 2,
            borderColor: colors.primary,
        },
        placeholder: {
            backgroundColor: colors.primaryLight,
            borderWidth: 2,
            borderColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        initials: {
            color: colors.primary,
            fontFamily: F.bold,
        },
    });
}
