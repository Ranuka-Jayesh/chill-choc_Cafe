import { db } from '@/services/storage/db';
import { Employee, EmployeeAttendanceDay, AttendanceDayStatus, SystemSettings } from '@/types';
import { accountingService } from '@/services/accountingService';

export interface ShiftTimingConfig {
  shiftStartTime: string; // e.g. "08:30"
  shiftEndTime: string; // e.g. "17:30"
  lateGraceMinutes: number; // e.g. 15
  standardHours: number; // e.g. 8
}

export type AttendanceColorCategory = 'GREEN' | 'ORANGE' | 'RED' | 'YELLOW' | 'PURPLE';

export interface EmployeeLiveAttendanceState {
  employee: Employee;
  dateKey: string;
  record: EmployeeAttendanceDay | null;
  isClockedIn: boolean;
  isClockedOut: boolean;
  state:
    | 'NOT_SIGNED'
    | 'CLOCKED_IN_ON_TIME'
    | 'CLOCKED_IN_LATE'
    | 'CLOCKED_OUT_EARLY'
    | 'CLOCKED_OUT_STANDARD'
    | 'CLOCKED_OUT_OVERTIME';
  colorCategory: AttendanceColorCategory;
  statusLabel: string;
  statusSubtext: string;
  shiftTiming: ShiftTimingConfig;
  workedMinutes: number;
  workedHoursFormatted: string;
  overtimeMinutes: number;
  overtimeHoursFormatted: string;
  earlyLeaveMinutes: number;
  isLate: boolean;
  lateMinutes: number;
}

export const attendanceService = {
  getTodayDateKey(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  getShiftTiming(employee?: Employee): ShiftTimingConfig {
    const settings = db.getSnapshot().settings || {};
    return {
      shiftStartTime: employee?.shiftStartTime || settings.shiftStartTime || '08:30',
      shiftEndTime: employee?.shiftEndTime || settings.shiftEndTime || '17:30',
      lateGraceMinutes: settings.lateGraceMinutes ?? 15,
      standardHours: employee?.standardHoursPerDay || settings.standardWorkHoursPerDay || 8,
    };
  },

  /**
   * Evaluates the live attendance state for an employee on today's date.
   */
  getEmployeeLiveState(employee: Employee, now: Date = new Date()): EmployeeLiveAttendanceState {
    const dateKey = this.getTodayDateKey();
    const record = employee.attendanceRecords?.[dateKey] || null;
    const shiftTiming = this.getShiftTiming(employee);

    // Parse shift start time into Date object for today
    const [startH, startM] = shiftTiming.shiftStartTime.split(':').map((v) => parseInt(v, 10) || 0);
    const shiftStartDate = new Date(now);
    shiftStartDate.setHours(startH, startM, 0, 0);

    const shiftGraceDate = new Date(shiftStartDate.getTime() + shiftTiming.lateGraceMinutes * 60 * 1000);

    // Parse shift end time into Date object for today
    const [endH, endM] = shiftTiming.shiftEndTime.split(':').map((v) => parseInt(v, 10) || 0);
    const shiftEndDate = new Date(now);
    shiftEndDate.setHours(endH, endM, 0, 0);

    const isClockedIn = Boolean(record?.checkInTime);
    const isClockedOut = Boolean(record?.checkOutTime);

    // Case 1: NOT Clocked in yet
    if (!isClockedIn) {
      const isPastShiftStart = now.getTime() > shiftGraceDate.getTime();
      const lateMins = isPastShiftStart ? Math.floor((now.getTime() - shiftStartDate.getTime()) / 60000) : 0;

      return {
        employee,
        dateKey,
        record: null,
        isClockedIn: false,
        isClockedOut: false,
        state: 'NOT_SIGNED',
        colorCategory: isPastShiftStart ? 'RED' : 'RED',
        statusLabel: isPastShiftStart ? 'NOT SIGNED (LATE)' : 'NOT SIGNED (PENDING)',
        statusSubtext: isPastShiftStart
          ? `Expected by ${shiftTiming.shiftStartTime} (${lateMins}m past start)`
          : `Scheduled: ${shiftTiming.shiftStartTime} - ${shiftTiming.shiftEndTime}`,
        shiftTiming,
        workedMinutes: 0,
        workedHoursFormatted: '0h 0m',
        overtimeMinutes: 0,
        overtimeHoursFormatted: '0h',
        earlyLeaveMinutes: 0,
        isLate: isPastShiftStart,
        lateMinutes: lateMins,
      };
    }

    // Case 2: Clocked in, currently active on shift
    const [inH, inM, inS] = (record?.checkInTime || '00:00:00').split(':').map((v) => parseInt(v, 10) || 0);
    const checkInDate = new Date(now);
    checkInDate.setHours(inH, inM, inS || 0, 0);

    const isLate = record?.isLate ?? checkInDate.getTime() > shiftGraceDate.getTime();
    const lateMinutes =
      record?.lateMinutes ??
      (isLate ? Math.max(0, Math.floor((checkInDate.getTime() - shiftStartDate.getTime()) / 60000)) : 0);

    const formatTime12h = (dateObj: Date) => {
      let hours = dateObj.getHours();
      const mins = String(dateObj.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${mins} ${ampm}`;
    };

    if (!isClockedOut) {
      // Live elapsed minutes
      const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - checkInDate.getTime()) / 60000));
      const hours = Math.floor(elapsedMinutes / 60);
      const mins = elapsedMinutes % 60;
      const stdMinutes = shiftTiming.standardHours * 60;

      const isCurrentlyOvertime = elapsedMinutes > stdMinutes || now.getTime() > shiftEndDate.getTime();
      const otMinutes = isCurrentlyOvertime ? Math.max(0, elapsedMinutes - stdMinutes) : 0;

      return {
        employee,
        dateKey,
        record,
        isClockedIn: true,
        isClockedOut: false,
        state: isLate ? 'CLOCKED_IN_LATE' : 'CLOCKED_IN_ON_TIME',
        colorCategory: isLate ? 'ORANGE' : 'GREEN',
        statusLabel: isLate ? `LATE IN (+${lateMinutes}M)` : 'CLOCKED IN',
        statusSubtext: `Active on shift • Working for ${hours}h ${mins}m`,
        shiftTiming,
        workedMinutes: elapsedMinutes,
        workedHoursFormatted: `${hours}h ${mins}m`,
        overtimeMinutes: otMinutes,
        overtimeHoursFormatted: `${(otMinutes / 60).toFixed(1)}h`,
        earlyLeaveMinutes: 0,
        isLate,
        lateMinutes,
      };
    }

    // Case 3: Clocked out (completed for today)
    const [outH, outM, outS] = (record?.checkOutTime || '00:00:00').split(':').map((v) => parseInt(v, 10) || 0);
    const checkOutDate = new Date(now);
    checkOutDate.setHours(outH, outM, outS || 0, 0);

    const totalWorkedMinutes =
      record?.workedHours !== undefined
        ? Math.round(record.workedHours * 60)
        : Math.max(0, Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000));

    const totalWorkedHours = totalWorkedMinutes / 60;
    const stdMinutes = shiftTiming.standardHours * 60;

    const isEarly = record?.isEarlyLeave ?? (checkOutDate.getTime() < shiftEndDate.getTime() && totalWorkedMinutes < stdMinutes - 15);
    const earlyMins =
      record?.earlyMinutes ??
      (isEarly ? Math.max(0, Math.floor((shiftEndDate.getTime() - checkOutDate.getTime()) / 60000)) : 0);

    const isOvertime =
      (record?.overtimeHours ?? 0) > 0 ||
      totalWorkedMinutes > stdMinutes + 15 ||
      record?.status === 'OVERTIME';

    const otHours = record?.overtimeHours ?? (isOvertime ? Number(((totalWorkedMinutes - stdMinutes) / 60).toFixed(2)) : 0);
    const otMinutes = Math.round(otHours * 60);

    let state: EmployeeLiveAttendanceState['state'] = 'CLOCKED_OUT_STANDARD';
    let colorCategory: AttendanceColorCategory = 'GREEN';
    let statusLabel = `COMPLETED (${totalWorkedHours.toFixed(1)}H)`;

    if (isOvertime) {
      state = 'CLOCKED_OUT_OVERTIME';
      colorCategory = 'PURPLE';
      statusLabel = `OVERTIME (+${otHours.toFixed(1)}H)`;
    } else if (isEarly) {
      state = 'CLOCKED_OUT_EARLY';
      colorCategory = 'YELLOW';
      const cappedEarlyMins = Math.min(shiftTiming.standardHours * 60, earlyMins);
      const formattedEarly = cappedEarlyMins >= 60 ? `${(cappedEarlyMins / 60).toFixed(1)}h` : `${Math.round(cappedEarlyMins)}m`;
      statusLabel = `LEFT EARLY (-${formattedEarly.toUpperCase()})`;
    } else if (isLate) {
      colorCategory = 'ORANGE';
      statusLabel = `COMPLETED (LATE IN)`;
    }

    return {
      employee,
      dateKey,
      record,
      isClockedIn: true,
      isClockedOut: true,
      state,
      colorCategory,
      statusLabel,
      statusSubtext: `In: ${formatTime12h(checkInDate)} • Out: ${formatTime12h(checkOutDate)}`,
      shiftTiming,
      workedMinutes: totalWorkedMinutes,
      workedHoursFormatted: `${Math.floor(totalWorkedMinutes / 60)}h ${totalWorkedMinutes % 60}m`,
      overtimeMinutes: otMinutes,
      overtimeHoursFormatted: `${otHours.toFixed(1)}h`,
      earlyLeaveMinutes: earlyMins,
      isLate,
      lateMinutes,
    };
  },

  /**
   * Clock-In an employee with digital signature
   */
  clockInEmployee(
    employeeId: string,
    signatureDataUrl: string,
    notes?: string
  ): { employee: Employee; record: EmployeeAttendanceDay; isLate: boolean; lateMinutes: number } {
    const employee = db.getSnapshot().employees.find((e) => e.id === employeeId);
    if (!employee) throw new Error('Employee not found');

    const now = new Date();
    const dateKey = this.getTodayDateKey();
    const shiftTiming = this.getShiftTiming(employee);

    const [startH, startM] = shiftTiming.shiftStartTime.split(':').map((v) => parseInt(v, 10) || 0);
    const shiftStartDate = new Date(now);
    shiftStartDate.setHours(startH, startM, 0, 0);
    const shiftGraceDate = new Date(shiftStartDate.getTime() + shiftTiming.lateGraceMinutes * 60 * 1000);

    const isLate = now.getTime() > shiftGraceDate.getTime();
    const lateMinutes = isLate ? Math.max(0, Math.floor((now.getTime() - shiftStartDate.getTime()) / 60000)) : 0;

    const timeStr = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join(':');

    const status: AttendanceDayStatus = isLate ? 'LATE' : 'PRESENT';

    const dayRecord: EmployeeAttendanceDay = {
      status,
      standardShiftHours: shiftTiming.standardHours,
      checkInTime: timeStr,
      checkInSignature: signatureDataUrl,
      isLate,
      lateMinutes,
      notes: notes || (isLate ? `Clocked in ${lateMinutes} mins late` : 'On-time arrival'),
    };

    const updated = accountingService.updateEmployeeAttendanceDay(employeeId, dateKey, dayRecord);
    return {
      employee: updated || employee,
      record: dayRecord,
      isLate,
      lateMinutes,
    };
  },

  /**
   * Clock-Out an employee with digital signature
   */
  clockOutEmployee(
    employeeId: string,
    signatureDataUrl: string,
    notes?: string
  ): {
    employee: Employee;
    record: EmployeeAttendanceDay;
    isOvertime: boolean;
    overtimeHours: number;
    workedHours: number;
    isEarlyLeave: boolean;
    earlyMinutes: number;
  } {
    const employee = db.getSnapshot().employees.find((e) => e.id === employeeId);
    if (!employee) throw new Error('Employee not found');

    const now = new Date();
    const dateKey = this.getTodayDateKey();
    const existingRecord = employee.attendanceRecords?.[dateKey];
    const shiftTiming = this.getShiftTiming(employee);

    if (!existingRecord || !existingRecord.checkInTime) {
      throw new Error('Employee must clock-in before clocking out.');
    }

    const [inH, inM, inS] = existingRecord.checkInTime.split(':').map((v) => parseInt(v, 10) || 0);
    const checkInDate = new Date(now);
    checkInDate.setHours(inH, inM, inS || 0, 0);

    const [endH, endM] = shiftTiming.shiftEndTime.split(':').map((v) => parseInt(v, 10) || 0);
    const shiftEndDate = new Date(now);
    shiftEndDate.setHours(endH, endM, 0, 0);

    const timeStr = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join(':');

    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - checkInDate.getTime()) / 60000));
    const workedHours = Number((elapsedMinutes / 60).toFixed(2));
    const stdHours = shiftTiming.standardHours;

    const isEarlyLeave = now.getTime() < shiftEndDate.getTime() && workedHours < stdHours - 0.25;
    const earlyMinutes = isEarlyLeave ? Math.max(0, Math.floor((shiftEndDate.getTime() - now.getTime()) / 60000)) : 0;
    const earlyLeaveHours = isEarlyLeave ? Number((earlyMinutes / 60).toFixed(2)) : 0;

    const isOvertime = workedHours > stdHours + 0.25 || now.getTime() > shiftEndDate.getTime() + 15 * 60000;
    const overtimeHours = isOvertime ? Number(Math.max(0, workedHours - stdHours).toFixed(2)) : 0;

    let status: AttendanceDayStatus = existingRecord.status;
    if (isOvertime) {
      status = 'OVERTIME';
    } else if (isEarlyLeave) {
      status = 'EARLY_LEAVE';
    } else if (existingRecord.status === 'LATE') {
      status = 'LATE';
    } else {
      status = 'PRESENT';
    }

    const dayRecord: EmployeeAttendanceDay = {
      ...existingRecord,
      status,
      checkOutTime: timeStr,
      checkOutSignature: signatureDataUrl,
      workedHours,
      overtimeHours,
      earlyLeaveHours,
      isEarlyLeave,
      earlyMinutes,
      notes: notes || existingRecord.notes || (isOvertime ? `Overtime +${overtimeHours}h completed` : 'Completed shift'),
    };

    const updated = accountingService.updateEmployeeAttendanceDay(employeeId, dateKey, dayRecord);
    return {
      employee: updated || employee,
      record: dayRecord,
      isOvertime,
      overtimeHours,
      workedHours,
      isEarlyLeave,
      earlyMinutes,
    };
  },
};
