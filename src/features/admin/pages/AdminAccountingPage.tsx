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
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [settlingSupplier, setSettlingSupplier] = useState<{
    supplierName: string;
    dueCents: number;
  } | null>(null);
  const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);
  const [supplierSubTab, setSupplierSubTab] = useState<'purchases' | 'payments'>('payments');

  // Form states for Record Employee Payment
  const [payAmount, setPayAmount] = useState('');
  const [payType, setPayType] = useState<EmployeePaymentType>('SALARY');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'CHEQUE'>('CASH');
  const [payChequeDate, setPayChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [payChequeNumber, setPayChequeNumber] = useState('');
  const [payBankName, setPayBankName] = useState('');
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
    return unsub;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
    return employees.map((emp) => {
      const allEmpPayments = employeePayments.filter((p) => p.employeeId === emp.id);
      const monthlyPayments = allEmpPayments.filter((p) => isMatchingPeriod(p.date));
      const paidThisMonthCents = monthlyPayments.reduce((s, p) => s + p.amountCents, 0);
      const baseSalaryCents = emp.baseSalaryCents || 0;
      const dueThisMonthCents = Math.max(0, baseSalaryCents - paidThisMonthCents);
      const isFullyPaidThisMonth = paidThisMonthCents >= baseSalaryCents;
      const lifetimePaidCents = allEmpPayments.reduce((s, p) => s + p.amountCents, 0);

      return {
        ...emp,
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

  const handleOpenPayEmployee = (emp: Employee, defaultDueCents?: number) => {
    setIsPayingEmployee(emp);
    const amountToPreload = defaultDueCents && defaultDueCents > 0 ? defaultDueCents : emp.baseSalaryCents;
    setPayAmount(String(amountToPreload / 100));
    setPayType('SALARY');
    setPayMethod('CASH');
    setPayChequeNumber('');
    setPayChequeDate(new Date().toISOString().split('T')[0]);
    setPayBankName(emp.bankName || '');
  };

  const handleConfirmPayEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPayingEmployee) return;

    const numAmt = parseFloat(payAmount);
    if (!numAmt || numAmt <= 0) {
      toast.error('Please enter a valid disbursement amount.');
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
      amountCents: Math.round(numAmt * 100),
      paymentType: payType,
      method: payMethod,
      date: new Date().toISOString(),
      bankName: payBankName.trim() || undefined,
      chequeNumber: payMethod === 'CHEQUE' ? payChequeNumber.trim() || undefined : undefined,
      chequeDate: payMethod === 'CHEQUE' ? payChequeDate || undefined : undefined,
    });

    toast.success(`Recorded ${payType} payment of ${formatLKR(Math.round(numAmt * 100))} to ${isPayingEmployee.name}.`);
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
                  <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Base Salary</th>
                  <th className="py-2.5 px-3 bg-[#FAF7F2]/95">Bank Details</th>
                  <th className="py-2.5 px-3 text-center bg-[#FAF7F2]/95">Month Status</th>
                  <th className="py-2.5 px-3 text-right bg-[#FAF7F2]/95">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECE4] font-medium">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-text-muted">
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
                              onClick={() => handleOpenPayEmployee(emp, emp.dueThisMonthCents)}
                              className="px-2.5 py-1 bg-brand-teal/10 hover:bg-brand-teal hover:text-white text-brand-teal rounded-lg font-bold text-[11px] border border-brand-teal/30 transition-all cursor-pointer active:scale-95 whitespace-nowrap shadow-xs"
                              title="Record Salary / Advance Payment"
                            >
                              + Pay
                            </button>
                          )}
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
                    <td colSpan={7} className="h-20 bg-transparent border-0" />
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

          {/* Payment Records History Table */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-[#E9E0D5] shadow-xs overflow-hidden flex flex-col">
            <div className="p-3 bg-[#FAF7F2] border-b border-[#EAE3DA] flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold uppercase text-brand-brown-dark tracking-wider">
                Disbursement & Payment Records ({selectedEmployeeData.payments.length})
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
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
                          {p.method === 'CHEQUE' ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-amber-50 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-amber-700" />
                                  Cheque
                                </span>
                                <span className="font-mono font-bold text-brand-brown-dark">
                                  {p.chequeNumber ? `#${p.chequeNumber}` : ''}
                                </span>
                                {p.bankName && <span className="text-text-muted">({p.bankName})</span>}
                              </div>
                              {p.chequeDate && (() => {
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const due = new Date(p.chequeDate);
                                due.setHours(0, 0, 0, 0);
                                const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                return (
                                  <div className="flex items-center gap-1.5 pl-0.5">
                                    <span className="font-mono text-[10px] text-text-muted">Due: {formatDate(p.chequeDate)}</span>
                                    {diffDays > 0 ? (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        Matures in {diffDays}d
                                      </span>
                                    ) : diffDays === 0 ? (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-50 text-brand-teal border border-teal-200">
                                        Matures Today
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        Matured ({Math.abs(diffDays)}d ago)
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          ) : p.method === 'CARD' ? (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-teal-50 text-brand-teal border border-teal-200 inline-flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                Transfer
                              </span>
                              {p.bankName && <span className="font-medium text-brand-brown-dark">{p.bankName}</span>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase bg-emerald-50 text-status-success border border-emerald-200 inline-flex items-center gap-1">
                                <Banknote className="w-3 h-3 text-emerald-700" />
                                Cash
                              </span>
                              <span className="text-text-muted text-[11px]">Direct Cash</span>
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
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB 2: SUPPLIER PAYABLES & DIRECTORY                                   */}
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
                        selectedEmployeeData.employee,
                        selectedEmployeeData.employee.dueThisMonthCents
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
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
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
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="HOURLY">Hourly</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1">
                          Salary Date (Day of Month)
                        </label>
                        <select
                          value={editingEmployee.salaryPayDay || '28'}
                          onChange={(e) =>
                            setEditingEmployee({
                              ...editingEmployee,
                              salaryPayDay: e.target.value,
                            })
                          }
                          className="w-full p-2.5 bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl text-xs font-bold text-brand-brown-dark outline-none focus:border-brand-teal focus:bg-white transition-colors"
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
      {/* 7. MODAL: RECORD EMPLOYEE PAYROLL PAYMENT                                 */}
      {/* ========================================================================= */}
      {isPayingEmployee &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl border border-[#E2D8CC] shadow-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#EAE3DA]">
                <div>
                  <h3 className="font-extrabold text-base text-brand-brown-dark flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-brand-teal" />
                    <span>Disburse Payroll Payment</span>
                  </h3>
                  <span className="text-[11px] text-text-muted">
                    Payee: <strong className="text-brand-brown-dark">{isPayingEmployee.name}</strong> ({isPayingEmployee.role})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPayingEmployee(null)}
                  className="w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 flex items-center justify-center text-text-muted hover:text-brand-brown-dark cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmPayEmployee} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Disbursement Type
                  </label>
                  <div className="grid grid-cols-4 gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#E2D8CC]">
                    {(['SALARY', 'ADVANCE', 'BONUS', 'OVERTIME'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPayType(type)}
                        className={`py-1.5 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                          payType === type
                            ? 'bg-[#2D2422] text-white shadow-xs'
                            : 'text-text-secondary hover:text-brand-brown-dark'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-[#FAF7F2] p-1 rounded-xl border border-[#E2D8CC]">
                    {(['CASH', 'CARD', 'CHEQUE'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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

                <div>
                  <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                    Disbursement Amount (LKR) *
                  </label>
                  <div className="relative flex items-center bg-[#FAF7F2] border border-[#E2D8CC] rounded-xl overflow-hidden focus-within:border-brand-teal">
                    <span className="pl-3 text-xs font-bold text-text-muted">Rs.</span>
                    <input
                      type="number"
                      step="100"
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 py-2 px-2 bg-transparent font-mono font-bold text-xs text-brand-brown-dark outline-none text-right"
                    />
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(isPayingEmployee.baseSalaryCents / 100))}
                      className="mx-1.5 px-2.5 py-1 bg-white hover:bg-cream-100 border border-[#E0D7CC] rounded-lg text-[10px] font-black text-brand-teal cursor-pointer"
                    >
                      Full Base
                    </button>
                  </div>
                </div>

                {payMethod === 'CHEQUE' && (
                  <div className="space-y-2.5 p-3 bg-[#FAF7F2] rounded-2xl border border-[#E2D8CC]">
                    <div className="text-[10px] font-extrabold uppercase text-brand-brown-dark tracking-wider flex items-center justify-between">
                      <span>Cheque & Bank Details</span>
                      <FileText className="w-3.5 h-3.5 text-brand-teal" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                          Cheque Ref # *
                        </label>
                        <input
                          type="text"
                          required
                          value={payChequeNumber}
                          onChange={(e) => setPayChequeNumber(e.target.value)}
                          placeholder="e.g. CHQ-88201"
                          className="w-full p-2 bg-white border border-[#E2D8CC] rounded-xl text-xs font-mono font-bold outline-none focus:border-brand-teal"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                          Drawn Bank Name
                        </label>
                        <input
                          type="text"
                          value={payBankName}
                          onChange={(e) => setPayBankName(e.target.value)}
                          placeholder="e.g. Commercial Bank"
                          className="w-full p-2 bg-white border border-[#E2D8CC] rounded-xl text-xs font-bold outline-none focus:border-brand-teal"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">
                        Cheque End Date / Maturity Date *
                      </label>
                      <CustomDatePicker
                        value={payChequeDate}
                        onChange={(newDate) => setPayChequeDate(newDate)}
                        placeholder="Select Cheque Due Date"
                        showPresets={true}
                        inputClassName="!bg-white !border-[#E2D8CC] !rounded-xl !text-xs !font-mono !font-bold !text-brand-brown-dark !p-2 hover:!border-brand-teal"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EAE3DA]">
                  <button
                    type="button"
                    onClick={() => setIsPayingEmployee(null)}
                    className="px-4 py-2 rounded-xl border border-[#E2D8CC] text-text-secondary text-xs font-bold hover:bg-cream-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white font-extrabold text-xs shadow-teal cursor-pointer active:scale-95 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm Disbursement</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* 8. MODAL: DIGITAL DISBURSEMENT VOUCHER SLIP (VIEW DETAILS ONLY - NO PRINT) */}
      {/* ========================================================================= */}
      {viewingPaymentSlip &&
        createPortal(
          <div className="fixed inset-0 z-[99999] w-full h-full bg-black/60 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in">
            <div className="w-full max-w-[320px] sm:max-w-[340px] max-h-[calc(100vh-32px)] overflow-y-auto bg-white rounded-2xl border border-[#E2D8CC] shadow-2xl p-4 sm:p-5 relative space-y-2.5 animate-in zoom-in-95 duration-150 scrollbar-none">
              {/* Close Button Top Right */}
              <button
                type="button"
                onClick={() => setViewingPaymentSlip(null)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] hover:bg-cream-200 flex items-center justify-center text-text-muted hover:text-brand-brown-dark transition-colors cursor-pointer"
                title="Close Slip"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Logo & Header */}
              <div className="text-center pt-1">
                <img
                  src="/logobg.webp"
                  alt="Chill & Choc"
                  className="w-14 sm:w-16 h-auto mx-auto object-contain drop-shadow-xs"
                />
                <h3 className="font-extrabold text-[11px] text-brand-brown-dark uppercase tracking-wider mt-1">
                  Disbursement Voucher
                </h3>
                <div className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E0D7CC] text-[10px] font-mono font-bold text-brand-teal">
                  {viewingPaymentSlip.referenceNumber || `VCH-${viewingPaymentSlip.id.slice(-4)}`}
                </div>
              </div>

              {/* Total Disbursed Amount */}
              <div className="p-2.5 bg-[#FAF7F2] rounded-xl border border-[#EAE3DA] text-center">
                <span className="text-[9px] font-bold uppercase text-text-muted tracking-wider block">
                  Disbursed Amount
                </span>
                <span className="font-mono font-black text-lg sm:text-xl text-brand-brown-dark tabular-nums block my-0.5">
                  {formatLKR(viewingPaymentSlip.amountCents)}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    viewingPaymentSlip.paymentType === 'SALARY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : viewingPaymentSlip.paymentType === 'ADVANCE'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-teal-100 text-teal-900'
                  }`}
                >
                  {viewingPaymentSlip.paymentType} PAYMENT
                </span>
              </div>

              {/* Voucher Meta Details */}
              <div className="space-y-1.5 text-[11px] divide-y divide-[#F2ECE4]">
                <div className="flex items-center justify-between pt-1">
                  <span className="text-text-muted font-bold text-[10px]">Payee</span>
                  <span className="font-black text-brand-brown-dark">{viewingPaymentSlip.employeeName}</span>
                </div>

                <div className="flex items-center justify-between pt-1.5">
                  <span className="text-text-muted font-bold text-[10px]">Date & Time</span>
                  <span className="font-mono font-bold text-text-secondary text-[10px]">
                    {formatDateTime(viewingPaymentSlip.date)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1.5">
                  <span className="text-text-muted font-bold text-[10px]">Method</span>
                  <span className="font-bold text-brand-teal flex items-center gap-1">
                    {viewingPaymentSlip.method === 'CHEQUE' ? (
                      <>
                        <FileText className="w-3 h-3" />
                        <span>Cheque</span>
                      </>
                    ) : viewingPaymentSlip.method === 'CARD' ? (
                      <>
                        <CreditCard className="w-3 h-3" />
                        <span>Bank Transfer</span>
                      </>
                    ) : (
                      <>
                        <Banknote className="w-3 h-3" />
                        <span>Direct Cash</span>
                      </>
                    )}
                  </span>
                </div>

                {viewingPaymentSlip.method === 'CHEQUE' && (
                  <>
                    <div className="flex items-center justify-between pt-1.5">
                      <span className="text-text-muted font-bold text-[10px]">Cheque Ref</span>
                      <span className="font-mono font-bold text-brand-brown-dark">
                        #{viewingPaymentSlip.chequeNumber || 'N/A'}
                      </span>
                    </div>

                    {viewingPaymentSlip.bankName && (
                      <div className="flex items-center justify-between pt-1.5">
                        <span className="text-text-muted font-bold text-[10px]">Drawn Bank</span>
                        <span className="font-bold text-text-secondary">{viewingPaymentSlip.bankName}</span>
                      </div>
                    )}

                    {viewingPaymentSlip.chequeDate && (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const due = new Date(viewingPaymentSlip.chequeDate);
                      due.setHours(0, 0, 0, 0);
                      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <div className="flex items-center justify-between pt-1.5">
                          <span className="text-text-muted font-bold text-[10px]">Maturity</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-brand-brown-dark block text-[10px]">
                              {formatDate(viewingPaymentSlip.chequeDate)}
                            </span>
                            {diffDays > 0 ? (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Matures in {diffDays}d
                              </span>
                            ) : diffDays === 0 ? (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-teal-50 text-brand-teal border border-teal-200">
                                Matures Today
                              </span>
                            ) : (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Matured ({Math.abs(diffDays)}d ago)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {viewingPaymentSlip.method === 'CARD' && viewingPaymentSlip.bankName && (
                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-text-muted font-bold text-[10px]">Bank</span>
                    <span className="font-bold text-text-secondary">{viewingPaymentSlip.bankName}</span>
                  </div>
                )}
              </div>

              {/* Close Button Only */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setViewingPaymentSlip(null)}
                  className="w-full py-2 bg-[#FAF7F2] hover:bg-cream-200 border border-[#E0D7CC] text-brand-brown-dark rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-98"
                >
                  Close Slip
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

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
    </div>
  );
};

