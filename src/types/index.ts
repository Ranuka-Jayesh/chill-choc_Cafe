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
  customerName?: string;
  customerPhone?: string;
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

export interface PurchasePaymentSplit {
  method: PurchasePaymentMethod;
  amountCents: number;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: string; // Cheque end date / due date
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
  logoWidthPx: number; // 60 to 160
  logoAlignment: 'center' | 'left';
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
  // Cash Drawer Rules
  requireOpeningCash: boolean;
  blindShiftClose: boolean;
  varianceReasonThresholdCents: number;
  requireReasonForCashOut: boolean;
  allowCashierManualCashIn: boolean;
  allowCashierManualCashOut: boolean;
  openDrawerAfterCashSale: boolean;
  defaultTerminalId: string;
}
