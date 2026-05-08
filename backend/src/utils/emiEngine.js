/**
 * EMI Engine — Core calculation logic for group pot schemes
 * 
 * Handles:
 * - Monthly EMI amounts per member
 * - Reduced EMI for pot winner
 * - Pot collection totals
 * - Scales for 20-100 members
 */

/**
 * Calculate what each member owes for a given month
 * @param {Object} group - Group document with config
 * @param {String} winnerId - User ID of this month's pot winner
 * @returns {Array} - Array of { userId, amount, isWinner }
 */
function calculateMonthlyDues(group, winnerId) {
    const dues = [];

    for (const memberId of group.members) {
        const memberIdStr = memberId.toString();
        const isWinner = memberIdStr === winnerId.toString();

        dues.push({
            userId: memberIdStr,
            amount: isWinner ? group.reducedEmi : group.emiAmount,
            isWinner,
        });
    }

    return dues;
}

/**
 * Calculate total pot collection for a month
 * @param {Object} group - Group document
 * @returns {Number} - Total pot amount
 */
function calculatePotTotal(group) {
    const memberCount = group.members.length;
    // Pot = (memberCount - 1) * fullEMI + 1 * reducedEMI
    return (memberCount - 1) * group.emiAmount + group.reducedEmi;
}

/**
 * Get group financial summary
 * @param {Object} group - Group document
 * @returns {Object} - Summary stats
 */
function getGroupSummary(group) {
    const memberCount = group.members.length;
    const monthlyCollection = (memberCount - 1) * group.emiAmount + group.reducedEmi;
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

    if (config.minMembers < 20) errors.push('Minimum members must be at least 20');
    if (config.maxMembers > 100) errors.push('Maximum members cannot exceed 100');
    if (config.minMembers > config.maxMembers) errors.push('Min members cannot exceed max members');
    if (config.potAmount <= 0) errors.push('Pot amount must be positive');
    if (config.emiAmount <= 0) errors.push('EMI amount must be positive');
    if (config.reducedEmi < 0) errors.push('Reduced EMI cannot be negative');
    if (config.reducedEmi >= config.emiAmount) errors.push('Reduced EMI must be less than full EMI');
    if (config.totalMonths < config.minMembers) errors.push('Total months must be at least equal to minimum members');

    return { valid: errors.length === 0, errors };
}

module.exports = {
    calculateMonthlyDues,
    calculatePotTotal,
    getGroupSummary,
    validateGroupConfig,
};
