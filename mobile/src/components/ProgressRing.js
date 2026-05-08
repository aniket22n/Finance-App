import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export default function ProgressRing({ progress = 0, size = 100, strokeWidth = 8, label }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    const center = size / 2;

    return (
        <View style={styles.container}>
            <Svg width={size} height={size}>
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="#16213e"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="#e94560"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${center} ${center})`}
                />
            </Svg>
            <View style={[styles.labelContainer, { width: size, height: size }]}>
                <Text style={styles.percentage}>{Math.round(progress)}%</Text>
                {label && <Text style={styles.label}>{label}</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { position: 'relative', alignItems: 'center' },
    labelContainer: {
        position: 'absolute',
        top: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    percentage: { color: '#fff', fontSize: 20, fontWeight: '700' },
    label: { color: '#8899aa', fontSize: 11, marginTop: 2 },
});
