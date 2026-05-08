const cron = require('node-cron');
const Group = require('../models/Group');
const Payment = require('../models/Payment');
const { sendBulkNotifications } = require('../utils/notifications');

const runRemindersNow = async () => {
    console.log('🔄 Running manual/daily EMI reminder job...');
    try {
        const today = new Date();
        const currentDay = today.getDate();

        // Find all active groups
        const activeGroups = await Group.find({ status: 'active' }).populate('members');

        for (const group of activeGroups) {
            // Calculate if today is the reminder day
            const reminderDay = group.dueDay - group.reminderDaysBefore;
            
            // If today is exactly the reminder day, send upcoming reminders
            if (currentDay === reminderDay) {
                await sendReminders(group, 'upcoming');
            }
            
            // If today is the exact due date, send final warnings
            if (currentDay === group.dueDay) {
                await sendReminders(group, 'due_today');
            }

            // If today is past the due date, send overdue notices
            if (currentDay === group.dueDay + 1) {
                await sendReminders(group, 'overdue');
            }
        }
    } catch (error) {
        console.error('❌ Error in reminder scheduler:', error);
    }
};

const startScheduler = () => {
    console.log('⏰ Initializing EMI Reminder Scheduler...');

    // Run every day at 10:00 AM
    cron.schedule('0 10 * * *', async () => {
        await runRemindersNow();
    });
};

const sendReminders = async (group, type) => {
    try {
        // Find members who haven't paid this month yet (status = pending/rejected)
        const pendingPayments = await Payment.find({
            group: group._id,
            month: group.currentMonth,
            status: { $in: ['pending', 'rejected'] }
        }).populate('user', 'expoPushToken name');

        const tokens = pendingPayments
            .map(p => p.user?.expoPushToken)
            .filter(token => token);

        if (tokens.length === 0) return;

        let title = '';
        let body = '';

        if (type === 'upcoming') {
            title = '⏰ Upcoming EMI Reminder';
            body = `Your EMI for ${group.name} is due in ${group.reminderDaysBefore} days! Please keep your payment ready.`;
        } else if (type === 'due_today') {
            title = '⚠️ EMI Due Today!';
            body = `Today is the last day to pay your EMI for ${group.name}. Please pay immediately to avoid late fees.`;
        } else if (type === 'overdue') {
            title = '🚨 Overdue EMI Notice';
            body = `Your EMI for ${group.name} is now OVERDUE. Please pay immediately.`;
        }

        console.log(`Sending ${type} reminders to ${tokens.length} members for group ${group.name}`);
        
        await sendBulkNotifications(tokens, title, body, { type: 'emi_reminder', groupId: group._id });
        
    } catch (error) {
        console.error(`Error sending ${type} reminders for group ${group._id}:`, error);
    }
};

module.exports = { startScheduler, runRemindersNow };
