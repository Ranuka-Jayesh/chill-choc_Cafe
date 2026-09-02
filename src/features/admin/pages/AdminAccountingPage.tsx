import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { accountingService } from '@/services/accountingService';
import { catalogService } from '@/services/catalogService';
import { inventoryService } from '@/services/inventoryService';
import { db } from '@/services/storage/db';
import { useAuthStore } from '@/store/useAuthStore';
import { confirmDialog } from '@/store/useConfirmStore';
import { toast } from 'sonner';
import {
  formatLKR,
  formatDateTime,
  formatDate,
} from '@/utils/format';
import {
  Employee,
  EmployeePayment,
  EmployeePaymentType,
  EmployeePayFrequency,
  Supplier,
  SupplierProvidedItem,
  Ingredient,
  Expense,
  Purchase,
  PurchasePaymentMethod,
} from '@/types';
import { MonthYearPicker, MonthYearValue } from '@/components/ui/MonthYearPicker';
import { CustomSelect, SelectOption } from '@/components/ui/CustomSelect';
import { CustomDatePicker } from '@/components/ui/CustomDatePicker';
import { EmployeeAttendanceCalendarModal } from '@/features/admin/components/EmployeeAttendanceCalendarModal';
import {
  Users,
  Building2,
  Receipt,
  Plus,
  Search,
  X,
  Check,
  Edit2,
  Trash2,
  Wallet,
  Banknote,
  CreditCard,
  FileText,
  Phone,
  Mail,
  MapPin,
  ArrowLeft,
  CheckCircle2,
  Building,
  ChevronRight,
  User,
  Briefcase,
  Calendar,
  Landmark,
  ShieldCheck,
  Sparkles,
  Package,
  Clock,
  Printer,
} from 'lucide-react';

type ActiveTab = 'payroll' | 'suppliers' | 'expenses';

type ExpenseCategoryType =
  | 'CLEANING'
  | 'EMERGENCY_MILK'
  | 'DELIVERY'
  | 'PETTY_CASH'
  | 'MAINTENANCE'
  | 'UTILITIES'
  | 'OTHER';

const EXPENSE_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'CLEANING', label: 'Cleaning & Janitorial' },
  { value: 'EMERGENCY_MILK', label: 'Emergency Dairy / Milk' },
  { value: 'DELIVERY', label: 'Ice / Gas Delivery' },
  { value: 'PETTY_CASH', label: 'Petty Cash / Supplies' },
  { value: 'MAINTENANCE', label: 'Equipment Maintenance' },
  { value: 'UTILITIES', label: 'Utilities & Bills' },
  { value: 'OTHER', label: 'Other Operational' },
];

// Helper to format Sri Lankan local phone number to "XX XXX XXXX" (9 digits)
const formatLKLocalPhone = (val: string): string => {
  if (!val) return '';
  let digits = val.replace(/\D/g, '');
  if (digits.startsWith('94')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  digits = digits.slice(0, 9);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
};

// Helper to format numeric strings with commas (e.g. "75000" -> "75,000", "75000.5" -> "75,000.5")
const formatCommaNumber = (val: string | number): string => {
  if (val === '' || val === null || val === undefined) return '';
  const str = String(val).replace(/,/g, '').trim();
  if (!str) return '';
  const parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

const cleanCommaNumber = (val: string | number): string => {
  return String(val || '').replace(/,/g, '').trim();
};

export const AdminAccountingPage: React.FC = () => {
  const { session } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get('tab') as ActiveTab) || 'payroll';
  const selectedEmployeeId = searchParams.get('employeeId');
  const selectedSupplierId = searchParams.get('supplierId');

  // ---------------------------------------------------------------------------
  // Core State
  // ---------------------------------------------------------------------------
  const [dateRange, setDateRange] = useState<MonthYearValue>({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
  });

  const [employees, setEmployees] = useState<Employee[]>(accountingService.getEmployees());
  const [employeePayments, setEmployeePayments] = useState<EmployeePayment[]>(
    accountingService.getEmployeePayments()
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(catalogService.getSuppliers());
  const [expenses, setExpenses] = useState<Expense[]>(catalogService.getExpenses());
  const [purchases, setPurchases] = useState<Purchase[]>(catalogService.getPurchases());
  const [ingredients, setIngredients] = useState<Ingredient[]>(inventoryService.getIngredients());

  // Search & Filters
  const [search, setSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('ALL');

  // Modals state
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const [isPayingEmployee, setIsPayingEmployee] = useState<Employee | null>(null);
  const [viewingAttendanceEmployee, setViewingAttendanceEmployee] = useState<Employee | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [settlingSupplier, setSettlingSupplier] = useState<{
    supplierName: string;
    dueCents: number;
  } | null>(null);
  const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);
  const [supplierSubTab, setSupplierSubTab] = useState<'purchases' | 'payments'>('payments');
  const [employeeSubTab, setEmployeeSubTab] = useState<'payments' | 'attendance'>('payments');

  // Form states for Record Employee Payment
  const [payAmount, setPayAmount] = useState('');
  const [payBasicAmount, setPayBasicAmount] = useState('');
  const [payOtHours, setPayOtHours] = useState('');
  const [payOtAmount, setPayOtAmount] = useState('');
  const [applyBonus, setApplyBonus] = useState(false);
  const [payBonusAmount, setPayBonusAmount] = useState('');
  const [payBonusReason, setPayBonusReason] = useState('');
  const [payAutoAdvanceRupees, setPayAutoAdvanceRupees] = useState(0);
  const [applyDeduction, setApplyDeduction] = useState(false);
  const [payDeductionAmount, setPayDeductionAmount] = useState('');
  const [payDeductionReason, setPayDeductionReason] = useState('');
  const [payType, setPayType] = useState<EmployeePaymentType>('SALARY');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'CHEQUE'>('CASH');
  const [payChequeDate, setPayChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [payChequeNumber, setPayChequeNumber] = useState('');
  const [payBankName, setPayBankName] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [viewingPaymentSlip, setViewingPaymentSlip] = useState<EmployeePayment | null>(null);

  // Form states for Settle Supplier Balance
  const [settleSupplierAmount, setSettleSupplierAmount] = useState('');
  const [settleSupplierMethod, setSettleSupplierMethod] = useState<PurchasePaymentMethod>('CASH');
  const [settleSupplierChequeNumber, setSettleSupplierChequeNumber] = useState('');
  const [settleSupplierChequeBank, setSettleSupplierChequeBank] = useState('');
  const [settleSupplierChequeDate, setSettleSupplierChequeDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [settleSupplierNotes, setSettleSupplierNotes] = useState('');

  // Form states for Record Expense
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategoryType>('PETTY_CASH');
  const [expensePaidViaDrawer, setExpensePaidViaDrawer] = useState(true);
  const [expenseNotes, setExpenseNotes] = useState('');

  // ---------------------------------------------------------------------------
  // Sync & ESC Keyboard handling
  // ---------------------------------------------------------------------------
  const syncAll = () => {
    setEmployees(accountingService.getEmployees());
    setEmployeePayments(accountingService.getEmployeePayments());
    setSuppliers(catalogService.getSuppliers());
    setPurchases(catalogService.getPurchases());
    setExpenses(catalogService.getExpenses());
    setIngredients(inventoryService.getIngredients());
  };

  useEffect(() => {
    const unsub = db.subscribe(() => {
      syncAll();
    });
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('cafemm') || e.key?.includes('employee')) {
        syncAll();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingAttendanceEmployee) setViewingAttendanceEmployee(null);
        if (viewingPaymentSlip) setViewingPaymentSlip(null);
        if (editingEmployee) setEditingEmployee(null);
        if (isPayingEmployee) setIsPayingEmployee(null);
        if (editingSupplier) setEditingSupplier(null);
        if (settlingSupplier) setSettlingSupplier(null);
        if (editingExpense) setEditingExpense(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewingAttendanceEmployee,
    viewingPaymentSlip,
    editingEmployee,
    isPayingEmployee,
    editingSupplier,
    settlingSupplier,
    editingExpense,
  ]);

  const handleTabChange = (tab: ActiveTab) => {
    setSearchParams({ tab });
    setSearch('');
  };

  const handleSelectEmployee = (empId: string | null) => {
    if (empId) {
      setSearchParams({ tab: 'payroll', employeeId: empId });
    } else {
      setSearchParams({ tab: 'payroll' });
    }
    setSearch('');
  };

  const handleSelectSupplier = (supId: string | null) => {
    if (supId) {
      setSearchParams({ tab: 'suppliers', supplierId: supId });
      setSupplierSubTab('payments');
    } else {
      setSearchParams({ tab: 'suppliers' });
    }
    setSearch('');
  };

  // Helper to check date range
  const isMatchingPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const yMatch = dateRange.year === 'ALL' || d.getFullYear() === parseInt(dateRange.year, 10);
    const mMatch = dateRange.month === 'ALL' || d.getMonth() + 1 === parseInt(dateRange.month, 10);
    return yMatch && mMatch;
  };

  // ---------------------------------------------------------------------------
  // Computed Financial Summary
  // ---------------------------------------------------------------------------
  const summary = useMemo(() => {
    const y = dateRange.year !== 'ALL' ? parseInt(dateRange.year, 10) : new Date().getFullYear();
    const m = dateRange.month !== 'ALL' ? parseInt(dateRange.month, 10) : new Date().getMonth() + 1;
    return accountingService.getFinancialSummary(y, m);
  }, [dateRange, employees, employeePayments, expenses, purchases]);

  // ---------------------------------------------------------------------------
  // Employee Payroll Analysis
  // ---------------------------------------------------------------------------
  const employeesWithStats = useMemo(() => {
    const currentShifts = db.getSnapshot().shifts || [];
    return employees.map((emp) => {
      const allEmpPayments = employeePayments.filter((p) => p.employeeId === emp.id);
      const monthlyPayments = allEmpPayments.filter((p) => isMatchingPeriod(p.date));
      const paidThisMonthCents = monthlyPayments.reduce((s, p) => s + p.amountCents, 0);
      const baseSalaryCents = emp.baseSalaryCents || 0;
      const dueThisMonthCents = Math.max(0, baseSalaryCents - paidThisMonthCents);
      const isFullyPaidThisMonth = paidThisMonthCents >= baseSalaryCents;
      const lifetimePaidCents = allEmpPayments.reduce((s, p) => s + p.amountCents, 0);

      // Attendance / Attended days calculation
      const shiftAttendedDates = new Set(
        currentShifts
          .filter(
            (s) =>
              (s.cashierId === emp.id || s.cashierName.toLowerCase() === emp.name.toLowerCase()) &&
              isMatchingPeriod(s.openedAt || s.businessDate)
          )
          .map((s) => s.businessDate || s.openedAt?.split('T')[0])
      );
      const shiftDaysCount = shiftAttendedDates.size;
      const attendedDays = shiftDaysCount > 0 ? shiftDaysCount : (emp.attendedDays ?? 26);

      return {
        ...emp,
        attendedDays,
        paidThisMonthCents,
        dueThisMonthCents,
        isFullyPaidThisMonth,
        monthlyPaymentsCount: monthlyPayments.length,
        lifetimePaidCents,
        allPaymentsCount: allEmpPayments.length,
      };
    });
  }, [employees, employeePayments, dateRange]);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employeesWithStats;
    return employeesWithStats.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        (e.phone && e.phone.includes(q)) ||
        (e.bankName && e.bankName.toLowerCase().includes(q))
    );
  }, [employeesWithStats, search]);

  const selectedEmployeeData = useMemo(() => {
    if (!selectedEmployeeId) return null;
    const emp = employeesWithStats.find((e) => e.id === selectedEmployeeId);
    if (!emp) return null;
    const payments = employeePayments.filter((p) => p.employeeId === selectedEmployeeId);
    const q = search.toLowerCase().trim();
    const filtered = !q
      ? payments
      : payments.filter(
          (p) =>
            p.paymentType.toLowerCase().includes(q) ||
            p.method.toLowerCase().includes(q) ||
            (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q)) ||
            (p.notes && p.notes.toLowerCase().includes(q))
        );
    return {
      employee: emp,
      payments: filtered,
      allPayments: payments,
    };
  }, [selectedEmployeeId, employeesWithStats, employeePayments, search]);

  const employeeAttendanceRows = useMemo(() => {
    if (!selectedEmployeeData) return [];
    const year = dateRange.year !== 'ALL' ? parseInt(dateRange.year, 10) : new Date().getFullYear();
    const month = dateRange.month !== 'ALL' ? parseInt(dateRange.month, 10) : new Date().getMonth() + 1;
    const allRows = accountingService.getEmployeeAttendanceDetailsList(selectedEmployeeData.employee.id, year, month);
    const q = search.toLowerCase().trim();
    if (!q) return allRows;
    return allRows.filter(
      (r) =>
        r.date.toLowerCase().includes(q) ||
        r.formattedDate.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.checkInTime.toLowerCase().includes(q) ||
        r.checkOutTime.toLowerCase().includes(q)
    );
  }, [selectedEmployeeData, dateRange.year, dateRange.month, employees, search]);

  const filteredEmployeePayments = useMemo(() => {
    const q = search.toLowerCase().trim();
    return employeePayments.filter((p) => {
      if (!isMatchingPeriod(p.date)) return false;
      if (!q) return true;
      return (
        p.employeeName.toLowerCase().includes(q) ||
        p.paymentType.toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q) ||
        (p.referenceNumber && p.referenceNumber.toLowerCase().includes(q))
      );
    });
  }, [employeePayments, dateRange, search]);

  // ---------------------------------------------------------------------------
  // Supplier Ledgers & Due Calculation
  // ---------------------------------------------------------------------------
  const supplierLedgers = useMemo(() => {
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

      const openPOs = supPurchases.filter((p) => (p.dueCents ?? 0) > 0);
      let earliestDueDate: string | undefined = undefined;
      let daysDiff: number | null = null;

      if (openPOs.length > 0) {
        const sortedPOs = [...openPOs].sort((a, b) => {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : new Date(a.purchaseDate).getTime() + 14 * 86400000;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : new Date(b.purchaseDate).getTime() + 14 * 86400000;
          return dateA - dateB;
        });

        const targetPO = sortedPOs[0];
        earliestDueDate = targetPO.dueDate || targetPO.purchaseDate;
        if (earliestDueDate) {
          const target = new Date(earliestDueDate).getTime();
          const today = new Date().setHours(0, 0, 0, 0);
          daysDiff = Math.round((target - today) / (1000 * 60 * 60 * 24));
        }
      }

      const paymentsHistory = supPurchases.flatMap((po) =>
        (po.payments || []).map((pm) => ({
          ...pm,
          poNumber: po.purchaseNumber,
          invoiceNumber: po.invoiceNumber,
          poId: po.id,
          poDate: po.purchaseDate,
        }))
      );

      return {
        supplier: sup,
        purchasesCount: supPurchases.length,
        totalInvoicedCents,
        totalPaidCents,
        totalDueCents,
        earliestDueDate,
        daysDiff,
        purchases: supPurchases,
        paymentsHistory,
      };
    });
  }, [suppliers, purchases]);

  const totalSupplierDueCents = useMemo(() => {
    return supplierLedgers.reduce((acc, s) => acc + s.totalDueCents, 0);
  }, [supplierLedgers]);

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return supplierLedgers;
    return supplierLedgers.filter(
      (s) =>
        s.supplier.name.toLowerCase().includes(q) ||
        (s.supplier.contactPerson && s.supplier.contactPerson.toLowerCase().includes(q)) ||
        (s.supplier.phone && s.supplier.phone.includes(q)) ||
        (s.supplier.address && s.supplier.address.toLowerCase().includes(q))
    );
  }, [supplierLedgers, search]);

  const selectedSupplierData = useMemo(() => {
    if (!selectedSupplierId) return null;
    const supData = supplierLedgers.find((s) => s.supplier.id === selectedSupplierId);
    if (!supData) return null;
    const q = search.toLowerCase().trim();

    const filteredPOs = !q
      ? supData.purchases
      : supData.purchases.filter(
          (po) =>
            po.purchaseNumber.toLowerCase().includes(q) ||
            po.invoiceNumber.toLowerCase().includes(q) ||
            po.items.some((it) => it.ingredientName.toLowerCase().includes(q))
        );

    const filteredPayments = !q
      ? supData.paymentsHistory
      : supData.paymentsHistory.filter(
          (pm) =>
            pm.poNumber.toLowerCase().includes(q) ||
            pm.method.toLowerCase().includes(q) ||
            (pm.chequeNumber && pm.chequeNumber.toLowerCase().includes(q)) ||
            (pm.bankName && pm.bankName.toLowerCase().includes(q)) ||
            (pm.notes && pm.notes.toLowerCase().includes(q))
        );

    return {
      ...supData,
      filteredPurchases: filteredPOs,
      filteredPayments,
    };
  }, [selectedSupplierId, supplierLedgers, search]);

  // ---------------------------------------------------------------------------
  // Operating Expenses
  // ---------------------------------------------------------------------------
  const filteredExpenses = useMemo(() => {
    const q = search.toLowerCase().trim();
    return expenses.filter((e) => {
      if (!isMatchingPeriod(e.createdAt)) return false;
      if (expenseCategoryFilter !== 'ALL' && e.category !== expenseCategoryFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.cashierName && e.cashierName.toLowerCase().includes(q)) ||
        (e.notes && e.notes.toLowerCase().includes(q))
      );
    });
  }, [expenses, dateRange, expenseCategoryFilter, search]);

  const expenseStats = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + (e.amountCents || 0), 0);
    const drawer = filteredExpenses.filter((e) => e.paidViaDrawer).reduce((sum, e) => sum + (e.amountCents || 0), 0);
    const direct = total - drawer;
    return { total, drawer, direct, count: filteredExpenses.length };
  }, [filteredExpenses]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee?.name?.trim()) {
      toast.error('Please enter employee name.');
      return;
    }

    if (editingEmployee.phone) {
      const digits = editingEmployee.phone.replace(/\D/g, '').replace(/^94|^0/, '');
      if (digits.length > 0 && digits.length !== 9) {
        toast.error('Please enter a valid 9-digit phone number (e.g. 7X XXX XXXX).');
        return;
      }
    }

    accountingService.saveEmployee({
      ...editingEmployee,
      name: editingEmployee.name.trim(),
      role: editingEmployee.role || 'Staff',
      baseSalaryCents: editingEmployee.baseSalaryCents || 0,
      payFrequency: editingEmployee.payFrequency || 'MONTHLY',
    } as Employee);

    toast.success(`Employee "${editingEmployee.name}" saved successfully.`);
    setEditingEmployee(null);
    syncAll();
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    const confirmed = await confirmDialog({
      title: `Delete Employee ${emp.name}?`,
      message: 'This will remove the employee record. Existing payment history will remain intact.',
      confirmText: 'Delete Employee',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (confirmed) {
      accountingService.deleteEmployee(emp.id);
      toast.success(`Employee "${emp.name}" deleted.`);
      if (selectedEmployeeId === emp.id) {
        handleSelectEmployee(null);
      }
      syncAll();
    }
  };

  const handleOpenPayEmployee = (emp: Employee) => {
    setIsPayingEmployee(emp);
    const year = dateRange.year !== 'ALL' ? parseInt(dateRange.year, 10) : new Date().getFullYear();
    const month = dateRange.month !== 'ALL' ? parseInt(dateRange.month, 10) : new Date().getMonth() + 1;
    const attendanceList = accountingService.getEmployeeAttendanceDetailsList(emp.id, year, month);
    const loggedOtHours = attendanceList.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
    const settings = accountingService.getSystemSettings();
    const otHourlyRateCents = emp.overtimeHourlyRateCents || settings?.defaultOvertimeHourlyRateCents || 45000;
    const otRateRupees = otHourlyRateCents / 100;
    const autoOtRupees = loggedOtHours * otRateRupees;
    const fullBaseSalaryRupees = emp.baseSalaryCents / 100;

    // Check if any salary advances were recorded for this employee this month
    const allPayments = accountingService.getEmployeePayments();
    const monthlyAdvances = allPayments.filter((p) => {
      if (p.employeeId !== emp.id || p.paymentType !== 'ADVANCE') return false;
      if (!p.date) return false;
      const d = new Date(p.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    const totalAdvancePaidCents = monthlyAdvances.reduce((sum, p) => sum + (p.amountCents || 0), 0);
    const advanceRupees = totalAdvancePaidCents / 100;

    setPayBasicAmount(String(fullBaseSalaryRupees));
    setPayOtHours(String(loggedOtHours));
    setPayOtAmount(String(autoOtRupees));
    setApplyBonus(false);
    setPayBonusAmount('');
    setPayBonusReason('');
    setPayAutoAdvanceRupees(advanceRupees);
    setApplyDeduction(false);
    setPayDeductionAmount('');
    setPayDeductionReason('');

    const initialTotal = Math.max(0, fullBaseSalaryRupees + autoOtRupees - advanceRupees);
    setPayAmount(String(initialTotal));
    setPayType('SALARY');
    setPayMethod('CASH');
    setPayChequeNumber('');
    setPayChequeDate(new Date().toISOString().split('T')[0]);
    setPayBankName(emp.bankName || '');
    setPayNotes(emp.notes || '');
  };

  const calcPayrollTotal = (
    basicStr: string,
    otStr: string,
    bonusActive: boolean,
    bonusStr: string,
    autoAdvance: number,
    deductActive: boolean,
    deductStr: string
  ) => {
    const b = parseFloat(cleanCommaNumber(basicStr)) || 0;
    const ot = parseFloat(cleanCommaNumber(otStr)) || 0;
    const bonus = bonusActive ? (parseFloat(cleanCommaNumber(bonusStr)) || 0) : 0;
    const otherDeduct = deductActive ? (parseFloat(cleanCommaNumber(deductStr)) || 0) : 0;
    return Math.max(0, b + ot + bonus - autoAdvance - otherDeduct);
  };

  const handleBasicChange = (val: string) => {
    setPayBasicAmount(val);
    setPayAmount(String(calcPayrollTotal(val, payOtAmount, applyBonus, payBonusAmount, payAutoAdvanceRupees, applyDeduction, payDeductionAmount)));
  };

  const handleOtHoursChange = (hrsStr: string) => {
    setPayOtHours(hrsStr);
    const hrs = parseFloat(hrsStr) || 0;
    const settings = accountingService.getSystemSettings();
    const otRateRupees = ((isPayingEmployee?.overtimeHourlyRateCents || settings?.defaultOvertimeHourlyRateCents || 45000) / 100);
    const otAmt = hrs * otRateRupees;
    setPayOtAmount(String(otAmt));
    setPayAmount(String(calcPayrollTotal(payBasicAmount, String(otAmt), applyBonus, payBonusAmount, payAutoAdvanceRupees, applyDeduction, payDeductionAmount)));
  };

  const handleOtAmountChange = (amtStr: string) => {
    setPayOtAmount(amtStr);
    setPayAmount(String(calcPayrollTotal(payBasicAmount, amtStr, applyBonus, payBonusAmount, payAutoAdvanceRupees, applyDeduction, payDeductionAmount)));
  };

  const handleBonusToggle = (checked: boolean) => {
    setApplyBonus(checked);
    setPayAmount(String(calcPayrollTotal(payBasicAmount, payOtAmount, checked, payBonusAmount, payAutoAdvanceRupees, applyDeduction, payDeductionAmount)));
  };

  const handleBonusAmountChange = (val: string) => {
    setPayBonusAmount(val);
    setPayAmount(String(calcPayrollTotal(payBasicAmount, payOtAmount, applyBonus, val, payAutoAdvanceRupees, applyDeduction, payDeductionAmount)));
  };

  const handleDeductionToggle = (checked: boolean) => {
    setApplyDeduction(checked);
    setPayAmount(String(calcPayrollTotal(payBasicAmount, payOtAmount, applyBonus, payBonusAmount, payAutoAdvanceRupees, checked, payDeductionAmount)));
  };

  const handleDeductionAmountChange = (val: string) => {
    setPayDeductionAmount(val);
    setPayAmount(String(calcPayrollTotal(payBasicAmount, payOtAmount, applyBonus, payBonusAmount, payAutoAdvanceRupees, applyDeduction, val)));
  };

  const handleConfirmPayEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPayingEmployee) return;

    let finalTotal = parseFloat(cleanCommaNumber(payAmount));
    let basicCents = 0;
    let otCents = 0;
    let otHrs = 0;
    let bonusCents = 0;
    let bonusReason: string | undefined = undefined;
    let deductionCents = 0;
    let deductionReason: string | undefined = undefined;

    if (payType === 'SALARY') {
      const basicVal = parseFloat(cleanCommaNumber(payBasicAmount)) || 0;
      const otVal = parseFloat(cleanCommaNumber(payOtAmount)) || 0;
      const bonusVal = applyBonus ? (parseFloat(cleanCommaNumber(payBonusAmount)) || 0) : 0;
      const otherDeductVal = applyDeduction ? (parseFloat(cleanCommaNumber(payDeductionAmount)) || 0) : 0;
      const totalDeductVal = payAutoAdvanceRupees + otherDeductVal;
      
      if (applyBonus && bonusVal <= 0) {
        toast.error('Please enter a valid bonus amount or uncheck Apply Bonus.');
        return;
      }
      if (applyBonus && !payBonusReason.trim()) {
        toast.error('Please enter a reason for the bonus.');
        return;
      }
      if (applyDeduction && otherDeductVal <= 0) {
        toast.error('Please enter a valid deduction amount or uncheck Apply Other Deductions.');
        return;
      }
      if (applyDeduction && !payDeductionReason.trim()) {
        toast.error('Please enter a reason for the other deduction.');
        return;
      }

      basicCents = Math.round(basicVal * 100);
      otCents = Math.round(otVal * 100);
      otHrs = parseFloat(payOtHours) || 0;
      bonusCents = Math.round(bonusVal * 100);
      bonusReason = applyBonus ? payBonusReason.trim() : undefined;
      
      deductionCents = Math.round(totalDeductVal * 100);
      let combinedReason: string | undefined = undefined;
      if (payAutoAdvanceRupees > 0 && applyDeduction) {
        combinedReason = `Advance Recovery (Rs. ${payAutoAdvanceRupees.toLocaleString()}) + ${payDeductionReason.trim()}`;
      } else if (payAutoAdvanceRupees > 0) {
        combinedReason = 'Salary Advance Recovery';
      } else if (applyDeduction) {
        combinedReason = payDeductionReason.trim();
      }
      deductionReason = combinedReason;

      finalTotal = Math.max(0, basicVal + otVal + bonusVal - payAutoAdvanceRupees - otherDeductVal);
    } else {
      if (!finalTotal || finalTotal <= 0) {
        toast.error('Please enter a valid disbursement amount.');
        return;
      }
      if (payType === 'OVERTIME') {
        otCents = Math.round(finalTotal * 100);
        otHrs = parseFloat(payOtHours) || 0;
      } else if (payType === 'BONUS') {
        bonusCents = Math.round(finalTotal * 100);
        bonusReason = payBonusReason.trim() || undefined;
      } else if (payType === 'ADVANCE') {
        basicCents = Math.round(finalTotal * 100);
      }
    }

    if (finalTotal <= 0) {
      toast.error('Total disbursement amount must be greater than 0.');
      return;
    }

    if (payMethod === 'CHEQUE') {
      if (!payChequeNumber.trim()) {
        toast.error('Please enter Cheque Number.');
        return;
      }
      if (!payChequeDate) {
        toast.error('Please select Cheque End / Maturity Date.');
        return;
      }
    }

    accountingService.recordEmployeePayment({
      employeeId: isPayingEmployee.id,
      employeeName: isPayingEmployee.name,
      amountCents: Math.round(finalTotal * 100),
      baseSalaryAmountCents: basicCents > 0 ? basicCents : undefined,
      overtimeAmountCents: otCents > 0 ? otCents : undefined,
      overtimeHours: otHrs > 0 ? otHrs : undefined,
      bonusAmountCents: bonusCents > 0 ? bonusCents : undefined,
      bonusReason: bonusReason,
      deductionAmountCents: deductionCents > 0 ? deductionCents : undefined,
      deductionReason: deductionReason,
      paymentType: payType,
      method: payMethod,
      date: new Date().toISOString(),
      bankName: payBankName.trim() || undefined,
      chequeNumber: payMethod === 'CHEQUE' ? payChequeNumber.trim() || undefined : undefined,
      chequeDate: payMethod === 'CHEQUE' ? payChequeDate || undefined : undefined,
      notes: payNotes.trim() || undefined,
    });

    toast.success(`Recorded ${payType} payment of ${formatLKR(Math.round(finalTotal * 100))} to ${isPayingEmployee.name}.`);
    setIsPayingEmployee(null);
    syncAll();
  };

  const handleAddSupplierItem = () => {
    const defaultIng = ingredients[0];
    const newItem: SupplierProvidedItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ingredientId: defaultIng?.id || '',
      name: '',
      unit: defaultIng?.unit || 'kg',
      sku: defaultIng?.sku || '',
    };
    setEditingSupplier((prev) => ({
      ...prev!,
      providedItems: [...(prev?.providedItems || []), newItem],
    }));
  };

  const handleUpdateSupplierItem = (index: number, updates: Partial<SupplierProvidedItem>) => {
    setEditingSupplier((prev) => {
      if (!prev) return null;
      const list = [...(prev.providedItems || [])];
      list[index] = { ...list[index], ...updates };
      return { ...prev, providedItems: list };
    });
  };

  const handleRemoveSupplierItem = (index: number) => {
    setEditingSupplier((prev) => {
      if (!prev) return null;
      const list = (prev.providedItems || []).filter((_, i) => i !== index);
      return { ...prev, providedItems: list };
    });
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier?.name?.trim()) {
      toast.error('Please enter supplier company name.');
      return;
    }

    if (editingSupplier.phone) {
      const digits = editingSupplier.phone.replace(/\D/g, '').replace(/^94|^0/, '');
      if (digits.length > 0 && digits.length !== 9) {
        toast.error('Please enter a valid 9-digit phone number (e.g. 7X XXX XXXX).');
        return;
      }
    }

    const cleanedItems = (editingSupplier.providedItems || []).filter(
      (item) => item.name && item.name.trim().length > 0
    );

    catalogService.saveSupplier({
      ...editingSupplier,
      name: editingSupplier.name.trim(),
      providedItems: cleanedItems,
    } as Supplier);

    toast.success(`Supplier "${editingSupplier.name}" saved.`);
    setEditingSupplier(null);
    syncAll();
  };

  const handleDeleteSupplier = async (sup: Supplier) => {
    const confirmed = await confirmDialog({
      title: `Delete Supplier ${sup.name}?`,
      message: 'This will remove the supplier directory entry.',
      confirmText: 'Delete Supplier',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (confirmed) {
      catalogService.deleteSupplier(sup.id);
      toast.success(`Supplier "${sup.name}" deleted.`);
      if (selectedSupplierId === sup.id) {
        handleSelectSupplier(null);
      }
      syncAll();
    }
  };

  const handleOpenSettleSupplier = (supplierName: string, dueCents: number) => {
    setSettlingSupplier({ supplierName, dueCents });
    setSettleSupplierAmount(String(dueCents / 100));
    setSettleSupplierMethod('CASH');
    setSettleSupplierChequeNumber('');
    setSettleSupplierChequeBank('');
    setSettleSupplierChequeDate(new Date().toISOString().split('T')[0]);
    setSettleSupplierNotes('');
  };

  const handleConfirmSettleSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingSupplier) return;

    const numAmt = parseFloat(settleSupplierAmount);
    if (!numAmt || numAmt <= 0) {
      toast.error('Please enter a valid settlement amount.');
      return;
    }

    if (settleSupplierMethod === 'CHEQUE' && (!settleSupplierChequeNumber.trim() || !settleSupplierChequeBank.trim())) {
      toast.error('Please provide Cheque Number and Bank Name.');
      return;
    }

    accountingService.settleSupplierBalance(
      settlingSupplier.supplierName,
      Math.round(numAmt * 100),
      settleSupplierMethod,
      {
        chequeNumber: settleSupplierChequeNumber.trim() || undefined,
        bankName: settleSupplierChequeBank.trim() || undefined,
        chequeDate: settleSupplierChequeDate,
        notes: settleSupplierNotes.trim() || undefined,
      }
    );

    toast.success(`Settled ${formatLKR(Math.round(numAmt * 100))} for ${settlingSupplier.supplierName}.`);
    setSettlingSupplier(null);
    syncAll();
  };

  const handleOpenEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setExpenseTitle(exp.title);
    setExpenseAmount(String(exp.amountCents / 100));
    setExpenseCategory(exp.category);
    setExpensePaidViaDrawer(exp.paidViaDrawer);
    setExpenseNotes(exp.notes || '');
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim()) {
      toast.error('Please enter expense title.');
      return;
    }

    const numAmt = parseFloat(expenseAmount);
    if (!numAmt || numAmt <= 0) {
      toast.error('Please enter a valid expense amount.');
      return;
    }

    if (editingExpense?.id) {
      catalogService.updateExpense(editingExpense.id, {
        title: expenseTitle.trim(),
        amountCents: Math.round(numAmt * 100),
        category: expenseCategory,
        paidViaDrawer: expensePaidViaDrawer,
        notes: expenseNotes.trim() || undefined,
      });
      toast.success(`Expense "${expenseTitle}" updated.`);
    } else {
      catalogService.addExpense({
        title: expenseTitle.trim(),
        amountCents: Math.round(numAmt * 100),
        category: expenseCategory,
        paidViaDrawer: expensePaidViaDrawer,
        cashierId: session?.user?.id,
        cashierName: session?.user?.name || 'Administrator',
        notes: expenseNotes.trim() || undefined,
      });
      toast.success(`Expense "${expenseTitle}" recorded.`);
    }

    setEditingExpense(null);
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseNotes('');
    syncAll();
  };

  const handleDeleteExpense = async (exp: Expense) => {
    const confirmed = await confirmDialog({
      title: 'Delete Expense Record?',
      message: `Are you sure you want to remove "${exp.title}" (${formatLKR(exp.amountCents)})?`,
      confirmText: 'Delete Expense',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (confirmed) {
      catalogService.deleteExpense(exp.id);
      toast.success('Expense deleted.');
      syncAll();
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="h-full flex-1 flex flex-col min-h-0 space-y-3 w-full animate-in fade-in">
      {/* 1. TOP UNIFIED HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-[#EAE3DA] pb-2">
        {/* Tab Switcher */}
        <div className="inline-flex items-center p-1 h-11 bg-white border border-[#E0D7CC] rounded-full shadow-xs overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => handleTabChange('payroll')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'payroll'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Employee Payroll</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                activeTab === 'payroll' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
              }`}
            >
              {employees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('suppliers')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'suppliers'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Supplier Payables</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                activeTab === 'suppliers' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
              }`}
            >
              {suppliers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('expenses')}
            className={`h-full flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-98 whitespace-nowrap ${
              activeTab === 'expenses'
                ? 'bg-brand-teal text-white shadow-teal'
                : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Operating Expenses</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                activeTab === 'expenses' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
              }`}
            >
              {expenses.length}
            </span>
          </button>
        </div>

        {/* Right Controls: Filters & Date Picker */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {activeTab === 'expenses' && (
            <div className="w-[155px]">
              <CustomSelect
                value={expenseCategoryFilter}
                onChange={(val) => setExpenseCategoryFilter(val)}
                options={EXPENSE_CATEGORY_OPTIONS}
                buttonClassName="h-9 !py-0 px-3.5 bg-[#FAF7F2] hover:bg-cream-100 border-[#E0D7CC] rounded-full text-xs font-bold text-brand-brown-dark shadow-xs"
              />
            </div>
          )}

          <MonthYearPicker value={dateRange} onChange={(newVal) => setDateRange(newVal)} />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB 1: EMPLOYEE PAYROLL & DIRECTORY                                    */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && !selectedEmployeeId && (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#FAF7F2] border-b border-[#EAE3DA] flex items-center justify-between shrink-0">
            <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block">
              Staff & Employee Directory
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Employee</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Role</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Contact</th>
                  <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Attendances</th>
                  <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Base Salary</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Bank Details</th>
                  <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Month Status</th>
                  <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-text-muted">
                      No employees found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp.id)}
                      className="hover:bg-cream-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-black text-brand-brown-dark group-hover:text-brand-teal transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>{emp.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-brand-brown">{emp.role}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted">{emp.phone || '-'}</td>
                      <td
                        className="py-2.5 px-3 text-center font-bold text-brand-brown-dark tabular-nums hover:text-brand-teal transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingAttendanceEmployee(emp);
                        }}
                        title="Click to view Attendance Calendar"
                      >
                        {emp.attendedDays} Days
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-xs text-brand-brown-dark tabular-nums">
                        <div>{formatLKR(emp.baseSalaryCents)} / {emp.payFrequency.toLowerCase()}</div>
                        <div className="text-[10px] font-medium text-brand-teal">
                          Pay Day: {emp.salaryPayDay ? `${emp.salaryPayDay}th` : '28th'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-text-secondary">
                        {emp.bankName ? (
                          <div>
                            <div className="font-bold text-brand-brown-dark">{emp.bankName}</div>
                            <div className="font-mono text-[10px] text-text-muted">
                              {emp.accountNumber || 'N/A'} {emp.bankBranch ? `• ${emp.bankBranch}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-text-muted italic">Direct Cash / Not Set</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {emp.isFullyPaidThisMonth ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-50 text-status-success border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Paid ({formatLKR(emp.paidThisMonthCents)})</span>
                          </span>
                        ) : emp.paidThisMonthCents > 0 ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                            Partial (Due: {formatLKR(emp.dueThisMonthCents)})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 inline-block">
                            Due: {formatLKR(emp.dueThisMonthCents)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {!emp.isFullyPaidThisMonth && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayEmployee(emp)}
                              className="px-2.5 py-1 bg-brand-teal/10 hover:bg-brand-teal hover:text-white text-brand-teal rounded-lg font-bold text-[11px] border border-brand-teal/30 transition-all cursor-pointer active:scale-95 whitespace-nowrap shadow-xs"
                              title="Record Salary / Advance Payment"
                            >
                              + Pay
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingAttendanceEmployee(emp)}
                            className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 rounded-full text-text-secondary hover:text-brand-teal flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                            title="View Attendance Calendar"
                          >
                            <Calendar className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEmployee(emp)}
                            className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 rounded-full text-text-secondary hover:text-brand-teal flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployee(emp)}
                            className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-rose-50 hover:border-rose-200 hover:text-status-danger rounded-full text-text-muted flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Delete Employee"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {filteredEmployees.length > 0 && (
                  <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                    <td colSpan={8} className="h-20 bg-transparent border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2.1 DRILL-DOWN: SINGLE EMPLOYEE PROFILE & PAYMENT RECORDS                 */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && selectedEmployeeData && (
        <div className="h-full flex-1 min-h-0 flex flex-col space-y-3">
          {/* Top Unified Header & KPI Statistics Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs shrink-0">
            {/* Left: Back button + Employee Name & ID */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSelectEmployee(null)}
                className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 flex items-center justify-center text-brand-brown-dark cursor-pointer transition-all active:scale-95 shrink-0"
                title="Back to Staff Directory"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="font-extrabold text-sm text-brand-brown-dark flex items-center gap-2">
                  <span>{selectedEmployeeData.employee.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
                    {selectedEmployeeData.employee.role}
                  </span>
                </h2>
                <span className="text-[10px] text-text-muted font-mono">
                  Employee ID: {selectedEmployeeData.employee.id} • Joined: {formatDate(selectedEmployeeData.employee.createdAt)}
                </span>
              </div>
            </div>

            {/* Right: Inline KPI Statistics */}
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              {/* Attendances */}
              <button
                type="button"
                onClick={() => setViewingAttendanceEmployee(selectedEmployeeData.employee)}
                className="flex flex-col items-end hover:opacity-80 transition-opacity cursor-pointer group text-right"
                title="Open Attendance & Overtime Calendar"
              >
                <span className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider group-hover:text-brand-teal">
                  Attendances
                </span>
                <span className="font-mono font-black text-xs sm:text-sm text-brand-brown-dark tabular-nums group-hover:text-brand-teal">
                  {selectedEmployeeData.employee.attendedDays} Days
                </span>
              </button>

              {/* Base Salary */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider">Base Salary</span>
                <span className="font-mono font-black text-xs sm:text-sm text-brand-brown-dark tabular-nums">
                  {formatLKR(selectedEmployeeData.employee.baseSalaryCents)}
                </span>
              </div>

              {/* Disbursed This Month */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold uppercase text-brand-teal tracking-wider">
                  Disbursed ({dateRange.year}-{dateRange.month})
                </span>
                <span className="font-mono font-black text-xs sm:text-sm text-brand-teal tabular-nums">
                  {formatLKR(selectedEmployeeData.employee.paidThisMonthCents)}
                </span>
              </div>

              {/* Current Month Balance */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider">Balance</span>
                <span
                  className={`font-mono font-black text-xs sm:text-sm tabular-nums ${
                    selectedEmployeeData.employee.dueThisMonthCents > 0 ? 'text-rose-700' : 'text-status-success'
                  }`}
                >
                  {selectedEmployeeData.employee.dueThisMonthCents > 0
                    ? formatLKR(selectedEmployeeData.employee.dueThisMonthCents)
                    : 'Rs. 0.00 (Settled)'}
                </span>
              </div>

              {/* Lifetime Total Disbursed */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider">Lifetime Disbursed</span>
                <span className="font-mono font-black text-xs sm:text-sm text-brand-brown-dark tabular-nums">
                  {formatLKR(selectedEmployeeData.employee.lifetimePaidCents)}
                </span>
              </div>
            </div>
          </div>

          {/* Employee Bank & Info Strip */}
          <div className="p-2.5 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Phone className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span className="font-mono">{selectedEmployeeData.employee.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Mail className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>{selectedEmployeeData.employee.email || 'No email'}</span>
              </div>
              {selectedEmployeeData.employee.nic && (
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                  <span className="font-mono">NIC: {selectedEmployeeData.employee.nic}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Building className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>
                  {selectedEmployeeData.employee.bankName ? (
                    <>
                      {selectedEmployeeData.employee.bankName} -{' '}
                      <strong className="font-mono text-brand-brown-dark">
                        {selectedEmployeeData.employee.accountNumber || 'N/A'}
                      </strong>
                      {selectedEmployeeData.employee.bankBranch ? ` (${selectedEmployeeData.employee.bankBranch})` : ''}
                    </>
                  ) : (
                    'Bank details not set'
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Calendar className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>
                  Salary Date:{' '}
                  <strong className="text-brand-brown-dark">
                    Day {selectedEmployeeData.employee.salaryPayDay || '28'}th of month
                  </strong>
                </span>
              </div>
            </div>
            {selectedEmployeeData.employee.notes && (
              <span className="text-[11px] text-text-muted italic">{selectedEmployeeData.employee.notes}</span>
            )}
          </div>

          {/* Payment & Attendance Records History Table */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col">
            <div className="p-3 bg-[#FAF7F2] border-b border-[#EAE3DA] flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider">
                {employeeSubTab === 'payments'
                  ? `Disbursement & Payment Records (${selectedEmployeeData.payments.length})`
                  : `Attendance & Shift Records (${employeeAttendanceRows.length})`}
              </span>

              {/* Right Top Corner Toggle Switch */}
              <div className="flex items-center bg-[#EAE3DA]/60 p-0.5 rounded-xl border border-[#E0D7CC]">
                <button
                  type="button"
                  onClick={() => setEmployeeSubTab('payments')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    employeeSubTab === 'payments'
                      ? 'bg-white text-brand-brown-dark shadow-xs'
                      : 'text-text-muted hover:text-brand-brown-dark'
                  }`}
                >
                  Payments ({selectedEmployeeData.payments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEmployeeSubTab('attendance')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    employeeSubTab === 'attendance'
                      ? 'bg-white text-brand-teal shadow-xs'
                      : 'text-text-muted hover:text-brand-teal'
                  }`}
                >
                  Attendance Records ({selectedEmployeeData.employee.attendedDays}d)
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {employeeSubTab === 'payments' ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                    <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Date / Time</th>
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Voucher / Ref #</th>
                      <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Disbursement Type</th>
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Payment Method & Details</th>
                      <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Amount (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE4] font-medium">
                    {selectedEmployeeData.payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-text-muted">
                          No payment records found.
                        </td>
                      </tr>
                    ) : (
                      selectedEmployeeData.payments.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setViewingPaymentSlip(p)}
                          className="hover:bg-cream-50/80 cursor-pointer transition-colors group"
                          title="Click to view payment voucher slip"
                        >
                          <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                            {formatDateTime(p.date)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-brand-brown-dark group-hover:text-brand-teal transition-colors">
                            <div className="flex items-center gap-1.5">
                              <span>{p.referenceNumber || `VCH-${p.id.slice(-4)}`}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                                p.paymentType === 'SALARY'
                                  ? 'bg-emerald-50 text-status-success border-emerald-200'
                                  : p.paymentType === 'ADVANCE'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-teal-50 text-brand-teal border-teal-200'
                              }`}
                            >
                              {p.paymentType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-text-secondary">
                            {p.method === 'CARD' ? (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-teal-50 text-brand-teal border border-teal-200 inline-flex items-center gap-1">
                                  <Building className="w-3 h-3" />
                                  Bank / Card
                                </span>
                                {p.bankName && (
                                  <span className="font-medium text-brand-brown-dark text-[11px]">
                                    {p.bankName}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                  <Wallet className="w-3 h-3 text-status-success" />
                                  Cash
                                </span>
                                <span className="text-text-secondary">Direct Cash</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-xs text-brand-brown-dark tabular-nums">
                            {formatLKR(p.amountCents)}
                          </td>
                        </tr>
                      ))
                    )}
                    {selectedEmployeeData.payments.length > 0 && (
                      <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                        <td colSpan={5} className="h-20 bg-transparent border-0" />
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                /* Attendance & Shift Records Table */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                    <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Date</th>
                      <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Status</th>
                      <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Attend Time (In)</th>
                      <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Leave Time (Out)</th>
                      <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Digital Signature</th>
                      <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Working Hrs</th>
                      <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Overtime / Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE4] font-medium">
                    {employeeAttendanceRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-text-muted">
                          No attendance records found for this period.
                        </td>
                      </tr>
                    ) : (
                      employeeAttendanceRows.map((row) => (
                        <tr
                          key={row.date}
                          className="hover:bg-cream-50/40 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-brand-brown-dark font-bold whitespace-nowrap">
                            {row.formattedDate}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {row.status === 'PRESENT' ? (
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-emerald-50 text-emerald-800 border border-emerald-300 inline-block">
                                Present ✓
                              </span>
                            ) : row.status === 'LATE' ? (
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-amber-50 text-amber-800 border border-amber-300 inline-block">
                                Late In
                              </span>
                            ) : row.status === 'EARLY_LEAVE' ? (
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-yellow-50 text-yellow-900 border border-yellow-300 inline-block">
                                Early Leave
                              </span>
                            ) : row.status === 'OVERTIME' ? (
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-purple-50 text-purple-800 border border-purple-300 inline-block">
                                + Overtime
                              </span>
                            ) : row.status === 'ABSENT' ? (
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-rose-50 text-rose-800 border border-rose-300 inline-block">
                                Absent
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase bg-neutral-100 text-text-muted inline-block">
                                Holiday
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-text-secondary">
                            <span>{row.checkInTime}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-text-secondary">
                            <span>{row.checkOutTime}</span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.status === 'HOLIDAY' || row.status === 'ABSENT' ? (
                              <span className="text-text-muted text-[11px] font-mono">-</span>
                            ) : (
                              <div className="flex items-center justify-center gap-2.5">
                                {/* In Signature */}
                                <div className="group relative h-6 w-14 flex items-center justify-center cursor-pointer">
                                  {row.checkInSignature ? (
                                    <img
                                      src={row.checkInSignature}
                                      alt="In Sign"
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-bold text-text-muted">-</span>
                                  )}
                                  <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded bg-brand-brown-deep text-white text-[9px] font-bold whitespace-nowrap z-20 shadow-md">
                                    Check-In Signature ({row.checkInTime})
                                  </span>
                                </div>

                                {/* Separator */}
                                <span className="text-zinc-300 font-bold select-none text-xs">|</span>

                                {/* Out Signature */}
                                <div className="group relative h-6 w-14 flex items-center justify-center cursor-pointer">
                                  {row.checkOutSignature ? (
                                    <img
                                      src={row.checkOutSignature}
                                      alt="Out Sign"
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  ) : (
                                    <span className="text-[10px] font-bold text-text-muted">-</span>
                                  )}
                                  <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded bg-brand-brown-deep text-white text-[9px] font-bold whitespace-nowrap z-20 shadow-md">
                                    Check-Out Signature ({row.checkOutTime})
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-brand-brown-dark">
                            {row.workedHours > 0 ? `${row.workedHours.toFixed(1)} hrs` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold">
                            {row.status === 'OVERTIME' ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
                                +{row.overtimeHours.toFixed(1)} hrs OT
                              </span>
                            ) : row.earlyLeaveHours > 0 && row.status !== 'ABSENT' ? (
                              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                                -{row.earlyLeaveHours.toFixed(1)} hrs Early
                              </span>
                            ) : row.status === 'ABSENT' ? (
                              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-[11px]">
                                Absent (-{row.standardShiftHours.toFixed(1)}h)
                              </span>
                            ) : row.status === 'HOLIDAY' ? (
                              <span className="text-text-muted text-[11px]">
                                Off / Holiday
                              </span>
                            ) : (
                              <span className="text-text-muted text-[11px]">
                                0.0 hrs (On Track)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                    {employeeAttendanceRows.length > 0 && (
                      <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                        <td colSpan={7} className="h-20 bg-transparent border-0" />
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && !selectedSupplierId && (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#FAF7F2] border-b border-[#EAE3DA] flex items-center justify-between shrink-0">
            <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider block">
              Supplier Directory & Payables Ledger
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Supplier / Company</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Contact Person</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Phone & Email</th>
                  <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Orders</th>
                  <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Total Invoiced</th>
                  <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Total Paid</th>
                  <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Outstanding Due</th>
                  <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Due Date / Status</th>
                  <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-text-muted">
                      No suppliers found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((sl) => (
                    <tr
                      key={sl.supplier.id}
                      onClick={() => handleSelectSupplier(sl.supplier.id)}
                      className="hover:bg-cream-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-black text-brand-brown-dark group-hover:text-brand-teal transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>{sl.supplier.name}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-brand-brown">{sl.supplier.contactPerson || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-text-muted">
                        {sl.supplier.phone || sl.supplier.email || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-cream-100 border border-[#E0D7CC] font-bold text-[10px]">
                          {sl.purchasesCount} POs
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-brand-brown-dark tabular-nums">
                        {formatLKR(sl.totalInvoicedCents)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-brand-teal tabular-nums">
                        {formatLKR(sl.totalPaidCents)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-xs tabular-nums">
                        {sl.totalDueCents > 0 ? (
                          <span className="text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md inline-block">
                            {formatLKR(sl.totalDueCents)}
                          </span>
                        ) : (
                          <span className="text-status-success font-bold">Settled</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {sl.totalDueCents > 0 ? (
                          sl.daysDiff !== null ? (
                            sl.daysDiff < 0 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-block">
                                Overdue by {Math.abs(sl.daysDiff)}d
                              </span>
                            ) : sl.daysDiff === 0 ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 inline-block">
                                Due Today
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 inline-block">
                                Due in {sl.daysDiff}d ({formatDate(sl.earliestDueDate)})
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Payment Due
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-status-success border border-emerald-200">
                            All Settled
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {sl.totalDueCents > 0 && (
                            <button
                              type="button"
                              onClick={() => handleOpenSettleSupplier(sl.supplier.name, sl.totalDueCents)}
                              className="px-2.5 py-1 bg-brand-teal/10 hover:bg-brand-teal hover:text-white text-brand-teal rounded-lg font-bold text-[11px] border border-brand-teal/30 transition-all cursor-pointer active:scale-95 whitespace-nowrap shadow-xs"
                            >
                              Settle Due
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingSupplier(sl.supplier)}
                            className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 rounded-full text-text-secondary hover:text-brand-teal flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Edit Supplier"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSupplier(sl.supplier)}
                            className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-rose-50 hover:border-rose-200 hover:text-status-danger rounded-full text-text-muted flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Delete Supplier"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {filteredSuppliers.length > 0 && (
                  <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                    <td colSpan={9} className="h-20 bg-transparent border-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3.1 DRILL-DOWN: SINGLE SUPPLIER PROFILE, SUPPLIED ITEMS & PAYMENTS        */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && selectedSupplierData && (
        <div className="flex-1 min-h-0 flex flex-col space-y-2.5">
          {/* Top Unified Header & KPI Statistics Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 sm:px-3.5 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs shrink-0">
            {/* Left: Back button + Supplier Name & Contact */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSelectSupplier(null)}
                className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 flex items-center justify-center text-brand-brown-dark cursor-pointer transition-all active:scale-95 shrink-0"
                title="Back to Supplier Directory"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="font-extrabold text-sm text-brand-brown-dark flex items-center gap-2">
                  <span>{selectedSupplierData.supplier.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
                    Vendor / Supplier
                  </span>
                </h2>
                <span className="text-[10px] text-text-muted font-mono">
                  Contact: {selectedSupplierData.supplier.contactPerson || 'N/A'} • {selectedSupplierData.supplier.phone || 'No phone'}
                </span>
              </div>
            </div>

            {/* Right: Inline KPI Statistics */}
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
              {/* Total Invoiced */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider">Total Invoiced</span>
                <span className="font-mono font-black text-xs sm:text-sm text-brand-brown-dark tabular-nums">
                  {formatLKR(selectedSupplierData.totalInvoicedCents)}
                </span>
              </div>

              {/* Total Paid */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold uppercase text-brand-teal tracking-wider">Total Settled</span>
                <span className="font-mono font-black text-xs sm:text-sm text-brand-teal tabular-nums">
                  {formatLKR(selectedSupplierData.totalPaidCents)}
                </span>
              </div>

              {/* Outstanding Balance */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider">Outstanding Balance</span>
                <span
                  className={`font-mono font-black text-xs sm:text-sm tabular-nums ${
                    selectedSupplierData.totalDueCents > 0 ? 'text-rose-700' : 'text-status-success'
                  }`}
                >
                  {selectedSupplierData.totalDueCents > 0
                    ? formatLKR(selectedSupplierData.totalDueCents)
                    : 'Rs. 0.00 (Settled)'}
                </span>
              </div>

              {/* Credit Status / Due Date */}
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-extrabold uppercase text-text-muted tracking-wider">Due Status</span>
                <span className="font-bold text-xs sm:text-sm text-brand-brown-dark block truncate">
                  {selectedSupplierData.totalDueCents > 0
                    ? selectedSupplierData.daysDiff !== null
                      ? selectedSupplierData.daysDiff < 0
                        ? `Overdue (${Math.abs(selectedSupplierData.daysDiff)}d)`
                        : `Due in ${selectedSupplierData.daysDiff}d`
                      : 'Payment Due'
                    : 'All Settled'}
                </span>
              </div>
            </div>
          </div>

          {/* Supplier Info Strip */}
          <div className="p-2.5 px-3.5 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Users className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>Contact Person: <strong className="text-brand-brown-dark">{selectedSupplierData.supplier.contactPerson || 'N/A'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Phone className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span className="font-mono">{selectedSupplierData.supplier.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-secondary">
                <Mail className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>{selectedSupplierData.supplier.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-secondary">
                <MapPin className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>{selectedSupplierData.supplier.address || 'Address not provided'}</span>
              </div>
            </div>
          </div>

          {/* Combined Single Table Container with Segmented Tab Switcher on Header Right */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col">
            {/* Table Header Bar with Left Title & Right Segmented Switcher */}
            <div className="p-2.5 px-3.5 bg-[#FAF7F2] border-b border-[#EAE3DA] flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider">
                  {supplierSubTab === 'purchases'
                    ? `Supplied Items & Purchase Orders (${selectedSupplierData.filteredPurchases.length})`
                    : `Settlement Payment Ledger (${selectedSupplierData.filteredPayments.length})`}
                </span>
              </div>

              {/* Right: Segmented Switcher Pill */}
              <div className="inline-flex items-center p-1 h-9 bg-white border border-[#E0D7CC] rounded-full shadow-xs">
                <button
                  type="button"
                  onClick={() => setSupplierSubTab('purchases')}
                  className={`h-full flex items-center gap-1.5 px-3 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-95 whitespace-nowrap ${
                    supplierSubTab === 'purchases'
                      ? 'bg-brand-teal text-white shadow-teal'
                      : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Supplied Items</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tabular-nums ${
                      supplierSubTab === 'purchases' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
                    }`}
                  >
                    {selectedSupplierData.filteredPurchases.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSupplierSubTab('payments')}
                  className={`h-full flex items-center gap-1.5 px-3 rounded-full text-xs font-black transition-all cursor-pointer select-none active:scale-95 whitespace-nowrap ${
                    supplierSubTab === 'payments'
                      ? 'bg-brand-teal text-white shadow-teal'
                      : 'text-brand-brown hover:text-brand-brown-deep hover:bg-cream-50'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Settlements</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold tabular-nums ${
                      supplierSubTab === 'payments' ? 'bg-white/20 text-white' : 'bg-cream-100 text-brand-brown-dark'
                    }`}
                  >
                    {selectedSupplierData.filteredPayments.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Table Body */}
            <div className="flex-1 min-h-0 overflow-auto">
              {supplierSubTab === 'purchases' ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                    <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">PO / Invoice #</th>
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Delivery Date</th>
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Supplied Items Breakdown</th>
                      <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Total Invoiced</th>
                      <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Paid Amount</th>
                      <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Balance Due</th>
                      <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE4] font-medium">
                    {selectedSupplierData.filteredPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-text-muted">
                          No purchase invoices recorded from this supplier.
                        </td>
                      </tr>
                    ) : (
                      selectedSupplierData.filteredPurchases.map((po) => {
                        const dueAmt = po.dueCents ?? Math.max(0, po.totalCents - (po.paidCents ?? po.totalCents));
                        const paidAmt = po.paidCents ?? po.totalCents;
                        return (
                          <tr key={po.id} className="hover:bg-[#FAF7F2]/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-brand-brown-dark whitespace-nowrap">
                              <div>{po.purchaseNumber}</div>
                              <span className="text-[10px] text-text-muted font-normal">Inv: {po.invoiceNumber}</span>
                            </td>
                            <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                              {formatDate(po.purchaseDate)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                {po.items.map((it, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-[11px]">
                                    <span className="font-bold text-brand-brown-dark">{it.ingredientName}</span>
                                    <span className="text-text-muted">({it.quantity} {it.unit} @ {formatLKR(it.unitPriceCents)}/{it.unit})</span>
                                    <span className="font-mono text-brand-brown font-semibold ml-auto">{formatLKR(it.totalCents)}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-xs text-brand-brown-dark tabular-nums whitespace-nowrap">
                              {formatLKR(po.totalCents)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-brand-teal tabular-nums whitespace-nowrap">
                              {formatLKR(paidAmt)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-xs tabular-nums whitespace-nowrap">
                              {dueAmt > 0 ? (
                                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 inline-block">
                                  {formatLKR(dueAmt)}
                                </span>
                              ) : (
                                <span className="text-status-success">Rs. 0.00</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                                  dueAmt === 0
                                    ? 'bg-emerald-50 text-status-success border-emerald-200'
                                    : paidAmt > 0
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {dueAmt === 0 ? 'PAID' : paidAmt > 0 ? 'PARTIAL' : 'UNPAID'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {selectedSupplierData.filteredPurchases.length > 0 && (
                      <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                        <td colSpan={7} className="h-20 bg-transparent border-0" />
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                    <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Payment Date</th>
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">PO Reference</th>
                      <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Payment Method & Details</th>
                      <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Amount Paid (LKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2ECE4] font-medium">
                    {selectedSupplierData.filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-16 text-text-muted">
                          No settlement payments logged for this vendor.
                        </td>
                      </tr>
                    ) : (
                      selectedSupplierData.filteredPayments.map((pm, idx) => (
                        <tr key={idx} className="hover:bg-[#FAF7F2]/50 transition-colors">
                          <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                            {formatDateTime(pm.timestamp || pm.poDate)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-brand-brown-dark">
                            {pm.poNumber}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-text-secondary">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-cream-100 border border-[#E0D7CC]">
                                {pm.method}
                              </span>
                              {(pm.bankName || pm.chequeNumber) && (
                                <span className="text-brand-brown-dark font-medium">
                                  {pm.bankName || ''} {pm.chequeNumber ? `[#${pm.chequeNumber}]` : ''}
                                </span>
                              )}
                              {pm.notes && <span className="text-text-muted italic text-[10px]">({pm.notes})</span>}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-xs text-brand-teal tabular-nums">
                            {formatLKR(pm.amountCents)}
                          </td>
                        </tr>
                      ))
                    )}
                    {selectedSupplierData.filteredPayments.length > 0 && (
                      <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                        <td colSpan={4} className="h-20 bg-transparent border-0" />
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB 3: OPERATING EXPENSES                                              */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="h-full flex-1 min-h-0 flex flex-col space-y-3">
          {/* Quick Expense KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="p-3 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs">
              <span className="text-[10px] font-extrabold uppercase text-text-muted block">Total Expenses</span>
              <span className="font-mono font-black text-sm text-brand-brown-dark tabular-nums">{formatLKR(expenseStats.total)}</span>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs">
              <span className="text-[10px] font-extrabold uppercase text-amber-800 block">Cash Drawer Paid</span>
              <span className="font-mono font-black text-sm text-amber-900 tabular-nums">{formatLKR(expenseStats.drawer)}</span>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs">
              <span className="text-[10px] font-extrabold uppercase text-brand-teal block">Direct / Bank Paid</span>
              <span className="font-mono font-black text-sm text-brand-teal tabular-nums">{formatLKR(expenseStats.direct)}</span>
            </div>
            <div className="p-3 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs">
              <span className="text-[10px] font-extrabold uppercase text-text-muted block">Logged Bills</span>
              <span className="font-mono font-black text-sm text-brand-brown-dark tabular-nums">{expenseStats.count} items</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col">
            <div className="p-3.5 bg-[#FAF7F2] border-b border-[#EAE3DA] flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider">
                Operational Expenses Ledger
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#FAF7F2]/95 backdrop-blur-xs z-10 shadow-xs">
                  <tr className="border-b border-[#EAE3DA] text-text-muted font-black uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Timestamp</th>
                    <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Title / Expense</th>
                    <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Category</th>
                    <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Payment Mode</th>
                    <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Recorded By</th>
                    <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Amount (LKR)</th>
                    <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2ECE4] font-medium">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-muted">
                        No expenses recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-[#FAF7F2]/70 transition-colors">
                        <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                          {formatDateTime(exp.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 font-black text-brand-brown-dark">{exp.title}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-cream-100 border border-[#E0D7CC]">
                            {exp.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              exp.paidViaDrawer
                                ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                : 'bg-teal-50 text-brand-teal border border-teal-200'
                            }`}
                          >
                            {exp.paidViaDrawer ? 'Cash Drawer' : 'Bank / Direct'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">{exp.cashierName || 'Admin'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-xs text-rose-700 tabular-nums">
                          {formatLKR(exp.amountCents)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditExpense(exp)}
                              className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 rounded-full text-text-secondary hover:text-brand-teal flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Edit Expense"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp)}
                              className="w-7 h-7 bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-rose-50 hover:border-rose-200 hover:text-status-danger rounded-full text-text-muted flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                  {filteredExpenses.length > 0 && (
                    <tr aria-hidden="true" className="border-0 pointer-events-none select-none">
                      <td colSpan={7} className="h-20 bg-transparent border-0" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. FLOATING SEARCH & ACTION CAPSULE (EXACT MATCH TO PRODUCTS & STOCK PAGES)*/}
      {/* ========================================================================= */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none select-none">
        <div className="bg-[#1E1917]/95 text-white backdrop-blur-xl border border-white/10 shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center gap-2 transition-all duration-300 pointer-events-auto">
          {/* Search Input */}
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-white/50 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder={
                selectedEmployeeId
                  ? 'Search payment vouchers...'
                  : selectedSupplierId
                  ? 'Search supplied items, POs...'
                  : activeTab === 'payroll'
                  ? 'Search staff, roles...'
                  : activeTab === 'suppliers'
                  ? 'Search suppliers, contacts...'
                  : 'Search expenses, notes...'
              }
              value={search}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setSearch(e.target.value)}
              className={`bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 text-xs font-semibold text-white placeholder:text-white/40 shadow-none transition-all duration-300 ease-out ${
                isSearchFocused || search ? 'w-56 sm:w-72 md:w-80' : 'w-24 sm:w-32'
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Primary Circular Action Button (+) - Not shown in Supplier Details view */}
          {!selectedSupplierData && (
            <button
              type="button"
              onClick={
                selectedEmployeeData
                  ? () =>
                      handleOpenPayEmployee(
                        selectedEmployeeData.employee
                      )
                  : activeTab === 'payroll'
                  ? () =>
                      setEditingEmployee({
                        name: '',
                        role: 'Head Barista',
                        phone: '',
                        email: '',
                        nic: '',
                        address: '',
                        emergencyContact: '',
                        baseSalaryCents: 6000000,
                        payFrequency: 'MONTHLY',
                        salaryPayDay: '28',
                        bankName: '',
                        accountNumber: '',
                        bankBranch: '',
                        active: true,
                      })
                  : activeTab === 'suppliers'
                  ? () =>
                      setEditingSupplier({
                        name: '',
                        contactPerson: '',
                        phone: '',
                        email: '',
                        address: '',
                        active: true,
                      })
                  : () => {
                      setEditingExpense({
                        id: '',
                        title: '',
                        amountCents: 0,
                        category: 'PETTY_CASH',
                        paidViaDrawer: true,
                        createdAt: new Date().toISOString(),
                      });
                      setExpenseTitle('');
                      setExpenseAmount('');
                      setExpenseCategory('PETTY_CASH');
                      setExpensePaidViaDrawer(true);
                      setExpenseNotes('');
                    }
              }
              className="w-10 h-10 rounded-full bg-[#E99343] hover:bg-[#DE7E29] text-white flex items-center justify-center shadow-lg shadow-[#E99343]/30 active:scale-95 transition-all shrink-0 cursor-pointer group"
              title={
                selectedEmployeeData
                  ? 'Disburse Payroll Payment'
                  : activeTab === 'payroll'
                  ? 'Add New Employee'
                  : activeTab === 'suppliers'
                  ? 'Add New Supplier'
                  : 'Record New Expense'
              }
            >
              <Plus className="w-5 h-5 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
            </button>
          )}

          {/* Contextual Edit Profile Button (After Add Button) */}
          {selectedEmployeeData && (
            <button
              type="button"
              onClick={() => setEditingEmployee(selectedEmployeeData.employee)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-95 transition-all shrink-0 cursor-pointer shadow-md"
              title="Edit Employee Profile"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {selectedSupplierData && (
            <button
              type="button"
              onClick={() => setEditingSupplier(selectedSupplierData.supplier)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-95 transition-all shrink-0 cursor-pointer shadow-md"
              title="Edit Supplier Profile"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. ADD / EDIT EMPLOYEE STUDIO MODAL (3-PANEL STUDIO FORM)                 */}
      {/* ========================================================================= */}
      {editingEmployee &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 lg:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[98vw] 2xl:max-w-[1450px] h-[92vh] max-h-[92vh] flex flex-col">
              {/* Top Header Bar Above Form */}
              <div className="flex items-center justify-between mb-2.5 px-1 shrink-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs flex items-center gap-2">
                    <Users className="w-5 h-5 text-brand-teal" />
                    <span>{editingEmployee.id ? 'Edit Employee Profile' : 'Add New Employee'}</span>
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block">
                    Staff Directory Studio
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    className="px-4 py-1.5 rounded-2xl border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="employee-form"
                    className="px-5 py-1.5 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Employee</span>
                  </button>
                </div>
              </div>

              {/* Main 3-Card Side-by-Side Responsive Grid Area */}
              <form
                id="employee-form"
                onSubmit={handleSaveEmployee}
                className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-hidden min-h-0"
              >
                {/* ================================================================= */}
                {/* 1. LEFT CARD: PERSONAL DETAILS                                    */}
                {/* ================================================================= */}
                <div className="flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-4">
                  {/* Card Section Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DF]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-brand-teal shadow-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs uppercase tracking-wider text-brand-brown-dark">
                          Personal Details
                        </h4>
                        <p className="text-[10px] text-text-muted">Identity & contact information</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editingEmployee.name || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                        placeholder="e.g. Nimal Perera"
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                      />
                    </div>

                    {/* NIC / National ID */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        NIC / National ID Number
                      </label>
                      <input
                        type="text"
                        value={editingEmployee.nic || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, nic: e.target.value })}
                        placeholder="e.g. 199012345678V or 200112345678"
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-mono font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                      />
                    </div>

                    {/* Phone Contact */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider">
                          Phone Contact
                        </label>
                        <span className="text-[9px] font-mono font-bold text-text-muted">
                          {(editingEmployee.phone || '').replace(/\D/g, '').replace(/^94|^0/, '').slice(0, 9).length} / 9 digits
                        </span>
                      </div>
                      <div className="flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal focus-within:bg-white transition-colors">
                        <span className="px-3 py-2.5 bg-[#F2ECE4] border-r border-[#E2D8CC] text-xs font-mono font-black text-brand-brown-dark select-none shrink-0">
                          +94
                        </span>
                        <input
                          type="tel"
                          value={formatLKLocalPhone(editingEmployee.phone || '')}
                          onChange={(e) => {
                            const formattedLocal = formatLKLocalPhone(e.target.value);
                            setEditingEmployee({
                              ...editingEmployee,
                              phone: formattedLocal ? `+94 ${formattedLocal}` : '',
                            });
                          }}
                          placeholder="7X XXX XXXX"
                          maxLength={11}
                          className="w-full py-2.5 px-3 bg-transparent text-xs font-mono font-bold text-brand-brown-dark outline-none placeholder:text-text-muted/50 tracking-wider"
                        />
                      </div>
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={editingEmployee.email || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                        placeholder="nimal@chillandchoc.lk"
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                      />
                    </div>

                    {/* Residential Address */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Residential Address
                      </label>
                      <input
                        type="text"
                        value={editingEmployee.address || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, address: e.target.value })}
                        placeholder="No. 45, Temple Road, Colombo 03"
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                      />
                    </div>

                    {/* Emergency Contact */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Emergency Contact (Name & Phone)
                      </label>
                      <input
                        type="text"
                        value={editingEmployee.emergencyContact || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, emergencyContact: e.target.value })}
                        placeholder="+94 77 111 2222 (Kamal Perera - Spouse)"
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 2. MIDDLE CARD: EMPLOYMENT DETAILS                                */}
                {/* ================================================================= */}
                <div className="flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-4">
                  {/* Card Section Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DF]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-brand-teal shadow-xs">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs uppercase tracking-wider text-brand-brown-dark">
                          Employment Details
                        </h4>
                        <p className="text-[10px] text-text-muted">Designation & contract schedule</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {/* Role / Position */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Role / Designation <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editingEmployee.role || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                        placeholder="e.g. Head Barista, Cashier, General Manager"
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                      />
                      {/* Popular Role Quick Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {['Head Barista', 'Junior Barista', 'Cashier', 'General Manager', 'Kitchen Assistant', 'Floor Server'].map((roleTag) => (
                          <button
                            key={roleTag}
                            type="button"
                            onClick={() => setEditingEmployee({ ...editingEmployee, role: roleTag })}
                            className={`px-2 py-0.5 text-[10px] rounded-lg border font-semibold transition-all cursor-pointer ${
                              editingEmployee.role === roleTag
                                ? 'bg-brand-teal text-white border-brand-teal shadow-xs'
                                : 'bg-[#FAF7F2] text-text-secondary border-[#E0D7CC] hover:border-brand-teal'
                            }`}
                          >
                            {roleTag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Join Date */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Joining / Effective Date
                      </label>
                      <CustomDatePicker
                        value={editingEmployee.joinDate || (editingEmployee.createdAt ? editingEmployee.createdAt.split('T')[0] : new Date().toISOString().split('T')[0])}
                        onChange={(newDate) => setEditingEmployee({ ...editingEmployee, joinDate: newDate })}
                        placeholder="Select joining date"
                        showPresets={false}
                        inputClassName="!bg-[#FAF7F2] !border-[#E2D8CC] !rounded-xl !text-xs !font-mono !font-bold !text-brand-brown-dark !p-2.5 hover:!border-brand-teal"
                      />
                    </div>

                    {/* Employment Status Toggle */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Employment Status
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingEmployee({ ...editingEmployee, active: true })}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            editingEmployee.active !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                              : 'bg-[#FAF7F2] text-text-muted border-[#E2D8CC]'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active Staff</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingEmployee({ ...editingEmployee, active: false })}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            editingEmployee.active === false
                              ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs'
                              : 'bg-[#FAF7F2] text-text-muted border-[#E2D8CC]'
                          }`}
                        >
                          <span>Inactive / On Leave</span>
                        </button>
                      </div>
                    </div>

                    {/* Internal Notes / Memo */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Internal Notes & Remarks
                      </label>
                      <textarea
                        rows={3}
                        value={editingEmployee.notes || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, notes: e.target.value })}
                        placeholder="Contract terms, shift preferences, uniform size, notes..."
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-medium text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white resize-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 3. RIGHT CARD: COMPENSATION & PAYMENT DETAILS                     */}
                {/* ================================================================= */}
                <div className="flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto space-y-4">
                  {/* Card Section Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DF]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-brand-teal shadow-xs">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs uppercase tracking-wider text-brand-brown-dark">
                          Payment Details
                        </h4>
                        <p className="text-[10px] text-text-muted">Salary & optional bank remittance</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {/* Base Salary */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Base Salary (LKR) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal focus-within:bg-white transition-colors">
                        <span className="pl-3 text-xs font-bold text-text-muted">Rs.</span>
                        <input
                          type="number"
                          step="500"
                          required
                          value={(editingEmployee.baseSalaryCents || 0) / 100 || ''}
                          onChange={(e) =>
                            setEditingEmployee({
                              ...editingEmployee,
                              baseSalaryCents: Math.round(parseFloat(e.target.value || '0') * 100),
                            })
                          }
                          placeholder="60,000.00"
                          className="flex-1 py-2.5 px-2 bg-transparent font-mono font-bold text-xs text-brand-brown-dark outline-none text-right"
                        />
                      </div>
                    </div>

                    {/* Pay Frequency & Salary Due Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1 truncate">
                          Pay Frequency
                        </label>
                        <select
                          value={editingEmployee.payFrequency || 'MONTHLY'}
                          onChange={(e) =>
                            setEditingEmployee({
                              ...editingEmployee,
                              payFrequency: e.target.value as EmployeePayFrequency,
                            })
                          }
                          className="w-full h-10 px-3 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="HOURLY">Hourly</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1 truncate">
                          Salary Date
                        </label>
                        <select
                          value={editingEmployee.salaryPayDay || '28'}
                          onChange={(e) =>
                            setEditingEmployee({
                              ...editingEmployee,
                              salaryPayDay: e.target.value,
                            })
                          }
                          className="w-full h-10 px-3 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                        >
                          <option value="1">1st of Month</option>
                          <option value="5">5th of Month</option>
                          <option value="10">10th of Month</option>
                          <option value="15">15th of Month</option>
                          <option value="20">20th of Month</option>
                          <option value="25">25th of Month</option>
                          <option value="28">28th of Month</option>
                          <option value="30">30th of Month</option>
                          <option value="31">End of Month (Last Day)</option>
                        </select>
                      </div>
                    </div>

                    {/* Bank Details (Optional) Section */}
                    <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] space-y-3">
                      <div className="flex items-center justify-between pb-1 border-b border-[#EAE3DA]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-brown-dark flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-brand-teal" />
                          <span>Bank Remittance Details</span>
                        </span>
                        <span className="text-[9px] font-bold text-text-muted bg-white px-2 py-0.5 rounded-md border border-[#EAE3DA]">
                          Optional
                        </span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={editingEmployee.bankName || ''}
                          onChange={(e) => setEditingEmployee({ ...editingEmployee, bankName: e.target.value })}
                          placeholder="e.g. Commercial Bank of Ceylon"
                          className="w-full p-2 bg-white border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                          Bank Account Number
                        </label>
                        <input
                          type="text"
                          value={editingEmployee.accountNumber || ''}
                          onChange={(e) => setEditingEmployee({ ...editingEmployee, accountNumber: e.target.value })}
                          placeholder="e.g. 0029384756"
                          className="w-full p-2 bg-white border border-[#E2D8CC] rounded-xl text-xs font-mono font-bold text-brand-brown-dark outline-none focus:border-brand-teal transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                          Bank Branch Name / Code
                        </label>
                        <input
                          type="text"
                          value={editingEmployee.bankBranch || ''}
                          onChange={(e) => setEditingEmployee({ ...editingEmployee, bankBranch: e.target.value })}
                          placeholder="e.g. Kollupitiya Branch - 042"
                          className="w-full p-2 bg-white border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 7. MODAL: RECORD EMPLOYEE PAYROLL PAYMENT (3-PANEL STUDIO FORM)           */}
      {/* ========================================================================= */}
      {isPayingEmployee &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-3 lg:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[98vw] 2xl:max-w-[1340px] max-h-[92vh] flex flex-col my-auto">
              {/* Top Header Bar Above Form */}
              <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-brand-teal" />
                    <span>Disburse Payroll Payment</span>
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block">
                    Payee: {isPayingEmployee.name} ({isPayingEmployee.role})
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsPayingEmployee(null)}
                    className="px-4 py-1.5 rounded-2xl border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="payroll-disburse-form"
                    className="px-5 py-1.5 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Disbursement</span>
                  </button>
                </div>
              </div>

              {/* Main 3-Card Side-by-Side Responsive Grid Area */}
              <form
                id="payroll-disburse-form"
                onSubmit={handleConfirmPayEmployee}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto max-h-[calc(92vh-50px)] pr-0.5 scrollbar-none"
              >
                {/* ================================================================= */}
                {/* 1. LEFT CARD: STAFF OVERVIEW & DISBURSEMENT TYPE                  */}
                {/* ================================================================= */}
                <div className="flex flex-col bg-white rounded-3xl shadow-xl border border-[#E9E0D5] p-4 sm:p-5 space-y-3.5">
                  {/* Card Section Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#F0E8DF] shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-brand-teal shadow-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs uppercase tracking-wider text-brand-brown-dark">
                          Staff & Schedule
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-3">
                    {/* Payee Profile Info Pill */}
                    <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-base text-brand-brown-dark tracking-tight block">
                            {isPayingEmployee.name}
                          </span>
                          <span className="text-xs text-brand-brown font-semibold block">
                            {isPayingEmployee.role}
                          </span>
                        </div>
                        <span className="px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold uppercase shadow-xs">
                          Active Staff
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-2.5 border-t border-[#EAE3DA]">
                        <div>
                          <span className="text-[9.5px] text-text-muted font-bold block uppercase mb-0.5">
                            Base Salary
                          </span>
                          <strong className="text-xs sm:text-sm font-mono font-black text-brand-brown-dark">
                            {formatLKR(isPayingEmployee.baseSalaryCents)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-text-muted font-bold block uppercase mb-0.5">
                            Salary Pay Day
                          </span>
                          <strong className="text-xs sm:text-sm font-black text-brand-brown-dark">
                            Day {isPayingEmployee.salaryPayDay || '28'}th
                          </strong>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-text-muted font-bold block uppercase mb-0.5">
                            Attended Days
                          </span>
                          <strong className="text-xs sm:text-sm text-brand-teal font-mono font-black">
                            {isPayingEmployee.attendedDays ?? 26} Days
                          </strong>
                        </div>
                        <div>
                          <span className="text-[9.5px] text-text-muted font-bold block uppercase mb-0.5">
                            Overtime Rate
                          </span>
                          <strong className="text-xs sm:text-sm text-emerald-800 font-mono font-black">
                            {formatLKR(isPayingEmployee.overtimeHourlyRateCents || 45000)}/h
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Advance Taken Notice (if any) */}
                    {payAutoAdvanceRupees > 0 && (
                      <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between text-xs shadow-xs">
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          <span>Monthly Advance Taken</span>
                        </div>
                        <span className="font-mono font-black text-amber-900">
                          {formatLKR(Math.round(payAutoAdvanceRupees * 100))}
                        </span>
                      </div>
                    )}

                    {/* Disbursement Mode Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block">
                        Disbursement Mode
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 bg-[#FAF7F2] p-1 rounded-xl border border-[#E2D8CC]">
                        {(['SALARY', 'ADVANCE'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setPayType(type);
                              if (type === 'SALARY') {
                                const b = parseFloat(cleanCommaNumber(payBasicAmount)) || (isPayingEmployee.baseSalaryCents / 100);
                                const ot = parseFloat(cleanCommaNumber(payOtAmount)) || 0;
                                const bonus = applyBonus ? (parseFloat(cleanCommaNumber(payBonusAmount)) || 0) : 0;
                                const deduct = applyDeduction ? (parseFloat(cleanCommaNumber(payDeductionAmount)) || 0) : 0;
                                setPayAmount(String(Math.max(0, b + ot + bonus - payAutoAdvanceRupees - deduct)));
                              } else {
                                setPayAmount('');
                              }
                            }}
                            className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                              payType === type
                                ? 'bg-[#2D2422] text-white shadow-xs'
                                : 'text-text-secondary hover:text-brand-brown-dark'
                            }`}
                          >
                            {type === 'SALARY' ? 'Salary Settlement' : 'Salary Advance'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Internal Notes & Remarks - Editable */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block">
                        Internal Notes & Remarks
                      </label>
                      <textarea
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="Contract terms, shift preferences, uniform size, notes..."
                        className="w-full h-20 p-3 bg-[#FAF7F2] border border-[#E2D8CC] rounded-2xl text-xs font-medium text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors resize-none leading-relaxed shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 2. CENTER CARD: EARNINGS & SALARY BREAKDOWN                       */}
                {/* ================================================================= */}
                <div className="flex flex-col bg-white rounded-3xl shadow-xl border border-[#E9E0D5] p-4 sm:p-5 space-y-3.5">
                  {/* Card Section Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#F0E8DF] shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-brand-teal shadow-xs">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs uppercase tracking-wider text-brand-brown-dark">
                          Earnings Breakdown
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-3">
                    {payType === 'SALARY' ? (
                      <div className="space-y-3">
                        {/* Basic Salary */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider">
                              Basic Salary (LKR) *
                            </label>
                            <span className="text-[10px] text-text-muted font-medium">
                              Base: {formatLKR(isPayingEmployee.baseSalaryCents)}
                            </span>
                          </div>
                          <div className="relative flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal focus-within:bg-white transition-colors h-10 px-2.5 shadow-xs">
                            <span className="text-xs font-bold text-text-muted">Rs.</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              required
                              value={formatCommaNumber(payBasicAmount)}
                              onChange={(e) => {
                                const raw = cleanCommaNumber(e.target.value);
                                if (/^\d*\.?\d*$/.test(raw)) handleBasicChange(raw);
                              }}
                              placeholder="0.00"
                              className="flex-1 py-1.5 px-2 bg-transparent font-mono font-bold text-xs sm:text-sm text-brand-brown-dark outline-none text-right"
                            />
                            <button
                              type="button"
                              onClick={() => handleBasicChange(String(isPayingEmployee.baseSalaryCents / 100))}
                              className="ml-1.5 px-2.5 py-1 bg-white hover:bg-cream-100 border border-[#E0D7CC] rounded-lg text-[10px] font-black text-brand-teal cursor-pointer shadow-xs transition-all active:scale-95"
                            >
                              Full Base
                            </button>
                          </div>
                        </div>

                        {/* Overtime (Auto Calculated + Custom Override) */}
                        <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-extrabold uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Overtime (Auto Calculated)</span>
                            </label>
                            <span className="text-[10px] font-bold text-emerald-800 font-mono">
                              @{formatLKR(isPayingEmployee.overtimeHourlyRateCents || 45000)}/hr
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] font-bold text-text-muted uppercase block mb-0.5">
                                OT Hours Logged
                              </span>
                              <div className="flex items-center bg-white border border-emerald-200 rounded-xl px-2.5 h-10 focus-within:border-emerald-500 shadow-xs">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={payOtHours}
                                  onChange={(e) => {
                                    const raw = cleanCommaNumber(e.target.value);
                                    if (/^\d*\.?\d*$/.test(raw)) handleOtHoursChange(raw);
                                  }}
                                  placeholder="0.0"
                                  className="w-full bg-transparent font-mono font-bold text-xs sm:text-sm text-brand-brown-dark outline-none text-right"
                                />
                                <span className="pl-1 text-xs font-bold text-text-muted">hrs</span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[9px] font-bold text-text-muted uppercase block mb-0.5">
                                OT Amount (LKR)
                              </span>
                              <div className="flex items-center bg-white border border-emerald-200 rounded-xl px-2.5 h-10 focus-within:border-emerald-500 shadow-xs">
                                <span className="text-xs font-bold text-text-muted mr-1">Rs.</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={formatCommaNumber(payOtAmount)}
                                  onChange={(e) => {
                                    const raw = cleanCommaNumber(e.target.value);
                                    if (/^\d*\.?\d*$/.test(raw)) handleOtAmountChange(raw);
                                  }}
                                  placeholder="0.00"
                                  className="w-full bg-transparent font-mono font-bold text-xs sm:text-sm text-emerald-900 outline-none text-right"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Apply Bonus with Checkbox and Reason */}
                        <div className={`p-3 rounded-xl border transition-all space-y-2 ${
                          applyBonus ? 'bg-amber-50/60 border-amber-300 shadow-xs' : 'bg-[#FAF7F2] border-[#E2D8CC]'
                        }`}>
                          <label className="flex items-center justify-between cursor-pointer select-none">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={applyBonus}
                                onChange={(e) => handleBonusToggle(e.target.checked)}
                                className="w-4 h-4 rounded text-brand-teal focus:ring-brand-teal border-[#D1C7BA] cursor-pointer"
                              />
                              <span className="text-xs font-black text-brand-brown-dark">
                                Apply Bonus / Incentive
                              </span>
                            </div>
                            {applyBonus && (
                              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[9.5px] uppercase border border-amber-200">
                                Bonus Active
                              </span>
                            )}
                          </label>

                          {applyBonus && (
                            <div className="pt-2 border-t border-amber-200 space-y-2 animate-in fade-in">
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-5">
                                  <label className="text-[9px] font-extrabold uppercase text-text-secondary tracking-wider block mb-0.5">
                                    Bonus Amount (LKR) *
                                  </label>
                                  <div className="flex items-center bg-white border border-amber-300 rounded-xl px-2.5 h-10 focus-within:border-brand-teal shadow-xs">
                                    <span className="text-xs font-bold text-text-muted mr-1">Rs.</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      required={applyBonus}
                                      value={formatCommaNumber(payBonusAmount)}
                                      onChange={(e) => {
                                        const raw = cleanCommaNumber(e.target.value);
                                        if (/^\d*\.?\d*$/.test(raw)) handleBonusAmountChange(raw);
                                      }}
                                      placeholder="0.00"
                                      className="w-full bg-transparent font-mono font-bold text-xs sm:text-sm text-brand-brown-dark outline-none text-right"
                                    />
                                  </div>
                                </div>

                                <div className="sm:col-span-7">
                                  <label className="text-[9px] font-extrabold uppercase text-text-secondary tracking-wider block mb-0.5">
                                    Bonus Reason *
                                  </label>
                                  <input
                                    type="text"
                                    required={applyBonus}
                                    value={payBonusReason}
                                    onChange={(e) => setPayBonusReason(e.target.value)}
                                    placeholder="e.g. Sales Target, Holiday Festival"
                                    className="w-full bg-white border border-amber-300 rounded-xl px-2.5 h-10 text-xs font-medium text-brand-brown-dark outline-none focus:border-brand-teal shadow-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Automatic Advance Recovery Info Card (if any advances exist) */}
                        {payAutoAdvanceRupees > 0 && (
                          <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-xl flex items-center justify-between text-xs shadow-xs">
                            <div>
                              <span className="font-extrabold text-amber-950 block">Auto Advance Recovery</span>
                              <span className="text-[10px] text-amber-800 font-medium">Automatic deduction from monthly settlement</span>
                            </div>
                            <strong className="font-mono font-black text-amber-900 text-xs sm:text-sm">
                              -{formatLKR(Math.round(payAutoAdvanceRupees * 100))}
                            </strong>
                          </div>
                        )}

                        {/* Apply Other Deductions with Checkbox and Reason */}
                        <div className={`p-3 rounded-xl border transition-all space-y-2 ${
                          applyDeduction ? 'bg-rose-50/60 border-rose-300 shadow-xs' : 'bg-[#FAF7F2] border-[#E2D8CC]'
                        }`}>
                          <label className="flex items-center justify-between cursor-pointer select-none">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={applyDeduction}
                                onChange={(e) => handleDeductionToggle(e.target.checked)}
                                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-[#D1C7BA] cursor-pointer"
                              />
                              <span className="text-xs font-black text-brand-brown-dark">
                                Apply Other Deductions
                              </span>
                            </div>
                            {applyDeduction && (
                              <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-900 font-extrabold text-[9.5px] uppercase border border-rose-200">
                                Deduction Active
                              </span>
                            )}
                          </label>

                          {applyDeduction && (
                            <div className="pt-2 border-t border-rose-200 space-y-2 animate-in fade-in">
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-5">
                                  <label className="text-[9px] font-extrabold uppercase text-text-secondary tracking-wider block mb-0.5">
                                    Deduction Amount (LKR) *
                                  </label>
                                  <div className="flex items-center bg-white border border-rose-300 rounded-xl px-2.5 h-10 focus-within:border-rose-500 shadow-xs">
                                    <span className="text-xs font-bold text-text-muted mr-1">Rs.</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      required={applyDeduction}
                                      value={formatCommaNumber(payDeductionAmount)}
                                      onChange={(e) => {
                                        const raw = cleanCommaNumber(e.target.value);
                                        if (/^\d*\.?\d*$/.test(raw)) handleDeductionAmountChange(raw);
                                      }}
                                      placeholder="0.00"
                                      className="w-full bg-transparent font-mono font-bold text-xs sm:text-sm text-rose-900 outline-none text-right"
                                    />
                                  </div>
                                </div>

                                <div className="sm:col-span-7">
                                  <label className="text-[9px] font-extrabold uppercase text-text-secondary tracking-wider block mb-0.5">
                                    Deduction Reason *
                                  </label>
                                  <input
                                    type="text"
                                    required={applyDeduction}
                                    value={payDeductionReason}
                                    onChange={(e) => setPayDeductionReason(e.target.value)}
                                    placeholder="e.g. Equipment Damage, Loan, EPF, Late fine"
                                    className="w-full bg-white border border-rose-300 rounded-xl px-2.5 h-10 text-xs font-medium text-brand-brown-dark outline-none focus:border-rose-500 shadow-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Salary Advance Input */
                      <div className="space-y-3.5">
                        {/* Advance Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider">
                              Advance Amount (LKR) *
                            </label>
                            <span className="text-[10px] text-text-muted font-medium">
                              Base: {formatLKR(isPayingEmployee.baseSalaryCents)}
                            </span>
                          </div>
                          <div className="relative flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal focus-within:bg-white transition-colors h-10 px-2.5 shadow-xs">
                            <span className="text-xs font-bold text-text-muted">Rs.</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              required
                              value={formatCommaNumber(payAmount)}
                              onChange={(e) => {
                                const raw = cleanCommaNumber(e.target.value);
                                if (/^\d*\.?\d*$/.test(raw)) setPayAmount(raw);
                              }}
                              placeholder="0.00"
                              className="flex-1 py-1.5 px-2 bg-transparent font-mono font-bold text-xs sm:text-sm text-brand-brown-dark outline-none text-right"
                            />
                            {isPayingEmployee.baseSalaryCents > 0 && (
                              <button
                                type="button"
                                onClick={() => setPayAmount(String(isPayingEmployee.baseSalaryCents / 200))}
                                className="ml-1.5 px-2.5 py-1 bg-white hover:bg-cream-100 border border-[#E0D7CC] rounded-lg text-[10px] font-black text-brand-teal cursor-pointer shadow-xs transition-all active:scale-95"
                              >
                                50% Base
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Live Balance Info */}
                        <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E2D8CC] space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-text-secondary font-semibold">
                            <span>Base Salary:</span>
                            <span className="font-mono text-brand-brown-dark">
                              {formatLKR(isPayingEmployee.baseSalaryCents)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-amber-800 font-semibold">
                            <span>Advance Deduction:</span>
                            <span className="font-mono">
                              -{formatLKR(Math.round((parseFloat(cleanCommaNumber(payAmount)) || 0) * 100))}
                            </span>
                          </div>
                          <div className="pt-1.5 border-t border-[#EAE3DA] flex items-center justify-between font-bold">
                            <span className="text-brand-brown-dark">Remaining Salary:</span>
                            <strong className="font-mono text-brand-teal">
                              {formatLKR(Math.max(0, (isPayingEmployee.baseSalaryCents || 0) - Math.round((parseFloat(cleanCommaNumber(payAmount)) || 0) * 100)))}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 3. RIGHT CARD: PAYMENT METHOD & CALCULATION SUMMARY               */}
                {/* ================================================================= */}
                <div className="flex flex-col bg-white rounded-3xl shadow-xl border border-[#E9E0D5] p-4 sm:p-5 space-y-3.5">
                  {/* Card Section Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#F0E8DF] shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-brand-teal shadow-xs">
                        <Landmark className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-black text-xs uppercase tracking-wider text-brand-brown-dark">
                          Payment Details
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-3">
                    <div className="space-y-3">
                      {/* Payment Method Selector */}
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                          Payment Method
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#E2D8CC]">
                          {(['CASH', 'CARD', 'CHEQUE'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPayMethod(m)}
                              className={`py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                payMethod === m
                                  ? 'bg-brand-teal text-white shadow-xs'
                                  : 'text-text-secondary hover:text-brand-brown-dark'
                              }`}
                            >
                              {m === 'CASH' && <Banknote className="w-3.5 h-3.5" />}
                              {m === 'CARD' && <CreditCard className="w-3.5 h-3.5" />}
                              {m === 'CHEQUE' && <FileText className="w-3.5 h-3.5" />}
                              <span>{m === 'CASH' ? 'Cash' : m === 'CARD' ? 'Bank Transfer' : 'Cheque'}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bank Transfer Details */}
                      {payMethod === 'CARD' && (
                        <div className="space-y-2.5 p-3 bg-[#FAF7F2] rounded-xl border border-[#E2D8CC]">
                          <div className="text-[10px] font-extrabold uppercase text-brand-brown-dark tracking-wider flex items-center justify-between">
                            <span>Bank Remittance Details</span>
                            <Building className="w-3.5 h-3.5 text-brand-teal" />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase text-text-secondary block mb-0.5">
                              Destination Bank Name
                            </label>
                            <input
                              type="text"
                              value={payBankName || isPayingEmployee.bankName || ''}
                              onChange={(e) => setPayBankName(e.target.value)}
                              placeholder="e.g. Commercial Bank of Ceylon"
                              className="w-full p-2 bg-white border border-[#E2D8CC] rounded-lg text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal"
                            />
                          </div>
                          {isPayingEmployee.accountNumber && (
                            <div>
                              <span className="text-[9px] font-bold uppercase text-text-muted block mb-0.5">
                                Employee Account Number
                              </span>
                              <span className="font-mono font-bold text-xs text-brand-brown-dark">
                                {isPayingEmployee.accountNumber} {isPayingEmployee.bankBranch ? `(${isPayingEmployee.bankBranch})` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cheque Details */}
                      {payMethod === 'CHEQUE' && (
                        <div className="space-y-2.5 p-3 bg-[#FAF7F2] rounded-xl border border-[#E2D8CC]">
                          <div className="text-[10px] font-extrabold uppercase text-brand-brown-dark tracking-wider flex items-center justify-between">
                            <span>Cheque Details</span>
                            <FileText className="w-3.5 h-3.5 text-brand-teal" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold uppercase text-text-secondary block mb-0.5">
                                Cheque Ref # *
                              </label>
                              <input
                                type="text"
                                required
                                value={payChequeNumber}
                                onChange={(e) => setPayChequeNumber(e.target.value)}
                                placeholder="e.g. CHQ-88201"
                                className="w-full p-2 bg-white border border-[#E2D8CC] rounded-lg text-xs font-mono font-bold outline-none focus:border-brand-teal"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold uppercase text-text-secondary block mb-0.5">
                                Drawn Bank Name
                              </label>
                              <input
                                type="text"
                                value={payBankName}
                                onChange={(e) => setPayBankName(e.target.value)}
                                placeholder="e.g. Commercial Bank"
                                className="w-full p-2 bg-white border border-[#E2D8CC] rounded-lg text-xs font-bold outline-none focus:border-brand-teal"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase text-text-secondary block mb-0.5">
                              Cheque End / Maturity Date *
                            </label>
                            <CustomDatePicker
                              value={payChequeDate}
                              onChange={(newDate) => setPayChequeDate(newDate)}
                              placeholder="Select Cheque Due Date"
                              showPresets={true}
                              inputClassName="!bg-white !border-[#E2D8CC] !rounded-lg !text-xs !font-mono !font-bold !text-brand-brown-dark !p-2 hover:!border-brand-teal"
                            />
                          </div>
                        </div>
                      )}

                      {/* Cash Details */}
                      {payMethod === 'CASH' && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
                          <Banknote className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Direct Cash Disbursement</span>
                        </div>
                      )}
                    </div>

                    {/* Calculation Breakdown Rows - Displayed in Payment Details Section */}
                    {payType === 'SALARY' ? (
                      <div className="bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] p-3 sm:p-3.5 space-y-2 shadow-xs">
                        <div className="text-[10px] font-extrabold uppercase text-text-muted tracking-wider pb-1 border-b border-[#EAE3DA] flex items-center justify-between">
                          <span>Payroll Calculation</span>
                          <span>Amount (LKR)</span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          {/* 1. Basic */}
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-text-secondary">Basic Salary:</span>
                            <span className="font-mono text-brand-brown-dark">
                              {formatLKR(Math.round((parseFloat(cleanCommaNumber(payBasicAmount)) || 0) * 100))}
                            </span>
                          </div>

                          {/* 2. OT */}
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-text-secondary">
                              Overtime {parseFloat(payOtHours) > 0 ? `(${payOtHours} hrs)` : ''}:
                            </span>
                            <span className="font-mono text-emerald-800">
                              +{formatLKR(Math.round((parseFloat(cleanCommaNumber(payOtAmount)) || 0) * 100))}
                            </span>
                          </div>

                          {/* 3. Bonus */}
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-text-secondary">Bonus / Incentive:</span>
                            <span className="font-mono text-amber-900">
                              +{formatLKR(applyBonus ? Math.round((parseFloat(cleanCommaNumber(payBonusAmount)) || 0) * 100) : 0)}
                            </span>
                          </div>

                          {/* 4. Advance Recovered (Automatic) */}
                          {payAutoAdvanceRupees > 0 && (
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-amber-800">Advance Recovered (Auto):</span>
                              <span className="font-mono text-amber-800">
                                -{formatLKR(Math.round(payAutoAdvanceRupees * 100))}
                              </span>
                            </div>
                          )}

                          {/* 5. Other Deductions */}
                          {applyDeduction && (
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-rose-700">
                                Other Deductions {payDeductionReason ? `(${payDeductionReason})` : ''}:
                              </span>
                              <span className="font-mono text-rose-700">
                                -{formatLKR(Math.round((parseFloat(cleanCommaNumber(payDeductionAmount)) || 0) * 100))}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Total */}
                        <div className="pt-2 border-t border-[#E2D8CC] flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-brand-brown-dark tracking-wide">
                            Total Payable
                          </span>
                          <strong className="text-xl font-mono font-black text-brand-teal">
                            {formatLKR(
                              Math.max(
                                0,
                                Math.round(
                                  ((parseFloat(cleanCommaNumber(payBasicAmount)) || 0) +
                                    (parseFloat(cleanCommaNumber(payOtAmount)) || 0) +
                                    (applyBonus ? (parseFloat(cleanCommaNumber(payBonusAmount)) || 0) : 0) -
                                    payAutoAdvanceRupees -
                                    (applyDeduction ? (parseFloat(cleanCommaNumber(payDeductionAmount)) || 0) : 0)) *
                                    100
                                )
                              )
                            )}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      /* Advance Calculation Breakdown in Card 3 */
                      <div className="bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC] p-3 sm:p-3.5 space-y-2 shadow-xs">
                        <div className="text-[10px] font-extrabold uppercase text-text-muted tracking-wider pb-1 border-b border-[#EAE3DA] flex items-center justify-between">
                          <span>Advance Calculation</span>
                          <span>Amount (LKR)</span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-text-secondary">Base Salary:</span>
                            <span className="font-mono text-brand-brown-dark">
                              {formatLKR(isPayingEmployee.baseSalaryCents)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-amber-800">Deduction (Advance):</span>
                            <span className="font-mono font-bold text-amber-800">
                              -{formatLKR(Math.round((parseFloat(cleanCommaNumber(payAmount)) || 0) * 100))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-text-secondary">Remaining Salary:</span>
                            <span className="font-mono text-brand-teal">
                              {formatLKR(Math.max(0, (isPayingEmployee.baseSalaryCents || 0) - Math.round((parseFloat(cleanCommaNumber(payAmount)) || 0) * 100)))}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#E2D8CC] flex items-center justify-between">
                          <span className="text-xs font-black uppercase text-brand-brown-dark tracking-wide">
                            Total Advance
                          </span>
                          <strong className="text-xl font-mono font-black text-brand-teal">
                            {formatLKR(Math.round((parseFloat(cleanCommaNumber(payAmount)) || 0) * 100))}
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* Final Confirmation Banner */}
                    <div className="p-3 bg-cream-50/80 border border-[#EAE3DA] rounded-xl space-y-1 text-xs">
                      <div className="flex items-center justify-between font-bold text-text-secondary">
                        <span>Disbursing Payee:</span>
                        <strong className="text-brand-brown-dark">{isPayingEmployee.name}</strong>
                      </div>
                      <div className="flex items-center justify-between font-bold text-text-secondary">
                        <span>Transaction Date:</span>
                        <span className="font-mono">{formatDate(new Date().toISOString())}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 8. MODAL: OFFICIAL DISBURSEMENT RECEIPT                                   */}
      {/* ========================================================================= */}
      {viewingPaymentSlip && (() => {
        const emp = accountingService.getEmployeeById(viewingPaymentSlip.employeeId);
        return createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
            <div className="w-full max-w-[400px] max-h-[92vh] flex flex-col bg-white rounded-3xl border border-[#E2D8CC] shadow-2xl overflow-y-auto p-5 sm:p-6 relative my-auto scrollbar-none animate-in zoom-in-95 duration-150">
              {/* Close Button Top Right (Only Close Action) */}
              <button
                type="button"
                onClick={() => setViewingPaymentSlip(null)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-cream-50 hover:bg-cream-200 border border-[#E0D7CC] flex items-center justify-center text-text-muted hover:text-brand-brown-dark transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Header with Logo */}
              <div className="text-center pb-3.5 border-b border-[#EAE3DA]">
                <img
                  src="/logobg.webp"
                  alt="Chill & Choc"
                  className="w-16 h-auto mx-auto object-contain drop-shadow-xs mb-1.5"
                />
                <h2 className="font-black text-sm uppercase tracking-wider text-brand-brown-dark">
                  Chill & Choc Cafe
                </h2>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">
                  Official Disbursement Receipt
                </p>
                <div className="flex items-center justify-center gap-2 mt-2 font-mono text-[10.5px] text-text-secondary font-bold">
                  <span>{viewingPaymentSlip.referenceNumber || `VCH-${viewingPaymentSlip.id.slice(-4)}`}</span>
                  <span>•</span>
                  <span>{formatDateTime(viewingPaymentSlip.date)}</span>
                </div>
              </div>

              {/* Employee & Payee Information (Records with bottom borders only, no colored backgrounds) */}
              <div className="py-2.5 border-b border-[#EAE3DA] space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                  <span className="text-text-muted font-bold text-[10.5px]">Employee / Payee:</span>
                  <strong className="text-brand-brown-dark font-black">{viewingPaymentSlip.employeeName}</strong>
                </div>

                <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                  <span className="text-text-muted font-bold text-[10.5px]">Designation / Role:</span>
                  <span className="text-brand-brown-dark font-bold">{emp?.role || 'Staff Member'}</span>
                </div>

                {emp?.phone && (
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                    <span className="text-text-muted font-bold text-[10.5px]">Contact Phone:</span>
                    <span className="font-mono text-brand-brown-dark font-bold">{emp.phone}</span>
                  </div>
                )}

                {emp?.nic && (
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                    <span className="text-text-muted font-bold text-[10.5px]">NIC / ID:</span>
                    <span className="font-mono text-brand-brown-dark font-bold">{emp.nic}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-text-muted font-bold text-[10.5px]">Payment Type:</span>
                  <span className="font-black text-brand-brown-dark uppercase text-[11px]">
                    {viewingPaymentSlip.paymentType === 'SALARY' ? 'Salary Settlement' : 'Salary Advance'}
                  </span>
                </div>
              </div>

              {/* Calculation & Payment Records (Bottom borders only) */}
              <div className="py-2.5 border-b-2 border-brand-brown-dark space-y-2 text-xs">
                {/* Header row */}
                <div className="flex items-center justify-between font-black uppercase text-[10px] text-text-muted tracking-wider pb-1 border-b border-[#EAE3DA]">
                  <span>Description</span>
                  <span>Amount (LKR)</span>
                </div>

                {/* Basic Salary */}
                <div className="flex items-center justify-between font-bold text-xs pb-1.5 border-b border-[#F0EAE1]">
                  <span className="text-text-secondary">
                    {viewingPaymentSlip.paymentType === 'ADVANCE' ? 'Advance Amount' : 'Basic Salary'}
                  </span>
                  <span className="font-mono text-brand-brown-dark font-black">
                    {formatLKR(viewingPaymentSlip.baseSalaryAmountCents || viewingPaymentSlip.amountCents)}
                  </span>
                </div>

                {/* Overtime */}
                {viewingPaymentSlip.overtimeAmountCents !== undefined && viewingPaymentSlip.overtimeAmountCents > 0 && (
                  <div className="flex items-center justify-between font-bold text-xs pb-1.5 border-b border-[#F0EAE1]">
                    <span className="text-text-secondary">
                      Overtime {viewingPaymentSlip.overtimeHours ? `(${viewingPaymentSlip.overtimeHours} hrs)` : ''}
                    </span>
                    <span className="font-mono text-brand-brown-dark font-black">
                      +{formatLKR(viewingPaymentSlip.overtimeAmountCents)}
                    </span>
                  </div>
                )}

                {/* Bonus / Incentive */}
                {viewingPaymentSlip.bonusAmountCents !== undefined && viewingPaymentSlip.bonusAmountCents > 0 && (
                  <div className="flex items-center justify-between font-bold text-xs pb-1.5 border-b border-[#F0EAE1]">
                    <div>
                      <span className="text-text-secondary">Bonus / Incentive</span>
                      {viewingPaymentSlip.bonusReason && (
                        <span className="text-[10px] text-text-muted block font-normal">
                          ({viewingPaymentSlip.bonusReason})
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-brand-brown-dark font-black">
                      +{formatLKR(viewingPaymentSlip.bonusAmountCents)}
                    </span>
                  </div>
                )}

                {/* Deductions / Advance Recovery */}
                {viewingPaymentSlip.deductionAmountCents !== undefined && viewingPaymentSlip.deductionAmountCents > 0 && (
                  <div className="flex items-center justify-between font-bold text-xs pb-1.5 border-b border-[#F0EAE1]">
                    <div>
                      <span className="text-text-secondary">Deduction / Recovery</span>
                      {viewingPaymentSlip.deductionReason && (
                        <span className="text-[10px] text-text-muted block font-normal">
                          ({viewingPaymentSlip.deductionReason})
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-brand-brown-dark font-black">
                      -{formatLKR(viewingPaymentSlip.deductionAmountCents)}
                    </span>
                  </div>
                )}

                {/* Net Total Disbursed */}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-black uppercase text-xs text-brand-brown-dark tracking-wide">
                    Total Disbursed:
                  </span>
                  <strong className="font-mono font-black text-base sm:text-lg text-brand-brown-dark">
                    {formatLKR(viewingPaymentSlip.amountCents)}
                  </strong>
                </div>
              </div>

              {/* Payment Remittance Details (Records with bottom borders) */}
              <div className="pt-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                  <span className="text-text-muted font-bold text-[10.5px]">Payment Method:</span>
                  <span className="font-bold text-brand-brown-dark">
                    {viewingPaymentSlip.method === 'CHEQUE'
                      ? 'Cheque'
                      : viewingPaymentSlip.method === 'CARD'
                      ? 'Bank Transfer'
                      : 'Cash'}
                  </span>
                </div>

                {viewingPaymentSlip.method === 'CHEQUE' && (
                  <>
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                      <span className="text-text-muted font-bold text-[10.5px]">Cheque Ref #:</span>
                      <span className="font-mono font-bold text-brand-brown-dark">
                        #{viewingPaymentSlip.chequeNumber || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                      <span className="text-text-muted font-bold text-[10.5px]">Drawn Bank:</span>
                      <span className="font-bold text-brand-brown-dark">
                        {viewingPaymentSlip.bankName || 'Bank of Ceylon'}
                      </span>
                    </div>
                    {viewingPaymentSlip.chequeDate && (
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                        <span className="text-text-muted font-bold text-[10.5px]">Maturity Date:</span>
                        <span className="font-mono font-bold text-brand-brown-dark">
                          {formatDate(viewingPaymentSlip.chequeDate)}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {viewingPaymentSlip.method === 'CARD' && (
                  <>
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                      <span className="text-text-muted font-bold text-[10.5px]">Bank Name:</span>
                      <span className="font-bold text-brand-brown-dark">
                        {viewingPaymentSlip.bankName || emp?.bankName || 'Direct Transfer'}
                      </span>
                    </div>
                    {emp?.accountNumber && (
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                        <span className="text-text-muted font-bold text-[10.5px]">Account Number:</span>
                        <span className="font-mono font-bold text-brand-brown-dark">{emp.accountNumber}</span>
                      </div>
                    )}
                    {emp?.bankBranch && (
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#F0EAE1]">
                        <span className="text-text-muted font-bold text-[10.5px]">Branch:</span>
                        <span className="font-bold text-brand-brown-dark">{emp.bankBranch}</span>
                      </div>
                    )}
                  </>
                )}

                {viewingPaymentSlip.notes && (
                  <div className="pt-1 text-[11px]">
                    <span className="text-text-muted font-bold text-[10px] block mb-0.5">Remarks / Memo:</span>
                    <p className="font-medium text-brand-brown-dark leading-relaxed italic">
                      "{viewingPaymentSlip.notes}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========================================================================= */}
      {/* 8. MODAL: ADD / EDIT SUPPLIER STUDIO (2-PANEL STUDIO FORM)                */}
      {/* ========================================================================= */}
      {editingSupplier &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in">
            <div className="w-full max-w-[96vw] 2xl:max-w-[1240px] h-[80vh] max-h-[80vh] min-h-[520px] flex flex-col">
              {/* Top Header Bar Above Form */}
              <div className="flex items-center justify-between mb-2.5 px-1 shrink-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-extrabold text-base sm:text-lg text-white drop-shadow-xs flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-brand-teal" />
                    <span>{editingSupplier.id ? 'Edit Supplier Profile' : 'Add New Supplier'}</span>
                  </h3>
                  <span className="text-[11px] font-bold text-white/70 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs hidden sm:inline-block">
                    Supplier Directory Studio
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingSupplier(null)}
                    className="px-4 py-1.5 rounded-2xl border border-white/30 text-white hover:bg-white/10 text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="supplier-form"
                    className="px-5 py-1.5 rounded-2xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Supplier</span>
                  </button>
                </div>
              </div>

              {/* Main 2-Panel Side-by-Side Responsive Grid Area */}
              <form
                id="supplier-form"
                onSubmit={handleSaveSupplier}
                className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 overflow-hidden min-h-0"
              >
                {/* ================================================================= */}
                {/* 1. LEFT CARD: SUPPLIER & VENDOR DETAILS                           */}
                {/* ================================================================= */}
                <div className="lg:col-span-5 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-y-auto">
                  {/* Card Section Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DF] shrink-0 mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-brand-teal shadow-xs">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <h4 className="font-black text-xs uppercase tracking-wider text-brand-brown-dark">
                        Supplier & Vendor Details
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-3 flex-1 flex flex-col">
                    {/* Company / Vendor Name */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Company / Vendor Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editingSupplier.name || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, name: e.target.value })}
                        placeholder="e.g. Ceylon Coffee Roasters Ltd"
                        className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                      />
                    </div>

                    {/* Contact Person & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                          Contact Person
                        </label>
                        <input
                          type="text"
                          value={editingSupplier.contactPerson || ''}
                          onChange={(e) => setEditingSupplier({ ...editingSupplier, contactPerson: e.target.value })}
                          placeholder="e.g. Rohan Wickramasinghe"
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider">
                            Phone Number
                          </label>
                          <span className="text-[9px] font-mono font-bold text-text-muted">
                            {(editingSupplier.phone || '').replace(/\D/g, '').replace(/^94|^0/, '').slice(0, 9).length} / 9 digits
                          </span>
                        </div>
                        <div className="flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal focus-within:bg-white transition-colors">
                          <span className="px-3 py-2.5 bg-[#F2ECE4] border-r border-[#E2D8CC] text-xs font-mono font-black text-brand-brown-dark select-none shrink-0">
                            +94
                          </span>
                          <input
                            type="tel"
                            value={formatLKLocalPhone(editingSupplier.phone || '')}
                            onChange={(e) => {
                              const formattedLocal = formatLKLocalPhone(e.target.value);
                              setEditingSupplier({
                                ...editingSupplier,
                                phone: formattedLocal ? `+94 ${formattedLocal}` : '',
                              });
                            }}
                            placeholder="7X XXX XXXX"
                            maxLength={11}
                            className="w-full py-2 px-3 bg-transparent text-xs font-mono font-bold text-brand-brown-dark outline-none tracking-wider"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Email Address & Physical Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={editingSupplier.email || ''}
                          onChange={(e) => setEditingSupplier({ ...editingSupplier, email: e.target.value })}
                          placeholder="sales@ceyloncoffeeroasters.lk"
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                          Physical Address
                        </label>
                        <input
                          type="text"
                          value={editingSupplier.address || ''}
                          onChange={(e) => setEditingSupplier({ ...editingSupplier, address: e.target.value })}
                          placeholder="Colombo 03, Sri Lanka"
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                        />
                      </div>
                    </div>

                    {/* Vendor Status */}
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Vendor Status
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingSupplier({ ...editingSupplier, active: true })}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            editingSupplier.active !== false
                              ? 'bg-teal-50 text-brand-teal border-teal-300 shadow-xs'
                              : 'bg-[#FAF7F2] text-text-muted border-[#E2D8CC]'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active Vendor</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSupplier({ ...editingSupplier, active: false })}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            editingSupplier.active === false
                              ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs'
                              : 'bg-[#FAF7F2] text-text-muted border-[#E2D8CC]'
                          }`}
                        >
                          <span>Inactive / Suspended</span>
                        </button>
                      </div>
                    </div>

                    {/* Payment Terms & Notes */}
                    <div className="flex-1 flex flex-col min-h-[90px]">
                      <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                        Payment Terms & Notes
                      </label>
                      <textarea
                        value={editingSupplier.notes || ''}
                        onChange={(e) => setEditingSupplier({ ...editingSupplier, notes: e.target.value })}
                        placeholder="Credit period 30 days, delivery on Mondays..."
                        className="w-full flex-1 min-h-[70px] p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-medium text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white resize-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* 2. RIGHT CARD: SUPPLIED ITEMS & INGREDIENTS LIST (ROW BY ROW)     */}
                {/* ================================================================= */}
                <div className="lg:col-span-7 flex flex-col h-full min-h-0 bg-white rounded-3xl shadow-2xl border border-[#E9E0D5] p-4 sm:p-5 overflow-hidden">
                  {/* Header with Title & Add Item Button */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#F0E8DF] shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF7F2] border border-[#EAE3DA] flex items-center justify-center text-brand-teal shadow-xs">
                        <Package className="w-4 h-4" />
                      </div>
                      <h4 className="font-black text-xs uppercase tracking-wider text-brand-brown-dark">
                        Supplied Items & Raw Ingredients
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddSupplierItem}
                      className="px-3.5 py-1.5 bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] rounded-xl text-xs font-extrabold text-brand-teal flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs active:scale-95 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  {/* Line Items Table (Scrollable with bottom border per row) */}
                  <div className="flex-1 min-h-0 overflow-y-auto py-1 pr-1">
                    {(!editingSupplier.providedItems || editingSupplier.providedItems.length === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 rounded-2xl bg-[#FAF7F2]/60 border border-dashed border-[#E2D8CC] text-center space-y-2 my-auto">
                        <Package className="w-10 h-10 text-text-muted/40" />
                        <div className="text-xs font-bold text-brand-brown-dark">No Supplied Items Added</div>
                        <p className="text-[11px] text-text-muted max-w-sm">
                          Click <strong className="text-brand-teal font-extrabold">"+ Add Item"</strong> above to add items row by row that this supplier provides.
                        </p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-[#EAE3DA] text-[10px] font-black uppercase text-text-secondary tracking-wider">
                            <th className="py-2 px-2 w-10 text-center">#</th>
                            <th className="py-2 px-2">Item / Ingredient Name *</th>
                            <th className="py-2 px-2 w-36">Unit *</th>
                            <th className="py-2 px-2 w-32">SKU / Code</th>
                            <th className="py-2 px-2 w-12 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0E8DF]">
                          {editingSupplier.providedItems.map((item, idx) => (
                            <tr
                              key={item.id || idx}
                              className="border-b border-[#F0E8DF] hover:bg-[#FAF7F2]/60 transition-colors"
                            >
                              {/* # Index */}
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-[11px] text-text-muted">
                                {idx + 1}
                              </td>

                              {/* Item / Ingredient Name */}
                              <td className="py-2.5 px-2">
                                <div className="relative">
                                  <input
                                    type="text"
                                    required
                                    value={item.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const matchedIng = ingredients.find(
                                        (ing) => ing.name.toLowerCase() === val.trim().toLowerCase()
                                      );
                                      if (matchedIng) {
                                        handleUpdateSupplierItem(idx, {
                                          name: val,
                                          ingredientId: matchedIng.id,
                                          unit: matchedIng.unit || item.unit,
                                          sku: matchedIng.sku || item.sku,
                                        });
                                      } else {
                                        handleUpdateSupplierItem(idx, { name: val });
                                      }
                                    }}
                                    placeholder="e.g. Fresh Cow Milk"
                                    list={`ing-list-${idx}`}
                                    className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                                  />
                                  <datalist id={`ing-list-${idx}`}>
                                    {ingredients.map((ing) => (
                                      <option key={ing.id} value={ing.name}>
                                        {ing.name} ({ing.unit})
                                      </option>
                                    ))}
                                  </datalist>
                                </div>
                              </td>

                              {/* Unit Dropdown */}
                              <td className="py-2.5 px-2">
                                <select
                                  value={item.unit || 'kg'}
                                  onChange={(e) => handleUpdateSupplierItem(idx, { unit: e.target.value })}
                                  className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                                >
                                  <option value="kg">kg (Kilograms)</option>
                                  <option value="g">g (Grams)</option>
                                  <option value="L">L (Liters)</option>
                                  <option value="ml">ml (Milliliters)</option>
                                  <option value="pcs">pcs (Pieces)</option>
                                  <option value="box">box (Box)</option>
                                  <option value="can">can (Can)</option>
                                  <option value="pkt">pkt (Packet)</option>
                                  <option value="bottle">bottle (Bottle)</option>
                                  <option value="tin">tin (Tin)</option>
                                  <option value="pack">pack (Pack)</option>
                                  <option value="unit">unit (Unit)</option>
                                </select>
                              </td>

                              {/* SKU / Code */}
                              <td className="py-2.5 px-2">
                                <input
                                  type="text"
                                  value={item.sku || ''}
                                  onChange={(e) => handleUpdateSupplierItem(idx, { sku: e.target.value })}
                                  placeholder="Optional"
                                  className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-mono font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                                />
                              </td>

                              {/* Action (Delete) */}
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSupplierItem(idx)}
                                  className="w-7 h-7 rounded-full bg-[#FAF7F2] hover:bg-rose-50 border border-[#E0D7CC] hover:border-rose-200 text-text-muted hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 mx-auto"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Bottom Summary Bar */}
                  <div className="pt-3 border-t border-[#F0E8DF] flex items-center justify-between text-xs shrink-0 bg-white">
                    <span className="text-text-muted font-bold">
                      Total Items: <strong className="text-brand-brown-dark">{editingSupplier.providedItems?.length || 0}</strong>
                    </span>
                  </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 9. MODAL: SETTLE SUPPLIER BALANCE                                         */}
      {/* ========================================================================= */}
      {settlingSupplier &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl border border-[#E2D8CC] shadow-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE3DA]">
                <div>
                  <h3 className="font-extrabold text-base text-brand-brown-dark flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-brand-teal" />
                    <span>Settle Supplier Balance</span>
                  </h3>
                  <span className="text-[11px] text-text-muted">
                    Payee: <strong className="text-brand-brown-dark">{settlingSupplier.supplierName}</strong> (Outstanding: {formatLKR(settlingSupplier.dueCents)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSettlingSupplier(null)}
                  className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 flex items-center justify-center text-text-muted hover:text-brand-brown-dark cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmSettleSupplier} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Settlement Method
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#E2D8CC]">
                    {(['CASH', 'CARD', 'CHEQUE'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSettleSupplierMethod(m)}
                        className={`py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          settleSupplierMethod === m
                            ? 'bg-brand-teal text-white shadow-xs'
                            : 'text-text-secondary hover:text-brand-brown-dark'
                        }`}
                      >
                        {m === 'CASH' && <Banknote className="w-3.5 h-3.5" />}
                        {m === 'CARD' && <CreditCard className="w-3.5 h-3.5" />}
                        {m === 'CHEQUE' && <FileText className="w-3.5 h-3.5" />}
                        <span>{m === 'CASH' ? 'Cash' : m === 'CARD' ? 'Bank Transfer' : 'Cheque'}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Amount to Settle (LKR) *
                  </label>
                  <div className="relative flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal">
                    <span className="pl-3 text-xs font-bold text-text-muted">Rs.</span>
                    <input
                      type="number"
                      step="100"
                      required
                      value={settleSupplierAmount}
                      onChange={(e) => setSettleSupplierAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 py-2 px-2 bg-transparent font-mono font-bold text-xs text-brand-brown-dark outline-none text-right"
                    />
                    <button
                      type="button"
                      onClick={() => setSettleSupplierAmount(String(settlingSupplier.dueCents / 100))}
                      className="mx-1.5 px-2.5 py-1 bg-white hover:bg-cream-100 border border-[#E0D7CC] rounded-lg text-[10px] font-black text-brand-teal cursor-pointer"
                    >
                      Full Balance
                    </button>
                  </div>
                </div>

                {settleSupplierMethod === 'CHEQUE' && (
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={settleSupplierChequeNumber}
                        onChange={(e) => setSettleSupplierChequeNumber(e.target.value)}
                        placeholder="Cheque Ref #"
                        className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-mono font-bold outline-none"
                      />
                      <input
                        type="text"
                        required
                        value={settleSupplierChequeBank}
                        onChange={(e) => setSettleSupplierChequeBank(e.target.value)}
                        placeholder="Bank Name"
                        className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Cheque Due Date
                      </label>
                      <CustomDatePicker
                        value={settleSupplierChequeDate}
                        onChange={(newDate) => setSettleSupplierChequeDate(newDate)}
                        placeholder="Select cheque date"
                        showPresets={true}
                        inputClassName="!bg-[#FAF7F2] !border-[#E2D8CC] !rounded-xl !text-xs !font-mono !font-bold !text-brand-brown-dark !p-2.5 hover:!border-brand-teal"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Notes / Memo
                  </label>
                  <input
                    type="text"
                    value={settleSupplierNotes}
                    onChange={(e) => setSettleSupplierNotes(e.target.value)}
                    placeholder="e.g. Full settlement for August deliveries"
                    className="w-full p-2 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-medium text-brand-brown-dark outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAE3DA]">
                  <button
                    type="button"
                    onClick={() => setSettlingSupplier(null)}
                    className="px-4 py-2 rounded-xl border border-[#E2D8CC] text-text-secondary text-xs font-bold hover:bg-cream-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Settlement</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 10. MODAL: ADD / EDIT EXPENSE                                             */}
      {/* ========================================================================= */}
      {editingExpense &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl border border-[#E2D8CC] shadow-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE3DA]">
                <h3 className="font-extrabold text-base text-brand-brown-dark flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-brand-teal" />
                  <span>{editingExpense.id ? 'Edit Expense Record' : 'Record Operating Expense'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 flex items-center justify-center text-text-muted hover:text-brand-brown-dark cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Expense Title / Reason *
                  </label>
                  <input
                    type="text"
                    required
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="e.g. Fresh milk delivery, Store cleaning"
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                      Amount (LKR) *
                    </label>
                    <div className="relative flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal">
                      <span className="pl-3 text-xs font-bold text-text-muted">Rs.</span>
                      <input
                        type="number"
                        step="10"
                        required
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 py-2 px-2 bg-transparent font-mono font-bold text-xs text-brand-brown-dark outline-none text-right"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                      Category
                    </label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategoryType)}
                      className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal"
                    >
                      <option value="PETTY_CASH">Petty Cash / Supplies</option>
                      <option value="EMERGENCY_MILK">Emergency Dairy / Milk</option>
                      <option value="CLEANING">Cleaning & Janitorial</option>
                      <option value="DELIVERY">Ice / Gas Delivery</option>
                      <option value="MAINTENANCE">Equipment Maintenance</option>
                      <option value="UTILITIES">Utilities & Bills</option>
                      <option value="OTHER">Other Operational</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Payment Source Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExpensePaidViaDrawer(true)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        expensePaidViaDrawer
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                          : 'bg-[#FAF7F2] border-[#E0D7CC] text-text-secondary'
                      }`}
                    >
                      <Banknote className="w-4 h-4 text-amber-800" />
                      <span>POS Cash Drawer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpensePaidViaDrawer(false)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        !expensePaidViaDrawer
                          ? 'bg-teal-50 border-brand-teal text-brand-teal shadow-xs'
                          : 'bg-[#FAF7F2] border-[#E0D7CC] text-text-secondary'
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-brand-teal" />
                      <span>Direct / Bank Account</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Notes / Bill Reference
                  </label>
                  <input
                    type="text"
                    value={expenseNotes}
                    onChange={(e) => setExpenseNotes(e.target.value)}
                    placeholder="Invoice #, receipt notes..."
                    className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-medium text-brand-brown-dark outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAE3DA]">
                  <button
                    type="button"
                    onClick={() => setEditingExpense(null)}
                    className="px-4 py-2 rounded-xl border border-[#E2D8CC] text-text-secondary text-xs font-bold hover:bg-cream-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Expense</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 9. EMPLOYEE ATTENDANCE & OVERTIME BIG CALENDAR MODAL                      */}
      {/* ========================================================================= */}
      {viewingAttendanceEmployee && (
        <EmployeeAttendanceCalendarModal
          employee={viewingAttendanceEmployee}
          initialYear={dateRange.year !== 'ALL' ? parseInt(dateRange.year, 10) : new Date().getFullYear()}
          initialMonth={dateRange.month !== 'ALL' ? parseInt(dateRange.month, 10) : new Date().getMonth() + 1}
          onClose={() => setViewingAttendanceEmployee(null)}
          onUpdate={syncAll}
        />
      )}
    </div>
  );
};

