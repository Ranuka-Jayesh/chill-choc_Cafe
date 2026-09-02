import { db } from './storage/db';
import { realtimeSocketService } from './realtimeSocketService';
import { SystemSettings, AuditLog, AuditAction } from '@/types';

const DEFAULT_LOYALTY_SETTINGS = {
  loyaltyProgramEnabled: true,
  loyaltyProgramName: 'Chill Club Rewards',
  loyaltySpendPerPointCents: 10000,
  loyaltyMinSpendToEarnCents: 20000,
  loyaltyPointRedemptionValueCents: 100,
  loyaltyMinPointsToRedeem: 50,
  loyaltyMaxRedemptionPercentPerOrder: 50,
  loyaltySignupBonusPoints: 25,
  loyaltyBirthdayBonusPoints: 50,
  loyaltyPointsExpiryDays: 365,
};

export const settingsService = {
  getSettings: (): SystemSettings => {
    const s = db.getSnapshot().settings;
    return {
      ...DEFAULT_LOYALTY_SETTINGS,
      ...s,
    };
  },

  updateSettings: (partial: Partial<SystemSettings>, userId = 'usr_admin', userName = 'Admin'): SystemSettings => {
    const oldSettings = db.getSnapshot().settings;
    const updated = {
      ...oldSettings,
      ...partial,
    };
    db.update('settings', () => updated);

    // Audit log
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId,
        userName,
        action: 'SETTINGS_CHANGE',
        entity: 'SystemSettings',
        entityId: 'global',
        details: `Updated settings: ${Object.keys(partial).join(', ')}`,
        terminalId: 'BACKOFFICE',
        timestamp: new Date().toISOString(),
      },
      ...logs,
    ]);

    realtimeSocketService.emitSettingsChanged(updated);

    return updated;
  },
};

export const auditService = {
  getLogs: (): AuditLog[] => {
    return db.getSnapshot().auditLogs;
  },

  log: (params: {
    userId: string;
    userName: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    details?: string;
    terminalId?: string;
  }): void => {
    const newLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      terminalId: params.terminalId || 'POS-01',
      timestamp: new Date().toISOString(),
    };
    db.update('auditLogs', (logs) => [newLog, ...logs]);
  },
};
