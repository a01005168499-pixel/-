export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  costPrice: number; // سعر التكلفة / الشراء
  sellPrice: number; // سعر البيع للجمهور
  stockQuantity: number; // الكمية المتوفرة بالمخزن
  minStockThreshold: number; // حد التنبيه بنقص المخزون
  image: string; // رابط الصورة أو Base64
  unit: string; // قطعة / طقم / متر / لفة
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number; // Can be adjusted or overridden during sale
  discount: number; // الخصم على هذا البند
  total: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  totalSpent: number;
  currentDebt: number; // إجمالي الديون المستحقة عليه
  createdAt: string;
}

export type PaymentType = 'cash' | 'debt' | 'partial';
export type InvoiceStatus = 'paid' | 'unpaid' | 'partial' | 'returned' | 'partially_returned';

export interface InvoiceItemSummary {
  productId: string;
  productName: string;
  barcode: string;
  unit: string;
  quantity: number;
  costPrice: number;
  sellPrice: number;
  discount: number;
  total: number;
  returnedQuantity?: number; // الكمية المسترجعة من هذا البند
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-0001
  customerId?: string;
  customerName: string;
  customerPhone: string;
  items: InvoiceItemSummary[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number; // المبلغ المدفوع
  remainingDebt: number; // المبلغ المتبقي كدين
  paymentType: PaymentType;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  dueDate?: string; // تاريخ استحقاق الدين
  officialSealConfirmed: boolean;
  returnedAmount?: number; // إجمالي المبالغ المسترجعة
  returnedAt?: string; // تاريخ آخر استرجاع
  returnReason?: string; // سبب الاسترجاع
}

export interface ReturnInvoiceRequest {
  invoiceId: string;
  items: {
    productId: string;
    quantity: number;
    returnToStock: boolean;
  }[];
  reason?: string;
  refundCashAmount?: number;
  reduceDebtAmount?: number;
}

export interface DebtPaymentRecord {
  id: string;
  invoiceId: string;
  customerId?: string;
  customerName: string;
  paidAmount: number;
  remainingAfter: number;
  date: string;
  notes?: string;
  receiver: string; // أ. أحمد محمد حامد
}

export interface RestockRecord {
  id: string;
  productId: string;
  productName: string;
  category: string;
  quantityAdded: number;
  unitCostPrice: number;
  totalCostDeducted: number; // المبلغ المخصوم من الأرباح = الكمية × سعر التكلفة
  previousStock: number;
  newStock: number;
  date: string; // ISO date string
  reason: string; // سبب الخصم والشراء
  type: 'manual_increase' | 'product_creation' | 'bulk_import';
}

export type TreasuryTransactionType = 'deposit' | 'withdrawal';

export interface TreasuryTransaction {
  id: string;
  type: TreasuryTransactionType; // 'deposit' (إيداع/إضافة مبلغ) أو 'withdrawal' (سحب/مصروفات)
  amount: number; // المبلغ بالجنيه
  reason: string; // البيان أو سبب السحب/الإيداع
  category?: string; // تصنيف الحركة
  performedBy: string; // اسم المسؤول (مثلاً: أ. أحمد محمد حامد)
  date: string; // ISO date string
  notes?: string;
}

export type PrintFormat = 'thermal-80mm' | 'thermal-58mm' | 'standard-a4';

export interface StoreConfig {
  storeName: string;
  managerName: string;
  phone: string;
  commercialRecord?: string;
  address: string;
  currency: string;
  printFormat: PrintFormat;
  receiptHeaderNotice: string;
  receiptFooterNotice: string;
  enableOfficialSeal: boolean;
  autoPrintAfterSale: boolean;
  lowStockAlertActive: boolean;
  theme: 'dark' | 'light';
  firebaseConfig?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
}

export const DEFAULT_STORE_CONFIG: StoreConfig = {
  storeName: 'عالم الصوت والإلكترونيات',
  managerName: 'أ. أحمد محمد حامد',
  phone: '01005168499',
  address: 'شارع الجمهورية - قسم الصوتيات والإلكترونيات الحديثة',
  currency: 'ج.م',
  printFormat: 'thermal-80mm',
  receiptHeaderNotice: 'أفضل أنظمة الصوت والمعدات الإلكترونية الاحترافية والصيانة المتخصصة',
  receiptFooterNotice: 'شكراً لتعاملكم معنا! البضاعة المباعة تستبدل أو ترد طبقاً للشروط خلال 14 يوماً بالفاتورة',
  enableOfficialSeal: true,
  autoPrintAfterSale: true,
  lowStockAlertActive: true,
  theme: 'dark',
};

export const PRODUCT_CATEGORIES = [
  'جميع الأقسام',
  'مكبرات صوت وسماعات',
  'ميكروفونات ولاسلكي',
  'ميكسرات ومضخمات صوت',
  'سماعات رأس ودي جي',
  'كابلات وتوصيلات ومحولات',
  'قطع غيار وإلكترونيات صيانة',
  'شواحن وبطاريات وتغذية',
  'أجهزة إضاءة ومؤثرات مسرحية',
];
