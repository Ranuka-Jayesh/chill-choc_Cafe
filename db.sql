-- ============================================================================
-- CHILL & CHOC CAFÉ MANAGEMENT SYSTEM (CafeMM)
-- Complete Supabase Database Schema & Initial Seed Data
-- ============================================================================
-- Features:
--   1. No Supabase Auth required (Custom PIN & role-based authentication)
--   2. No UUIDs used (Clean text-based IDs matching TypeScript models)
--   3. Unrestricted Public RLS Policies for anon, authenticated & service_role
--   4. Compatible with Supabase PostgREST JS client and frontend models
--   5. Full initial seed data included for immediate plug-and-play operation
--   6. Supabase Realtime publication enabled for live data sync
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & SCHEMA PREPARATION
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS public;

-- Grant broad schema permissions to allow anon API queries
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. SYSTEM SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_settings (
    "id" TEXT PRIMARY KEY DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'Chill & Choc',
    "tagline" TEXT DEFAULT 'Cool Vibes, Sweet Bites',
    "address" TEXT DEFAULT 'No. 42, Galle Road, Colombo 03, Sri Lanka',
    "phone" TEXT DEFAULT '+94 11 234 5678',
    "email" TEXT DEFAULT 'hello@chillandchoc.lk',
    "currencyCode" TEXT DEFAULT 'LKR',
    "currencySymbol" TEXT DEFAULT 'Rs.',
    "decimalPlaces" INT DEFAULT 2,
    "taxRatePercent" NUMERIC DEFAULT 0,
    "serviceChargePercent" NUMERIC DEFAULT 0,
    "receiptHeader" TEXT,
    "receiptFooter" TEXT,
    "autoPrintReceipt" BOOLEAN DEFAULT true,
    "autoPrintKOT" BOOLEAN DEFAULT true,
    "receiptCopies" INT DEFAULT 1,
    "receiptCustomization" JSONB DEFAULT '{}'::jsonb,
    "kotCustomization" JSONB DEFAULT '{}'::jsonb,
    "defaultOvertimeHourlyRateCents" BIGINT DEFAULT 45000,
    "defaultLeaveDailyRateCents" BIGINT DEFAULT 250000,
    "overtimeCalculationMode" TEXT DEFAULT 'FIXED_HOURLY',
    "overtimeMultiplier" NUMERIC DEFAULT 1.5,
    "standardWorkHoursPerDay" NUMERIC DEFAULT 8,
    "workingDaysPerMonth" INT DEFAULT 26,
    "shiftStartTime" TEXT DEFAULT '08:30',
    "shiftEndTime" TEXT DEFAULT '17:30',
    "lateGraceMinutes" INT DEFAULT 15,
    "leavePolicyNote" TEXT,
    "requireOpeningCash" BOOLEAN DEFAULT true,
    "blindShiftClose" BOOLEAN DEFAULT true,
    "varianceReasonThresholdCents" BIGINT DEFAULT 10000,
    "requireReasonForCashOut" BOOLEAN DEFAULT true,
    "allowCashierManualCashIn" BOOLEAN DEFAULT true,
    "allowCashierManualCashOut" BOOLEAN DEFAULT true,
    "openDrawerAfterCashSale" BOOLEAN DEFAULT true,
    "defaultTerminalId" TEXT DEFAULT 'term_01',
    "loyaltyProgramEnabled" BOOLEAN DEFAULT true,
    "loyaltyProgramName" TEXT DEFAULT 'Chill Club Rewards',
    "loyaltySpendPerPointCents" BIGINT DEFAULT 10000,
    "loyaltyMinSpendToEarnCents" BIGINT DEFAULT 20000,
    "loyaltyPointRedemptionValueCents" BIGINT DEFAULT 100,
    "loyaltyMinPointsToRedeem" INT DEFAULT 50,
    "loyaltyMaxRedemptionPercentPerOrder" NUMERIC DEFAULT 50,
    "loyaltySignupBonusPoints" INT DEFAULT 25,
    "loyaltyBirthdayBonusPoints" INT DEFAULT 50,
    "loyaltyPointsExpiryDays" INT DEFAULT 365,
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. APP COUNTERS TABLE (Order numbers, Hold numbers, Sequences)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_counters (
    "id" TEXT PRIMARY KEY,
    "value" BIGINT NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. USERS & CASHIERS TABLE (Custom Authentication, No Supabase Auth needed)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL UNIQUE,
    "role" TEXT NOT NULL DEFAULT 'CASHIER', -- 'ADMIN' | 'CASHIER'
    "pin" TEXT NOT NULL,
    "avatar" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. POS TERMINALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminals (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. PREPARATION STATIONS (Bar, Dessert, Hot Kitchen)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stations (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "printerName" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. PRODUCT CATEGORIES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Coffee',
    "image" TEXT,
    "displayOrder" INT NOT NULL DEFAULT 0,
    "preparationStationId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. MODIFIER GROUPS (Sizes, Milks, Syrups, Toppings, Preferences)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.modifier_groups (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "multiSelect" BOOLEAN NOT NULL DEFAULT false,
    "minSelections" INT NOT NULL DEFAULT 0,
    "maxSelections" INT NOT NULL DEFAULT 1,
    "options" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 9. SUPPLIERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "providedItems" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 10. RAW INVENTORY INGREDIENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingredients (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kg', -- 'g' | 'kg' | 'ml' | 'L' | 'pcs'
    "currentStock" NUMERIC NOT NULL DEFAULT 0,
    "reorderLevel" NUMERIC NOT NULL DEFAULT 0,
    "averageCostCents" BIGINT NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiryDate" TEXT,
    "lastRestockedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 11. PRODUCTS CATALOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT,
    "image" TEXT,
    "basePriceCents" BIGINT NOT NULL DEFAULT 0,
    "costPriceCents" BIGINT NOT NULL DEFAULT 0,
    "preparationStationId" TEXT,
    "modifierGroupIds" JSONB DEFAULT '[]'::jsonb,
    "customModifiers" JSONB DEFAULT '[]'::jsonb,
    "taxRate" NUMERIC DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSoldOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 12. PRODUCT RECIPES (BOM - Bill of Materials for Auto Inventory Deduction)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 13. CASHIER SHIFTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
    "id" TEXT PRIMARY KEY,
    "shiftNumber" INT NOT NULL DEFAULT 1,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "terminalName" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "closedAt" TIMESTAMPTZ,
    "openingCash" BIGINT NOT NULL DEFAULT 0,
    "closingCashEntered" BIGINT,
    "expectedClosingCash" BIGINT,
    "cashSales" BIGINT NOT NULL DEFAULT 0,
    "cardSales" BIGINT NOT NULL DEFAULT 0,
    "qrSales" BIGINT NOT NULL DEFAULT 0,
    "cashIn" BIGINT NOT NULL DEFAULT 0,
    "cashOut" BIGINT NOT NULL DEFAULT 0,
    "cashRefunds" BIGINT NOT NULL DEFAULT 0,
    "cashDrops" BIGINT NOT NULL DEFAULT 0,
    "variance" BIGINT,
    "varianceStatus" TEXT, -- 'BALANCED' | 'SHORT' | 'OVER'
    "closingNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN' | 'CLOSED'
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 14. CASH DRAWER TRANSACTIONS (Cash In, Cash Out, Float, Sale, Refund)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drawer_transactions (
    "id" TEXT PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- 'OPENING_CASH' | 'CASH_SALE' | 'CASH_REFUND' | 'CASH_IN' | 'CASH_OUT' | 'CASH_DROP' | 'CLOSING_ADJUSTMENT'
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "reason" TEXT,
    "expenseCategory" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "status" TEXT DEFAULT 'APPROVED', -- 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED'
    "approvedByUserId" TEXT,
    "approvedByUserName" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 15. ORDERS TABLE (POS Orders, Items, Payments, Refunds)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    "id" TEXT PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "numericOrderNum" BIGINT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL DEFAULT 'DINE_IN', -- 'DINE_IN' | 'TAKEAWAY'
    "tableNumber" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "loyaltyPointsEarned" INT DEFAULT 0,
    "loyaltyPointsRedeemed" INT DEFAULT 0,
    "loyaltyDiscountCents" BIGINT DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED', -- 'DRAFT' | 'PLACED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
    "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "subtotalCents" BIGINT NOT NULL DEFAULT 0,
    "discountCents" BIGINT NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "discountPercent" NUMERIC DEFAULT 0,
    "serviceChargeCents" BIGINT NOT NULL DEFAULT 0,
    "taxCents" BIGINT NOT NULL DEFAULT 0,
    "totalCents" BIGINT NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH', -- 'CASH' | 'CARD' | 'QR' | 'SPLIT'
    "paymentSplits" JSONB DEFAULT '[]'::jsonb,
    "cashReceivedCents" BIGINT,
    "changeGivenCents" BIGINT,
    "cardReference" TEXT,
    "qrReference" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "kotPrinted" BOOLEAN NOT NULL DEFAULT false,
    "receiptPrinted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "completedAt" TIMESTAMPTZ,
    "refundedAmountCents" BIGINT DEFAULT 0,
    "refundReason" TEXT,
    "refundStatus" TEXT DEFAULT 'NONE',
    "refundRequest" JSONB,
    "refundApproval" JSONB,
    "refundRejection" JSONB
);

-- ----------------------------------------------------------------------------
-- 16. HELD ORDERS TABLE (Parked / Suspended Orders)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.held_orders (
    "id" TEXT PRIMARY KEY,
    "holdNumber" INT NOT NULL,
    "holdLabel" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "tableNumber" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "subtotalCents" BIGINT NOT NULL DEFAULT 0,
    "discountCents" BIGINT NOT NULL DEFAULT 0,
    "discountPercent" NUMERIC DEFAULT 0,
    "discountReason" TEXT,
    "serviceChargeCents" BIGINT NOT NULL DEFAULT 0,
    "taxCents" BIGINT NOT NULL DEFAULT 0,
    "totalCents" BIGINT NOT NULL DEFAULT 0,
    "heldAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "heldByCashierId" TEXT NOT NULL,
    "heldByCashierName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 17. CUSTOMERS & LOYALTY CRM
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL UNIQUE, -- e.g. 'CUST-1001'
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "birthday" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'BRONZE', -- 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
    "points" INT NOT NULL DEFAULT 0,
    "totalSpentCents" BIGINT NOT NULL DEFAULT 0,
    "totalOrders" INT NOT NULL DEFAULT 0,
    "lastVisit" TIMESTAMPTZ,
    "notes" TEXT,
    "pointHistory" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 18. CUSTOMER POINT HISTORY TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_point_history (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- 'EARNED' | 'REDEEMED' | 'SIGNUP_BONUS' | 'BIRTHDAY_BONUS' | 'MANUAL_ADJUST'
    "points" INT NOT NULL,
    "balanceAfter" INT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "amountCents" BIGINT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 19. INVENTORY MOVEMENTS (Stock Log: Purchase, Consumption, Waste, Return)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    "id" TEXT PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "ingredientName" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- 'PURCHASE' | 'SALE_CONSUMPTION' | 'WASTE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN'
    "quantity" NUMERIC NOT NULL,
    "unit" TEXT NOT NULL,
    "costCents" BIGINT NOT NULL DEFAULT 0,
    "reason" TEXT,
    "referenceId" TEXT,
    "expiryDate" TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 20. EXPENSES TABLE (Petty Cash, Cleaning, Milk, Utilities)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    "id" TEXT PRIMARY KEY,
    "category" TEXT NOT NULL, -- 'EMERGENCY_MILK' | 'CLEANING' | 'DELIVERY' | 'MAINTENANCE' | 'UTILITIES' | 'PETTY_CASH' | 'OTHER'
    "title" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "paidViaDrawer" BOOLEAN NOT NULL DEFAULT true,
    "shiftId" TEXT,
    "cashierId" TEXT,
    "cashierName" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 21. PURCHASES TABLE (Supplier Goods Received Notes & POs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
    "id" TEXT PRIMARY KEY,
    "purchaseNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "purchaseDate" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "status" TEXT NOT NULL DEFAULT 'RECEIVED', -- 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
    "paymentStatus" TEXT DEFAULT 'PAID', -- 'PAID' | 'PARTIAL' | 'UNPAID'
    "subtotalCents" BIGINT NOT NULL DEFAULT 0,
    "discountCents" BIGINT NOT NULL DEFAULT 0,
    "totalCents" BIGINT NOT NULL DEFAULT 0,
    "paidCents" BIGINT DEFAULT 0,
    "dueCents" BIGINT DEFAULT 0,
    "dueDate" TEXT,
    "payments" JSONB DEFAULT '[]'::jsonb,
    "items" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "notes" TEXT,
    "receivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 22. STOCK REQUESTS TABLE (Staff requests for adjustments or deliveries)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_requests (
    "id" TEXT PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- 'STOCK_ADJUSTMENT' | 'STOCK_DELIVERY'
    "ingredientId" TEXT,
    "ingredientName" TEXT NOT NULL,
    "sku" TEXT,
    "currentStock" NUMERIC NOT NULL DEFAULT 0,
    "requestedStock" NUMERIC,
    "quantityChange" NUMERIC NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "costCents" BIGINT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "invoiceNumber" TEXT,
    "expiryDate" TEXT,
    "reason" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByUserName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "resolvedAt" TIMESTAMPTZ,
    "resolvedByUserId" TEXT,
    "resolvedByUserName" TEXT,
    "rejectionReason" TEXT,
    "items" JSONB DEFAULT '[]'::jsonb,
    "totalCents" BIGINT,
    "paidCents" BIGINT,
    "dueCents" BIGINT,
    "paymentStatus" TEXT,
    "payments" JSONB DEFAULT '[]'::jsonb,
    "duePaymentDate" TEXT,
    "notes" TEXT
);

-- ----------------------------------------------------------------------------
-- 23. EMPLOYEES & STAFF TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "nic" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "baseSalaryCents" BIGINT NOT NULL DEFAULT 0,
    "payFrequency" TEXT NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY' | 'WEEKLY' | 'HOURLY'
    "overtimeHourlyRateCents" BIGINT,
    "leaveDailyRateCents" BIGINT,
    "standardHoursPerDay" NUMERIC DEFAULT 8,
    "shiftStartTime" TEXT DEFAULT '08:30',
    "shiftEndTime" TEXT DEFAULT '17:30',
    "attendedDays" INT DEFAULT 0,
    "attendanceRecords" JSONB DEFAULT '{}'::jsonb,
    "salaryPayDay" TEXT,
    "salaryDate" TEXT,
    "joinDate" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "bankBranch" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 24. EMPLOYEE PAYMENTS (Salaries, Advances, Overtime, Bonuses)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_payments (
    "id" TEXT PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "paymentType" TEXT NOT NULL, -- 'SALARY' | 'ADVANCE' | 'BONUS' | 'OVERTIME'
    "method" TEXT NOT NULL DEFAULT 'CASH', -- 'CASH' | 'CARD' | 'CHEQUE'
    "date" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "baseSalaryAmountCents" BIGINT,
    "overtimeAmountCents" BIGINT,
    "overtimeHours" NUMERIC,
    "bonusAmountCents" BIGINT,
    "bonusReason" TEXT,
    "deductionAmountCents" BIGINT,
    "deductionReason" TEXT,
    "chequeNumber" TEXT,
    "bankName" TEXT,
    "chequeDate" TEXT,
    "notes" TEXT,
    "referenceNumber" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 25. EMPLOYEE RATE HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_histories (
    "id" TEXT PRIMARY KEY,
    "employeeId" TEXT DEFAULT 'GLOBAL',
    "employeeName" TEXT NOT NULL DEFAULT 'Global Policy (All Staff)',
    "rateType" TEXT NOT NULL, -- 'OVERTIME' | 'LEAVE' | 'BASE_SALARY' | 'STANDARD_HOURS' | 'ALL'
    "previousOvertimeRateCents" BIGINT,
    "newOvertimeRateCents" BIGINT,
    "previousLeaveRateCents" BIGINT,
    "newLeaveRateCents" BIGINT,
    "previousBaseSalaryCents" BIGINT,
    "newBaseSalaryCents" BIGINT,
    "previousStandardHoursPerDay" NUMERIC,
    "newStandardHoursPerDay" NUMERIC,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "effectiveDate" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 26. LOYALTY SETTING HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_histories (
    "id" TEXT PRIMARY KEY,
    "changeType" TEXT NOT NULL, -- 'ALL' | 'PROGRAM_CONFIG' | 'EARNING_RATE' | 'REDEMPTION_VALUE' | 'BONUS_RULES' | 'VALIDITY_LIMITS'
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "previousSpendPerPointCents" BIGINT,
    "newSpendPerPointCents" BIGINT,
    "previousRedemptionValueCents" BIGINT,
    "newRedemptionValueCents" BIGINT,
    "previousMinSpendToEarnCents" BIGINT,
    "newMinSpendToEarnCents" BIGINT,
    "previousMinPointsToRedeem" INT,
    "newMinPointsToRedeem" INT,
    "previousMaxRedemptionPercent" NUMERIC,
    "newMaxRedemptionPercent" NUMERIC,
    "previousSignupBonusPoints" INT,
    "newSignupBonusPoints" INT,
    "previousBirthdayBonusPoints" INT,
    "newBirthdayBonusPoints" INT,
    "previousPointsExpiryDays" INT,
    "newPointsExpiryDays" INT,
    "previousProgramName" TEXT,
    "newProgramName" TEXT,
    "previousProgramEnabled" BOOLEAN,
    "newProgramEnabled" BOOLEAN,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 27. HARDWARE PRINTERS CONFIGURATION
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.printers (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL, -- 'RECEIPT' | 'KITCHEN_KOT' | 'BAR_KOT' | 'DESSERT_KOT' | 'REPORT'
    "connectionType" TEXT NOT NULL, -- 'LAN_IP' | 'USB' | 'BLUETOOTH' | 'BROWSER_DRIVER'
    "address" TEXT NOT NULL,
    "paperWidthMm" INT NOT NULL DEFAULT 80, -- 58 | 80
    "autoCut" BOOLEAN NOT NULL DEFAULT true,
    "drawerKickRJ12" BOOLEAN NOT NULL DEFAULT false,
    "beepOnPrint" BOOLEAN NOT NULL DEFAULT false,
    "copies" INT NOT NULL DEFAULT 1,
    "stationId" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "isDefaultReceipt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 28. PRINTER JOBS QUEUE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.printer_jobs (
    "id" TEXT PRIMARY KEY,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "printerId" TEXT NOT NULL,
    "printerName" TEXT NOT NULL,
    "stationId" TEXT,
    "type" TEXT NOT NULL, -- 'KOT' | 'CUSTOMER_RECEIPT' | 'SHIFT_REPORT' | 'DAILY_REPORT' | 'TEST_PRINT'
    "status" TEXT NOT NULL DEFAULT 'QUEUED', -- 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED'
    "attempts" INT NOT NULL DEFAULT 0,
    "payloadText" TEXT NOT NULL DEFAULT '',
    "formattedThermalLines" JSONB DEFAULT '[]'::jsonb,
    "error" TEXT,
    "printedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 29. SYSTEM AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "details" TEXT,
    "terminalId" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 30. COMPATIBILITY VIEWS (Supports both camelCase and snake_case references)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public."modifierGroups" AS SELECT * FROM public.modifier_groups;
CREATE OR REPLACE VIEW public."drawerTransactions" AS SELECT * FROM public.drawer_transactions;
CREATE OR REPLACE VIEW public."heldOrders" AS SELECT * FROM public.held_orders;
CREATE OR REPLACE VIEW public."customerPointHistory" AS SELECT * FROM public.customer_point_history;
CREATE OR REPLACE VIEW public."inventoryMovements" AS SELECT * FROM public.inventory_movements;
CREATE OR REPLACE VIEW public."stockRequests" AS SELECT * FROM public.stock_requests;
CREATE OR REPLACE VIEW public."employeePayments" AS SELECT * FROM public.employee_payments;
CREATE OR REPLACE VIEW public."rateHistories" AS SELECT * FROM public.rate_histories;
CREATE OR REPLACE VIEW public."loyaltyHistories" AS SELECT * FROM public.loyalty_histories;
CREATE OR REPLACE VIEW public."printerJobs" AS SELECT * FROM public.printer_jobs;
CREATE OR REPLACE VIEW public."auditLogs" AS SELECT * FROM public.audit_logs;
CREATE OR REPLACE VIEW public."systemSettings" AS SELECT * FROM public.system_settings;
CREATE OR REPLACE VIEW public."appCounters" AS SELECT * FROM public.app_counters;

-- ----------------------------------------------------------------------------
-- 31. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_shiftId ON public.orders ("shiftId");
CREATE INDEX IF NOT EXISTS idx_orders_cashierId ON public.orders ("cashierId");
CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON public.orders ("createdAt");
CREATE INDEX IF NOT EXISTS idx_orders_orderNumber ON public.orders ("orderNumber");
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders ("status");

CREATE INDEX IF NOT EXISTS idx_shifts_businessDate ON public.shifts ("businessDate");
CREATE INDEX IF NOT EXISTS idx_shifts_cashierId ON public.shifts ("cashierId");
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts ("status");

CREATE INDEX IF NOT EXISTS idx_drawer_transactions_shiftId ON public.drawer_transactions ("shiftId");
CREATE INDEX IF NOT EXISTS idx_drawer_transactions_timestamp ON public.drawer_transactions ("timestamp");

CREATE INDEX IF NOT EXISTS idx_inventory_movements_ingredientId ON public.inventory_movements ("ingredientId");
CREATE INDEX IF NOT EXISTS idx_inventory_movements_timestamp ON public.inventory_movements ("timestamp");

CREATE INDEX IF NOT EXISTS idx_customer_point_history_customerId ON public.customer_point_history ("customerId");
CREATE INDEX IF NOT EXISTS idx_employee_payments_employeeId ON public.employee_payments ("employeeId");
CREATE INDEX IF NOT EXISTS idx_expenses_shiftId ON public.expenses ("shiftId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs ("timestamp");
CREATE INDEX IF NOT EXISTS idx_printer_jobs_status ON public.printer_jobs ("status");

-- ----------------------------------------------------------------------------
-- 32. ENABLE ROW LEVEL SECURITY (RLS) WITH UNRESTRICTED PUBLIC POLICIES
--     (Ensures Supabase security checks pass while giving 100% public access)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'system_settings', 'app_counters', 'users', 'terminals', 'stations',
        'categories', 'modifier_groups', 'suppliers', 'ingredients', 'products',
        'recipes', 'shifts', 'drawer_transactions', 'orders', 'held_orders',
        'customers', 'customer_point_history', 'inventory_movements', 'expenses',
        'purchases', 'stock_requests', 'employees', 'employee_payments',
        'rate_histories', 'loyalty_histories', 'printers', 'printer_jobs', 'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "public_unrestricted_policy" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "public_unrestricted_policy" ON public.%I FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

-- Grant permissions to anon, authenticated and service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 33. ENABLE SUPABASE REALTIME REPLICATION (Instant multi-device live sync)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    tbl text;
    realtime_tables text[] := ARRAY[
        'orders', 'shifts', 'drawer_transactions', 'inventory_movements',
        'stock_requests', 'held_orders', 'ingredients', 'products',
        'customers', 'printer_jobs', 'expenses', 'audit_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY realtime_tables LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN OTHERS THEN NULL;
        END;
    END LOOP;
END $$;


-- ============================================================================
-- 34. COMPLETE INITIAL SEED DATA
--     (Pre-populates the entire system with users, catalog, settings, & demo data)
-- ============================================================================

-- 1. System Settings
INSERT INTO public.system_settings (
    "id", "businessName", "tagline", "address", "phone", "email",
    "currencyCode", "currencySymbol", "decimalPlaces", "taxRatePercent", "serviceChargePercent",
    "receiptHeader", "receiptFooter", "autoPrintReceipt", "autoPrintKOT", "receiptCopies",
    "receiptCustomization", "kotCustomization",
    "defaultOvertimeHourlyRateCents", "defaultLeaveDailyRateCents", "overtimeCalculationMode", "overtimeMultiplier",
    "standardWorkHoursPerDay", "workingDaysPerMonth", "leavePolicyNote",
    "requireOpeningCash", "blindShiftClose", "varianceReasonThresholdCents",
    "requireReasonForCashOut", "allowCashierManualCashIn", "allowCashierManualCashOut",
    "openDrawerAfterCashSale", "defaultTerminalId",
    "loyaltyProgramEnabled", "loyaltyProgramName", "loyaltySpendPerPointCents", "loyaltyMinSpendToEarnCents",
    "loyaltyPointRedemptionValueCents", "loyaltyMinPointsToRedeem", "loyaltyMaxRedemptionPercentPerOrder",
    "loyaltySignupBonusPoints", "loyaltyBirthdayBonusPoints", "loyaltyPointsExpiryDays"
) VALUES (
    'default',
    'Chill & Choc',
    'Cool Vibes, Sweet Bites',
    'No. 42, Galle Road, Colombo 03, Sri Lanka',
    '+94 11 234 5678',
    'hello@chillandchoc.lk',
    'LKR',
    'Rs.',
    2,
    0,
    0,
    'CHILL & CHOC CAFÉ' || E'\n' || 'COOL VIBES, SWEET BITES' || E'\n' || 'Colombo 03, Sri Lanka' || E'\n' || 'Tel: +94 11 234 5678',
    'Thank you for chilling with us!' || E'\n' || 'Please visit us again.' || E'\n' || 'Follow @chillandchoc.lk',
    true,
    true,
    1,
    '{
        "showLogo": true,
        "logoUrl": "/logobg.webp",
        "logoWidthPx": 95,
        "logoAlignment": "center",
        "businessName": "Chill & Choc",
        "tagline": "Cool Vibes, Sweet Bites",
        "address": "No. 42, Galle Road, Colombo 03, Sri Lanka",
        "phone": "+94 11 234 5678",
        "email": "hello@chillandchoc.lk",
        "website": "www.chillandchoc.lk",
        "taxNumber": "VAT-LK-10928374",
        "headerAlignment": "center",
        "dividerStyle": "dashed",
        "paperWidthMm": 80,
        "fontFamily": "mono",
        "fontSize": "normal",
        "showOrderNumber": true,
        "orderNumberPrefix": "Order: #",
        "showOrderType": true,
        "showTableNumber": true,
        "showCashierName": true,
        "showDateTime": true,
        "timeFormat": "12h",
        "showCustomerInfo": true,
        "itemSpacing": "normal",
        "showModifiers": true,
        "showModifierPrices": true,
        "showItemNotes": true,
        "showUnitPrice": false,
        "showSubtotal": true,
        "showDiscount": true,
        "showServiceCharge": true,
        "serviceChargeLabel": "Service Charge (10%)",
        "showTax": false,
        "taxLabel": "VAT (0%)",
        "currencySymbol": "Rs.",
        "showPaymentMethod": true,
        "showCashBreakdown": true,
        "showCardReference": true,
        "receiptFooter": "Thank you for chilling with us!\nPlease visit us again.\nFollow @chillandchoc.lk",
        "showSocialHandle": true,
        "socialHandle": "@chillandchoc.lk",
        "showWifiInfo": false,
        "wifiSsid": "ChillAndChoc_Guest",
        "wifiPassword": "sweetbites2026",
        "showDeveloperCredit": true,
        "developerCreditText": "DEVELOPED BY OGO TECHNOLOGY",
        "developerContact": "www.ogotechnology.net • +94 75 930 7059"
    }'::jsonb,
    '{
        "ticketTitle": "KITCHEN ORDER TICKET",
        "showBrandName": true,
        "brandName": "CHILL & CHOC",
        "showOrderType": true,
        "showTableNumber": true,
        "tableNumberStyle": "prominent",
        "showOrderNumber": true,
        "orderNumberPrefix": "#",
        "showCashierName": true,
        "cashierLabel": "Staff",
        "showDateTime": true,
        "timeFormat": "12h",
        "showModifiers": true,
        "showItemNotes": true,
        "highlightNotes": true,
        "fontSize": "normal",
        "paperWidthMm": 80,
        "dividerStyle": "dashed",
        "showStationRouting": true,
        "stationRoutingText": "Station Routing: BAR / KITCHEN / DESSERT",
        "customNote": ""
    }'::jsonb,
    45000,
    250000,
    'FIXED_HOURLY',
    1.5,
    8,
    26,
    'Standard monthly leave deduction rate: Rs. 2,500.00/day for unpaid absences',
    true,
    true,
    10000,
    true,
    true,
    true,
    true,
    'term_01',
    true,
    'Chill Club Rewards',
    10000,
    20000,
    100,
    50,
    50,
    25,
    50,
    365
) ON CONFLICT ("id") DO UPDATE SET
    "businessName" = EXCLUDED."businessName",
    "updatedAt" = now();

-- 2. App Counters
INSERT INTO public.app_counters ("id", "value") VALUES
    ('order_number', 1055),
    ('hold_number', 1)
ON CONFLICT ("id") DO NOTHING;

-- 3. Users (Chaminda Silva - Admin, Nimal Perera - Cashier)
INSERT INTO public.users ("id", "name", "username", "role", "pin", "avatar", "active", "lastLoginAt") VALUES
    ('usr_admin', 'Chaminda Silva', 'admin', 'ADMIN', '1234', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', true, '2026-08-25T07:00:00.000Z'),
    ('usr_cashier', 'Nimal Perera', 'cashier', 'CASHIER', '1111', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', true, '2026-08-25T08:00:00.000Z')
ON CONFLICT ("id") DO NOTHING;

-- 4. Terminals
INSERT INTO public.terminals ("id", "name", "code", "location", "isActive") VALUES
    ('term_01', 'Main Counter POS-01', 'POS-01', 'Ground Floor Counter', true),
    ('term_02', 'Dessert Bar POS-02', 'POS-02', 'Patio & Dessert Counter', false)
ON CONFLICT ("id") DO NOTHING;

-- 5. Preparation Stations
INSERT INTO public.stations ("id", "name", "code", "printerName") VALUES
    ('st_bar', 'Coffee & Beverage Bar', 'BAR', 'Bar Thermal 80mm'),
    ('st_dessert', 'Dessert & Waffle Station', 'DESSERT', 'Dessert Station 80mm'),
    ('st_kitchen', 'Hot Kitchen & Bites', 'KITCHEN', 'Kitchen Thermal 80mm')
ON CONFLICT ("id") DO NOTHING;

-- 6. Categories
INSERT INTO public.categories ("id", "name", "slug", "icon", "displayOrder", "preparationStationId", "active") VALUES
    ('cat_coffee', 'Coffee', 'coffee', 'Coffee', 1, 'st_bar', true),
    ('cat_cold_drinks', 'Cold Drinks', 'cold-drinks', 'CupSoda', 2, 'st_bar', true),
    ('cat_desserts', 'Desserts', 'desserts', 'Cake', 3, 'st_dessert', true),
    ('cat_ice_cream', 'Ice Cream', 'ice-cream', 'IceCream', 4, 'st_dessert', true),
    ('cat_food', 'Food & Bites', 'food', 'UtensilsCrossed', 5, 'st_kitchen', true),
    ('cat_addons', 'Add-ons', 'addons', 'Sparkles', 6, 'st_bar', true)
ON CONFLICT ("id") DO NOTHING;

-- 7. Modifier Groups
INSERT INTO public.modifier_groups ("id", "name", "required", "multiSelect", "minSelections", "maxSelections", "options") VALUES
    ('mod_size', 'Size', true, false, 1, 1, '[
        {"id": "opt_sz_reg", "name": "Regular (8oz)", "priceCents": 0, "isDefault": true},
        {"id": "opt_sz_med", "name": "Medium (12oz)", "priceCents": 10000},
        {"id": "opt_sz_lrg", "name": "Large (16oz)", "priceCents": 20000}
    ]'::jsonb),
    ('mod_milk', 'Milk Choice', false, false, 0, 1, '[
        {"id": "opt_milk_fresh", "name": "Fresh Milk", "priceCents": 0, "isDefault": true},
        {"id": "opt_milk_oat", "name": "Oat Milk", "priceCents": 15000},
        {"id": "opt_milk_almond", "name": "Almond Milk", "priceCents": 18000},
        {"id": "opt_milk_soy", "name": "Soy Milk", "priceCents": 12000}
    ]'::jsonb),
    ('mod_extras_coffee', 'Coffee Extras', false, true, 0, 4, '[
        {"id": "opt_ext_shot", "name": "Extra Espresso Shot", "priceCents": 20000},
        {"id": "opt_ext_vanilla", "name": "Vanilla Syrup", "priceCents": 10000},
        {"id": "opt_ext_caramel", "name": "Caramel Drizzle", "priceCents": 12000},
        {"id": "opt_ext_whip", "name": "Whipped Cream", "priceCents": 15000}
    ]'::jsonb),
    ('mod_sugar', 'Sweetness', false, false, 0, 1, '[
        {"id": "opt_sug_norm", "name": "Normal Sweet", "priceCents": 0, "isDefault": true},
        {"id": "opt_sug_less", "name": "Less Sweet (50%)", "priceCents": 0},
        {"id": "opt_sug_none", "name": "No Sugar", "priceCents": 0}
    ]'::jsonb),
    ('mod_ice', 'Ice Level', false, false, 0, 1, '[
        {"id": "opt_ice_norm", "name": "Regular Ice", "priceCents": 0, "isDefault": true},
        {"id": "opt_ice_less", "name": "Less Ice", "priceCents": 0},
        {"id": "opt_ice_none", "name": "No Ice", "priceCents": 0}
    ]'::jsonb),
    ('mod_toppings_dessert', 'Dessert Toppings', false, true, 0, 4, '[
        {"id": "opt_top_nutella", "name": "Nutella Drizzle", "priceCents": 25000},
        {"id": "opt_top_gelato", "name": "Vanilla Ice Cream Scoop", "priceCents": 30000},
        {"id": "opt_top_cashew", "name": "Roasted Cashews", "priceCents": 18000},
        {"id": "opt_top_oreo", "name": "Crushed Oreos", "priceCents": 15000}
    ]'::jsonb),
    ('mod_food_options', 'Preferences', false, true, 0, 4, '[
        {"id": "opt_food_cheese", "name": "Extra Cheddar Cheese", "priceCents": 20000},
        {"id": "opt_food_spicy", "name": "Spicy Mayo Dip", "priceCents": 10000},
        {"id": "opt_food_noonion", "name": "No Onion", "priceCents": 0}
    ]'::jsonb)
ON CONFLICT ("id") DO NOTHING;

-- 8. Suppliers
INSERT INTO public.suppliers ("id", "name", "contactPerson", "phone", "email", "address", "active") VALUES
    ('sup_ceylon_coffee', 'Ceylon Coffee Roasters Ltd', 'Rohan Wickramasinghe', '+94 77 123 4567', 'sales@ceyloncoffeeroasters.lk', 'No. 120, Kandy Road, Colombo 03', true),
    ('sup_highland_dairy', 'Highland Pure Dairy LK', 'Sunil Senanayake', '+94 71 456 7890', 'highlandorders@dairy.lk', 'Dairy Way, Nuwara Eliya', true),
    ('sup_choc_lanka', 'Choc & Bakers Supplies Lanka', 'Fathima Razeen', '+94 11 789 0123', 'orders@chocbakers.lk', 'No. 45, Baseline Road, Colombo 09', true),
    ('sup_farm_poultry', 'Fresh Farm Poultry & Agro', 'Janaka Bandara', '+94 77 987 6543', 'janaka@freshfarmagro.lk', 'Agro Zone, Kurunegala', true)
ON CONFLICT ("id") DO NOTHING;

-- 9. Ingredients
INSERT INTO public.ingredients ("id", "name", "sku", "unit", "currentStock", "reorderLevel", "averageCostCents", "supplierId", "expiryDate", "active") VALUES
    ('ing_coffee_beans', 'Arabica Espresso Beans', 'ING-CFB-01', 'kg', 8.25, 3.0, 650000, 'sup_ceylon_coffee', '2026-11-30', true),
    ('ing_fresh_milk', 'Fresh Cow Milk', 'ING-MLK-01', 'L', 24.5, 10.0, 48000, 'sup_highland_dairy', '2026-09-06', true),
    ('ing_oat_milk', 'Barista Oat Milk', 'ING-MLK-02', 'L', 8.0, 4.0, 120000, 'sup_highland_dairy', '2026-10-15', true),
    ('ing_choc_syrup', 'Belgian Chocolate Syrup', 'ING-CHC-01', 'L', 4.2, 2.0, 210000, 'sup_choc_lanka', '2026-12-31', true),
    ('ing_brownie_mix', 'Fudge Brownie Slices', 'ING-BRW-01', 'pcs', 18, 5, 24000, 'sup_choc_lanka', '2026-09-12', true),
    ('ing_waffle_batter', 'Belgian Waffle Batter Mix', 'ING-WAF-01', 'kg', 5.5, 2.0, 110000, 'sup_choc_lanka', '2026-09-20', true),
    ('ing_vanilla_gelato', 'Madagascar Vanilla Gelato', 'ING-ICM-01', 'L', 12.0, 4.0, 140000, 'sup_highland_dairy', '2026-10-25', true),
    ('ing_chicken_breast', 'Marinated Chicken Breast', 'ING-CHK-01', 'kg', 6.8, 3.0, 185000, 'sup_farm_poultry', '2026-09-04', true),
    ('ing_bread_slices', 'Artisan Bread Loaf Slices', 'ING-BRD-01', 'pcs', 40, 15, 3500, 'sup_choc_lanka', '2026-09-05', true),
    ('ing_potatoes_fries', 'Cut Fries Potatoes', 'ING-POT-01', 'kg', 14.5, 5.0, 65000, 'sup_farm_poultry', '2026-09-18', true)
ON CONFLICT ("id") DO NOTHING;

-- 10. Products
INSERT INTO public.products (
    "id", "name", "categoryId", "description", "image", "basePriceCents", "costPriceCents",
    "preparationStationId", "modifierGroupIds", "taxRate", "active", "isSoldOut"
) VALUES
    ('prod_cappuccino', 'Cappuccino', 'cat_coffee', 'Rich dark espresso topped with silky smooth steamed milk and dense chocolate powder dust.', 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&auto=format&fit=crop&q=80', 85000, 28000, 'st_bar', '["mod_size", "mod_milk", "mod_extras_coffee", "mod_sugar"]'::jsonb, 0, true, false),
    ('prod_latte', 'Cafe Latte', 'cat_coffee', 'Double shot espresso balanced with creamy textured steamed milk and delicate latte art.', 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&auto=format&fit=crop&q=80', 90000, 30000, 'st_bar', '["mod_size", "mod_milk", "mod_extras_coffee", "mod_sugar"]'::jsonb, 0, true, false),
    ('prod_americano', 'Americano', 'cat_coffee', 'Bold double espresso pulled over hot water for a clean, rich aromatic coffee taste.', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80', 70000, 15000, 'st_bar', '["mod_size", "mod_extras_coffee", "mod_sugar"]'::jsonb, 0, true, false),
    ('prod_mocha', 'Mocha Delight', 'cat_coffee', 'Signature Belgian chocolate blended with espresso, steamed milk, and velvety chocolate swirls.', 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=500&auto=format&fit=crop&q=80', 105000, 38000, 'st_bar', '["mod_size", "mod_milk", "mod_extras_coffee", "mod_sugar"]'::jsonb, 0, true, false),
    ('prod_iced_coffee', 'Iced Coffee Chill', 'cat_cold_drinks', 'Sri Lankan style chilled brewed coffee with condensed milk, fresh milk, and crushed ice.', 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=500&auto=format&fit=crop&q=80', 95000, 31000, 'st_bar', '["mod_size", "mod_milk", "mod_ice", "mod_sugar"]'::jsonb, 0, true, false),
    ('prod_hot_chocolate', 'Hot Chocolate Special', 'cat_cold_drinks', 'Warm, thick Belgian chocolate ganache infused in full cream milk with marshmallow topping.', 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=500&auto=format&fit=crop&q=80', 85000, 29000, 'st_bar', '["mod_size", "mod_milk", "mod_extras_coffee"]'::jsonb, 0, true, true),
    ('prod_choc_milkshake', 'Chocolate Milkshake', 'cat_cold_drinks', 'Decadent chocolate gelato blitzed with cold milk, chocolate fudge and whipped cream cloud.', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop&q=80', 110000, 39000, 'st_bar', '["mod_size", "mod_extras_coffee"]'::jsonb, 0, true, false),
    ('prod_vanilla_shake', 'Vanilla Thickshake', 'cat_cold_drinks', 'Madagascar vanilla bean ice cream shaken with chilled cream and golden waffle biscuit.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80', 105000, 37000, 'st_bar', '["mod_size"]'::jsonb, 0, true, false),
    ('prod_brownie', 'Chocolate Brownie', 'cat_desserts', 'Fudgy, gooey dark chocolate brownie served warm with a crisp crinkle top.', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=80', 75000, 24000, 'st_dessert', '["mod_toppings_dessert"]'::jsonb, 0, true, false),
    ('prod_choc_waffle', 'Chocolate Waffle', 'cat_desserts', 'Crispy golden Belgian waffle drizzled with warm Nutella, fresh strawberries and chocolate flakes.', 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=500&auto=format&fit=crop&q=80', 125000, 42000, 'st_dessert', '["mod_toppings_dessert"]'::jsonb, 0, true, false),
    ('prod_lava_cake', 'Molten Choc Lava Cake', 'cat_desserts', 'Decadent mini cake with a warm flowing liquid chocolate center and cocoa dusting.', 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=500&auto=format&fit=crop&q=80', 135000, 48000, 'st_dessert', '["mod_toppings_dessert"]'::jsonb, 0, true, false),
    ('prod_sundae', 'Ice Cream Sundae Chill', 'cat_ice_cream', 'Trio of artisan chocolate, vanilla & caramel ice cream scoops layered with nuts and fudge.', 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop&q=80', 110000, 35000, 'st_dessert', '["mod_toppings_dessert"]'::jsonb, 0, true, false),
    ('prod_sandwich', 'Chicken Sandwich', 'cat_food', 'Tender grilled spiced chicken breast, crispy lettuce, cheddar cheese and herb mayo in toasted bread.', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80', 135000, 52000, 'st_kitchen', '["mod_food_options"]'::jsonb, 0, true, false),
    ('prod_fries', 'French Fries (Large)', 'cat_food', 'Golden crispy shoestring potatoes tossed in seasoned sea salt and served with spicy dip.', 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500&auto=format&fit=crop&q=80', 85000, 22000, 'st_kitchen', '["mod_food_options"]'::jsonb, 0, true, false),
    ('prod_burger', 'Crispy Chicken Burger', 'cat_food', 'Buttermilk fried chicken patty with melted cheddar, fresh pickles and special house relish.', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80', 165000, 65000, 'st_kitchen', '["mod_food_options"]'::jsonb, 0, true, false)
ON CONFLICT ("id") DO NOTHING;

-- 11. Recipes (Bill of Materials)
INSERT INTO public.recipes ("id", "productId", "productName", "items") VALUES
    ('rcp_cappuccino', 'prod_cappuccino', 'Cappuccino', '[
        {"ingredientId": "ing_coffee_beans", "ingredientName": "Arabica Espresso Beans", "quantity": 0.018, "unit": "kg"},
        {"ingredientId": "ing_fresh_milk", "ingredientName": "Fresh Cow Milk", "quantity": 0.150, "unit": "L"}
    ]'::jsonb),
    ('rcp_latte', 'prod_latte', 'Cafe Latte', '[
        {"ingredientId": "ing_coffee_beans", "ingredientName": "Arabica Espresso Beans", "quantity": 0.018, "unit": "kg"},
        {"ingredientId": "ing_fresh_milk", "ingredientName": "Fresh Cow Milk", "quantity": 0.220, "unit": "L"}
    ]'::jsonb),
    ('rcp_americano', 'prod_americano', 'Americano', '[
        {"ingredientId": "ing_coffee_beans", "ingredientName": "Arabica Espresso Beans", "quantity": 0.018, "unit": "kg"}
    ]'::jsonb),
    ('rcp_brownie', 'prod_brownie', 'Chocolate Brownie', '[
        {"ingredientId": "ing_brownie_mix", "ingredientName": "Fudge Brownie Slices", "quantity": 1, "unit": "pcs"},
        {"ingredientId": "ing_choc_syrup", "ingredientName": "Belgian Chocolate Syrup", "quantity": 0.030, "unit": "L"}
    ]'::jsonb),
    ('rcp_waffle', 'prod_choc_waffle', 'Chocolate Waffle', '[
        {"ingredientId": "ing_waffle_batter", "ingredientName": "Belgian Waffle Batter Mix", "quantity": 0.180, "unit": "kg"},
        {"ingredientId": "ing_choc_syrup", "ingredientName": "Belgian Chocolate Syrup", "quantity": 0.050, "unit": "L"},
        {"ingredientId": "ing_vanilla_gelato", "ingredientName": "Madagascar Vanilla Gelato", "quantity": 0.060, "unit": "L"}
    ]'::jsonb),
    ('rcp_sandwich', 'prod_sandwich', 'Chicken Sandwich', '[
        {"ingredientId": "ing_chicken_breast", "ingredientName": "Marinated Chicken Breast", "quantity": 0.120, "unit": "kg"},
        {"ingredientId": "ing_bread_slices", "ingredientName": "Artisan Bread Loaf Slices", "quantity": 2, "unit": "pcs"}
    ]'::jsonb),
    ('rcp_fries', 'prod_fries', 'French Fries (Large)', '[
        {"ingredientId": "ing_potatoes_fries", "ingredientName": "Cut Fries Potatoes", "quantity": 0.250, "unit": "kg"}
    ]'::jsonb)
ON CONFLICT ("id") DO NOTHING;

-- 12. Customers
INSERT INTO public.customers (
    "id", "customerId", "name", "phone", "email", "address", "birthday", "tier", "points", "totalSpentCents", "totalOrders", "lastVisit", "notes"
) VALUES
    ('cust_001', 'CUST-1001', 'Anuki Fernando', '+94 77 123 4567', 'anuki.f@example.com', 'No 45, Alfred House Gardens, Colombo 03', '1996-04-12', 'GOLD', 680, 4820000, 14, '2026-09-02T10:48:00.000Z', 'Prefers oat milk for coffees. Regular weekend visitor.'),
    ('cust_002', 'CUST-1002', 'Kavinda Perera', '+94 71 890 1234', 'kavinda.p@example.com', '22/4, Galle Road, Mount Lavinia', '1992-08-25', 'PLATINUM', 1240, 8650000, 22, '2026-09-02T10:30:00.000Z', 'VIP customer. Often orders takeaway iced coffees.'),
    ('cust_003', 'CUST-1003', 'Saman Jayasinghe', '+94 76 345 6789', 'saman.j@example.com', '14, Ward Place, Colombo 07', '1988-11-03', 'SILVER', 310, 2645000, 8, '2026-09-02T10:12:00.000Z', 'Likes table seating near window.'),
    ('cust_004', 'CUST-1004', 'Rashmi Dissanayake', '+94 70 567 8901', 'rashmi.d@example.com', '78, Duplication Road, Colombo 04', '1998-02-14', 'GOLD', 540, 3890000, 11, '2026-09-02T09:45:00.000Z', 'Loves chocolate desserts and matcha specials.'),
    ('cust_005', 'CUST-1005', 'Dilshan Silva', '+94 77 987 6543', 'dilshan.silva@example.com', '5B, Flower Road, Colombo 07', '1995-09-18', 'SILVER', 290, 2135000, 6, '2026-09-02T09:20:00.000Z', NULL),
    ('cust_006', 'CUST-1006', 'Praveen Karunaratne', '+94 72 456 7890', 'praveen.k@example.com', '91, Baseline Road, Colombo 09', '1990-06-30', 'PLATINUM', 980, 7210000, 19, '2026-09-02T08:55:00.000Z', 'Always orders double espresso Americano.'),
    ('cust_007', 'CUST-1007', 'Shenali Mendis', '+94 78 234 5678', 'shenali.m@example.com', '10/2, Havelock Road, Colombo 05', '2000-12-05', 'BRONZE', 150, 1480000, 4, '2026-09-02T08:35:00.000Z', NULL),
    ('cust_008', 'CUST-1008', 'Dinuka Senanayake', '+94 75 678 9012', 'dinuka.s@example.com', '84, Kandy Road, Kadawatha', '1994-03-22', 'BRONZE', 85, 945000, 3, '2026-09-02T08:15:00.000Z', NULL),
    ('cust_009', 'CUST-1009', 'Malik Jayawardena', '+94 77 654 3210', 'malik.j@example.com', '18, Gregory Road, Colombo 07', '1991-07-19', 'GOLD', 475, 3520000, 9, '2026-09-01T18:30:00.000Z', NULL),
    ('cust_010', 'CUST-1010', 'Gayan Alwis', '+94 71 234 5678', 'gayan.alwis@example.com', '33, Rajagiriya Road, Rajagiriya', '1997-10-10', 'SILVER', 210, 1890000, 5, '2026-09-01T16:15:00.000Z', NULL),
    ('cust_011', 'CUST-1011', 'Niluka Perera', '+94 76 789 0123', 'niluka.p@example.com', '12, Stanmore Crescent, Colombo 07', '1999-05-15', 'BRONZE', 120, 1125000, 3, '2026-09-01T14:10:00.000Z', NULL),
    ('cust_012', 'CUST-1012', 'Anil Dias', '+94 70 123 4567', 'anil.dias@example.com', '56, Negombo Road, Wattala', '1985-01-28', 'BRONZE', 95, 860000, 2, '2026-09-01T11:30:00.000Z', NULL)
ON CONFLICT ("id") DO NOTHING;

-- 13. Customer Point History
INSERT INTO public.customer_point_history ("id", "customerId", "type", "points", "balanceAfter", "orderNumber", "note", "createdAt") VALUES
    ('pt_001_1', 'cust_001', 'EARNED', 23, 680, '#1054', 'Points earned for Order #1054', '2026-09-02T10:48:00.000Z'),
    ('pt_001_2', 'cust_001', 'BIRTHDAY_BONUS', 50, 657, NULL, 'Happy Birthday Celebration Bonus Gift!', '2026-04-12T08:00:00.000Z'),
    ('pt_001_3', 'cust_001', 'SIGNUP_BONUS', 25, 25, NULL, 'Welcome signup reward points', '2026-01-15T09:00:00.000Z'),
    ('pt_002_1', 'cust_002', 'EARNED', 27, 1240, '#1053', 'Points earned for Order #1053', '2026-09-02T10:30:00.000Z'),
    ('pt_002_2', 'cust_002', 'REDEEMED', -100, 1213, '#1038', 'Redeemed Rs. 100.00 discount on bill', '2026-08-28T16:20:00.000Z')
ON CONFLICT ("id") DO NOTHING;

-- 14. Employees
INSERT INTO public.employees (
    "id", "name", "role", "phone", "email", "baseSalaryCents", "payFrequency",
    "overtimeHourlyRateCents", "leaveDailyRateCents", "attendedDays", "bankName", "accountNumber", "active", "notes"
) VALUES
    ('emp_001', 'Chaminda Silva', 'General Manager & Admin', '+94 77 123 4567', 'chaminda@chillandchoc.lk', 12000000, 'MONTHLY', 65000, 460000, 26, 'Commercial Bank of Ceylon', '8001293847', true, 'Store manager and administrator.'),
    ('emp_002', 'Nimal Perera', 'Head Barista & Cashier', '+94 71 987 6543', 'nimal@chillandchoc.lk', 7500000, 'MONTHLY', 55000, 288000, 24, 'Bank of Ceylon', '0029384756', true, 'Lead coffee barista and shift in-charge.'),
    ('emp_003', 'Kasun Fernando', 'Cashier & Junior Barista', '+94 76 555 8899', 'kasun@chillandchoc.lk', 5500000, 'MONTHLY', 45000, 211500, 22, 'Sampath Bank', '1004839201', true, 'Morning shift cashier.'),
    ('emp_004', 'Dilshan Madushanka', 'Kitchen & Stock Assistant', '+94 72 333 4455', NULL, 4500000, 'MONTHLY', 40000, 173000, 25, 'Hatton National Bank (HNB)', '0492837461', true, 'Ingredient prep and stock receiving.')
ON CONFLICT ("id") DO NOTHING;

-- 15. Employee Payments
INSERT INTO public.employee_payments (
    "id", "employeeId", "employeeName", "amountCents", "paymentType", "method", "date", "bankName", "notes", "referenceNumber"
) VALUES
    ('pay_001', 'emp_002', 'Nimal Perera', 1500000, 'ADVANCE', 'CASH', '2026-08-15T10:30:00.000Z', NULL, 'Mid-month salary advance approved by GM', 'ADV-8812'),
    ('pay_002', 'emp_003', 'Kasun Fernando', 5500000, 'SALARY', 'CARD', '2026-08-01T09:00:00.000Z', 'Sampath Bank', 'July Salary Bank Transfer', 'SAL-7701')
ON CONFLICT ("id") DO NOTHING;

-- 16. Employee Rate History
INSERT INTO public.rate_histories (
    "id", "employeeId", "employeeName", "rateType", "previousOvertimeRateCents", "newOvertimeRateCents",
    "previousLeaveRateCents", "newLeaveRateCents", "changedBy", "reason", "effectiveDate", "createdAt"
) VALUES
    ('rate_hist_001', 'GLOBAL', 'Global Policy (All Staff)', 'OVERTIME', 40000, 45000, NULL, NULL, 'Admin (Chaminda Silva)', 'Mid-year cost of living adjustment and overtime incentive boost', '2026-07-01', '2026-07-01T08:30:00.000Z'),
    ('rate_hist_002', 'GLOBAL', 'Global Policy (All Staff)', 'LEAVE', NULL, NULL, 220000, 250000, 'Admin (Chaminda Silva)', 'Updated daily unpaid leave deduction rate according to standard store policy', '2026-07-01', '2026-07-01T08:35:00.000Z'),
    ('rate_hist_003', 'emp_002', 'Nimal Perera', 'OVERTIME', 45000, 55000, NULL, NULL, 'Admin (Chaminda Silva)', 'Special overtime allowance for Head Barista closing shift supervision', '2026-08-01', '2026-08-01T09:00:00.000Z'),
    ('rate_hist_004', 'emp_001', 'Chaminda Silva', 'ALL', 50000, 65000, 400000, 460000, 'System Owner', 'Executive management grade annual compensation & overtime adjustment', '2026-06-15', '2026-06-15T11:00:00.000Z'),
    ('rate_hist_005', 'emp_003', 'Kasun Fernando', 'OVERTIME', 40000, 45000, NULL, NULL, 'Admin (Chaminda Silva)', 'Completion of 3-month probation period & standard barista rate upgrade', '2026-08-15', '2026-08-15T14:20:00.000Z')
ON CONFLICT ("id") DO NOTHING;

-- 17. Loyalty Setting History
INSERT INTO public.loyalty_histories (
    "id", "changeType", "title", "summary", "previousSpendPerPointCents", "newSpendPerPointCents",
    "previousRedemptionValueCents", "newRedemptionValueCents", "changedBy", "reason", "createdAt"
) VALUES
    ('loyalty_hist_001', 'EARNING_RATE', 'Spend Rate Update', 'Spend: Rs. 150.00 → Rs. 100.00/pt', 15000, 10000, NULL, NULL, 'Admin (Chaminda Silva)', 'Enhanced reward points multiplier to celebrate café anniversary', '2026-08-15T14:20:00.000Z'),
    ('loyalty_hist_002', 'REDEMPTION_VALUE', 'Point Value Adjustment', 'Point Value: Rs. 0.75 → Rs. 1.00/pt', NULL, NULL, 75, 100, 'Admin (Chaminda Silva)', 'Standardized 1 Point = Rs. 1.00 direct cash discount equivalent', '2026-08-01T09:00:00.000Z'),
    ('loyalty_hist_003', 'BONUS_RULES', 'Signup & Birthday Rewards', 'Signup: 10 → 25 pts · Birthday: 25 → 50 pts', NULL, NULL, NULL, NULL, 'Admin (Chaminda Silva)', 'Upgraded welcome gifts and special birthday patron delight perks', '2026-07-15T11:45:00.000Z'),
    ('loyalty_hist_004', 'VALIDITY_LIMITS', 'Redemption Threshold & Validity', 'Min Redeem: 100 → 50 pts · Max Coverage: 50%', NULL, NULL, NULL, NULL, 'Admin (Chaminda Silva)', 'Lowered minimum redemption threshold for faster customer reward unlocks', '2026-07-01T08:30:00.000Z'),
    ('loyalty_hist_005', 'PROGRAM_CONFIG', 'Loyalty Program Rebranded', 'Program Name: Chill Club Rewards · Status: Active', NULL, NULL, NULL, NULL, 'System Owner', 'Official brand launch of Chill Club Rewards customer loyalty program', '2026-06-15T10:00:00.000Z')
ON CONFLICT ("id") DO NOTHING;

-- 18. Hardware Printers
INSERT INTO public.printers (
    "id", "name", "role", "connectionType", "address", "paperWidthMm", "autoCut", "drawerKickRJ12", "beepOnPrint", "copies", "stationId", "isOnline", "isDefaultReceipt"
) VALUES
    ('prn_receipt_80mm', 'Counter Thermal Receipt (POS-01)', 'RECEIPT', 'LAN_IP', '192.168.1.100:9100', 80, true, true, false, 1, NULL, true, true),
    ('prn_kitchen_80mm', 'Kitchen KOT Prep Thermal', 'KITCHEN_KOT', 'LAN_IP', '192.168.1.101:9100', 80, true, false, true, 1, 'st_kitchen', true, false),
    ('prn_bar_80mm', 'Bar & Espresso KOT Thermal', 'BAR_KOT', 'USB', 'USB001 (ESC/POS)', 80, true, false, true, 1, 'st_bar', true, false),
    ('prn_dessert_80mm', 'Dessert & Waffle Station Thermal', 'DESSERT_KOT', 'BLUETOOTH', 'BT:CHILL-DESSERT-80', 80, true, false, true, 1, 'st_dessert', true, false)
ON CONFLICT ("id") DO NOTHING;

-- 19. Purchases
INSERT INTO public.purchases (
    "id", "purchaseNumber", "supplierId", "supplierName", "invoiceNumber", "purchaseDate",
    "status", "paymentStatus", "subtotalCents", "discountCents", "totalCents", "paidCents", "dueCents",
    "payments", "items", "receivedAt", "notes"
) VALUES
    ('po_001', 'PO-8801', 'sup_ceylon_coffee', 'Ceylon Coffee Roasters Ltd', 'CCR-INV-9921', '2026-08-25T09:30:00.000Z', 'RECEIVED', 'PAID', 4500000, 0, 4500000, 4500000, 0, '[{"method": "CARD", "amountCents": 4500000, "timestamp": "2026-08-25T09:30:00.000Z"}]'::jsonb, '[{"ingredientId": "ing_beans", "ingredientName": "Specialty Espresso Beans", "quantity": 10, "unit": "kg", "unitPriceCents": 450000, "totalCents": 4500000}]'::jsonb, '2026-08-25T09:30:00.000Z', 'Premium dark roast blend delivery'),
    ('po_002', 'PO-8802', 'sup_highland_dairy', 'Highland Pure Dairy LK', 'HPD-7721', '2026-08-26T07:15:00.000Z', 'RECEIVED', 'PAID', 2750000, 0, 2750000, 2750000, 0, '[{"method": "CASH", "amountCents": 2750000, "timestamp": "2026-08-26T07:15:00.000Z"}]'::jsonb, '[{"ingredientId": "ing_milk", "ingredientName": "Fresh Whole Barista Milk", "quantity": 50, "unit": "L", "unitPriceCents": 55000, "totalCents": 2750000}]'::jsonb, '2026-08-26T07:15:00.000Z', 'Daily dairy restock'),
    ('po_003', 'PO-8803', 'sup_choc_lanka', 'Choc & Bakers Supplies Lanka', 'CBS-4412', '2026-08-27T11:00:00.000Z', 'RECEIVED', 'PARTIAL', 5250000, 0, 5250000, 3000000, 2250000, '[{"method": "CHEQUE", "amountCents": 3000000, "chequeNumber": "CHQ-9901", "bankName": "Commercial Bank"}]'::jsonb, '[{"ingredientId": "ing_choc_chips", "ingredientName": "Belgian Dark Choc Ganache", "quantity": 15, "unit": "kg", "unitPriceCents": 350000, "totalCents": 5250000}]'::jsonb, '2026-08-27T11:00:00.000Z', 'Special waffle toppings batch')
ON CONFLICT ("id") DO NOTHING;

-- 20. Demo Shifts
INSERT INTO public.shifts (
    "id", "shiftNumber", "cashierId", "cashierName", "terminalId", "terminalName", "businessDate",
    "openedAt", "closedAt", "openingCash", "closingCashEntered", "expectedClosingCash",
    "cashSales", "cardSales", "qrSales", "cashIn", "cashOut", "cashRefunds", "cashDrops",
    "variance", "varianceStatus", "status"
) VALUES
    ('shift_today_01', 1, 'usr_cashier', 'Nimal Perera', 'term_01', 'Main Counter POS-01', to_char(now(), 'YYYY-MM-DD'), now() - interval '4 hours', NULL, 1000000, NULL, NULL, 949500, 490000, 385000, 0, 495000, 85000, 0, NULL, NULL, 'OPEN'),
    ('shift_yesterday_01', 0, 'usr_admin', 'Chaminda Silva', 'term_01', 'Main Counter POS-01', to_char(now() - interval '1 day', 'YYYY-MM-DD'), now() - interval '28 hours', now() - interval '16 hours', 1000000, 1850000, 1850000, 610000, 520000, 270000, 0, 150000, 0, 0, 0, 'BALANCED', 'CLOSED')
ON CONFLICT ("id") DO NOTHING;

-- 21. Demo Drawer Transactions
INSERT INTO public.drawer_transactions ("id", "shiftId", "terminalId", "cashierId", "cashierName", "type", "amount", "balanceAfter", "reason", "expenseCategory", "timestamp") VALUES
    ('txn_demo_01', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'OPENING_CASH', 1000000, 1000000, 'Opening Shift Float', NULL, now() - interval '4 hours'),
    ('txn_demo_02', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'CASH_OUT', -60000, 940000, 'Crushed Ice Bags for Cold Beverage Bar', 'PETTY_CASH', now() - interval '3 hours 30 minutes'),
    ('txn_demo_03', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'CASH_SALE', 240000, 1180000, 'Order #1048', NULL, now() - interval '3 hours 15 minutes'),
    ('txn_demo_04', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'CASH_OUT', -120000, 1060000, 'Table Sanitizer & Paper Napkins Pack', 'CLEANING', now() - interval '3 hours'),
    ('txn_demo_05', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'CASH_SALE', 155000, 1215000, 'Order #1049', NULL, now() - interval '2 hours 45 minutes'),
    ('txn_demo_06', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'CASH_OUT', -240000, 975000, 'Emergency Fresh Barista Milk (4 Litres)', 'EMERGENCY_MILK', now() - interval '2 hours 15 minutes'),
    ('txn_demo_07', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'CASH_OUT', -75000, 900000, 'Fresh Mint Leaves & Lemons', 'EMERGENCY_MILK', now() - interval '1 hour 30 minutes'),
    ('txn_demo_08', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'CASH_SALE', 319500, 1219500, 'Order #1052', NULL, now() - interval '45 minutes'),
    ('txn_demo_09', 'shift_today_01', 'term_01', 'usr_cashier', 'Nimal Perera', 'CASH_SALE', 235000, 1454500, 'Order #1054', NULL, now() - interval '10 minutes')
ON CONFLICT ("id") DO NOTHING;

-- 22. Demo Operating Expenses
INSERT INTO public.expenses ("id", "category", "title", "amountCents", "paidViaDrawer", "shiftId", "cashierId", "cashierName", "createdAt") VALUES
    ('exp_demo_01', 'EMERGENCY_MILK', 'Emergency Fresh Barista Milk (4 Litres)', 240000, true, 'shift_today_01', 'usr_cashier', 'Nimal Perera', now() - interval '2 hours 15 minutes'),
    ('exp_demo_02', 'EMERGENCY_MILK', 'Fresh Mint Leaves & Lemons', 75000, true, 'shift_today_01', 'usr_cashier', 'Nimal Perera', now() - interval '1 hour 30 minutes'),
    ('exp_demo_03', 'CLEANING', 'Table Sanitizer & Paper Napkins Pack', 120000, true, 'shift_today_01', 'usr_cashier', 'Nimal Perera', now() - interval '3 hours'),
    ('exp_demo_04', 'PETTY_CASH', 'Crushed Ice Bags for Cold Beverage Bar', 60000, true, 'shift_today_01', 'usr_cashier', 'Nimal Perera', now() - interval '3 hours 30 minutes'),
    ('exp_demo_05', 'PETTY_CASH', 'Courier & Emergency Sugar Delivery', 150000, true, 'shift_yesterday_01', 'usr_admin', 'Chaminda Silva', now() - interval '20 hours')
ON CONFLICT ("id") DO NOTHING;

-- 23. Demo Orders
INSERT INTO public.orders (
    "id", "orderNumber", "numericOrderNum", "shiftId", "cashierId", "cashierName", "terminalId",
    "orderType", "tableNumber", "customerName", "status", "items", "subtotalCents", "discountCents",
    "serviceChargeCents", "taxCents", "totalCents", "paymentMethod", "cashReceivedCents", "changeGivenCents",
    "cardReference", "qrReference", "isPaid", "kotPrinted", "receiptPrinted", "createdAt", "completedAt"
) VALUES
    ('ord_demo_01', '#1054', 1054, 'shift_today_01', 'usr_cashier', 'Nimal Perera', 'term_01', 'DINE_IN', '05', 'Anuki Fernando', 'COMPLETED', '[
        {"id": "item_d1_1", "productId": "prod_choc_waffle", "name": "Belgian Chocolate Waffle", "basePriceCents": 125000, "quantity": 1, "modifiers": [{"groupId": "mod_toppings_dessert", "groupName": "Dessert Toppings", "optionId": "opt_top_nutella", "optionName": "Nutella Drizzle", "priceCents": 25000}], "itemTotalCents": 150000, "preparationStationId": "st_dessert"},
        {"id": "item_d1_2", "productId": "prod_cappuccino", "name": "Cappuccino", "basePriceCents": 85000, "quantity": 1, "modifiers": [{"groupId": "mod_milk", "groupName": "Milk Choice", "optionId": "opt_milk_fresh", "optionName": "Fresh Milk", "priceCents": 0}], "itemTotalCents": 85000, "preparationStationId": "st_bar"}
    ]'::jsonb, 235000, 0, 0, 0, 235000, 'CASH', 250000, 15000, NULL, NULL, true, true, true, now() - interval '10 minutes', now() - interval '10 minutes'),

    ('ord_demo_02', '#1053', 1053, 'shift_today_01', 'usr_cashier', 'Nimal Perera', 'term_01', 'TAKEAWAY', NULL, 'Kavinda Perera', 'COMPLETED', '[
        {"id": "item_d2_1", "productId": "prod_iced_coffee", "name": "Iced Coffee Chill", "basePriceCents": 95000, "quantity": 2, "modifiers": [], "itemTotalCents": 190000, "preparationStationId": "st_bar"},
        {"id": "item_d2_2", "productId": "prod_brownie", "name": "Fudge Brownie Slice", "basePriceCents": 85000, "quantity": 1, "modifiers": [], "itemTotalCents": 85000, "preparationStationId": "st_dessert"}
    ]'::jsonb, 275000, 0, 0, 0, 275000, 'CARD', NULL, NULL, 'VISA-4412', NULL, true, true, true, now() - interval '25 minutes', now() - interval '25 minutes'),

    ('ord_demo_03', '#1052', 1052, 'shift_today_01', 'usr_cashier', 'Nimal Perera', 'term_01', 'DINE_IN', '02', 'Saman Jayasinghe', 'COMPLETED', '[
        {"id": "item_d3_1", "productId": "prod_sandwich", "name": "Classic Chicken Club Sandwich", "basePriceCents": 185000, "quantity": 1, "modifiers": [], "itemTotalCents": 185000, "preparationStationId": "st_kitchen"},
        {"id": "item_d3_2", "productId": "prod_fries", "name": "Crispy Seasoned Fries", "basePriceCents": 85000, "quantity": 1, "modifiers": [], "itemTotalCents": 85000, "preparationStationId": "st_kitchen"},
        {"id": "item_d3_3", "productId": "prod_hot_chocolate", "name": "Hot Chocolate Special", "basePriceCents": 85000, "quantity": 1, "modifiers": [], "itemTotalCents": 85000, "preparationStationId": "st_bar"}
    ]'::jsonb, 355000, 35500, 0, 0, 319500, 'CASH', 350000, 30500, NULL, NULL, true, true, true, now() - interval '45 minutes', now() - interval '45 minutes'),

    ('ord_demo_04', '#1051', 1051, 'shift_today_01', 'usr_cashier', 'Nimal Perera', 'term_01', 'DINE_IN', '04', 'Rashmi Dissanayake', 'COMPLETED', '[
        {"id": "item_d4_1", "productId": "prod_latte", "name": "Cafe Latte", "basePriceCents": 90000, "quantity": 2, "modifiers": [{"groupId": "mod_milk", "groupName": "Milk Choice", "optionId": "opt_milk_oat", "optionName": "Oat Milk", "priceCents": 15000}], "itemTotalCents": 210000, "preparationStationId": "st_bar"},
        {"id": "item_d4_2", "productId": "prod_lava_cake", "name": "Choc Lava Warm Cake", "basePriceCents": 145000, "quantity": 1, "modifiers": [{"groupId": "mod_toppings_dessert", "groupName": "Dessert Toppings", "optionId": "opt_top_gelato", "optionName": "Vanilla Ice Cream Scoop", "priceCents": 30000}], "itemTotalCents": 175000, "preparationStationId": "st_dessert"}
    ]'::jsonb, 385000, 0, 0, 0, 385000, 'QR', NULL, NULL, NULL, 'LQR-20260826-8831', true, true, true, now() - interval '1 hour 15 minutes', now() - interval '1 hour 15 minutes'),

    ('ord_demo_05', '#1050', 1050, 'shift_today_01', 'usr_cashier', 'Nimal Perera', 'term_01', 'TAKEAWAY', NULL, 'Dilshan Silva', 'COMPLETED', '[
        {"id": "item_d5_1", "productId": "prod_choc_milkshake", "name": "Chocolate Milkshake", "basePriceCents": 110000, "quantity": 1, "modifiers": [], "itemTotalCents": 110000, "preparationStationId": "st_bar"},
        {"id": "item_d5_2", "productId": "prod_vanilla_shake", "name": "Vanilla Thickshake", "basePriceCents": 105000, "quantity": 1, "modifiers": [], "itemTotalCents": 105000, "preparationStationId": "st_bar"}
    ]'::jsonb, 215000, 0, 0, 0, 215000, 'CARD', NULL, NULL, 'MC-8109', NULL, true, true, true, now() - interval '1 hour 45 minutes', now() - interval '1 hour 45 minutes')
ON CONFLICT ("id") DO NOTHING;

-- 24. Demo Inventory Movements
INSERT INTO public.inventory_movements ("id", "ingredientId", "ingredientName", "type", "quantity", "unit", "costCents", "reason", "timestamp") VALUES
    ('mov_demo_01', 'ing_coffee_beans', 'Specialty Espresso Beans', 'PURCHASE', 10, 'kg', 4500000, 'Batch supplier purchase', now() - interval '2 days'),
    ('mov_demo_02', 'ing_fresh_milk', 'Fresh Whole Barista Milk', 'PURCHASE', 50, 'L', 2750000, 'Dairy fresh restock', now() - interval '1 day'),
    ('mov_demo_03', 'ing_choc_syrup', 'Belgian Dark Choc Ganache', 'PURCHASE', 15, 'kg', 5250000, 'Choc confectionery intake', now() - interval '2 days'),
    ('mov_demo_04', 'ing_fresh_milk', 'Fresh Whole Barista Milk', 'SALE_CONSUMPTION', -4.8, 'L', 264000, 'POS orders automatic usage', now() - interval '1 hour')
ON CONFLICT ("id") DO NOTHING;

-- ============================================================================
-- END OF SUPABASE INITIALIZATION SCRIPT
-- ============================================================================
