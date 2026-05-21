import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getGroups } from '../services/api';
import GroupCard from '../components/GroupCard';
import { F } from '../theme';

export default function GroupListScreen({ navigation }) {
    const { user } = useAuth();
    const { colors } = useTheme();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadGroups = async () => {
        try {
            const res = await getGroups();
            setGroups(res.data.groups || []);
        } catch (err) {
            console.log('Error loading groups:', err.message);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadGroups(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadGroups();
        setRefreshing(false);
    };

    const styles = makeStyles(colors);

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>My Groups</Text>
                <Text style={styles.count}>{groups.length} group{groups.length !== 1 ? 's' : ''}</Text>
            </View>

            <FlatList
                data={groups}
                keyExtractor={item => item._id}
                renderItem={({ item }) => (
                    <GroupCard
                        group={item}
                        onPress={() => navigation.navigate('GroupDetail', { groupId: item._id })}
                    />
                )}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>No Groups Yet</Text>
                        <Text style={styles.emptyBody}>
                            {user?.role === 'admin'
                                ? 'Create a group from the Admin panel.'
                                : "You'll be added to a group by your admin."}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.backgroundSecondary },
        center:    { flex: 1, backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' },
        header: {
            backgroundColor: colors.background,
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
        },
        title:    { fontSize: 24, fontFamily: F.semibold, color: colors.text },
        count:    { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, marginBottom: 2 },
        list:     { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 90 },
        emptyBox: {
            borderRadius: 12,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.border,
            backgroundColor: colors.background,
            padding: 32,
            alignItems: 'center',
            marginTop: 20,
        },
        emptyTitle: { fontSize: 16, fontFamily: F.medium, color: colors.text, marginTop: 12 },
        emptyBody:  { fontSize: 14, fontFamily: F.regular, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 20 },
    });
}
