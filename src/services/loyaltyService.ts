import { db } from './storage/db';
import { LoyaltySettingHistory, LoyaltyHistoryChangeType, SystemSettings } from '@/types';
import { formatLKR } from '@/utils/format';

export const loyaltyService = {
  /**
   * Fetch all loyalty program revision history records, sorted newest first.
   */
  getLoyaltyHistories: (filter?: {
    changeType?: LoyaltyHistoryChangeType;
    search?: string;
  }): LoyaltySettingHistory[] => {
    let list = db.getSnapshot().loyaltyHistories || [];

    if (filter?.changeType && filter.changeType !== 'ALL') {
      list = list.filter((h) => h.changeType === filter.changeType);
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (h) =>
          h.title.toLowerCase().includes(q) ||
          h.summary.toLowerCase().includes(q) ||
          (h.reason && h.reason.toLowerCase().includes(q)) ||
          h.changedBy.toLowerCase().includes(q)
      );
    }

    return list.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Manually record a loyalty setting change entry into the ledger.
   */
  recordLoyaltyHistory: (
    history: Omit<LoyaltySettingHistory, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
  ): LoyaltySettingHistory => {
    const newEntry: LoyaltySettingHistory = {
      ...history,
      id: history.id || `loyalty_hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: history.createdAt || new Date().toISOString(),
    };

    db.update('loyaltyHistories', (prev) => [newEntry, ...(prev || [])]);

    // Also record standard Audit Log for cross-system audit consistency
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: 'usr_admin',
        userName: history.changedBy || 'Admin',
        action: 'SETTINGS_CHANGE',
        entity: 'LoyaltyProgram',
        entityId: 'global',
        details: `Loyalty Program: ${history.summary}${history.reason ? ` - ${history.reason}` : ''}`,
        terminalId: 'BACKOFFICE',
        timestamp: new Date().toISOString(),
      },
      ...(logs || []),
    ]);

    return newEntry;
  },

  /**
   * Compare previous and next system settings, and record a history entry if any loyalty parameter changed.
   */
  trackSettingsChange: (
    prev: SystemSettings,
    next: SystemSettings,
    changedBy: string = 'Admin (Chaminda Silva)',
    customReason?: string
  ): LoyaltySettingHistory | null => {
    const enabledChanged = prev.loyaltyProgramEnabled !== next.loyaltyProgramEnabled;
    const nameChanged = (prev.loyaltyProgramName || '') !== (next.loyaltyProgramName || '');
    const spendChanged = prev.loyaltySpendPerPointCents !== next.loyaltySpendPerPointCents;
    const minSpendChanged = prev.loyaltyMinSpendToEarnCents !== next.loyaltyMinSpendToEarnCents;
    const redeemValChanged = prev.loyaltyPointRedemptionValueCents !== next.loyaltyPointRedemptionValueCents;
    const minRedeemChanged = prev.loyaltyMinPointsToRedeem !== next.loyaltyMinPointsToRedeem;
    const maxCoverageChanged = prev.loyaltyMaxRedemptionPercentPerOrder !== next.loyaltyMaxRedemptionPercentPerOrder;
    const signupChanged = prev.loyaltySignupBonusPoints !== next.loyaltySignupBonusPoints;
    const bdayChanged = prev.loyaltyBirthdayBonusPoints !== next.loyaltyBirthdayBonusPoints;
    const expiryChanged = prev.loyaltyPointsExpiryDays !== next.loyaltyPointsExpiryDays;

    if (
      !enabledChanged &&
      !nameChanged &&
      !spendChanged &&
      !minSpendChanged &&
      !redeemValChanged &&
      !minRedeemChanged &&
      !maxCoverageChanged &&
      !signupChanged &&
      !bdayChanged &&
      !expiryChanged
    ) {
      return null;
    }

    const changes: string[] = [];
    let changeType: LoyaltyHistoryChangeType = 'PROGRAM_CONFIG';
    let title = 'Loyalty Configuration Update';

    if (enabledChanged) {
      changes.push(`Program: ${prev.loyaltyProgramEnabled ? 'Active' : 'Disabled'} → ${next.loyaltyProgramEnabled ? 'Active' : 'Disabled'}`);
      changeType = 'PROGRAM_CONFIG';
      title = next.loyaltyProgramEnabled ? 'Loyalty Program Activated' : 'Loyalty Program Deactivated';
    }

    if (nameChanged) {
      changes.push(`Name: "${prev.loyaltyProgramName || 'Rewards'}" → "${next.loyaltyProgramName || 'Rewards'}"`);
      changeType = 'PROGRAM_CONFIG';
      title = 'Program Rebranded';
    }

    if (spendChanged) {
      const prevRs = formatLKR(prev.loyaltySpendPerPointCents || 10000);
      const nextRs = formatLKR(next.loyaltySpendPerPointCents || 10000);
      changes.push(`Spend: ${prevRs} → ${nextRs}/pt`);
      changeType = 'EARNING_RATE';
      title = 'Points Earning Rate Updated';
    }

    if (minSpendChanged) {
      const prevRs = formatLKR(prev.loyaltyMinSpendToEarnCents || 20000);
      const nextRs = formatLKR(next.loyaltyMinSpendToEarnCents || 20000);
      changes.push(`Min Bill: ${prevRs} → ${nextRs}`);
      if (changeType === 'PROGRAM_CONFIG') changeType = 'EARNING_RATE';
    }

    if (redeemValChanged) {
      const prevRs = formatLKR(prev.loyaltyPointRedemptionValueCents || 100);
      const nextRs = formatLKR(next.loyaltyPointRedemptionValueCents || 100);
      changes.push(`Point Value: ${prevRs} → ${nextRs}/pt`);
      changeType = 'REDEMPTION_VALUE';
      title = 'Redemption Cash Value Updated';
    }

    if (minRedeemChanged) {
      changes.push(`Min Redeem: ${prev.loyaltyMinPointsToRedeem || 50} → ${next.loyaltyMinPointsToRedeem || 50} pts`);
      if (changeType === 'PROGRAM_CONFIG') changeType = 'REDEMPTION_VALUE';
    }

    if (maxCoverageChanged) {
      changes.push(`Max Coverage: ${prev.loyaltyMaxRedemptionPercentPerOrder || 50}% → ${next.loyaltyMaxRedemptionPercentPerOrder || 50}%`);
      if (changeType === 'PROGRAM_CONFIG') changeType = 'VALIDITY_LIMITS';
    }

    if (signupChanged || bdayChanged) {
      if (signupChanged) changes.push(`Signup: ${prev.loyaltySignupBonusPoints || 0} → ${next.loyaltySignupBonusPoints || 0} pts`);
      if (bdayChanged) changes.push(`Birthday: ${prev.loyaltyBirthdayBonusPoints || 0} → ${next.loyaltyBirthdayBonusPoints || 0} pts`);
      changeType = 'BONUS_RULES';
      title = 'Bonus Points Rules Updated';
    }

    if (expiryChanged) {
      changes.push(`Validity: ${prev.loyaltyPointsExpiryDays || 0} → ${next.loyaltyPointsExpiryDays || 0} days`);
      changeType = 'VALIDITY_LIMITS';
      title = 'Points Validity & Expiry Updated';
    }

    if (changes.length > 2) {
      changeType = 'ALL';
      title = 'Loyalty Program Rules Updated';
    }

    const defaultReason = customReason || 'Updated café customer loyalty program settings and points rules';

    return loyaltyService.recordLoyaltyHistory({
      changeType,
      title,
      summary: changes.join(' · '),
      previousSpendPerPointCents: prev.loyaltySpendPerPointCents,
      newSpendPerPointCents: next.loyaltySpendPerPointCents,
      previousRedemptionValueCents: prev.loyaltyPointRedemptionValueCents,
      newRedemptionValueCents: next.loyaltyPointRedemptionValueCents,
      previousMinSpendToEarnCents: prev.loyaltyMinSpendToEarnCents,
      newMinSpendToEarnCents: next.loyaltyMinSpendToEarnCents,
      previousMinPointsToRedeem: prev.loyaltyMinPointsToRedeem,
      newMinPointsToRedeem: next.loyaltyMinPointsToRedeem,
      previousMaxRedemptionPercent: prev.loyaltyMaxRedemptionPercentPerOrder,
      newMaxRedemptionPercent: next.loyaltyMaxRedemptionPercentPerOrder,
      previousSignupBonusPoints: prev.loyaltySignupBonusPoints,
      newSignupBonusPoints: next.loyaltySignupBonusPoints,
      previousBirthdayBonusPoints: prev.loyaltyBirthdayBonusPoints,
      newBirthdayBonusPoints: next.loyaltyBirthdayBonusPoints,
      previousPointsExpiryDays: prev.loyaltyPointsExpiryDays,
      newPointsExpiryDays: next.loyaltyPointsExpiryDays,
      previousProgramName: prev.loyaltyProgramName,
      newProgramName: next.loyaltyProgramName,
      previousProgramEnabled: prev.loyaltyProgramEnabled,
      newProgramEnabled: next.loyaltyProgramEnabled,
      changedBy,
      reason: defaultReason,
    });
  },
};
