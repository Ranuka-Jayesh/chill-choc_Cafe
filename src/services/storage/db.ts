import {
  User,
  Terminal,
  PreparationStation,
  Category,
  ModifierGroup,
  Product,
  Ingredient,
  Recipe,
  Supplier,
  SystemSettings,
  CashierShift,
  CashDrawerTransaction,
  Order,
  InventoryMovement,
  Expense,
  Purchase,
  PrinterJob,
  AuditLog,
  HeldOrder,
  PrinterConfig,
  Employee,
  EmployeePayment,
  EmployeeRateHistory,
  LoyaltySettingHistory,
  Customer,
  StockRequest,
  AttendanceRecord,
} from '@/types';
import { supabase } from '../supabaseClient';
import { realtimeSocketService } from '../realtimeSocketService';

export interface DatabaseSchema {
  users: User[];
  terminals: Terminal[];
  stations: PreparationStation[];
  categories: Category[];
  modifierGroups: ModifierGroup[];
  products: Product[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  suppliers: Supplier[];
  settings: SystemSettings;
  shifts: CashierShift[];
  activeShift: CashierShift | null;
  drawerTransactions: CashDrawerTransaction[];
  orders: Order[];
  customers: Customer[];
  inventoryMovements: InventoryMovement[];
  stockRequests: StockRequest[];
  expenses: Expense[];
  purchases: Purchase[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  employeePayments: EmployeePayment[];
  rateHistories: EmployeeRateHistory[];
  loyaltyHistories: LoyaltySettingHistory[];
  printerJobs: PrinterJob[];
  printers: PrinterConfig[];
  auditLogs: AuditLog[];
  heldOrders: HeldOrder[];
  nextOrderNumber: number;
  nextHoldNumber: number;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  businessName: '',
  tagline: '',
  address: '',
  phone: '',
  email: '',
  currencyCode: 'LKR',
  currencySymbol: 'Rs.',
  decimalPlaces: 2,
  taxRatePercent: 0,
  serviceChargePercent: 0,
  receiptHeader: '',
  receiptFooter: '',
  autoPrintReceipt: true,
  autoPrintKOT: true,
  receiptCopies: 1,
  defaultOvertimeHourlyRateCents: 0,
  defaultLeaveDailyRateCents: 0,
  overtimeCalculationMode: 'FIXED_HOURLY',
  overtimeMultiplier: 1,
  standardWorkHoursPerDay: 8,
  workingDaysPerMonth: 26,
  shiftStartTime: '08:00',
  shiftEndTime: '17:00',
  lateGraceMinutes: 15,
  leavePolicyNote: '',
  requireOpeningCash: false,
  blindShiftClose: false,
  varianceReasonThresholdCents: 0,
  requireReasonForCashOut: false,
  allowCashierManualCashIn: true,
  allowCashierManualCashOut: true,
  openDrawerAfterCashSale: true,
  defaultTerminalId: '',
  directPrintEnabled: true,
  directPrintAgentUrl: 'http://127.0.0.1:23456',
  directPrintAuthToken: 'cafemm_secure_print_token_2026',
  directPrintPrinterName: 'XP-80C',
  directPrintPaperWidthMm: 80,
  directPrintAutoCut: true,
  directPrintDrawerKick: true,
  loyaltyProgramEnabled: false,
  loyaltyProgramName: '',
  loyaltySpendPerPointCents: 0,
  loyaltyMinSpendToEarnCents: 0,
  loyaltyPointRedemptionValueCents: 0,
  loyaltyMinPointsToRedeem: 0,
  loyaltyMaxRedemptionPercentPerOrder: 0,
  loyaltySignupBonusPoints: 0,
  loyaltyBirthdayBonusPoints: 0,
  loyaltyPointsExpiryDays: 0,
};

export const INITIAL_DATABASE: DatabaseSchema = {
  users: [],
  terminals: [],
  stations: [],
  categories: [],
  modifierGroups: [],
  products: [],
  ingredients: [],
  recipes: [],
  suppliers: [],
  settings: DEFAULT_SYSTEM_SETTINGS,
  shifts: [],
  activeShift: null,
  drawerTransactions: [],
  orders: [],
  customers: [],
  inventoryMovements: [],
  stockRequests: [],
  expenses: [],
  purchases: [],
  employees: [],
  attendance: [],
  employeePayments: [],
  rateHistories: [],
  loyaltyHistories: [],
  printerJobs: [],
  printers: [],
  auditLogs: [],
  heldOrders: [],
  nextOrderNumber: 1,
  nextHoldNumber: 1,
};

const STORAGE_KEY = 'chill_choc_cafe_db_supabase_v1';
const DB_CHANGE_EVENT = 'chill_choc_db_changed';

const SCHEMA_TO_TABLE: Record<string, string> = {
  users: 'users',
  terminals: 'terminals',
  stations: 'stations',
  categories: 'categories',
  modifierGroups: 'modifier_groups',
  products: 'products',
  ingredients: 'ingredients',
  recipes: 'recipes',
  suppliers: 'suppliers',
  settings: 'system_settings',
  shifts: 'shifts',
  drawerTransactions: 'drawer_transactions',
  orders: 'orders',
  customers: 'customers',
  inventoryMovements: 'inventory_movements',
  stockRequests: 'stock_requests',
  expenses: 'expenses',
  purchases: 'purchases',
  employees: 'employees',
  attendance: 'attendance',
  employeePayments: 'employee_payments',
  rateHistories: 'rate_histories',
  loyaltyHistories: 'loyalty_histories',
  printerJobs: 'printer_jobs',
  printers: 'printers',
  auditLogs: 'audit_logs',
  heldOrders: 'held_orders',
};

const TABLE_TO_SCHEMA: Record<string, keyof DatabaseSchema> = {
  users: 'users',
  terminals: 'terminals',
  stations: 'stations',
  categories: 'categories',
  modifier_groups: 'modifierGroups',
  products: 'products',
  ingredients: 'ingredients',
  recipes: 'recipes',
  suppliers: 'suppliers',
  system_settings: 'settings',
  shifts: 'shifts',
  drawer_transactions: 'drawerTransactions',
  orders: 'orders',
  customers: 'customers',
  inventory_movements: 'inventoryMovements',
  stock_requests: 'stockRequests',
  expenses: 'expenses',
  purchases: 'purchases',
  employees: 'employees',
  attendance: 'attendance',
  employee_payments: 'employeePayments',
  rate_histories: 'rateHistories',
  loyalty_histories: 'loyaltyHistories',
  printer_jobs: 'printerJobs',
  printers: 'printers',
  audit_logs: 'auditLogs',
  held_orders: 'heldOrders',
};

export const SUPABASE_SYSTEM_SETTINGS_COLUMNS = new Set([
  'id',
  'businessName',
  'tagline',
  'address',
  'phone',
  'email',
  'currencyCode',
  'currencySymbol',
  'decimalPlaces',
  'taxRatePercent',
  'serviceChargePercent',
  'receiptHeader',
  'receiptFooter',
  'autoPrintReceipt',
  'autoPrintKOT',
  'receiptCopies',
  'receiptCustomization',
  'kotCustomization',
  'defaultOvertimeHourlyRateCents',
  'defaultLeaveDailyRateCents',
  'overtimeCalculationMode',
  'overtimeMultiplier',
  'standardWorkHoursPerDay',
  'workingDaysPerMonth',
  'shiftStartTime',
  'shiftEndTime',
  'lateGraceMinutes',
  'leavePolicyNote',
  'requireOpeningCash',
  'blindShiftClose',
  'varianceReasonThresholdCents',
  'requireReasonForCashOut',
  'allowCashierManualCashIn',
  'allowCashierManualCashOut',
  'openDrawerAfterCashSale',
  'defaultTerminalId',
  'loyaltyProgramEnabled',
  'loyaltyProgramName',
  'loyaltySpendPerPointCents',
  'loyaltyMinSpendToEarnCents',
  'loyaltyPointRedemptionValueCents',
  'loyaltyMinPointsToRedeem',
  'loyaltyMaxRedemptionPercentPerOrder',
  'loyaltySignupBonusPoints',
  'loyaltyBirthdayBonusPoints',
  'loyaltyPointsExpiryDays',
  'updatedAt',
]);

export function sanitizeSystemSettingsForSupabase(settings: any): Record<string, any> {
  const current = settings || {};
  const directPrintData = {
    enabled: current.directPrintEnabled,
    agentUrl: current.directPrintAgentUrl,
    authToken: current.directPrintAuthToken,
    printerName: current.directPrintPrinterName,
    paperWidthMm: current.directPrintPaperWidthMm,
    autoCut: current.directPrintAutoCut,
    drawerKick: current.directPrintDrawerKick,
  };

  const payload: Record<string, any> = {
    id: 'default',
    updatedAt: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(current)) {
    if (SUPABASE_SYSTEM_SETTINGS_COLUMNS.has(key)) {
      payload[key] = value;
    }
  }

  // Preserve receiptCustomization if present, embedding directPrintData cleanly
  if (current.receiptCustomization) {
    payload.receiptCustomization = {
      ...current.receiptCustomization,
      directPrint: {
        ...(current.receiptCustomization.directPrint || {}),
        ...directPrintData,
      },
    };
  }

  if (current.kotCustomization) {
    payload.kotCustomization = current.kotCustomization;
  }

  return payload;
}

export function normalizeSystemSettingsFromSupabase(row: any, fallback: SystemSettings): SystemSettings {
  if (!row) return fallback;
  const directPrint = row.receiptCustomization?.directPrint || (fallback.receiptCustomization as any)?.directPrint || {};

  const mergedReceipt = {
    ...(fallback.receiptCustomization || {}),
    ...(row.receiptCustomization || {}),
  };

  const mergedKot = {
    ...(fallback.kotCustomization || {}),
    ...(row.kotCustomization || {}),
  };

  return {
    ...fallback,
    ...row,
    receiptCustomization: mergedReceipt,
    kotCustomization: mergedKot,
    directPrintEnabled: directPrint.enabled !== undefined ? directPrint.enabled : fallback.directPrintEnabled,
    directPrintAgentUrl: directPrint.agentUrl || fallback.directPrintAgentUrl,
    directPrintAuthToken: directPrint.authToken || fallback.directPrintAuthToken,
    directPrintPrinterName: directPrint.printerName || fallback.directPrintPrinterName,
    directPrintPaperWidthMm: directPrint.paperWidthMm || fallback.directPrintPaperWidthMm,
    directPrintAutoCut: directPrint.autoCut !== undefined ? directPrint.autoCut : fallback.directPrintAutoCut,
    directPrintDrawerKick: directPrint.drawerKick !== undefined ? directPrint.drawerKick : fallback.directPrintDrawerKick,
  };
}

class DatabaseManager {
  private db: DatabaseSchema;
  private listeners: Set<() => void> = new Set();
  private isSyncingFromRemote: boolean = false;
  private lastStorageString: string = '';
  private isSupabaseInitialized: boolean = false;

  constructor() {
    this.db = this.loadDatabase();

    if (typeof window !== 'undefined') {
      // 1. Initial live synchronization from Supabase tables
      this.initFromSupabase();

      // 2. Real-time Supabase replication subscription
      this.setupRealtimeSubscription();

      // 3. Native cross-tab storage event (fires across browser tabs)
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.syncFromStorage();
        }
      });

      // 4. Tab focus sync
      window.addEventListener('focus', () => {
        this.syncFromStorage();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.syncFromStorage();
        }
      });
    }
  }

  /**
   * Load entire database snapshot from Supabase tables
   */
  public async initFromSupabase(): Promise<void> {
    try {
      const fetchTable = async (tableName: string) => {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) {
          console.warn(`Supabase fetch failed for ${tableName}:`, error.message);
          return null;
        }
        return data;
      };

      const [
        users,
        terminals,
        stations,
        categories,
        modifierGroups,
        products,
        ingredients,
        recipes,
        suppliers,
        settingsRows,
        shifts,
        drawerTransactions,
        orders,
        heldOrders,
        customers,
        inventoryMovements,
        expenses,
        purchases,
        stockRequests,
        employees,
        employeePayments,
        rateHistories,
        loyaltyHistories,
        printers,
        printerJobs,
        auditLogs,
        counters,
        attendance,
      ] = await Promise.all([
        fetchTable('users'),
        fetchTable('terminals'),
        fetchTable('stations'),
        fetchTable('categories'),
        fetchTable('modifier_groups'),
        fetchTable('products'),
        fetchTable('ingredients'),
        fetchTable('recipes'),
        fetchTable('suppliers'),
        fetchTable('system_settings'),
        fetchTable('shifts'),
        fetchTable('drawer_transactions'),
        fetchTable('orders'),
        fetchTable('held_orders'),
        fetchTable('customers'),
        fetchTable('inventory_movements'),
        fetchTable('expenses'),
        fetchTable('purchases'),
        fetchTable('stock_requests'),
        fetchTable('employees'),
        fetchTable('attendance'),
        fetchTable('employee_payments'),
        fetchTable('rate_histories'),
        fetchTable('loyalty_histories'),
        fetchTable('printers'),
        fetchTable('printer_jobs'),
        fetchTable('audit_logs'),
        fetchTable('app_counters'),
      ]);

      if (users) this.db.users = users;
      if (terminals) this.db.terminals = terminals;
      if (stations) this.db.stations = stations;
      if (categories) this.db.categories = categories;
      if (modifierGroups) this.db.modifierGroups = modifierGroups;
      if (products) this.db.products = products;
      if (ingredients) this.db.ingredients = ingredients;
      if (recipes) this.db.recipes = recipes;
      if (suppliers) this.db.suppliers = suppliers;
      if (settingsRows && settingsRows.length > 0) {
        this.db.settings = normalizeSystemSettingsFromSupabase(settingsRows[0], this.db.settings);
      }
      if (shifts) {
        this.db.shifts = shifts;
        this.db.activeShift = shifts.find((s: CashierShift) => s.status === 'OPEN') || null;
      }
      if (drawerTransactions) this.db.drawerTransactions = drawerTransactions;
      if (orders) this.db.orders = orders;
      if (heldOrders) this.db.heldOrders = heldOrders;
      if (customers) this.db.customers = customers;
      if (inventoryMovements) this.db.inventoryMovements = inventoryMovements;
      if (expenses) this.db.expenses = expenses;
      if (purchases) this.db.purchases = purchases;
      if (stockRequests) this.db.stockRequests = stockRequests;
      if (employees) this.db.employees = employees;
      if (attendance) this.db.attendance = attendance;
      if (employeePayments) this.db.employeePayments = employeePayments;
      if (rateHistories) this.db.rateHistories = rateHistories;
      if (loyaltyHistories) this.db.loyaltyHistories = loyaltyHistories;
      if (printers) this.db.printers = printers;
      if (printerJobs) this.db.printerJobs = printerJobs;
      if (auditLogs) this.db.auditLogs = auditLogs;

      if (counters && counters.length > 0) {
        const orderCounter = counters.find((c: any) => c.id === 'order_number');
        const holdCounter = counters.find((c: any) => c.id === 'hold_number');
        if (orderCounter) this.db.nextOrderNumber = Number(orderCounter.value) || this.db.nextOrderNumber;
        if (holdCounter) this.db.nextHoldNumber = Number(holdCounter.value) || this.db.nextHoldNumber;
      }

      this.isSupabaseInitialized = true;
      this.saveDatabase(this.db, false);
      this.notifyListeners();
    } catch (err) {
      console.error('Error fetching initial data from Supabase:', err);
    }
  }

  /**
   * Listen to real-time events from Supabase Realtime channel
   */
  private setupRealtimeSubscription(): void {
    try {
      const channelName = 'supabase-realtime-full-sync';
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}` || c.topic === channelName);
      if (existing) {
        supabase.removeChannel(existing);
      }

      supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          this.handleRealtimeChange(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Connected to Supabase Realtime database sync channel');
          }
        });
    } catch (err) {
      console.warn('Could not establish Supabase Realtime channel:', err);
    }
  }

  private handleRealtimeChange(payload: any): void {
    const { table, eventType, new: newRecord, old: oldRecord } = payload;
    const schemaKey = TABLE_TO_SCHEMA[table];
    if (!schemaKey) return;

    this.isSyncingFromRemote = true;

    if (schemaKey === 'settings') {
      if (newRecord) {
        this.db.settings = normalizeSystemSettingsFromSupabase(newRecord, this.db.settings);
        this.saveDatabase(this.db, false);
        this.notifyListeners();
      }
      this.isSyncingFromRemote = false;
      return;
    }

    const list = (this.db[schemaKey] as any[]) || [];

    if (eventType === 'INSERT' && newRecord) {
      const exists = list.some((i: any) => i.id === newRecord.id);
      if (!exists) {
        (this.db[schemaKey] as any) = [newRecord, ...list];
        if (schemaKey === 'shifts' && newRecord.status === 'OPEN') {
          this.db.activeShift = newRecord;
        }
        this.notifyListeners();
      }
    } else if (eventType === 'UPDATE' && newRecord) {
      (this.db[schemaKey] as any) = list.map((item: any) =>
        item.id === newRecord.id ? { ...item, ...newRecord } : item
      );
      if (schemaKey === 'shifts') {
        this.db.activeShift = (this.db.shifts as CashierShift[]).find((s) => s.status === 'OPEN') || null;
      }
      this.notifyListeners();
    } else if (eventType === 'DELETE' && oldRecord && oldRecord.id) {
      (this.db[schemaKey] as any) = list.filter((item: any) => item.id !== oldRecord.id);
      if (schemaKey === 'shifts' && this.db.activeShift?.id === oldRecord.id) {
        this.db.activeShift = null;
      }
      this.notifyListeners();
    }

    this.saveDatabase(this.db, false);
    this.isSyncingFromRemote = false;
  }

  /**
   * Push modified records to Supabase tables in the background
   */
  private async syncCollectionToSupabase<K extends keyof DatabaseSchema>(
    key: K,
    prevVal: any,
    newVal: any
  ): Promise<void> {
    const tableName = SCHEMA_TO_TABLE[key as string];
    if (!tableName) return;

    try {
      if (key === 'settings') {
        const payload = sanitizeSystemSettingsForSupabase(newVal);
        const { error: settingsErr } = await supabase.from('system_settings').upsert(payload);
        if (settingsErr) {
          console.error('CRITICAL: Error syncing settings to Supabase system_settings:', settingsErr);
        }
        return;
      }

      if (Array.isArray(newVal)) {
        const prevArr = Array.isArray(prevVal) ? prevVal : [];
        const prevMap = new Map<string, any>(prevArr.map((item: any) => [item.id, item]));
        const newMap = new Map<string, any>(newVal.map((item: any) => [item.id, item]));

        // 1. Identify newly added or modified items
        const toUpsert: any[] = [];
        for (const item of newVal) {
          if (!item || !item.id) continue;
          const prev = prevMap.get(item.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
            toUpsert.push(item);
          }
        }

        // 2. Identify deleted items
        const toDeleteIds: string[] = [];
        for (const item of prevArr) {
          if (item && item.id && !newMap.has(item.id)) {
            toDeleteIds.push(item.id);
          }
        }

        if (toUpsert.length > 0) {
          for (let i = 0; i < toUpsert.length; i += 50) {
            const chunk = toUpsert.slice(i, i + 50);
            const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: 'id' });
            if (error) {
              console.error(`Supabase upsert error on ${tableName}:`, error);
            }
          }
        }

        if (toDeleteIds.length > 0) {
          const { error } = await supabase.from(tableName).delete().in('id', toDeleteIds);
          if (error) {
            console.error(`Supabase delete error on ${tableName}:`, error);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to sync ${String(key)} to Supabase:`, err);
    }
  }

  public syncFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw !== this.lastStorageString) {
        this.isSyncingFromRemote = true;
        this.lastStorageString = raw;
        const parsed = JSON.parse(raw);
        if (parsed.printers && Array.isArray(parsed.printers)) {
          parsed.printers = parsed.printers.filter(
            (p: any) =>
              p &&
              p.name &&
              p.name !== 'Thermal Printer' &&
              p.name !== 'New Thermal Printer' &&
              p.name !== 'USB Printer Port' &&
              p.name !== 'Generic / Text Only' &&
              !p.id?.startsWith('prn_receipt_80mm') &&
              !p.id?.startsWith('prn_kitchen_80mm') &&
              !p.id?.startsWith('prn_bar_80mm') &&
              !p.id?.startsWith('prn_dessert_80mm')
          );
        }
        this.db = {
          ...INITIAL_DATABASE,
          ...parsed,
        };
        this.notifyListeners();
        this.isSyncingFromRemote = false;
      }
    } catch (e) {
      console.error('Error syncing from storage', e);
      this.isSyncingFromRemote = false;
    }
  }

  private loadDatabase(): DatabaseSchema {
    if (typeof window === 'undefined') {
      return { ...INITIAL_DATABASE };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const freshDb: DatabaseSchema = { ...INITIAL_DATABASE };
        this.lastStorageString = JSON.stringify(freshDb);
        this.saveDatabase(freshDb, false);
        return freshDb;
      }

      this.lastStorageString = raw;
      const parsed = JSON.parse(raw);

      const combined: DatabaseSchema = {
        ...INITIAL_DATABASE,
        ...parsed,
        settings: {
          ...INITIAL_DATABASE.settings,
          ...(parsed.settings || {}),
        },
      };

      // Automatically purge any legacy mock/placeholder dummy printers
      if (combined.printers && Array.isArray(combined.printers)) {
        combined.printers = combined.printers.filter(
          (p) =>
            p &&
            p.name &&
            p.name !== 'Thermal Printer' &&
            p.name !== 'New Thermal Printer' &&
            p.name !== 'USB Printer Port' &&
            p.name !== 'Generic / Text Only' &&
            !p.id?.startsWith('prn_receipt_80mm') &&
            !p.id?.startsWith('prn_kitchen_80mm') &&
            !p.id?.startsWith('prn_bar_80mm') &&
            !p.id?.startsWith('prn_dessert_80mm')
        );
      }

      // Auto-migrate legacy employee.attendanceRecords to separate attendance table if empty
      if (
        (!combined.attendance || combined.attendance.length === 0) &&
        combined.employees &&
        combined.employees.length > 0
      ) {
        const migrated: AttendanceRecord[] = [];
        combined.employees.forEach((emp: any) => {
          if (emp.attendanceRecords) {
            Object.entries(emp.attendanceRecords).forEach(([dateStr, rec]: [string, any]) => {
              migrated.push({
                id: `att_${emp.id}_${dateStr}`,
                employeeId: emp.id,
                employeeName: emp.name,
                date: dateStr,
                status: rec.status,
                standardShiftHours: rec.standardShiftHours,
                overtimeHours: rec.overtimeHours,
                checkInTime: rec.checkInTime,
                checkInSignature: rec.checkInSignature,
                checkOutTime: rec.checkOutTime,
                checkOutSignature: rec.checkOutSignature,
                workedHours: rec.workedHours,
                earlyLeaveHours: rec.earlyLeaveHours,
                isLate: rec.isLate,
                lateMinutes: rec.lateMinutes,
                isEarlyLeave: rec.isEarlyLeave,
                earlyMinutes: rec.earlyMinutes,
                notes: rec.notes,
                createdAt: new Date().toISOString(),
              });
            });
          }
        });
        if (migrated.length > 0) {
          combined.attendance = migrated;
        }
      }

      return combined;
    } catch (e) {
      console.error('Failed to load database from localStorage, resetting to clean default', e);
      return { ...INITIAL_DATABASE };
    }
  }

  private saveDatabase(data: DatabaseSchema, broadcast: boolean = true): void {
    if (typeof window === 'undefined') return;
    try {
      const serialized = JSON.stringify(data);
      this.lastStorageString = serialized;
      localStorage.setItem(STORAGE_KEY, serialized);
      this.notifyListeners();
      if (broadcast && !this.isSyncingFromRemote) {
        realtimeSocketService.emitDatabaseSync();
      }
    } catch (e) {
      console.error('Failed to persist database to localStorage', e);
    }
  }

  public getSnapshot(): DatabaseSchema {
    return this.db;
  }

  public update<K extends keyof DatabaseSchema>(
    key: K,
    updater: (current: DatabaseSchema[K]) => DatabaseSchema[K]
  ): DatabaseSchema[K] {
    const prevVal = this.db[key];
    const updatedValue = updater(this.db[key]);
    this.db = {
      ...this.db,
      [key]: updatedValue,
    };
    this.saveDatabase(this.db);

    // Sync to Supabase in background
    this.syncCollectionToSupabase(key, prevVal, updatedValue);

    return updatedValue;
  }

  public mutate(mutator: (draft: DatabaseSchema) => void): DatabaseSchema {
    const prevSnapshot = JSON.parse(JSON.stringify(this.db)) as DatabaseSchema;
    const draft = JSON.parse(JSON.stringify(this.db)) as DatabaseSchema;
    mutator(draft);
    this.db = draft;
    this.saveDatabase(this.db);

    // Sync any modified collections to Supabase in background
    (Object.keys(SCHEMA_TO_TABLE) as (keyof DatabaseSchema)[]).forEach((key) => {
      if (JSON.stringify(prevSnapshot[key]) !== JSON.stringify(draft[key])) {
        this.syncCollectionToSupabase(key, prevSnapshot[key], draft[key]);
      }
    });

    if (prevSnapshot.nextOrderNumber !== draft.nextOrderNumber) {
      supabase
        .from('app_counters')
        .upsert({ id: 'order_number', value: draft.nextOrderNumber, updatedAt: new Date().toISOString() });
    }
    if (prevSnapshot.nextHoldNumber !== draft.nextHoldNumber) {
      supabase
        .from('app_counters')
        .upsert({ id: 'hold_number', value: draft.nextHoldNumber, updatedAt: new Date().toISOString() });
    }

    return this.db;
  }

  public reset(): void {
    this.db = JSON.parse(JSON.stringify(INITIAL_DATABASE));
    this.saveDatabase(this.db);
  }

  public seedDummyData(): void {
    // Mock seed data removed
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in db listener', err);
      }
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DB_CHANGE_EVENT));
    }
  }
}

export const db = new DatabaseManager();
