import { db } from './storage/db';
import { realtimeSocketService } from './realtimeSocketService';
import { Employee, EmployeeRateHistory, RateChangeType, SystemSettings } from '@/types';
import { accountingService } from './accountingService';
import { settingsService } from './settingsService';

export const rateService = {
  /**
   * Fetch all rate revision history records, sorted newest first.
   */
  getRateHistories: (filter?: {
    employeeId?: string;
    rateType?: RateChangeType;
    search?: string;
  }): EmployeeRateHistory[] => {
    let list = db.getSnapshot().rateHistories || [];

    if (filter?.employeeId && filter.employeeId !== 'ALL') {
      list = list.filter(
        (h) => h.employeeId === filter.employeeId || (filter.employeeId === 'GLOBAL' && h.employeeId === 'GLOBAL')
      );
    }

    if (filter?.rateType && filter.rateType !== 'ALL') {
      list = list.filter((h) => h.rateType === filter.rateType || h.rateType === 'ALL');
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        (h) =>
          h.employeeName.toLowerCase().includes(q) ||
          (h.reason && h.reason.toLowerCase().includes(q)) ||
          h.changedBy.toLowerCase().includes(q) ||
          h.rateType.toLowerCase().includes(q)
      );
    }

    return list.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Manually record a rate change audit entry into the immutable ledger.
   */
  recordRateHistory: (
    history: Omit<EmployeeRateHistory, 'id' | 'createdAt'> & { id?: string }
  ): EmployeeRateHistory => {
    const newEntry: EmployeeRateHistory = {
      ...history,
      id: history.id || `rate_hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      effectiveDate: history.effectiveDate || new Date().toISOString().split('T')[0],
    };

    db.update('rateHistories', (prev) => [newEntry, ...(prev || [])]);

    // Also record standard Audit Log for cross-system consistency
    db.update('auditLogs', (logs) => [
      {
        id: `aud_${Date.now()}`,
        userId: 'usr_admin',
        userName: history.changedBy,
        action: 'SETTINGS_CHANGE',
        entity: 'RateHistory',
        entityId: history.employeeId || 'GLOBAL',
        details: `Rate updated for ${history.employeeName} (${history.rateType}): ${history.reason || 'No note provided'}`,
        terminalId: 'BACKOFFICE',
        timestamp: new Date().toISOString(),
      },
      ...(logs || []),
    ]);

    return newEntry;
  },

  /**
   * Update Café-wide Default Overtime & Leave Rates in System Settings
   * and log the rate update into history records.
   */
  updateGlobalPayrollRates: (
    updates: {
      defaultOvertimeHourlyRateCents?: number;
      defaultLeaveDailyRateCents?: number;
      overtimeCalculationMode?: 'FIXED_HOURLY' | 'SALARY_MULTIPLIER';
      overtimeMultiplier?: number;
      standardWorkHoursPerDay?: number;
      workingDaysPerMonth?: number;
      reason?: string;
      effectiveDate?: string;
    },
    changedBy: string = 'Admin (Chaminda Silva)'
  ): SystemSettings => {
    const oldSettings = settingsService.getSettings();
    const effectiveDate = updates.effectiveDate || new Date().toISOString().split('T')[0];
    const reason = updates.reason || 'Café-wide default payroll rates updated in System Settings';

    // Determine what changed to record in history
    const otChanged =
      updates.defaultOvertimeHourlyRateCents !== undefined &&
      updates.defaultOvertimeHourlyRateCents !== oldSettings.defaultOvertimeHourlyRateCents;

    const leaveChanged =
      updates.defaultLeaveDailyRateCents !== undefined &&
      updates.defaultLeaveDailyRateCents !== oldSettings.defaultLeaveDailyRateCents;

    const hoursChanged =
      updates.standardWorkHoursPerDay !== undefined &&
      updates.standardWorkHoursPerDay !== oldSettings.standardWorkHoursPerDay;

    const daysChanged =
      updates.workingDaysPerMonth !== undefined &&
      updates.workingDaysPerMonth !== oldSettings.workingDaysPerMonth;

    if (otChanged || leaveChanged || hoursChanged || daysChanged) {
      let rateType: RateChangeType = 'ALL';
      if (hoursChanged && !otChanged && !leaveChanged) {
        rateType = 'STANDARD_HOURS';
      } else if (otChanged && !leaveChanged && !hoursChanged) {
        rateType = 'OVERTIME';
      } else if (!otChanged && leaveChanged && !hoursChanged) {
        rateType = 'LEAVE';
      }

      rateService.recordRateHistory({
        employeeId: 'GLOBAL',
        employeeName: 'Global Policy (All Staff)',
        rateType,
        previousOvertimeRateCents: otChanged ? oldSettings.defaultOvertimeHourlyRateCents : undefined,
        newOvertimeRateCents: otChanged ? (updates.defaultOvertimeHourlyRateCents ?? oldSettings.defaultOvertimeHourlyRateCents) : undefined,
        previousLeaveRateCents: leaveChanged ? oldSettings.defaultLeaveDailyRateCents : undefined,
        newLeaveRateCents: leaveChanged ? (updates.defaultLeaveDailyRateCents ?? oldSettings.defaultLeaveDailyRateCents) : undefined,
        previousStandardHoursPerDay: hoursChanged ? oldSettings.standardWorkHoursPerDay : undefined,
        newStandardHoursPerDay: hoursChanged ? (updates.standardWorkHoursPerDay ?? oldSettings.standardWorkHoursPerDay) : undefined,
        changedBy,
        reason,
        effectiveDate,
      });
    }

    const updated = settingsService.updateSettings({
      defaultOvertimeHourlyRateCents: updates.defaultOvertimeHourlyRateCents ?? oldSettings.defaultOvertimeHourlyRateCents,
      defaultLeaveDailyRateCents: updates.defaultLeaveDailyRateCents ?? oldSettings.defaultLeaveDailyRateCents,
      overtimeCalculationMode: updates.overtimeCalculationMode ?? oldSettings.overtimeCalculationMode,
      overtimeMultiplier: updates.overtimeMultiplier ?? oldSettings.overtimeMultiplier,
      standardWorkHoursPerDay: updates.standardWorkHoursPerDay ?? oldSettings.standardWorkHoursPerDay,
      workingDaysPerMonth: updates.workingDaysPerMonth ?? oldSettings.workingDaysPerMonth,
    });

    realtimeSocketService.emitSettingsChanged(updated);
    return updated;
  },

  /**
   * Update custom Overtime and Leave rates for a specific employee
   * and log the rate revision into history records.
   */
  updateEmployeeRates: (
    employeeId: string,
    updates: {
      overtimeHourlyRateCents?: number;
      leaveDailyRateCents?: number;
      baseSalaryCents?: number;
      reason?: string;
      effectiveDate?: string;
    },
    changedBy: string = 'Admin (Chaminda Silva)'
  ): Employee => {
    const employee = accountingService.getEmployeeById(employeeId);
    if (!employee) throw new Error(`Employee with ID ${employeeId} not found`);

    const effectiveDate = updates.effectiveDate || new Date().toISOString().split('T')[0];
    const reason = updates.reason || 'Employee custom rate override updated';

    const otChanged =
      updates.overtimeHourlyRateCents !== undefined &&
      updates.overtimeHourlyRateCents !== employee.overtimeHourlyRateCents;

    const leaveChanged =
      updates.leaveDailyRateCents !== undefined &&
      updates.leaveDailyRateCents !== employee.leaveDailyRateCents;

    const salaryChanged =
      updates.baseSalaryCents !== undefined &&
      updates.baseSalaryCents !== employee.baseSalaryCents;

    if (otChanged || leaveChanged || salaryChanged) {
      let rateType: RateChangeType = 'ALL';
      if (otChanged && !leaveChanged && !salaryChanged) rateType = 'OVERTIME';
      else if (!otChanged && leaveChanged && !salaryChanged) rateType = 'LEAVE';
      else if (!otChanged && !leaveChanged && salaryChanged) rateType = 'BASE_SALARY';

      rateService.recordRateHistory({
        employeeId: employee.id,
        employeeName: employee.name,
        rateType,
        previousOvertimeRateCents: otChanged ? employee.overtimeHourlyRateCents : undefined,
        newOvertimeRateCents: otChanged ? (updates.overtimeHourlyRateCents ?? employee.overtimeHourlyRateCents) : undefined,
        previousLeaveRateCents: leaveChanged ? employee.leaveDailyRateCents : undefined,
        newLeaveRateCents: leaveChanged ? (updates.leaveDailyRateCents ?? employee.leaveDailyRateCents) : undefined,
        previousBaseSalaryCents: salaryChanged ? employee.baseSalaryCents : undefined,
        newBaseSalaryCents: salaryChanged ? (updates.baseSalaryCents ?? employee.baseSalaryCents) : undefined,
        changedBy,
        reason,
        effectiveDate,
      });
    }

    const saved = accountingService.saveEmployee({
      id: employee.id,
      name: employee.name,
      overtimeHourlyRateCents: updates.overtimeHourlyRateCents !== undefined ? updates.overtimeHourlyRateCents : employee.overtimeHourlyRateCents,
      leaveDailyRateCents: updates.leaveDailyRateCents !== undefined ? updates.leaveDailyRateCents : employee.leaveDailyRateCents,
      baseSalaryCents: updates.baseSalaryCents !== undefined ? updates.baseSalaryCents : employee.baseSalaryCents,
    });

    return saved;
  },

  /**
   * Calculate effective rates for an employee:
   * Returns employee custom rate if defined, or café global default otherwise.
   */
  getEffectiveRates: (employee?: Employee | null) => {
    const settings = settingsService.getSettings();
    const globalOvertimeCents = settings.defaultOvertimeHourlyRateCents || 45000;
    const globalLeaveCents = settings.defaultLeaveDailyRateCents || 250000;

    if (!employee) {
      return {
        overtimeHourlyRateCents: globalOvertimeCents,
        leaveDailyRateCents: globalLeaveCents,
        isCustomOvertime: false,
        isCustomLeave: false,
      };
    }

    return {
      overtimeHourlyRateCents: employee.overtimeHourlyRateCents ?? globalOvertimeCents,
      leaveDailyRateCents: employee.leaveDailyRateCents ?? globalLeaveCents,
      isCustomOvertime: employee.overtimeHourlyRateCents !== undefined && employee.overtimeHourlyRateCents !== null,
      isCustomLeave: employee.leaveDailyRateCents !== undefined && employee.leaveDailyRateCents !== null,
    };
  },
};
