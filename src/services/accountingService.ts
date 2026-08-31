import { db } from './storage/db';
import {
  Employee,
  EmployeePayment,
  Supplier,
  PurchasePaymentMethod,
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
