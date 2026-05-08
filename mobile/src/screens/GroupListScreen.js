import React, { useState, useCallback } from 'react';
import {
    View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getGroups } from '../services/api';
import GroupCard from '../components/GroupCard';

export default function GroupListScreen({ navigation }) {
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

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#e94560" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>My Groups</Text>
            <FlatList
                data={groups}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <GroupCard
                        group={item}
                        onPress={() => navigation.navigate('GroupDetail', { groupId: item._id })}
                    />
                )}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e94560" />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No groups yet</Text>
                        <Text style={styles.emptySubtext}>You'll see groups here once an admin adds you</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e' },
    center: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
    header: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '800',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 16,
    },
    list: { paddingHorizontal: 20, paddingBottom: 40 },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    emptySubtext: { color: '#8899aa', fontSize: 14, marginTop: 8 },
});
