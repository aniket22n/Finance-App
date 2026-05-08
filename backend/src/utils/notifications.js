const { Expo } = require('expo-server-sdk');

const expo = new Expo();

/**
 * Send push notification to a single user
 * @param {String} pushToken - Expo push token
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Extra data payload
 */
async function sendPushNotification(pushToken, title, body, data = {}) {
    if (!Expo.isExpoPushToken(pushToken)) {
        console.warn(`Invalid Expo push token: ${pushToken}`);
        return null;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
    };

    try {
        const chunks = expo.chunkPushNotifications([message]);
        const results = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            results.push(...ticketChunk);
        }
        return results;
    } catch (error) {
        console.error('Push notification error:', error);
        return null;
    }
}

/**
 * Send push notification to multiple users
 * @param {Array} tokens - Array of Expo push tokens
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Extra data payload
 */
async function sendBulkNotifications(tokens, title, body, data = {}) {
    const messages = tokens
        .filter(token => Expo.isExpoPushToken(token))
        .map(token => ({
            to: token,
            sound: 'default',
            title,
            body,
            data,
        }));

    if (messages.length === 0) return [];

    try {
        const chunks = expo.chunkPushNotifications(messages);
        const results = [];
        for (const chunk of chunks) {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            results.push(...ticketChunk);
        }
        return results;
    } catch (error) {
        console.error('Bulk notification error:', error);
        return [];
    }
}

module.exports = { sendPushNotification, sendBulkNotifications };
