export type Role = 'ADMIN' | 'CASHIER';

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  pin: string;
  avatar?: string;
  active: boolean;
  lastLoginAt?: string;
}

export interface AuthSession {
  user: User;
  token: string;
  terminalId: string;
}

export interface Terminal {
  id: string;
  name: string;
  code: string;
  location: string;
  isActive: boolean;
}

export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface CashierShift {
  id: string;
  shiftNumber: number;
  cashierId: string;
  cashierName: string;
  terminalId: string;
  terminalName: string;
  businessDate: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number; // integer cents (e.g. 1000000 = Rs. 10,000.00)
  closingCashEntered?: number;
  expectedClosingCash?: number;
  cashSales: number;
  cardSales: number;
  qrSales: number;
  cashIn: number;
  cashOut: number;
  cashRefunds: number;
  cashDrops: number;
  variance?: number;
  varianceStatus?: 'BALANCED' | 'SHORT' | 'OVER';
  closingNotes?: string;
  status: ShiftStatus;
}

export type CashDrawerTransactionType =
  | 'OPENING_CASH'
  | 'CASH_SALE'
  | 'CASH_REFUND'
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'CASH_DROP'
  | 'CLOSING_ADJUSTMENT';

export interface CashDrawerTransaction {
  id: string;
  shiftId: string;
  terminalId: string;
  cashierId: string;
  cashierName: string;
  type: CashDrawerTransactionType;
  amount: number; // cents (can be negative for refunds, cash out)
  balanceAfter: number; // cents
  orderId?: string;
  orderNumber?: string;
  reason?: string;
  expenseCategory?: string;
  timestamp: string;
  status?: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
  approvedByUserId?: string;
  approvedByUserName?: string;
  approvedAt?: string;
  rejectedReason?: string;
}

export interface PreparationStation {
  id: string;
  name: string;
  code: string;
  printerName: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image?: string;
  displayOrder: number;
  preparationStationId: string;
  active: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceCents: number;
  isDefault?: boolean;
  ingredientId?: string;
  ingredientQuantity?: number;
  ingredientUnit?: string;
  ingredients?: RecipeItem[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  image: string;
  basePriceCents: number; // e.g. 85000 = Rs. 850.00
  costPriceCents: number;
  preparationStationId: string;
  modifierGroupIds: string[];
  customModifiers?: ModifierGroup[]; // Product-specific modifier groups with customized pricing
  taxRate: number;
  active: boolean;
  isSoldOut: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  sku: string;
  unit: 'g' | 'kg' | 'ml' | 'L' | 'pcs';
  currentStock: number;
  reorderLevel: number;
  averageCostCents: number;
  supplierId?: string;
  active: boolean;
  expiryDate?: string;
  lastRestockedAt?: string;
  createdAt?: string;
}

export interface RecipeItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  items: RecipeItem[];
}

export type InventoryMovementType =
  | 'PURCHASE'
  | 'SALE_CONSUMPTION'
  | 'WASTE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'RETURN';

export interface InventoryMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: InventoryMovementType;
  quantity: number;
  unit: string;
  costCents: number;
  reason?: string;
  referenceId?: string; // orderId, purchaseId, etc.
  expiryDate?: string;
  timestamp: string;
}

export type OrderStatus =
  | 'DRAFT'
  | 'PLACED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type OrderType = 'DINE_IN' | 'TAKEAWAY';

export interface OrderItemModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceCents: number;
  ingredientId?: string;
  ingredientQuantity?: number;
  ingredientUnit?: string;
  ingredients?: RecipeItem[];
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  basePriceCents: number;
  quantity: number;
  modifiers: OrderItemModifier[];
  itemTotalCents: number;
  notes?: string;
  preparationStationId: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'QR' | 'SPLIT';

export interface PaymentSplit {
  method: 'CASH' | 'CARD' | 'QR';
  amountCents: number;
  reference?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "#1045"
  numericOrderNum: number;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  terminalId: string;
  orderType: OrderType;
  tableNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  loyaltyDiscountCents?: number;
  status: OrderStatus;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  discountReason?: string;
  discountPercent?: number;
  serviceChargeCents: number;
  taxCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentSplits?: PaymentSplit[];
  cashReceivedCents?: number;
  changeGivenCents?: number;
  cardReference?: string;
  qrReference?: string;
  isPaid: boolean;
  kotPrinted: boolean;
  receiptPrinted: boolean;
  createdAt: string;
  completedAt?: string;
  refundedAmountCents?: number;
  refundReason?: string;
  refundStatus?: 'NONE' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  refundRequest?: {
    requestedByUserId: string;
    requestedByUserName: string;
    requestedAt: string;
    reason: string;
    amountCents: number;
  };
  refundApproval?: {
    approvedByUserId: string;
    approvedByUserName: string;
    approvedAt: string;
    notes?: string;
  };
  refundRejection?: {
    rejectedByUserId: string;
    rejectedByUserName: string;
    rejectedAt: string;
    rejectionReason?: string;
  };
}

export interface HeldOrder {
  id: string;
  holdNumber: number;
  holdLabel: string;
  orderType: OrderType;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  discountPercent?: number;
  discountReason?: string;
  serviceChargeCents: number;
  taxCents: number;
  totalCents: number;
  heldAt: string;
  heldByCashierId: string;
  heldByCashierName: string;
}

export interface SupplierProvidedItem {
  id: string;
  ingredientId?: string;
  name: string;
  unit: string;
  unitPriceCents?: number;
  sku?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  notes?: string;
  providedItems?: SupplierProvidedItem[];
}

export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
  expiryDate?: string;
}

export type PurchasePaymentMethod = 'CASH' | 'CARD' | 'CHEQUE';
export type PurchasePaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export type ChequeStatus = 'PENDING' | 'CLEARED' | 'CANCELLED';

export interface PurchasePaymentSplit {
  id?: string;
  method: PurchasePaymentMethod;
  amountCents: number;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string; // Cheque end date / due date
  chequeStatus?: ChequeStatus; // 'PENDING' until cleared by supplier, then 'CLEARED'
  clearedAt?: string; // Timestamp when supplier cashed / marked paid
  notes?: string;
  timestamp?: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  purchaseDate: string;
  status: PurchaseStatus;
  paymentStatus?: PurchasePaymentStatus;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents?: number;
  dueCents?: number;
  dueDate?: string; // Scheduled payment date for partial or unpaid credit balances
  payments?: PurchasePaymentSplit[];
  items: PurchaseItem[];
  notes?: string;
  receivedAt?: string;
}

export interface Expense {
  id: string;
  category: 'EMERGENCY_MILK' | 'CLEANING' | 'DELIVERY' | 'MAINTENANCE' | 'UTILITIES' | 'PETTY_CASH' | 'OTHER';
  title: string;
  amountCents: number;
  paidViaDrawer: boolean;
  shiftId?: string;
  cashierId?: string;
  cashierName?: string;
  approvedBy?: string;
  notes?: string;
  createdAt: string;
}

export type EmployeePayFrequency = 'MONTHLY' | 'WEEKLY' | 'HOURLY';
export type EmployeePaymentType = 'SALARY' | 'ADVANCE' | 'BONUS' | 'OVERTIME';

export type RateChangeType = 'OVERTIME' | 'LEAVE' | 'BASE_SALARY' | 'STANDARD_HOURS' | 'ALL';

export interface EmployeeRateHistory {
  id: string;
  employeeId?: string; // 'GLOBAL' or employee ID (e.g. 'emp_001')
  employeeName: string; // 'Global Default (All Staff)' or employee name
  rateType: RateChangeType;
  previousOvertimeRateCents?: number;
  newOvertimeRateCents?: number;
  previousLeaveRateCents?: number;
  newLeaveRateCents?: number;
  previousBaseSalaryCents?: number;
  newBaseSalaryCents?: number;
  previousStandardHoursPerDay?: number;
  newStandardHoursPerDay?: number;
  changedBy: string; // e.g. 'Admin (usr_admin)'
  reason?: string; // e.g. 'Annual inflation adjustment', 'Promotion', 'Overtime incentive boost'
  effectiveDate: string; // e.g. '2026-09-01'
  createdAt: string;
}

export type LoyaltyHistoryChangeType =
  | 'ALL'
  | 'PROGRAM_CONFIG'
  | 'EARNING_RATE'
  | 'REDEMPTION_VALUE'
  | 'BONUS_RULES'
  | 'VALIDITY_LIMITS';

export interface LoyaltySettingHistory {
  id: string;
  changeType: LoyaltyHistoryChangeType;
  title: string;
  summary: string;
  previousSpendPerPointCents?: number;
  newSpendPerPointCents?: number;
  previousRedemptionValueCents?: number;
  newRedemptionValueCents?: number;
  previousMinSpendToEarnCents?: number;
  newMinSpendToEarnCents?: number;
  previousMinPointsToRedeem?: number;
  newMinPointsToRedeem?: number;
  previousMaxRedemptionPercent?: number;
  newMaxRedemptionPercent?: number;
  previousSignupBonusPoints?: number;
  newSignupBonusPoints?: number;
  previousBirthdayBonusPoints?: number;
  newBirthdayBonusPoints?: number;
  previousPointsExpiryDays?: number;
  newPointsExpiryDays?: number;
  previousProgramName?: string;
  newProgramName?: string;
  previousProgramEnabled?: boolean;
  newProgramEnabled?: boolean;
  changedBy: string; // e.g. 'Admin (Chaminda Silva)'
  reason?: string;
  createdAt: string;
}

export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface CustomerPointHistory {
  id: string;
  customerId: string;
  type: 'EARNED' | 'REDEEMED' | 'SIGNUP_BONUS' | 'BIRTHDAY_BONUS' | 'MANUAL_ADJUST';
  points: number;
  balanceAfter: number;
  orderId?: string;
  orderNumber?: string;
  amountCents?: number;
  note?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  customerId: string; // e.g. "CUST-1001"
  name: string;
  phone: string;
  email?: string;
  address?: string;
  birthday?: string;
  tier: CustomerTier;
  points: number;
  totalSpentCents: number;
  totalOrders: number;
  lastVisit: string;
  notes?: string;
  createdAt: string;
  pointHistory?: CustomerPointHistory[];
}

export type AttendanceDayStatus =
  | 'PRESENT'
  | 'OVERTIME'
  | 'ABSENT'
  | 'HOLIDAY'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'SCHEDULED';

export interface EmployeeAttendanceDay {
  status: AttendanceDayStatus;
  standardShiftHours?: number;
  overtimeHours?: number;
  checkInTime?: string;
  checkOutTime?: string;
  checkInSignature?: string; // Base64 / SVG signature data URL
  checkOutSignature?: string; // Base64 / SVG signature data URL
  workedHours?: number;
  earlyLeaveHours?: number;
  isLate?: boolean;
  lateMinutes?: number;
  isEarlyLeave?: boolean;
  earlyMinutes?: number;
  notes?: string;
}

export interface AttendanceRecord {
  id: string; // e.g. "att_${employeeId}_${date}"
  employeeId: string;
  employeeName?: string;
  date: string; // "YYYY-MM-DD"
  status: AttendanceDayStatus;
  standardShiftHours?: number;
  overtimeHours?: number;
  checkInTime?: string;
  checkOutTime?: string;
  checkInSignature?: string; // Base64 signature data URL
  checkOutSignature?: string; // Base64 signature data URL
  workedHours?: number;
  workedMinutes?: number;
  overtimeMinutes?: number;
  earlyLeaveHours?: number;
  earlyLeaveMinutes?: number;
  isLate?: boolean;
  lateMinutes?: number;
  isEarlyLeave?: boolean;
  earlyMinutes?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeAttendanceDetailRow {
  date: string;
  dayOfWeek: string;
  formattedDate: string;
  status: AttendanceDayStatus;
  checkInTime: string;
  checkOutTime: string;
  checkInSignature?: string;
  checkOutSignature?: string;
  standardShiftHours: number;
  workedHours: number;
  overtimeHours: number;
  earlyLeaveHours: number;
  varianceHours: number;
  isLate?: boolean;
  lateMinutes?: number;
  isEarlyLeave?: boolean;
  earlyMinutes?: number;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  nic?: string;
  address?: string;
  emergencyContact?: string;
  baseSalaryCents: number;
  payFrequency: EmployeePayFrequency;
  overtimeHourlyRateCents?: number; // Custom hourly overtime rate (in cents). If not set, falls back to default in SystemSettings
  leaveDailyRateCents?: number; // Custom daily leave deduction rate (in cents). If not set, falls back to default in SystemSettings
  standardHoursPerDay?: number;
  shiftStartTime?: string; // e.g. "08:30" (24h format)
  shiftEndTime?: string; // e.g. "17:30" (24h format)
  attendedDays?: number; // Total count of attended working days for current period
  attendanceRecords?: Record<string, EmployeeAttendanceDay>; // e.g. { '2026-09-01': { status: 'PRESENT' } }
  salaryPayDay?: number | string;
  salaryDate?: string;
  joinDate?: string;
  bankName?: string;
  accountNumber?: string;
  bankBranch?: string;
  active: boolean;
  createdAt: string;
  notes?: string;
}

export interface EmployeePayment {
  id: string;
  employeeId: string;
  employeeName: string;
  amountCents: number;
  paymentType: EmployeePaymentType;
  method: 'CASH' | 'CARD' | 'CHEQUE';
  date: string;
  baseSalaryAmountCents?: number;
  overtimeAmountCents?: number;
  overtimeHours?: number;
  bonusAmountCents?: number;
  bonusReason?: string;
  deductionAmountCents?: number;
  deductionReason?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string;
  notes?: string;
  referenceNumber?: string;
  createdAt: string;
}

export type PrinterJobStatus = 'QUEUED' | 'PRINTING' | 'PRINTED' | 'FAILED';
export type PrinterJobType = 'KOT' | 'CUSTOMER_RECEIPT' | 'SHIFT_REPORT' | 'DAILY_REPORT' | 'TEST_PRINT';
export type PrinterConnectionType = 'LAN_IP' | 'USB' | 'BLUETOOTH' | 'BROWSER_DRIVER';
export type PrinterRole = 'RECEIPT' | 'KITCHEN_KOT' | 'BAR_KOT' | 'DESSERT_KOT' | 'REPORT';

export interface PrinterConfig {
  id: string;
  name: string;
  role: PrinterRole;
  connectionType: PrinterConnectionType;
  address: string; // e.g. "192.168.1.100:9100", "USB001"
  paperWidthMm: 58 | 80;
  autoCut: boolean;
  drawerKickRJ12: boolean;
  beepOnPrint: boolean;
  copies: number;
  stationId?: string;
  isOnline: boolean;
  isDefaultReceipt: boolean;
}

export interface PrinterJob {
  id: string;
  orderId?: string;
  orderNumber?: string;
  printerId: string;
  printerName: string;
  stationId?: string;
  type: PrinterJobType;
  status: PrinterJobStatus;
  attempts: number;
  createdAt: string;
  printedAt?: string;
  error?: string;
  payloadText: string;
  formattedThermalLines?: string[];
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'SHIFT_OPEN'
  | 'SHIFT_CLOSE'
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'CASH_DROP'
  | 'ORDER_CREATE'
  | 'ORDER_VOID'
  | 'ORDER_HOLD'
  | 'ORDER_RESUME'
  | 'REFUND'
  | 'DISCOUNT'
  | 'PRICE_OVERRIDE'
  | 'REPRINT_RECEIPT'
  | 'REPRINT_KOT'
  | 'STOCK_ADJUSTMENT'
  | 'SETTINGS_CHANGE'
  | 'USER_CHANGE';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
  terminalId: string;
  timestamp: string;
}

export interface ReceiptCustomizationSettings {
  // Logo & Branding
  showLogo: boolean;
  logoUrl?: string;
  logoWidthPx: number; // 40 to 300
  logoAlignment: 'center' | 'left';
  logoOffsetYPx?: number; // -50 to +50 (Center: 0, Right > 0: Move Up, Left < 0: Move Down)
  logoMarginTopPx?: number;
  logoMarginBottomPx?: number;
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  email?: string;
  website?: string;
  taxNumber?: string;

  // Header Layout & Typography
  headerAlignment: 'center' | 'left';
  dividerStyle: 'dashed' | 'double' | 'dotted' | 'solid';
  paperWidthMm: 58 | 80;
  fontFamily: 'mono' | 'courier' | 'sans';
  fontSize: 'compact' | 'normal' | 'large';

  // Typography Hierarchy & Weight Customizations
  heading1Size?: 'small' | 'normal' | 'large' | 'xlarge';
  heading1Bold?: boolean;
  heading2Size?: 'small' | 'normal' | 'large';
  heading2Bold?: boolean;
  heading3Size?: 'small' | 'normal' | 'large';
  heading3Bold?: boolean;
  bodyBold?: boolean;

  // Metadata Toggles
  showOrderNumber: boolean;
  orderNumberPrefix: string;
  showOrderType: boolean;
  showTableNumber: boolean;
  showCashierName: boolean;
  showDateTime: boolean;
  timeFormat: '12h' | '24h';
  showCustomerInfo: boolean;

  // Items & Modifiers
  itemSpacing: 'compact' | 'normal' | 'relaxed';
  showModifiers: boolean;
  showModifierPrices: boolean;
  showItemNotes: boolean;
  showUnitPrice: boolean;

  // Financials & Taxes
  showSubtotal: boolean;
  showDiscount: boolean;
  showServiceCharge: boolean;
  serviceChargeLabel: string;
  showTax: boolean;
  taxLabel: string;
  currencySymbol: string;

  // Payments
  showPaymentMethod: boolean;
  showCashBreakdown: boolean;
  showCardReference: boolean;
  showPaymentQR?: boolean;
  qrPayloadType?: 'lanka_qr' | 'feedback_url' | 'wifi_login' | 'custom_url';
  qrCustomValue?: string;

  // Footer & Social & Wi-Fi
  receiptFooter: string;
  showSocialHandle: boolean;
  socialHandle: string;
  showWifiInfo: boolean;
  wifiSsid: string;
  wifiPassword?: string;
  showDeveloperCredit: boolean;
  developerCreditText: string;
  developerContact: string;
}

export interface KotCustomizationSettings {
  ticketTitle: string; // e.g. 'KITCHEN ORDER TICKET'
  showBrandName: boolean;
  brandName: string; // e.g. 'CHILL & CHOC'
  showOrderType: boolean;
  showTableNumber: boolean;
  tableNumberStyle: 'prominent' | 'standard'; // prominent = large box, standard = inline
  showOrderNumber: boolean;
  orderNumberPrefix: string; // e.g. '#'
  showCashierName: boolean;
  cashierLabel: string; // e.g. 'Staff:' / 'Server:'
  showCustomerName?: boolean;
  showDateTime: boolean;
  timeFormat: '12h' | '24h';
  showModifiers: boolean;
  showItemNotes: boolean;
  highlightNotes: boolean; // colored alert box for notes
  fontSize: 'compact' | 'normal' | 'large';
  paperWidthMm: 58 | 80;
  dividerStyle: 'dashed' | 'double' | 'dotted' | 'solid';
  showStationRouting: boolean;
  stationRoutingText: string; // e.g. 'Station Routing: BAR / KITCHEN / DESSERT'
  customNote?: string;
}

export interface SystemSettings {
  businessName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  currencyCode: 'LKR';
  currencySymbol: 'Rs.';
  decimalPlaces: 2;
  taxRatePercent: number;
  serviceChargePercent: number;
  receiptHeader: string;
  receiptFooter: string;
  autoPrintReceipt: boolean;
  autoPrintKOT: boolean;
  receiptCopies: number;
  receiptCustomization?: ReceiptCustomizationSettings;
  kotCustomization?: KotCustomizationSettings;
  // Employee & Payroll Rate Defaults
  defaultOvertimeHourlyRateCents: number; // e.g. 45000 = Rs. 450.00 / hour
  defaultLeaveDailyRateCents: number; // e.g. 250000 = Rs. 2,500.00 / day
  overtimeCalculationMode?: 'FIXED_HOURLY' | 'SALARY_MULTIPLIER';
  overtimeMultiplier?: number; // e.g. 1.5x
  standardWorkHoursPerDay?: number; // default 8
  workingDaysPerMonth?: number; // default 26
  shiftStartTime?: string; // default "08:30" (24h format)
  shiftEndTime?: string; // default "17:30" (24h format)
  lateGraceMinutes?: number; // default 15 mins
  leavePolicyNote?: string;
  // Cash Drawer Rules
  requireOpeningCash: boolean;
  blindShiftClose: boolean;
  varianceReasonThresholdCents: number;
  requireReasonForCashOut: boolean;
  allowCashierManualCashIn: boolean;
  allowCashierManualCashOut: boolean;
  openDrawerAfterCashSale: boolean;
  defaultTerminalId: string;
  // Direct Thermal Printing (Windows Local Agent / XPrinter)
  directPrintEnabled?: boolean;
  directPrintAgentUrl?: string; // default "http://127.0.0.1:23456"
  directPrintAuthToken?: string;
  directPrintPrinterName?: string; // e.g. "XP-80C"
  directPrintPaperWidthMm?: 58 | 80;
  directPrintAutoCut?: boolean;
  directPrintDrawerKick?: boolean;
  // Customer Loyalty & Rewards Program Settings
  loyaltyProgramEnabled: boolean;
  loyaltyProgramName: string; // e.g. 'Chill Club Rewards'
  loyaltySpendPerPointCents: number; // e.g. 10000 = Rs. 100.00 spent gives 1 point
  loyaltyMinSpendToEarnCents: number; // e.g. 20000 = Min bill of Rs. 200.00 to qualify
  loyaltyPointRedemptionValueCents: number; // e.g. 100 = 1 point = Rs. 1.00 discount
  loyaltyMinPointsToRedeem: number; // e.g. 50 points threshold to unlock redemption
  loyaltyMaxRedemptionPercentPerOrder: number; // e.g. 50% of invoice total max payable via points
  loyaltySignupBonusPoints: number; // e.g. 25 welcome bonus points on member signup
  loyaltyBirthdayBonusPoints: number; // e.g. 50 birthday bonus points
  loyaltyPointsExpiryDays: number; // e.g. 365 days (0 = never expires)
}

export type StockRequestType = 'STOCK_ADJUSTMENT' | 'STOCK_DELIVERY';
export type StockRequestStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface StockRequest {
  id: string;
  requestNumber: string; // e.g. "REQ-1001"
  type: StockRequestType;
  ingredientId?: string;
  ingredientName: string;
  sku?: string;
  currentStock: number;
  requestedStock?: number; // for adjustment (the proposed total quantity)
  quantityChange: number; // diff or added quantity (+10, -2, etc.)
  unit: string;
  costCents?: number;
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  expiryDate?: string;
  reason: string;
  requestedByUserId: string;
  requestedByUserName: string;
  status: StockRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  resolvedByUserName?: string;
  rejectionReason?: string;
  // Multi-item delivery request details
  items?: PurchaseItem[];
  totalCents?: number;
  paidCents?: number;
  dueCents?: number;
  paymentStatus?: PurchasePaymentStatus;
  payments?: PurchasePaymentSplit[];
  duePaymentDate?: string;
  notes?: string;
}

