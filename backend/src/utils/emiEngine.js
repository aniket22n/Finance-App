/**
 * EMI Engine — Core calculation logic for group pot schemes
 *
 * Convention:
 *   group.emiAmount  — Winner's fixed (higher) EMI, paid by pot winners from the month they win.
 *   group.reducedEmi — Non-winners' reducing (lower) EMI, paid by members who haven't won yet.
 */

/**
 * Calculate what each member owes for a given month
 * @param {Object} group - Group document with config
 * @param {String} winnerId - User ID of this month's pot winner
 * @returns {Array} - Array of { userId, amount, isWinner }
 */
function calculateMonthlyDues(group, winnerId, emiAmount, reducedEmi, pastWinnerIds = []) {
    const ea = emiAmount != null ? emiAmount : group.emiAmount;
    const re = reducedEmi != null ? reducedEmi : group.reducedEmi;
    const dues = [];

    for (const memberId of group.members) {
        // Members may be ObjectIds or populated User docs
        const memberIdStr = (memberId._id || memberId).toString();
        const isCurrentWinner = memberIdStr === winnerId.toString();
        // Past winners also pay the fixed EMI — they already received the pot,
        // so reducedEmi only applies to members who haven't won yet.
        const isAnyWinner = isCurrentWinner || pastWinnerIds.includes(memberIdStr);

        dues.push({
            userId: memberIdStr,
            amount: isAnyWinner ? ea : re,
            isWinner: isCurrentWinner,
        });
    }

    return dues;
}

/**
 * Calculate total pot collection for a month
 * Pot = 1 winner * winnerEMI + (memberCount - 1) * reducingEMI
 */
function calculatePotTotal(group) {
    const memberCount = group.members.length;
    return group.emiAmount + (memberCount - 1) * group.reducedEmi;
}

/**
 * Get group financial summary
 * @param {Object} group - Group document
 * @returns {Object} - Summary stats
 */
function getGroupSummary(group) {
    const memberCount = group.members.length;
    const monthlyCollection = group.emiAmount + (memberCount - 1) * group.reducedEmi;
    const totalCycles = group.totalMonths;
    const remainingCycles = totalCycles - group.currentMonth;
    const progress = totalCycles > 0 ? ((group.currentMonth / totalCycles) * 100).toFixed(1) : 0;

    return {
        memberCount,
        monthlyCollection,
        potAmount: group.potAmount,
        emiAmount: group.emiAmount,
        reducedEmi: group.reducedEmi,
        currentMonth: group.currentMonth,
        totalCycles,
        remainingCycles,
        progress: parseFloat(progress),
    };
}

/**
 * Validate group configuration
 * @param {Object} config - { potAmount, emiAmount, reducedEmi, minMembers, maxMembers, totalMonths }
 * @returns {Object} - { valid, errors }
 */
function validateGroupConfig(config) {
    const errors = [];

    if (config.minMembers < 2) errors.push('Minimum members must be at least 2');
    if (config.maxMembers > 100) errors.push('Maximum members cannot exceed 100');
    if (config.minMembers > config.maxMembers) errors.push('Min members cannot exceed max members');
    if (config.potAmount <= 0) errors.push('Pot amount must be positive');
    if (config.emiAmount <= 0) errors.push('EMI amount must be positive');
    if (config.reducedEmi < 0) errors.push('Reducing EMI cannot be negative');
    if (config.reducedEmi >= config.emiAmount) errors.push('Reducing EMI (non-winners) must be less than Winner EMI');
    if (config.totalMonths < config.minMembers) errors.push('Total months must be at least equal to minimum members');

    return { valid: errors.length === 0, errors };
}

module.exports = {
    calculateMonthlyDues,
    calculatePotTotal,
    getGroupSummary,
    validateGroupConfig,
};
