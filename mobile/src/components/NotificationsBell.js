import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Modal, SectionList,
    ActivityIndicator, Animated, PanResponder, Dimensions, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { F } from '../theme';
import {
    getNotifications, getUnreadCount,
    markNotificationRead, markAllNotificationsRead, deleteNotification,
} from '../services/api';

// Type → icon/colour mapping
const TYPE_META = {
    account_request:    { icon: 'person-add',        colorKey: 'warning' },
    account_approved:   { icon: 'shield-checkmark',  colorKey: 'success' },
    payment_submitted:  { icon: 'wallet',            colorKey: 'info'    },
    payment_verified:   { icon: 'checkmark-circle',  colorKey: 'success' },
    payment_rejected:   { icon: 'close-circle',      colorKey: 'error'   },
};

function routeFor(notification) {
    switch (notification.type) {
        case 'account_request':   return { screen: 'AdminAccountRequests' };
        case 'payment_submitted': return { screen: 'Payments' };
        case 'payment_verified':
        case 'payment_rejected':  return { screen: 'Payments' };
        case 'account_approved':  return null;
        default:                  return null;
    }
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `${days}d`;
    return `${Math.floor(days / 7)}w`;
}

// Bucket notifications into Today / Yesterday / Earlier sections for the SectionList.
function groupSections(items) {
    const now    = new Date();
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
    const today    = startOfDay(now);
    const yesterday = today - 86400_000;

    const buckets = { today: [], yesterday: [], earlier: [] };
    for (const n of items) {
        const t = startOfDay(new Date(n.createdAt));
        if (t === today)         buckets.today.push(n);
        else if (t === yesterday) buckets.yesterday.push(n);
        else                       buckets.earlier.push(n);
    }
    const sections = [];
    if (buckets.today.length)     sections.push({ title: 'Today',     data: buckets.today });
    if (buckets.yesterday.length) sections.push({ title: 'Yesterday', data: buckets.yesterday });
    if (buckets.earlier.length)   sections.push({ title: 'Earlier',   data: buckets.earlier });
    return sections;
}

const SCREEN_W   = Dimensions.get('window').width;
const SCREEN_H   = Dimensions.get('window').height;
const PANEL_H    = SCREEN_H * 0.55;
const SWIPE_TRIG = 80;

// ── Single notification row with swipe-to-dismiss + tap-to-navigate ──
function SwipeableRow({ item, colors, styles, onPress, onDismiss }) {
    const translateX = useRef(new Animated.Value(0)).current;
    const dismissing = useRef(false);

    const pan = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
            onPanResponderMove: (_, g) => {
                if (dismissing.current) return;
                if (g.dx < 0) translateX.setValue(g.dx);
            },
            onPanResponderRelease: (_, g) => {
                if (g.dx < -SWIPE_TRIG) {
                    dismissing.current = true;
                    Animated.timing(translateX, { toValue: -SCREEN_W, duration: 180, useNativeDriver: true })
                        .start(() => onDismiss(item));
                } else {
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
                }
            },
            onPanResponderTerminate: () => {
                Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            },
        })
    ).current;

    const meta  = TYPE_META[item.type] || { icon: 'notifications', colorKey: 'primary' };
    const color = colors[meta.colorKey] || colors.primary;
    const tint  = colors[meta.colorKey + 'Light'] || colors.primaryLight;

    const dismissBgOpacity = translateX.interpolate({
        inputRange:  [-SCREEN_W, -SWIPE_TRIG, 0],
        outputRange: [1, 0.7, 0],
        extrapolate: 'clamp',
    });

    return (
        <View style={styles.rowOuter}>
            <Animated.View style={[styles.dismissBg, { opacity: dismissBgOpacity }]}>
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={styles.dismissTxt}>Dismiss</Text>
            </Animated.View>

            <Animated.View style={{ transform: [{ translateX }], backgroundColor: colors.background }} {...pan.panHandlers}>
                <TouchableOpacity
                    style={[styles.item, !item.read && styles.itemUnread]}
                    onPress={() => onPress(item)}
                    activeOpacity={0.75}
                >
                    <View style={[styles.itemIconWrap, { backgroundColor: tint, borderColor: color }]}>
                        <Ionicons name={meta.icon} size={16} color={color} />
                    </View>
                    <View style={styles.itemContent}>
                        <View style={styles.itemTitleRow}>
                            <Text style={[styles.itemTitle, !item.read && styles.itemTitleUnread]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
                        </View>
                        {item.body ? <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text> : null}
                    </View>
                    {!item.read && <View style={styles.unreadDot} />}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

export default function NotificationsBell() {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [marking, setMarking] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Slide-down panel animation.
    const slide = useRef(new Animated.Value(-PANEL_H)).current;
    const backdrop = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (open) {
            Animated.parallel([
                Animated.timing(slide,    { toValue: 0,   duration: 260, useNativeDriver: true }),
                Animated.timing(backdrop, { toValue: 1,   duration: 260, useNativeDriver: true }),
            ]).start();
        } else {
            slide.setValue(-PANEL_H);
            backdrop.setValue(0);
        }
    }, [open]);

    const refreshCount = useCallback(async () => {
        try { const res = await getUnreadCount(); setUnread(res.data?.count || 0); } catch { /* silent */ }
    }, []);

    useFocusEffect(useCallback(() => { refreshCount(); }, [refreshCount]));

    const loadList = useCallback(async () => {
        setLoading(true);
        try { const res = await getNotifications(); setItems(res.data?.notifications || []); }
        catch { setItems([]); }
        finally { setLoading(false); }
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const res = await getNotifications();
            setItems(res.data?.notifications || []);
            await refreshCount();
        } finally { setRefreshing(false); }
    }, [refreshCount]);

    const openModal = () => { setOpen(true); loadList(); };

    const closeModal = () => {
        Animated.parallel([
            Animated.timing(slide,    { toValue: -PANEL_H, duration: 220, useNativeDriver: true }),
            Animated.timing(backdrop, { toValue: 0,        duration: 220, useNativeDriver: true }),
        ]).start(() => { setOpen(false); refreshCount(); });
    };

    // Drag-down handle to dismiss
    const dragHandle = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
            onPanResponderMove: (_, g) => { if (g.dy > 0) slide.setValue(Math.min(0, -g.dy * 0.6)); },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 60) closeModal();
                else Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
            },
        })
    ).current;

    const flipReadFlag = async (item) => {
        if (item.read) return;
        setItems(prev => prev.map(n => n._id === item._id ? { ...n, read: true } : n));
        setUnread(c => Math.max(0, c - 1));
        try { await markNotificationRead(item._id); }
        catch {
            setItems(prev => prev.map(n => n._id === item._id ? { ...n, read: false } : n));
            setUnread(c => c + 1);
        }
    };

    const handlePress = async (item) => {
        await flipReadFlag(item);
        const target = routeFor(item);
        if (target) {
            closeModal();
            setTimeout(() => navigation.navigate(target.screen, target.params || {}), 240);
        }
    };

    const handleDismiss = async (item) => {
        setItems(prev => prev.filter(n => n._id !== item._id));
        if (!item.read) setUnread(c => Math.max(0, c - 1));
        try { await deleteNotification(item._id); }
        catch {
            setItems(prev => [item, ...prev]);
            if (!item.read) setUnread(c => c + 1);
        }
    };

    const handleMarkAll = async () => {
        if (unread === 0 || marking) return;
        setMarking(true);
        const previous = items;
        setItems(prev => prev.map(n => ({ ...n, read: true })));
        setUnread(0);
        try { await markAllNotificationsRead(); }
        catch { setItems(previous); refreshCount(); }
        finally { setMarking(false); }
    };

    const sections = useMemo(() => groupSections(items), [items]);

    return (
        <>
            <TouchableOpacity
                onPress={openModal}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
                style={styles.bellWrap}
            >
                <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={22} color={colors.text} />
                {unread > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeTxt}>{unread > 99 ? '99+' : String(unread)}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="none" onRequestClose={closeModal} statusBarTranslucent>
                <Animated.View style={[styles.overlay, { opacity: backdrop }]}>
                    <TouchableOpacity style={styles.overlayTouch} activeOpacity={1} onPress={closeModal} />
                </Animated.View>

                <Animated.View style={[styles.panel, { transform: [{ translateY: slide }] }]}>
                    {/* Header (drag-to-dismiss area) */}
                    <View {...dragHandle.panHandlers}>
                        <View style={styles.dragHandle} />
                        <View style={styles.panelHeader}>
                            <View style={styles.panelHeaderLeft}>
                                <View style={styles.bellHeaderIcon}>
                                    <Ionicons name="notifications" size={14} color={colors.primary} />
                                </View>
                                <View>
                                    <Text style={styles.panelTitle}>Notifications</Text>
                                    <Text style={styles.panelSubtitle}>
                                        {unread > 0 ? `${unread} new` : 'You\'re all caught up'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.panelHeaderRight}>
                                {unread > 0 ? (
                                    <TouchableOpacity
                                        style={styles.markAllBtn}
                                        onPress={handleMarkAll}
                                        disabled={marking}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="checkmark-done" size={13} color={colors.primary} />
                                        <Text style={styles.markAllTxt}>{marking ? '…' : 'Mark all'}</Text>
                                    </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity
                                    onPress={closeModal}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    style={styles.closeBtn}
                                >
                                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {loading ? (
                        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
                    ) : items.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <View style={styles.emptyIconWrap}>
                                <Ionicons name="notifications-off-outline" size={28} color={colors.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>You're all caught up</Text>
                            <Text style={styles.emptyHint}>New activity will show up here.</Text>
                        </View>
                    ) : (
                        <SectionList
                            sections={sections}
                            keyExtractor={n => n._id}
                            renderSectionHeader={({ section }) => (
                                <Text style={styles.sectionHeader}>{section.title}</Text>
                            )}
                            renderItem={({ item }) => (
                                <SwipeableRow
                                    item={item}
                                    colors={colors}
                                    styles={styles}
                                    onPress={handlePress}
                                    onDismiss={handleDismiss}
                                />
                            )}
                            stickySectionHeadersEnabled={false}
                            contentContainerStyle={{ paddingBottom: 16 }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                            }
                        />
                    )}
                </Animated.View>
            </Modal>
        </>
    );
}

function makeStyles(colors) {
    return StyleSheet.create({
        bellWrap: { position: 'relative', padding: 2 },
        badge: {
            position: 'absolute', top: -2, right: -4,
            minWidth: 16, height: 16, borderRadius: 8,
            backgroundColor: colors.error,
            alignItems: 'center', justifyContent: 'center',
            paddingHorizontal: 4,
            borderWidth: 1.5, borderColor: colors.background,
        },
        badgeTxt: { fontSize: 9, fontFamily: F.bold, color: '#fff' },

        // Backdrop
        overlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.5)',
        },
        overlayTouch: { flex: 1 },

        // Panel — slides down from top, occupies ~55% height
        panel: {
            position: 'absolute', top: 0, left: 0, right: 0,
            height: PANEL_H,
            backgroundColor: colors.background,
            borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
            overflow: 'hidden',
            // Subtle depth — works in both light + dark
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.18,
            shadowRadius: 12,
            elevation: 12,
        },

        // Drag-to-dismiss handle
        dragHandle: {
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: colors.borderSecondary,
            alignSelf: 'center', marginTop: 44, marginBottom: 10,
        },

        // Header
        panelHeader: {
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingBottom: 14,
            borderBottomWidth: 1, borderBottomColor: colors.border,
        },
        panelHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
        panelHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        bellHeaderIcon: {
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: colors.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.primary,
        },
        panelTitle:    { fontSize: 15, fontFamily: F.bold, color: colors.text },
        panelSubtitle: { fontSize: 11, fontFamily: F.regular, color: colors.textSecondary, marginTop: 1 },
        markAllBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 10, paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: colors.primaryLight,
            borderWidth: 1, borderColor: colors.primary,
        },
        markAllTxt: { fontSize: 11, fontFamily: F.semibold, color: colors.primary },
        closeBtn: {
            width: 30, height: 30, borderRadius: 15,
            backgroundColor: colors.backgroundSecondary,
            alignItems: 'center', justifyContent: 'center',
        },

        // Section header
        sectionHeader: {
            fontSize: 10, fontFamily: F.bold,
            color: colors.textTertiary, letterSpacing: 0.8,
            paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
            backgroundColor: colors.background,
        },

        // Center / empty
        center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
        emptyBox: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
        emptyIconWrap: {
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: colors.primaryLight,
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 12, borderWidth: 1, borderColor: colors.primary,
        },
        emptyTitle: { fontSize: 14, fontFamily: F.bold, color: colors.text },
        emptyHint:  { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 4 },

        // Row outer wrapper (holds reveal layer + draggable row)
        rowOuter: { position: 'relative', backgroundColor: colors.background },
        dismissBg: {
            position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
            backgroundColor: colors.error,
            alignItems: 'flex-end', justifyContent: 'center',
            paddingRight: 24, flexDirection: 'row', gap: 6,
        },
        dismissTxt: { color: '#fff', fontSize: 12, fontFamily: F.bold },

        item: {
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingVertical: 12,
            backgroundColor: colors.background,
        },
        itemUnread: { backgroundColor: colors.backgroundSecondary },
        itemIconWrap: {
            width: 36, height: 36, borderRadius: 18,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12, borderWidth: 1,
        },
        itemContent: { flex: 1, minWidth: 0 },
        itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        itemTitle:   { flex: 1, fontSize: 13, fontFamily: F.medium, color: colors.text },
        itemTitleUnread: { fontFamily: F.bold },
        itemTime:    { fontSize: 11, fontFamily: F.regular, color: colors.textTertiary },
        itemBody:    { fontSize: 12, fontFamily: F.regular, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
        unreadDot:   {
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: colors.primary,
            marginLeft: 8,
        },
    });
}
