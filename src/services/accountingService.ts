import { db } from './storage/db';
import {
  Employee,
  EmployeePayment,
  Supplier,
  PurchasePaymentMethod,
  AttendanceDayStatus,
  EmployeeAttendanceDay,
  EmployeeAttendanceDetailRow,
  SystemSettings,
} from '@/types';
import { catalogService } from './catalogService';
import { orderService } from './orderService';

const SEED_EMPLOYEES: Employee[] = [
  {
    id: 'emp_001',
    name: 'Chaminda Silva',
    role: 'General Manager & Admin',
    phone: '+94 77 123 4567',
    email: 'chaminda@chillandchoc.lk',
    baseSalaryCents: 12000000, // Rs. 120,000.00
    payFrequency: 'MONTHLY',
    overtimeHourlyRateCents: 65000, // Rs. 650.00 / hr
    leaveDailyRateCents: 460000, // Rs. 4,600.00 / day
    attendedDays: 26,
    bankName: 'Commercial Bank of Ceylon',
    accountNumber: '8001293847',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    notes: 'Store manager and administrator.',
  },
  {
    id: 'emp_002',
    name: 'Nimal Perera',
    role: 'Head Barista & Cashier',
    phone: '+94 71 987 6543',
    email: 'nimal@chillandchoc.lk',
    baseSalaryCents: 7500000, // Rs. 75,000.00
    payFrequency: 'MONTHLY',
    overtimeHourlyRateCents: 55000, // Rs. 550.00 / hr (custom override)
    leaveDailyRateCents: 288000, // Rs. 2,880.00 / day
    attendedDays: 24,
    bankName: 'Bank of Ceylon',
    accountNumber: '0029384756',
    active: true,
    createdAt: '2026-02-01T00:00:00.000Z',
    notes: 'Lead coffee barista and shift in-charge.',
  },
  {
    id: 'emp_003',
    name: 'Kasun Fernando',
    role: 'Cashier & Junior Barista',
    phone: '+94 76 555 8899',
    email: 'kasun@chillandchoc.lk',
    baseSalaryCents: 5500000, // Rs. 55,000.00
    payFrequency: 'MONTHLY',
    overtimeHourlyRateCents: 45000, // Rs. 450.00 / hr (default standard)
    leaveDailyRateCents: 211500, // Rs. 2,115.00 / day
    attendedDays: 22,
    bankName: 'Sampath Bank',
    accountNumber: '1004839201',
    active: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    notes: 'Morning shift cashier.',
  },
  {
    id: 'emp_004',
    name: 'Dilshan Madushanka',
    role: 'Kitchen & Stock Assistant',
    phone: '+94 72 333 4455',
    baseSalaryCents: 4500000, // Rs. 45,000.00
    payFrequency: 'MONTHLY',
    overtimeHourlyRateCents: 40000, // Rs. 400.00 / hr
    leaveDailyRateCents: 173000, // Rs. 1,730.00 / day
    attendedDays: 25,
    bankName: 'Hatton National Bank (HNB)',
    accountNumber: '0492837461',
    active: true,
    createdAt: '2026-04-01T00:00:00.000Z',
    notes: 'Ingredient prep and stock receiving.',
  },
];

const SEED_EMPLOYEE_PAYMENTS: EmployeePayment[] = [
  {
    id: 'pay_001',
    employeeId: 'emp_002',
    employeeName: 'Nimal Perera',
    amountCents: 1500000, // Rs. 15,000.00 Advance
    paymentType: 'ADVANCE',
    method: 'CASH',
    date: '2026-08-15T10:30:00.000Z',
    notes: 'Mid-month salary advance approved by GM',
    referenceNumber: 'ADV-8812',
    createdAt: '2026-08-15T10:30:00.000Z',
  },
  {
    id: 'pay_002',
    employeeId: 'emp_003',
    employeeName: 'Kasun Fernando',
    amountCents: 5500000, // Rs. 55,000.00 Salary
    paymentType: 'SALARY',
    method: 'CARD',
    date: '2026-08-01T09:00:00.000Z',
    bankName: 'Sampath Bank',
    notes: 'July Salary Bank Transfer',
    referenceNumber: 'SAL-7701',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
];

export const accountingService = {
  getSystemSettings: (): SystemSettings | undefined => {
    return db.getSnapshot().settings;
  },

  // ---------------------------------------------------------------------------
  // Employees
  // ---------------------------------------------------------------------------
  getEmployees: (): Employee[] => {
    const list = db.getSnapshot().employees;
    if (!list || list.length === 0) {
      db.update('employees', () => SEED_EMPLOYEES);
      return SEED_EMPLOYEES;
    }
    return list;
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
    const existing = emp?.attendanceRecords || {};
    const result: Record<string, EmployeeAttendanceDay> = {};

    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (existing[dateKey]) {
        result[dateKey] = existing[dateKey];
      } else {
        const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 is Sunday
        if (dayOfWeek === 0) {
          // Sunday is Holiday (no color circle)
          result[dateKey] = { status: 'HOLIDAY' };
        } else {
          // Default weekday logic based on standard attendance
          const targetAttended = emp?.attendedDays ?? 26;
          // Working days so far in month up to target
          if (day === 12 || day === 25) {
            // Sample OT days
            result[dateKey] = { status: 'OVERTIME', overtimeHours: 2 };
          } else if (targetAttended < 25 && day === 18) {
            // Absent day
            result[dateKey] = { status: 'ABSENT' };
          } else {
            result[dateKey] = { status: 'PRESENT' };
          }
        }
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
    const existingRecords = emp?.attendanceRecords || {};
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

    const generateSvg = (label: string, seed: number) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 70" fill="none" stroke="#2B1810" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M 15 42 Q 35 ${18 + (seed % 10)}, 55 38 T 90 ${32 + (seed % 8)} T 125 45 T 160 ${28 + (seed % 6)} T 185 36 M 25 52 Q 100 54, 175 50" /></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(year, month - 1, day);
      const dowIndex = dObj.getDay();
      const dow = dayShortNames[dowIndex];
      const formattedDate = `${String(day).padStart(2, '0')} ${monthNames[month - 1]} ${year} (${dow})`;

      const isRealRecord = Boolean(existingRecords[dateKey]);
      const rec = attendanceMap[dateKey] || { status: 'PRESENT' };
      const status = rec.status;

      const standardShift =
        rec.standardShiftHours ??
        accountingService.getStandardShiftHoursForDate(employeeId, dateKey);

      let checkInTime = '-';
      let checkOutTime = '-';
      let workedHours = 0;
      let overtimeHours = 0;
      let earlyLeaveHours = 0;
      let inSign: string | undefined = undefined;
      let outSign: string | undefined = undefined;

      if (isRealRecord) {
        // ACTUAL REAL-TIME RECORD FROM POS
        checkInTime = rec.checkInTime ? formatTime12h(rec.checkInTime) : '-';
        checkOutTime = rec.checkOutTime ? formatTime12h(rec.checkOutTime) : '-';
        workedHours = rec.workedHours ?? (rec.checkOutTime ? standardShift : 0);
        overtimeHours = rec.overtimeHours ?? 0;
        earlyLeaveHours = rec.earlyLeaveHours ?? 0;
        inSign = rec.checkInSignature;
        outSign = rec.checkOutSignature;
      } else {
        // MOCK / DEFAULT PAST DAYS
        if (status === 'PRESENT') {
          checkInTime = '08:00 AM';
          const finish = 8 + standardShift;
          const hour12 = finish > 12 ? finish - 12 : finish === 0 ? 12 : finish;
          const period = finish >= 12 && finish < 24 ? 'PM' : 'AM';
          checkOutTime = `${String(hour12).padStart(2, '0')}:00 ${period}`;
          workedHours = standardShift;
          inSign = generateSvg(emp?.name || 'Staff', day * 3);
          outSign = generateSvg(emp?.name || 'Staff', day * 7);
        } else if (status === 'LATE') {
          checkInTime = '09:00 AM';
          const finish = 9 + standardShift;
          const hour12 = finish > 12 ? finish - 12 : finish === 0 ? 12 : finish;
          const period = finish >= 12 && finish < 24 ? 'PM' : 'AM';
          checkOutTime = `${String(hour12).padStart(2, '0')}:00 ${period}`;
          workedHours = standardShift;
          inSign = generateSvg(emp?.name || 'Staff', day * 3);
          outSign = generateSvg(emp?.name || 'Staff', day * 7);
        } else if (status === 'EARLY_LEAVE') {
          checkInTime = '08:00 AM';
          checkOutTime = '03:30 PM';
          workedHours = Math.max(1, standardShift - 2);
          earlyLeaveHours = 2;
          inSign = generateSvg(emp?.name || 'Staff', day * 3);
          outSign = generateSvg(emp?.name || 'Staff', day * 7);
        } else if (status === 'OVERTIME') {
          const ot = rec.overtimeHours || 2;
          overtimeHours = ot;
          workedHours = standardShift + ot;
          checkInTime = '08:00 AM';
          const finish = 8 + standardShift + ot;
          const hour12 = finish > 12 ? finish - 12 : finish === 0 ? 12 : finish;
          const period = finish >= 12 && finish < 24 ? 'PM' : 'AM';
          checkOutTime = `${String(hour12).padStart(2, '0')}:00 ${period}`;
          inSign = generateSvg(emp?.name || 'Staff', day * 3);
          outSign = generateSvg(emp?.name || 'Staff', day * 7);
        }
      }

      const varianceHours = workedHours - (status === 'HOLIDAY' ? 0 : standardShift);

      rows.push({
        date: dateKey,
        dayOfWeek: dow,
        formattedDate,
        status,
        checkInTime,
        checkOutTime,
        checkInSignature: inSign,
        checkOutSignature: outSign,
        standardShiftHours: status === 'HOLIDAY' ? 0 : standardShift,
        workedHours,
        overtimeHours,
        earlyLeaveHours,
        varianceHours,
        isLate: rec.isLate,
        lateMinutes: rec.lateMinutes,
        isEarlyLeave: rec.isEarlyLeave,
        earlyMinutes: rec.earlyMinutes,
        notes: rec.notes,
      });
    }

    return rows;
  },

  updateEmployeeAttendanceDay: (
    employeeId: string,
    dateStr: string,
    record: EmployeeAttendanceDay
  ): Employee | null => {
    let updatedEmp: Employee | null = null;
    db.update('employees', (emps) =>
      emps.map((e) => {
        if (e.id !== employeeId) return e;
        const currentRecords = { ...(e.attendanceRecords || {}) };
        const stdHours =
          record.standardShiftHours ??
          accountingService.getStandardShiftHoursForDate(employeeId, dateStr);

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
          if (rec) {
            if (rec.status === 'PRESENT' || rec.status === 'OVERTIME') {
              attendedCount++;
            }
          } else {
            const dow = new Date(y, m - 1, d).getDay();
            if (dow !== 0) {
              attendedCount++; // Default weekday present
            }
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

  bulkSetMonthAttendance: (
    employeeId: string,
    year: number,
    month: number,
    defaultStatus: AttendanceDayStatus = 'PRESENT'
  ): Employee | null => {
    let updatedEmp: Employee | null = null;
    const daysInMonth = new Date(year, month, 0).getDate();

    db.update('employees', (emps) =>
      emps.map((e) => {
        if (e.id !== employeeId) return e;
        const currentRecords = { ...(e.attendanceRecords || {}) };
        let attendedCount = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dow = new Date(year, month - 1, d).getDay();
          if (dow === 0) {
            currentRecords[dKey] = { status: 'HOLIDAY' };
          } else {
            currentRecords[dKey] = { status: defaultStatus };
            if (defaultStatus === 'PRESENT' || defaultStatus === 'OVERTIME') {
              attendedCount++;
            }
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

  // ---------------------------------------------------------------------------
  // Employee Payroll & Disbursements
  // ---------------------------------------------------------------------------
  getEmployeePayments: (employeeId?: string): EmployeePayment[] => {
    const list = db.getSnapshot().employeePayments || [];
    if (list.length === 0) {
      db.update('employeePayments', () => SEED_EMPLOYEE_PAYMENTS);
      return SEED_EMPLOYEE_PAYMENTS;
    }
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
    details?: { chequeNumber?: string; bankName?: string; chequeDate?: string; notes?: string }
  ) => {
    let remainingToAllocate = amountCents;

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
              method,
              amountCents: alloc,
              timestamp: new Date().toISOString(),
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

    // 2. Cost of Goods (Ingredient Purchases)
    const allPurchases = catalogService.getPurchases();
    const monthlyPurchases = allPurchases.filter((p) => isMatchingDate(p.purchaseDate));
    const cogsPurchasesCents = monthlyPurchases.reduce((sum, p) => sum + (p.totalCents || 0), 0);
    const purchasesPaidCents = monthlyPurchases.reduce((sum, p) => sum + (p.paidCents ?? p.totalCents), 0);
    const purchasesDueCents = monthlyPurchases.reduce(
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
    const totalOutflowCents = cogsPurchasesCents + payrollDisbursedCents + operatingExpensesCents;
    const netProfitCents = grossRevenueCents - totalOutflowCents;
    const netMarginPercent = grossRevenueCents > 0 ? (netProfitCents / grossRevenueCents) * 100 : 0;

    // 6. Cash Flow Breakdown (Cash In vs Cash Out)
    const cashInOrdersCents = monthlyOrders
      .filter((o) => o.paymentMethod === 'CASH')
      .reduce((sum, o) => sum + (o.totalCents || 0), 0);

    const cashOutPurchasesCents = monthlyPurchases.reduce((sum, p) => {
      const cashPayments = p.payments?.filter((pm) => pm.method === 'CASH').reduce((s, pm) => s + pm.amountCents, 0) || 0;
      return sum + cashPayments;
    }, 0);

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
