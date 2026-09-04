import { db } from './storage/db';
import {
  Employee,
  EmployeePayment,
  Supplier,
  PurchasePaymentMethod,
  AttendanceDayStatus,
  EmployeeAttendanceDay,
  EmployeeAttendanceDetailRow,
  AttendanceRecord,
  SystemSettings,
} from '@/types';
import { catalogService } from './catalogService';
import { orderService } from './orderService';
import { realtimeSocketService } from './realtimeSocketService';
export const accountingService = {
  getSystemSettings: (): SystemSettings | undefined => {
    return db.getSnapshot().settings;
  },

  // ---------------------------------------------------------------------------
  // Employees
  // ---------------------------------------------------------------------------
  getEmployees: (): Employee[] => {
    return db.getSnapshot().employees || [];
  },

  getEmployeeById: (id: string): Employee | undefined => {
    return accountingService.getEmployees().find((e) => e.id === id);
  },

  saveEmployee: (employee: Partial<Employee> & { name: string }): Employee => {
    const list = accountingService.getEmployees();
    let saved: Employee;

    if (employee.id) {
      const idx = list.findIndex((e) => e.id === employee.id);
      if (idx >= 0) {
        saved = {
          ...list[idx],
          ...employee,
        };
      } else {
        saved = {
          id: employee.id,
          name: employee.name,
          role: employee.role || 'Staff Member',
          phone: employee.phone,
          email: employee.email,
          nic: employee.nic,
          address: employee.address,
          emergencyContact: employee.emergencyContact,
          baseSalaryCents: employee.baseSalaryCents || 0,
          payFrequency: employee.payFrequency || 'MONTHLY',
          overtimeHourlyRateCents: employee.overtimeHourlyRateCents,
          leaveDailyRateCents: employee.leaveDailyRateCents,
          standardHoursPerDay: employee.standardHoursPerDay,
          attendedDays: employee.attendedDays,
          attendanceRecords: employee.attendanceRecords || list[idx]?.attendanceRecords,
          salaryPayDay: employee.salaryPayDay,
          salaryDate: employee.salaryDate,
          joinDate: employee.joinDate,
          bankName: employee.bankName,
          accountNumber: employee.accountNumber,
          bankBranch: employee.bankBranch,
          active: employee.active !== undefined ? employee.active : true,
          createdAt: employee.createdAt || new Date().toISOString(),
          notes: employee.notes,
        };
      }
      db.update('employees', (emps) => emps.map((e) => (e.id === saved.id ? saved : e)));
    } else {
      saved = {
        id: `emp_${Date.now()}`,
        name: employee.name,
        role: employee.role || 'Staff Member',
        phone: employee.phone,
        email: employee.email,
        nic: employee.nic,
        address: employee.address,
        emergencyContact: employee.emergencyContact,
        baseSalaryCents: employee.baseSalaryCents || 0,
        payFrequency: employee.payFrequency || 'MONTHLY',
        overtimeHourlyRateCents: employee.overtimeHourlyRateCents,
        leaveDailyRateCents: employee.leaveDailyRateCents,
        standardHoursPerDay: employee.standardHoursPerDay,
        attendedDays: employee.attendedDays ?? 26,
        attendanceRecords: employee.attendanceRecords || {},
        salaryPayDay: employee.salaryPayDay,
        salaryDate: employee.salaryDate,
        joinDate: employee.joinDate || new Date().toISOString().split('T')[0],
        bankName: employee.bankName,
        accountNumber: employee.accountNumber,
        bankBranch: employee.bankBranch,
        active: employee.active !== undefined ? employee.active : true,
        createdAt: new Date().toISOString(),
        notes: employee.notes,
      };
      db.update('employees', (emps) => [...emps, saved]);
    }

    return saved;
  },

  deleteEmployee: (id: string): boolean => {
    db.update('employees', (emps) => emps.filter((e) => e.id !== id));
    return true;
  },

  // ---------------------------------------------------------------------------
  // Employee Attendance Management
  // ---------------------------------------------------------------------------
  getEmployeeAttendanceMap: (
    employeeId: string,
    year: number,
    month: number
  ): Record<string, EmployeeAttendanceDay> => {
    const emps = db.getSnapshot().employees || [];
    const emp = emps.find((e) => e.id === employeeId);
    const existing: Record<string, EmployeeAttendanceDay> = {};

    // 1. Populate legacy records if any
    if (emp?.attendanceRecords) {
      Object.assign(existing, emp.attendanceRecords);
    }

    // 2. Overlay dedicated attendance table records
    const allAtt = db.getSnapshot().attendance || [];
    allAtt
      .filter((a) => a.employeeId === employeeId)
      .forEach((a) => {
        existing[a.date] = {
          status: a.status,
          standardShiftHours: a.standardShiftHours,
          overtimeHours: a.overtimeHours,
          checkInTime: a.checkInTime,
          checkOutTime: a.checkOutTime,
          checkInSignature: a.checkInSignature,
          checkOutSignature: a.checkOutSignature,
          workedHours: a.workedHours,
          earlyLeaveHours: a.earlyLeaveHours,
          isLate: a.isLate,
          lateMinutes: a.lateMinutes,
          isEarlyLeave: a.isEarlyLeave,
          earlyMinutes: a.earlyMinutes,
          notes: a.notes,
        };
      });

    const result: Record<string, EmployeeAttendanceDay> = {};
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (existing[dateKey]) {
        result[dateKey] = existing[dateKey];
      } else {
        const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 is Sunday
        if (dayOfWeek === 0) {
          // Sunday is Holiday
          result[dateKey] = { status: 'HOLIDAY' };
        }
        // Unclocked days do NOT have records in the database!
      }
    }
    return result;
  },

  getStandardShiftHoursForDate: (employeeId: string, dateStr: string): number => {
    const emps = db.getSnapshot().employees || [];
    const emp = emps.find((e) => e.id === employeeId);
    const existingRec = emp?.attendanceRecords?.[dateStr];
    if (existingRec?.standardShiftHours !== undefined) {
      return existingRec.standardShiftHours;
    }

    if (emp?.standardHoursPerDay !== undefined && emp.standardHoursPerDay !== null) {
      return emp.standardHoursPerDay;
    }

    const rateHistories = db.getSnapshot().rateHistories || [];
    const hourChanges = rateHistories
      .filter(
        (h) =>
          (h.employeeId === 'GLOBAL' || h.employeeId === employeeId) &&
          (h.newStandardHoursPerDay !== undefined || h.rateType === 'STANDARD_HOURS')
      )
      .sort((a, b) => (b.effectiveDate || b.createdAt).localeCompare(a.effectiveDate || a.createdAt));

    if (hourChanges.length > 0) {
      for (const h of hourChanges) {
        const effDate = h.effectiveDate || h.createdAt.split('T')[0];
        if (dateStr >= effDate) {
          return h.newStandardHoursPerDay ?? 8;
        }
      }
      const earliest = hourChanges[hourChanges.length - 1];
      return earliest.previousStandardHoursPerDay ?? 8;
    }

    const settings = db.getSnapshot().settings;
    return settings?.standardWorkHoursPerDay ?? 8;
  },

  getEmployeeAttendanceDetailsList: (
    employeeId: string,
    year: number,
    month: number
  ): EmployeeAttendanceDetailRow[] => {
    const emps = db.getSnapshot().employees || [];
    const emp = emps.find((e) => e.id === employeeId);

    // Collect all real records from both dedicated attendance table & legacy records
    const realRecords: Record<string, EmployeeAttendanceDay> = {};
    if (emp?.attendanceRecords) {
      Object.assign(realRecords, emp.attendanceRecords);
    }
    const allAtt = db.getSnapshot().attendance || [];
    allAtt
      .filter((a) => a.employeeId === employeeId)
      .forEach((a) => {
        realRecords[a.date] = {
          status: a.status,
          standardShiftHours: a.standardShiftHours,
          overtimeHours: a.overtimeHours,
          checkInTime: a.checkInTime,
          checkOutTime: a.checkOutTime,
          checkInSignature: a.checkInSignature,
          checkOutSignature: a.checkOutSignature,
          workedHours: a.workedHours,
          earlyLeaveHours: a.earlyLeaveHours,
          isLate: a.isLate,
          lateMinutes: a.lateMinutes,
          isEarlyLeave: a.isEarlyLeave,
          earlyMinutes: a.earlyMinutes,
          notes: a.notes,
        };
      });

    const attendanceMap = accountingService.getEmployeeAttendanceMap(employeeId, year, month);

    const daysInMonth = new Date(year, month, 0).getDate();
    const rows: EmployeeAttendanceDetailRow[] = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const formatTime12h = (timeStr?: string) => {
      if (!timeStr || timeStr === '-') return '-';
      if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
      const [hStr, mStr] = timeStr.split(':');
      let h = parseInt(hStr, 10) || 0;
      const m = mStr || '00';
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
    };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(year, month - 1, day);
      const dowIndex = dObj.getDay();
      const dow = dayShortNames[dowIndex];
      const formattedDate = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year} (${dow})`;

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const realRecord = realRecords[dateKey];
      const rec = attendanceMap[dateKey];
      const status: AttendanceDayStatus =
        rec?.status ||
        (dowIndex === 0
          ? 'HOLIDAY'
          : dateKey >= todayStr
          ? 'SCHEDULED'
          : 'ABSENT');

      const standardShift =
        rec?.standardShiftHours ??
        accountingService.getStandardShiftHoursForDate(employeeId, dateKey);

      let checkInTime = '-';
      let checkOutTime = '-';
      let workedHours = 0;
      let overtimeHours = 0;
      let earlyLeaveHours = 0;
      let inSign: string | undefined = undefined;
      let outSign: string | undefined = undefined;

      if (realRecord) {
        // ACTUAL REAL RECORD FROM POS CLOCK-IN
        checkInTime = realRecord.checkInTime ? formatTime12h(realRecord.checkInTime) : '-';
        checkOutTime = realRecord.checkOutTime ? formatTime12h(realRecord.checkOutTime) : '-';
        workedHours = realRecord.workedHours ?? (realRecord.checkOutTime ? standardShift : 0);
        overtimeHours = realRecord.overtimeHours ?? 0;
        earlyLeaveHours = realRecord.earlyLeaveHours ?? 0;
        inSign = realRecord.checkInSignature;
        outSign = realRecord.checkOutSignature;
      } else {
        // NO DUMMY VALUES: Unclocked days have no times and no signatures
        checkInTime = '-';
        checkOutTime = '-';
        workedHours = 0;
        overtimeHours = 0;
        earlyLeaveHours = 0;
        inSign = undefined;
        outSign = undefined;
      }

      const varianceHours =
        status === 'ABSENT'
          ? -standardShift
          : status === 'HOLIDAY' || status === 'SCHEDULED'
          ? 0
          : workedHours - standardShift;

      rows.push({
        date: dateKey,
        dayOfWeek: dow,
        formattedDate,
        status,
        checkInTime,
        checkOutTime,
        checkInSignature: inSign,
        checkOutSignature: outSign,
        standardShiftHours: standardShift,
        workedHours,
        overtimeHours,
        earlyLeaveHours,
        varianceHours,
        isLate: realRecord?.isLate,
        lateMinutes: realRecord?.lateMinutes,
        isEarlyLeave: realRecord?.isEarlyLeave,
        earlyMinutes: realRecord?.earlyMinutes,
        notes: realRecord?.notes,
      });
    }

    return rows;
  },

  updateEmployeeAttendanceDay: (
    employeeId: string,
    dateStr: string,
    record: EmployeeAttendanceDay
  ): Employee | null => {
    const emps = db.getSnapshot().employees || [];
    const emp = emps.find((e) => e.id === employeeId);
    const stdHours =
      record.standardShiftHours ??
      accountingService.getStandardShiftHoursForDate(employeeId, dateStr);

    const attId = `att_${employeeId}_${dateStr}`;
    const dedicatedRecord: AttendanceRecord = {
      id: attId,
      employeeId,
      employeeName: emp?.name,
      date: dateStr,
      status: record.status,
      standardShiftHours: stdHours,
      overtimeHours: record.overtimeHours,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      checkInSignature: record.checkInSignature,
      checkOutSignature: record.checkOutSignature,
      workedHours: record.workedHours,
      earlyLeaveHours: record.earlyLeaveHours,
      isLate: record.isLate,
      lateMinutes: record.lateMinutes,
      isEarlyLeave: record.isEarlyLeave,
      earlyMinutes: record.earlyMinutes,
      notes: record.notes,
      updatedAt: new Date().toISOString(),
    };

    // 1. Persist directly to dedicated 'attendance' table
    db.update('attendance', (list) => {
      const filtered = (list || []).filter(
        (a) => a.id !== attId && !(a.employeeId === employeeId && a.date === dateStr)
      );
      return [dedicatedRecord, ...filtered];
    });

    // 2. Emit real-time attendance change to all connected clients
    realtimeSocketService.emitAttendanceChanged(dedicatedRecord);

    // 3. Keep employee attendedDays counter and cache updated
    let updatedEmp: Employee | null = null;
    db.update('employees', (empList) =>
      empList.map((e) => {
        if (e.id !== employeeId) return e;
        const currentRecords = { ...(e.attendanceRecords || {}) };
        currentRecords[dateStr] = {
          ...record,
          standardShiftHours: stdHours,
        };

        const [yStr, mStr] = dateStr.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const daysInMonth = new Date(y, m, 0).getDate();

        let attendedCount = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const dKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const rec = currentRecords[dKey];
          if (
            rec &&
            (rec.status === 'PRESENT' ||
              rec.status === 'LATE' ||
              rec.status === 'EARLY_LEAVE' ||
              rec.status === 'OVERTIME')
          ) {
            attendedCount++;
          }
        }

        updatedEmp = {
          ...e,
          attendanceRecords: currentRecords,
          attendedDays: attendedCount,
        };
        return updatedEmp;
      })
    );
    return updatedEmp;
  },

  deleteEmployeeAttendanceDay: (employeeId: string, dateStr: string): void => {
    const attId = `att_${employeeId}_${dateStr}`;
    db.update('attendance', (list) =>
      (list || []).filter((a) => a.id !== attId && !(a.employeeId === employeeId && a.date === dateStr))
    );
    db.update('employees', (empList) =>
      empList.map((e) => {
        if (e.id !== employeeId) return e;
        const currentRecords = { ...(e.attendanceRecords || {}) };
        delete currentRecords[dateStr];

        const [yStr, mStr] = dateStr.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const daysInMonth = new Date(y, m, 0).getDate();

        let attendedCount = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const dKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const rec = currentRecords[dKey];
          if (
            rec &&
            (rec.status === 'PRESENT' ||
              rec.status === 'LATE' ||
              rec.status === 'EARLY_LEAVE' ||
              rec.status === 'OVERTIME')
          ) {
            attendedCount++;
          }
        }

        return {
          ...e,
          attendanceRecords: currentRecords,
          attendedDays: attendedCount,
        };
      })
    );
    realtimeSocketService.emitAttendanceChanged({
      id: attId,
      employeeId,
      employeeName: '',
      date: dateStr,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString(),
    });
  },

  bulkSetMonthAttendance: (
    employeeId: string,
    year: number,
    month: number,
    defaultStatus: AttendanceDayStatus = 'PRESENT'
  ): Employee | null => {
    let updatedEmp: Employee | null = null;
    const daysInMonth = new Date(year, month, 0).getDate();
    const newAttendanceBatch: AttendanceRecord[] = [];

    db.update('employees', (emps) =>
      emps.map((e) => {
        if (e.id !== employeeId) return e;
        const currentRecords = { ...(e.attendanceRecords || {}) };
        const std = e.standardHoursPerDay || 8;

        for (let d = 1; d <= daysInMonth; d++) {
          const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dow = new Date(year, month - 1, d).getDay();
          if (dow !== 0) {
            currentRecords[dKey] = {
              status: defaultStatus,
              standardShiftHours: std,
            };
            newAttendanceBatch.push({
              id: `att_${employeeId}_${dKey}`,
              employeeId,
              employeeName: e.name,
              date: dKey,
              status: defaultStatus,
              standardShiftHours: std,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        updatedEmp = {
          ...e,
          attendanceRecords: currentRecords,
          attendedDays: defaultStatus === 'PRESENT' ? daysInMonth - 4 : 0,
        };
        return updatedEmp;
      })
    );

    // Also update dedicated attendance table
    if (newAttendanceBatch.length > 0) {
      db.update('attendance', (list) => {
        const datePrefix = `${year}-${String(month).padStart(2, '0')}`;
        const remaining = (list || []).filter(
          (a) => !(a.employeeId === employeeId && a.date.startsWith(datePrefix))
        );
        return [...newAttendanceBatch, ...remaining];
      });
      realtimeSocketService.emitAttendanceChanged({ employeeId, month, year });
    }

    return updatedEmp;
  },

  getAttendanceRecords: (employeeId?: string): AttendanceRecord[] => {
    const list = db.getSnapshot().attendance || [];
    if (!employeeId) return list;
    return list.filter((a) => a.employeeId === employeeId);
  },

  // ---------------------------------------------------------------------------
  // Employee Payroll & Disbursements
  // ---------------------------------------------------------------------------
  getEmployeePayments: (employeeId?: string): EmployeePayment[] => {
    const list = db.getSnapshot().employeePayments || [];
    if (employeeId) {
      return list.filter((p: EmployeePayment) => p.employeeId === employeeId);
    }
    return list.slice().sort((a: EmployeePayment, b: EmployeePayment) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  recordEmployeePayment: (payment: Omit<EmployeePayment, 'id' | 'createdAt'> & { id?: string }): EmployeePayment => {
    const newPayment: EmployeePayment = {
      ...payment,
      id: payment.id || `pay_${Date.now()}`,
      createdAt: new Date().toISOString(),
      referenceNumber: payment.referenceNumber || `VCH-${Date.now().toString().slice(-4)}`,
    };
    db.update('employeePayments', (list) => [newPayment, ...(list || [])]);
    return newPayment;
  },

  deleteEmployeePayment: (id: string): boolean => {
    db.update('employeePayments', (list) => (list || []).filter((p) => p.id !== id));
    return true;
  },

  // ---------------------------------------------------------------------------
  // Supplier Ledger & Operations
  // ---------------------------------------------------------------------------
  getSuppliers: (): Supplier[] => {
    return catalogService.getSuppliers();
  },

  saveSupplier: (supplier: Partial<Supplier> & { name: string }): Supplier => {
    return catalogService.saveSupplier(supplier);
  },

  deleteSupplier: (id: string): void => {
    catalogService.deleteSupplier(id);
  },

  getSupplierLedgers: () => {
    const suppliers = catalogService.getSuppliers();
    const purchases = catalogService.getPurchases();

    return suppliers.map((sup) => {
      const supPurchases = purchases.filter(
        (p) => p.supplierId === sup.id || p.supplierName.toLowerCase() === sup.name.toLowerCase()
      );
      const totalInvoicedCents = supPurchases.reduce((s, p) => s + (p.totalCents || 0), 0);
      const totalPaidCents = supPurchases.reduce((s, p) => s + (p.paidCents ?? p.totalCents), 0);
      const totalDueCents = supPurchases.reduce(
        (s, p) => s + (p.dueCents ?? Math.max(0, p.totalCents - (p.paidCents ?? p.totalCents))),
        0
      );

      return {
        supplier: sup,
        purchasesCount: supPurchases.length,
        totalInvoicedCents,
        totalPaidCents,
        totalDueCents,
        purchases: supPurchases,
      };
    });
  },

  // Settle supplier balance by allocating payments across open POs
  settleSupplierBalance: (
    supplierName: string,
    amountCents: number,
    method: PurchasePaymentMethod,
    details?: { chequeNumber?: string; bankName?: string; chequeDate?: string; paymentDate?: string; notes?: string }
  ) => {
    let remainingToAllocate = amountCents;
    const paymentTimestamp = details?.paymentDate ? new Date(details.paymentDate).toISOString() : new Date().toISOString();

    db.update('purchases', (list) =>
      list.map((po) => {
        if (po.supplierName.toLowerCase() !== supplierName.toLowerCase()) return po;
        const currentPaid = po.paidCents ?? po.totalCents;
        const currentDue = po.dueCents ?? Math.max(0, po.totalCents - currentPaid);

        if (currentDue > 0 && remainingToAllocate > 0) {
          const alloc = Math.min(currentDue, remainingToAllocate);
          remainingToAllocate -= alloc;

          const newPayments = [
            ...(po.payments || []),
            {
              id: `pm_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              method,
              amountCents: alloc,
              timestamp: paymentTimestamp,
              chequeNumber: details?.chequeNumber,
              bankName: details?.bankName,
              chequeDate: details?.chequeDate,
              notes: details?.notes,
            },
          ];

          const newPaid = currentPaid + alloc;
          const newDue = Math.max(0, po.totalCents - newPaid);
          const newStatus = newDue === 0 ? 'PAID' : 'PARTIAL';

          return {
            ...po,
            paidCents: newPaid,
            dueCents: newDue,
            dueDate: newDue > 0 ? po.dueDate : undefined,
            paymentStatus: newStatus,
            payments: newPayments,
          };
        }
        return po;
      })
    );

    realtimeSocketService.emitStockChanged(undefined, { action: 'SUPPLIER_BALANCE_SETTLED', supplierName });
    return true;
  },

  // ---------------------------------------------------------------------------
  // Financial Statement & P&L Calculation
  // ---------------------------------------------------------------------------
  getFinancialSummary: (year: number, month: number) => {
    // Month is 1-indexed (1 to 12)
    const isMatchingDate = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    };

    // 1. Gross Revenue from completed Orders
    const allOrders = orderService.getOrders();
    const monthlyOrders = allOrders.filter(
      (o) => o.status !== 'CANCELLED' && isMatchingDate(o.createdAt)
    );
    const grossRevenueCents = monthlyOrders.reduce((sum, o) => sum + (o.totalCents || 0), 0);
    const orderCount = monthlyOrders.length;

    // 2. Cost of Goods & Purchases Payments (Accrual COGS + Cash Outflow by Payment Date)
    const allPurchases = catalogService.getPurchases();
    const monthlyInvoicedPurchases = allPurchases.filter((p) => isMatchingDate(p.purchaseDate));
    const cogsPurchasesCents = monthlyInvoicedPurchases.reduce((sum, p) => sum + (p.totalCents || 0), 0);

    // Payments ACTUALLY made & cleared towards purchases during THIS specific month (regardless of when PO was created)
    let purchasesPaidCents = 0;
    let cashOutPurchasesCents = 0;

    allPurchases.forEach((p) => {
      (p.payments || []).forEach((pm) => {
        // Cheques only count towards bank cash outflow once CLEARED by supplier/bank
        const isCleared = pm.method !== 'CHEQUE' || pm.chequeStatus === 'CLEARED';
        if (isCleared) {
          const dateToCheck = pm.clearedAt || pm.timestamp;
          if (isMatchingDate(dateToCheck)) {
            purchasesPaidCents += pm.amountCents;
            if (pm.method === 'CASH') {
              cashOutPurchasesCents += pm.amountCents;
            }
          }
        }
      });
    });

    // Outstanding dues on all purchases created on or before this month that remain unpaid
    const purchasesDueCents = allPurchases
      .filter((p) => {
        const pDate = new Date(p.purchaseDate);
        const pYear = pDate.getFullYear();
        const pMonth = pDate.getMonth() + 1;
        return pYear < year || (pYear === year && pMonth <= month);
      })
      .reduce(
        (sum, p) => sum + (p.dueCents ?? Math.max(0, p.totalCents - (p.paidCents ?? p.totalCents))),
        0
      );

    // 3. Employee Payroll & Disbursements
    const allPayroll = accountingService.getEmployeePayments();
    const monthlyPayroll = allPayroll.filter((p) => isMatchingDate(p.date));
    const payrollDisbursedCents = monthlyPayroll.reduce((sum, p) => sum + (p.amountCents || 0), 0);

    // 4. Operating Expenses
    const allExpenses = catalogService.getExpenses();
    const monthlyExpenses = allExpenses.filter((e) => isMatchingDate(e.createdAt));
    const operatingExpensesCents = monthlyExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);

    // 5. Net Profit & Margins
    const totalOutflowCents = purchasesPaidCents + payrollDisbursedCents + operatingExpensesCents;
    const netProfitCents = grossRevenueCents - totalOutflowCents;
    const netMarginPercent = grossRevenueCents > 0 ? (netProfitCents / grossRevenueCents) * 100 : 0;

    // 6. Cash Flow Breakdown (Cash In vs Cash Out)
    const cashInOrdersCents = monthlyOrders
      .filter((o) => o.paymentMethod === 'CASH')
      .reduce((sum, o) => sum + (o.totalCents || 0), 0);

    const cashOutPayrollCents = monthlyPayroll
      .filter((p) => p.method === 'CASH')
      .reduce((sum, p) => sum + (p.amountCents || 0), 0);

    const cashOutExpensesCents = monthlyExpenses
      .filter((e) => e.paidViaDrawer)
      .reduce((sum, e) => sum + (e.amountCents || 0), 0);

    const totalCashInCents = cashInOrdersCents;
    const totalCashOutCents = cashOutPurchasesCents + cashOutPayrollCents + cashOutExpensesCents;
    const netCashFlowCents = totalCashInCents - totalCashOutCents;

    return {
      year,
      month,
      grossRevenueCents,
      orderCount,
      cogsPurchasesCents,
      purchasesPaidCents,
      purchasesDueCents,
      payrollDisbursedCents,
      operatingExpensesCents,
      totalOutflowCents,
      netProfitCents,
      netMarginPercent,
      cashFlow: {
        totalCashInCents,
        totalCashOutCents,
        netCashFlowCents,
        cashInOrdersCents,
        cashOutPurchasesCents,
        cashOutPayrollCents,
        cashOutExpensesCents,
      },
    };
  },
};
