import { db, sanitizeSystemSettingsForSupabase } from './storage/db';
import { supabase } from './supabaseClient';
import { realtimeSocketService } from './realtimeSocketService';
import { receiptSocketService } from './receiptSocketService';
import { SystemSettings, AuditLog, AuditAction, ReceiptCustomizationSettings, KotCustomizationSettings } from '@/types';

export const settingsService = {
  getSettings: (): SystemSettings => {
    return db.getSnapshot().settings;
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

  /**
   * Save Receipt Customization directly into database (0ms instant response) and sync in background
   */
  saveReceiptCustomization: async (
    receiptCustom: ReceiptCustomizationSettings,
    userId = 'usr_admin',
    userName = 'Admin'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Instantly update local DB memory & localStorage (0ms, guarantees instant persistence on refresh)
      db.update('settings', (prev) => ({
        ...prev,
        businessName: receiptCustom.businessName !== undefined ? receiptCustom.businessName : prev.businessName,
        tagline: receiptCustom.tagline !== undefined ? receiptCustom.tagline : prev.tagline,
        address: receiptCustom.address !== undefined ? receiptCustom.address : prev.address,
        phone: receiptCustom.phone !== undefined ? receiptCustom.phone : prev.phone,
        email: receiptCustom.email !== undefined ? receiptCustom.email : prev.email,
        receiptFooter: receiptCustom.receiptFooter !== undefined ? receiptCustom.receiptFooter : prev.receiptFooter,
        receiptCustomization: receiptCustom,
      }));

      // 2. Broadcast updates in parallel without blocking UI
      receiptSocketService.broadcastReceiptUpdate(receiptCustom, 'Admin Studio Save').catch(console.warn);
      realtimeSocketService.broadcast('RECEIPT_TEMPLATE_CHANGED', receiptCustom);
      realtimeSocketService.emitSettingsChanged(db.getSnapshot().settings);

      // 3. Fast direct cloud upsert to Supabase
      const current = db.getSnapshot().settings;
      const payload = {
        ...current,
        id: 'default',
        businessName: receiptCustom.businessName !== undefined ? receiptCustom.businessName : (current.businessName || ''),
        tagline: receiptCustom.tagline !== undefined ? receiptCustom.tagline : (current.tagline || ''),
        address: receiptCustom.address !== undefined ? receiptCustom.address : (current.address || ''),
        phone: receiptCustom.phone !== undefined ? receiptCustom.phone : (current.phone || ''),
        email: receiptCustom.email !== undefined ? receiptCustom.email : (current.email || ''),
        receiptFooter: receiptCustom.receiptFooter !== undefined ? receiptCustom.receiptFooter : (current.receiptFooter || ''),
        receiptCustomization: receiptCustom,
        updatedAt: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('system_settings')
        .upsert(sanitizeSystemSettingsForSupabase(payload));

      if (upsertErr) {
        console.error('CRITICAL: Supabase system_settings upsert error:', upsertErr);
        return { success: false, error: upsertErr.message };
      }

      // 4. Audit Log
      db.update('auditLogs', (logs) => [
        {
          id: `aud_${Date.now()}`,
          userId,
          userName,
          action: 'SETTINGS_CHANGE',
          entity: 'SystemSettings',
          entityId: 'receiptCustomization',
          details: `Saved receipt design template: ${receiptCustom.businessName || 'Default'} (Offset: ${receiptCustom.logoOffsetYPx ?? 0}px, Paper: ${receiptCustom.paperWidthMm}mm)`,
          terminalId: 'BACKOFFICE',
          timestamp: new Date().toISOString(),
        },
        ...logs,
      ]);

      return { success: true };
    } catch (err: any) {
      console.error('Unexpected error saving receipt customization:', err);
      return { success: false, error: err?.message || 'Database error occurred' };
    }
  },

  /**
   * Save KOT Customization directly into database (fast & confirmed)
   */
  saveKotCustomization: async (
    kotCustom: KotCustomizationSettings,
    userId = 'usr_admin',
    userName = 'Admin'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      db.update('settings', (prev) => ({
        ...prev,
        kotCustomization: kotCustom,
      }));

      receiptSocketService.broadcastKotUpdate(kotCustom, 'Admin Studio Save').catch(console.warn);
      realtimeSocketService.emitSettingsChanged(db.getSnapshot().settings);

      const current = db.getSnapshot().settings;
      const payload = {
        ...current,
        id: 'default',
        kotCustomization: kotCustom,
        updatedAt: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('system_settings')
        .upsert(sanitizeSystemSettingsForSupabase(payload));

      if (upsertErr) {
        console.error('CRITICAL: Supabase kotCustomization upsert error:', upsertErr);
        return { success: false, error: upsertErr.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Unexpected error saving KOT customization:', err);
      return { success: false, error: err?.message || 'Database error occurred' };
    }
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
