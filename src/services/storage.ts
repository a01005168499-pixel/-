import * as XLSX from 'xlsx';
import { Product, Customer, Invoice, StoreConfig, DebtPaymentRecord, DEFAULT_STORE_CONFIG, ReturnInvoiceRequest, RestockRecord, TreasuryTransaction } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS, INITIAL_INVOICES } from './initialData';

const STORAGE_KEYS = {
  PRODUCTS: 'audio_world_products_v1',
  CUSTOMERS: 'audio_world_customers_v1',
  INVOICES: 'audio_world_invoices_v1',
  DEBT_PAYMENTS: 'audio_world_debt_payments_v1',
  RESTOCK_LOG: 'audio_world_restock_log_v1',
  TREASURY_TRANSACTIONS: 'audio_world_treasury_tx_v1',
  CONFIG: 'audio_world_config_v1',
  LAST_SYNC: 'audio_world_last_sync_v1',
};

// IndexedDB Helper for Large Offline Data
const DB_NAME = 'AudioWorldElectronicsDB';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve) => {
      const tx = db.transaction('store', 'readwrite');
      const store = tx.objectStore('store');
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // fallback gracefully
  }
}

export class StorageService {
  // --- PRODUCTS ---
  static async getProducts(): Promise<Product[]> {
    const fromIdb = await idbGet<Product[]>(STORAGE_KEYS.PRODUCTS);
    if (fromIdb !== null && Array.isArray(fromIdb)) {
      return fromIdb;
    }

    const local = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (local !== null) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          await idbSet(STORAGE_KEYS.PRODUCTS, parsed);
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing local products', e);
      }
    }

    // Default clean start with empty array
    await this.saveProducts([]);
    return [];
  }

  static async saveProducts(products: Product[]): Promise<void> {
    // 1. Save to IndexedDB (supports large storage, hundreds of MBs)
    await idbSet(STORAGE_KEYS.PRODUCTS, products);

    // 2. Safe save to localStorage without throwing QuotaExceededError
    try {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for products, saving lightweight copy to LocalStorage', e);
      try {
        const light = products.map((p) => ({
          ...p,
          image: p.image && p.image.length > 500 ? '' : p.image,
        }));
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(light));
      } catch {
        // If localStorage is completely full, IndexedDB has already persisted the full dataset
      }
    }
  }

  // --- RESTOCK RECORDS (تزويد ومشتريات المخزون المخصومة من الأرباح) ---
  static async getRestockRecords(): Promise<RestockRecord[]> {
    const fromIdb = await idbGet<RestockRecord[]>(STORAGE_KEYS.RESTOCK_LOG);
    if (fromIdb !== null && Array.isArray(fromIdb)) {
      return fromIdb;
    }
    const local = localStorage.getItem(STORAGE_KEYS.RESTOCK_LOG);
    if (local !== null) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          await idbSet(STORAGE_KEYS.RESTOCK_LOG, parsed);
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing local restock log', e);
      }
    }
    await this.saveRestockRecords([]);
    return [];
  }

  static async saveRestockRecords(records: RestockRecord[]): Promise<void> {
    await idbSet(STORAGE_KEYS.RESTOCK_LOG, records);
    try {
      localStorage.setItem(STORAGE_KEYS.RESTOCK_LOG, JSON.stringify(records));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for restock records', e);
    }
  }

  static async recordRestock(params: {
    productId: string;
    productName: string;
    category?: string;
    quantityAdded: number;
    unitCostPrice: number;
    previousStock: number;
    newStock: number;
    reason?: string;
    type?: 'manual_increase' | 'product_creation' | 'bulk_import';
    date?: string;
  }): Promise<RestockRecord | null> {
    if (params.quantityAdded <= 0) return null;

    const totalCostDeducted = params.quantityAdded * (params.unitCostPrice || 0);
    const newRecord: RestockRecord = {
      id: `restock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: params.productId,
      productName: params.productName,
      category: params.category || 'أخرى',
      quantityAdded: params.quantityAdded,
      unitCostPrice: params.unitCostPrice || 0,
      totalCostDeducted,
      previousStock: params.previousStock,
      newStock: params.newStock,
      date: params.date || new Date().toISOString(),
      reason:
        params.reason ||
        (params.type === 'product_creation'
          ? `إضافة صنف جديد (${params.productName}) برصيد افتتاحي ${params.quantityAdded} قطعة بسعر تكلفة ${params.unitCostPrice} ج.م`
          : `شراء وتزويد بضاعة جديدة للمخزن (+${params.quantityAdded} قطعة) بسعر تكلفة ${params.unitCostPrice} ج.م`),
      type: params.type || 'manual_increase',
    };

    const currentRecords = await this.getRestockRecords();
    const updated = [newRecord, ...currentRecords];
    await this.saveRestockRecords(updated);
    return newRecord;
  }

  static async deleteRestockRecord(id: string): Promise<RestockRecord[]> {
    const records = await this.getRestockRecords();
    const remaining = records.filter((r) => r.id !== id);
    await this.saveRestockRecords(remaining);
    return remaining;
  }

  static async clearAllRestockRecords(): Promise<void> {
    await this.saveRestockRecords([]);
  }

  // --- TREASURY CASH TRANSACTIONS (DEPOSITS & WITHDRAWALS) ---
  static async getTreasuryTransactions(): Promise<TreasuryTransaction[]> {
    const fromIdb = await idbGet<TreasuryTransaction[]>(STORAGE_KEYS.TREASURY_TRANSACTIONS);
    if (fromIdb !== null && Array.isArray(fromIdb)) {
      return fromIdb;
    }

    const local = localStorage.getItem(STORAGE_KEYS.TREASURY_TRANSACTIONS);
    if (local !== null) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          await idbSet(STORAGE_KEYS.TREASURY_TRANSACTIONS, parsed);
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing local treasury transactions', e);
      }
    }
    await this.saveTreasuryTransactions([]);
    return [];
  }

  static async saveTreasuryTransactions(records: TreasuryTransaction[]): Promise<void> {
    await idbSet(STORAGE_KEYS.TREASURY_TRANSACTIONS, records);
    try {
      localStorage.setItem(STORAGE_KEYS.TREASURY_TRANSACTIONS, JSON.stringify(records));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for treasury transactions', e);
    }
  }

  static async addTreasuryTransaction(params: {
    type: 'deposit' | 'withdrawal';
    amount: number;
    reason: string;
    category?: string;
    performedBy?: string;
    notes?: string;
    date?: string;
  }): Promise<TreasuryTransaction> {
    const config = await this.getConfig();
    const newTx: TreasuryTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: params.type,
      amount: Math.max(0, params.amount),
      reason: params.reason.trim(),
      category: params.category || (params.type === 'deposit' ? 'إيداع نقدي' : 'مصروفات وسحب'),
      performedBy: params.performedBy || config.managerName || 'أ. أحمد محمد حامد',
      date: params.date || new Date().toISOString(),
      notes: params.notes?.trim() || undefined,
    };

    const current = await this.getTreasuryTransactions();
    const updated = [newTx, ...current];
    await this.saveTreasuryTransactions(updated);
    return newTx;
  }

  static async deleteTreasuryTransaction(id: string): Promise<TreasuryTransaction[]> {
    const records = await this.getTreasuryTransactions();
    const remaining = records.filter((r) => r.id !== id);
    await this.saveTreasuryTransactions(remaining);
    return remaining;
  }

  static async clearAllTreasuryTransactions(): Promise<void> {
    await this.saveTreasuryTransactions([]);
  }

  static async saveProduct(product: Product, customReason?: string): Promise<Product[]> {
    const all = await this.getProducts();
    const index = all.findIndex((p) => String(p.id) === String(product.id));
    let updated: Product[];

    if (index >= 0) {
      const oldProd = all[index];
      const previousStock = oldProd.stockQuantity || 0;
      const newStock = product.stockQuantity || 0;
      const quantityAdded = newStock - previousStock;

      if (quantityAdded > 0) {
        await this.recordRestock({
          productId: product.id,
          productName: product.name,
          category: product.category,
          quantityAdded,
          unitCostPrice: product.costPrice || 0,
          previousStock,
          newStock,
          reason:
            customReason ||
            `تزويد رصيد الصنف بمقدار (+${quantityAdded} قطعة) بسعر تكلفة ${product.costPrice || 0} ج.م للقطعة`,
          type: 'manual_increase',
        });
      }

      updated = [...all];
      updated[index] = { ...updated[index], ...product, updatedAt: new Date().toISOString() };
    } else {
      const newStock = product.stockQuantity || 0;
      if (newStock > 0) {
        await this.recordRestock({
          productId: product.id,
          productName: product.name,
          category: product.category,
          quantityAdded: newStock,
          unitCostPrice: product.costPrice || 0,
          previousStock: 0,
          newStock,
          reason:
            customReason ||
            `إضافة صنف جديد (${product.name}) للمخزن برصيد افتتاحي (${newStock} قطعة) بسعر تكلفة ${product.costPrice || 0} ج.م`,
          type: 'product_creation',
        });
      }
      updated = [product, ...all];
    }
    await this.saveProducts(updated);
    return updated;
  }

  static async deleteProduct(productId: string): Promise<Product[]> {
    const products = await this.getProducts();
    const remaining = products.filter((p) => p.id !== productId);
    await this.saveProducts(remaining);
    return remaining;
  }

  static async deleteAllProducts(): Promise<Product[]> {
    await this.saveProducts([]);
    return [];
  }

  static async deleteSampleProducts(): Promise<Product[]> {
    const products = await this.getProducts();
    // Sample products have id starting with 'prod-00'
    const remaining = products.filter((p) => !p.id.startsWith('prod-00'));
    await this.saveProducts(remaining);
    return remaining;
  }

  static async updateProductStock(productId: string, delta: number, customReason?: string): Promise<Product[]> {
    const products = await this.getProducts();
    const target = products.find((p) => p.id === productId);

    if (target && delta > 0) {
      await this.recordRestock({
        productId: target.id,
        productName: target.name,
        category: target.category,
        quantityAdded: delta,
        unitCostPrice: target.costPrice || 0,
        previousStock: target.stockQuantity || 0,
        newStock: Math.max(0, (target.stockQuantity || 0) + delta),
        reason:
          customReason ||
          `تزويد كمية للمخزن (+${delta} قطعة) بسعر تكلفة ${target.costPrice || 0} ج.م للقطعة`,
        type: 'manual_increase',
      });
    }

    const updated = products.map((p) => {
      if (p.id === productId) {
        const newQty = Math.max(0, p.stockQuantity + delta);
        return { ...p, stockQuantity: newQty, updatedAt: new Date().toISOString() };
      }
      return p;
    });
    await this.saveProducts(updated);
    return updated;
  }

  // --- CUSTOMERS ---
  static async getCustomers(): Promise<Customer[]> {
    const fromIdb = await idbGet<Customer[]>(STORAGE_KEYS.CUSTOMERS);
    if (fromIdb !== null && Array.isArray(fromIdb)) {
      return fromIdb;
    }
    const local = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (local !== null) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          await idbSet(STORAGE_KEYS.CUSTOMERS, parsed);
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing local customers', e);
      }
    }
    await this.saveCustomers([]);
    return [];
  }

  static async saveCustomers(customers: Customer[]): Promise<void> {
    await idbSet(STORAGE_KEYS.CUSTOMERS, customers);
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for customers', e);
    }
  }

  static async deleteCustomer(customerId: string): Promise<Customer[]> {
    const customers = await this.getCustomers();
    const remaining = customers.filter((c) => c.id !== customerId);
    await this.saveCustomers(remaining);
    return remaining;
  }

  // --- INVOICES ---
  static async getInvoices(): Promise<Invoice[]> {
    const fromIdb = await idbGet<Invoice[]>(STORAGE_KEYS.INVOICES);
    if (fromIdb !== null && Array.isArray(fromIdb)) {
      return fromIdb;
    }
    const local = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (local !== null) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          await idbSet(STORAGE_KEYS.INVOICES, parsed);
          return parsed;
        }
      } catch (e) {
        console.error('Error parsing local invoices', e);
      }
    }
    await this.saveInvoices([]);
    return [];
  }

  static async saveInvoices(invoices: Invoice[]): Promise<void> {
    await idbSet(STORAGE_KEYS.INVOICES, invoices);
    try {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for invoices', e);
    }
  }

  static async updateInvoiceCustomer(
    invoiceId: string,
    newCustomerName: string,
    newCustomerPhone?: string
  ): Promise<{ invoice: Invoice; invoices: Invoice[]; customers: Customer[] } | null> {
    const [invoices, customers] = await Promise.all([this.getInvoices(), this.getCustomers()]);
    const idx = invoices.findIndex((i) => i.id === invoiceId);
    if (idx === -1) return null;

    const target = invoices[idx];
    const trimmedName = newCustomerName.trim() || 'عميل نقدي سريع';
    const trimmedPhone = newCustomerPhone !== undefined ? newCustomerPhone.trim() : target.customerPhone;

    // Check if matching an existing registered customer
    const matchedCustomer = customers.find(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase() || (trimmedPhone && c.phone === trimmedPhone)
    );

    const updatedInvoice: Invoice = {
      ...target,
      customerName: trimmedName,
      customerPhone: trimmedPhone,
      customerId: matchedCustomer ? matchedCustomer.id : (trimmedName === 'عميل نقدي سريع' ? undefined : target.customerId),
    };

    invoices[idx] = updatedInvoice;
    await this.saveInvoices(invoices);

    let updatedCustomers = customers;
    if (matchedCustomer && target.remainingDebt > 0 && target.customerId !== matchedCustomer.id) {
      updatedCustomers = customers.map((c) => {
        if (c.id === matchedCustomer.id) {
          return {
            ...c,
            currentDebt: c.currentDebt + target.remainingDebt,
          };
        }
        if (target.customerId && c.id === target.customerId) {
          return {
            ...c,
            currentDebt: Math.max(0, c.currentDebt - target.remainingDebt),
          };
        }
        return c;
      });
      await this.saveCustomers(updatedCustomers);
    }

    return { invoice: updatedInvoice, invoices, customers: updatedCustomers };
  }

  static async deleteInvoice(invoiceId: string): Promise<{ invoices: Invoice[]; customers: Customer[] }> {
    const [invoices, customers] = await Promise.all([this.getInvoices(), this.getCustomers()]);
    const target = invoices.find((i) => i.id === invoiceId);

    // Adjust customer debt if the invoice had remaining debt
    let updatedCustomers = customers;
    if (target && target.remainingDebt > 0 && (target.customerId || target.customerName)) {
      updatedCustomers = customers.map((c) => {
        if (
          (target.customerId && c.id === target.customerId) ||
          c.name.trim() === target.customerName.trim()
        ) {
          return {
            ...c,
            currentDebt: Math.max(0, c.currentDebt - target.remainingDebt),
          };
        }
        return c;
      });
      await this.saveCustomers(updatedCustomers);
    }

    const remainingInvoices = invoices.filter((i) => i.id !== invoiceId);
    await this.saveInvoices(remainingInvoices);
    return { invoices: remainingInvoices, customers: updatedCustomers };
  }

  static async deleteAllInvoices(): Promise<{ invoices: Invoice[]; customers: Customer[] }> {
    await this.saveInvoices([]);
    await this.saveDebtPayments([]);
    // Reset all customers debt to 0
    const customers = await this.getCustomers();
    const updatedCustomers = customers.map((c) => ({ ...c, currentDebt: 0 }));
    await this.saveCustomers(updatedCustomers);
    return { invoices: [], customers: updatedCustomers };
  }

  static async deleteSampleInvoices(): Promise<{ invoices: Invoice[]; customers: Customer[] }> {
    const invoices = await this.getInvoices();
    // Sample invoices have id 'inv-1001', 'inv-1002', 'inv-1003'
    const remaining = invoices.filter((i) => !i.id.startsWith('inv-100'));
    await this.saveInvoices(remaining);

    // Filter sample customers
    const customers = await this.getCustomers();
    const remainingCustomers = customers.filter((c) => !c.id.startsWith('cust-00'));
    await this.saveCustomers(remainingCustomers);

    return { invoices: remaining, customers: remainingCustomers };
  }

  // --- DEBT PAYMENTS ---
  static async getDebtPayments(): Promise<DebtPaymentRecord[]> {
    const fromIdb = await idbGet<DebtPaymentRecord[]>(STORAGE_KEYS.DEBT_PAYMENTS);
    if (fromIdb && Array.isArray(fromIdb)) {
      return fromIdb;
    }
    const local = localStorage.getItem(STORAGE_KEYS.DEBT_PAYMENTS);
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        return [];
      }
    }
    return [];
  }

  static async saveDebtPayments(payments: DebtPaymentRecord[]): Promise<void> {
    await idbSet(STORAGE_KEYS.DEBT_PAYMENTS, payments);
    try {
      localStorage.setItem(STORAGE_KEYS.DEBT_PAYMENTS, JSON.stringify(payments));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for debt payments', e);
    }
  }

  // --- STORE CONFIG ---
  static async getConfig(): Promise<StoreConfig> {
    const local = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (local) {
      try {
        return { ...DEFAULT_STORE_CONFIG, ...JSON.parse(local) };
      } catch {
        return DEFAULT_STORE_CONFIG;
      }
    }
    return DEFAULT_STORE_CONFIG;
  }

  static async saveConfig(config: StoreConfig): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for config', e);
    }
  }

  // --- RECORD SALE (DECREMENT STOCK + RECORD INVOICE + UPDATE CUSTOMER DEBT) ---
  static async processSale(invoice: Invoice): Promise<{
    invoices: Invoice[];
    products: Product[];
    customers: Customer[];
  }> {
    const [invoices, products, customers] = await Promise.all([
      this.getInvoices(),
      this.getProducts(),
      this.getCustomers(),
    ]);

    // 1. Update Product Stocks
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of invoice.items) {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.stockQuantity = Math.max(0, existing.stockQuantity - item.quantity);
        existing.updatedAt = new Date().toISOString();
      }
    }
    const updatedProducts = Array.from(productMap.values());
    await this.saveProducts(updatedProducts);

    // 2. Prepend Invoice
    const updatedInvoices = [invoice, ...invoices];
    await this.saveInvoices(updatedInvoices);

    // 3. Update Customer records (debt & totalSpent)
    let updatedCustomers = [...customers];
    if (invoice.customerId) {
      updatedCustomers = updatedCustomers.map((c) => {
        if (c.id === invoice.customerId) {
          return {
            ...c,
            totalSpent: c.totalSpent + invoice.totalAmount,
            currentDebt: c.currentDebt + invoice.remainingDebt,
          };
        }
        return c;
      });
    } else if (invoice.customerName && invoice.customerName !== 'عميل نقدي سريع') {
      // Find or create customer
      const existingIdx = updatedCustomers.findIndex(
        (c) => c.name.trim() === invoice.customerName.trim() || (invoice.customerPhone && c.phone === invoice.customerPhone)
      );
      if (existingIdx >= 0) {
        updatedCustomers[existingIdx] = {
          ...updatedCustomers[existingIdx],
          totalSpent: updatedCustomers[existingIdx].totalSpent + invoice.totalAmount,
          currentDebt: updatedCustomers[existingIdx].currentDebt + invoice.remainingDebt,
        };
      } else {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          name: invoice.customerName,
          phone: invoice.customerPhone || '',
          totalSpent: invoice.totalAmount,
          currentDebt: invoice.remainingDebt,
          createdAt: new Date().toISOString(),
        };
        updatedCustomers.push(newCust);
      }
    }
    await this.saveCustomers(updatedCustomers);

    return {
      invoices: updatedInvoices,
      products: updatedProducts,
      customers: updatedCustomers,
    };
  }

  // --- RETURN / REFUND INVOICE ITEMS (RESTORE STOCK + RECALCULATE INVOICE & CUSTOMER DEBT) ---
  static async processInvoiceReturn(req: ReturnInvoiceRequest): Promise<{
    invoices: Invoice[];
    products: Product[];
    customers: Customer[];
  }> {
    const [invoices, products, customers] = await Promise.all([
      this.getInvoices(),
      this.getProducts(),
      this.getCustomers(),
    ]);

    const targetInvoice = invoices.find((inv) => inv.id === req.invoiceId);
    if (!targetInvoice) {
      throw new Error('الفاتورة غير موجودة');
    }

    // 1. Restore Stock for items marked returnToStock
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const returnItem of req.items) {
      if (returnItem.quantity > 0 && returnItem.returnToStock) {
        const prod = productMap.get(returnItem.productId);
        if (prod) {
          prod.stockQuantity = prod.stockQuantity + returnItem.quantity;
          prod.updatedAt = new Date().toISOString();
        }
      }
    }
    const updatedProducts = Array.from(productMap.values());
    await this.saveProducts(updatedProducts);

    // 2. Update Invoice Item returned quantities & totals
    let totalNewlyReturnedAmount = 0;
    const updatedItems = targetInvoice.items.map((item) => {
      const match = req.items.find((r) => r.productId === item.productId);
      if (match && match.quantity > 0) {
        const prevReturned = item.returnedQuantity || 0;
        const newReturned = prevReturned + match.quantity;
        // Price per unit after discount share
        const unitActualPrice = item.quantity > 0 ? item.total / item.quantity : item.sellPrice;
        totalNewlyReturnedAmount += unitActualPrice * match.quantity;
        return {
          ...item,
          returnedQuantity: Math.min(item.quantity, newReturned),
        };
      }
      return item;
    });

    const totalSoldQty = updatedItems.reduce((acc, it) => acc + it.quantity, 0);
    const totalReturnedQty = updatedItems.reduce((acc, it) => acc + (it.returnedQuantity || 0), 0);
    const isFullyReturned = totalReturnedQty >= totalSoldQty;

    const prevReturnedAmount = targetInvoice.returnedAmount || 0;
    const newTotalReturnedAmount = prevReturnedAmount + totalNewlyReturnedAmount;

    // Adjust paid & remainingDebt
    let cashRefund = req.refundCashAmount;
    let debtReduction = req.reduceDebtAmount;
    if (cashRefund === undefined && debtReduction === undefined) {
      // Auto logic: reduce debt first if debt exists, then cash refund
      if (targetInvoice.remainingDebt > 0) {
        debtReduction = Math.min(targetInvoice.remainingDebt, totalNewlyReturnedAmount);
        cashRefund = Math.max(0, totalNewlyReturnedAmount - debtReduction);
      } else {
        debtReduction = 0;
        cashRefund = totalNewlyReturnedAmount;
      }
    } else {
      cashRefund = cashRefund || 0;
      debtReduction = debtReduction || 0;
    }

    const newPaidAmount = Math.max(0, targetInvoice.paidAmount - cashRefund);
    const newRemainingDebt = Math.max(0, targetInvoice.remainingDebt - debtReduction);

    const updatedInvoice: Invoice = {
      ...targetInvoice,
      items: updatedItems,
      returnedAmount: newTotalReturnedAmount,
      returnedAt: new Date().toISOString(),
      returnReason: req.reason || targetInvoice.returnReason || 'استرجاع بضاعة وإعادتها للمخزون',
      paidAmount: newPaidAmount,
      remainingDebt: newRemainingDebt,
      status: isFullyReturned ? 'returned' : 'partially_returned',
    };

    const updatedInvoices = invoices.map((inv) =>
      inv.id === targetInvoice.id ? updatedInvoice : inv
    );
    await this.saveInvoices(updatedInvoices);

    // 3. Update Customer debt & total spent
    let updatedCustomers = [...customers];
    if (debtReduction > 0 || cashRefund > 0) {
      updatedCustomers = updatedCustomers.map((c) => {
        const isMatch =
          (targetInvoice.customerId && c.id === targetInvoice.customerId) ||
          c.name.trim() === targetInvoice.customerName.trim();
        if (isMatch) {
          return {
            ...c,
            currentDebt: Math.max(0, c.currentDebt - debtReduction),
            totalSpent: Math.max(0, c.totalSpent - totalNewlyReturnedAmount),
          };
        }
        return c;
      });
      await this.saveCustomers(updatedCustomers);
    }

    return {
      invoices: updatedInvoices,
      products: updatedProducts,
      customers: updatedCustomers,
    };
  }

  // --- SETTLE DEBT (PARTIAL OR FULL) ---
  static async settleDebt(
    invoiceId: string,
    amountToPay: number,
    notes?: string
  ): Promise<{
    invoice: Invoice;
    paymentRecord: DebtPaymentRecord;
  }> {
    const [invoices, customers, payments, config] = await Promise.all([
      this.getInvoices(),
      this.getCustomers(),
      this.getDebtPayments(),
      this.getConfig(),
    ]);

    const invoiceIndex = invoices.findIndex((i) => i.id === invoiceId);
    if (invoiceIndex === -1) {
      throw new Error('الفاتورة غير موجودة');
    }

    const currentInvoice = invoices[invoiceIndex];
    const actualPay = Math.min(amountToPay, currentInvoice.remainingDebt);
    const newPaid = currentInvoice.paidAmount + actualPay;
    const newRemaining = Math.max(0, currentInvoice.remainingDebt - actualPay);
    const newStatus: Invoice['status'] = newRemaining <= 0 ? 'paid' : 'partial';

    const updatedInvoice: Invoice = {
      ...currentInvoice,
      paidAmount: newPaid,
      remainingDebt: newRemaining,
      status: newStatus,
      paymentType: newRemaining <= 0 ? 'cash' : 'partial',
    };

    invoices[invoiceIndex] = updatedInvoice;
    await this.saveInvoices(invoices);

    // Update Customer's current debt
    if (updatedInvoice.customerId || updatedInvoice.customerName) {
      const updatedCustomers = customers.map((c) => {
        if (
          (updatedInvoice.customerId && c.id === updatedInvoice.customerId) ||
          c.name.trim() === updatedInvoice.customerName.trim()
        ) {
          return {
            ...c,
            currentDebt: Math.max(0, c.currentDebt - actualPay),
          };
        }
        return c;
      });
      await this.saveCustomers(updatedCustomers);
    }

    // Record Payment
    const paymentRecord: DebtPaymentRecord = {
      id: `pay-${Date.now()}`,
      invoiceId: updatedInvoice.id,
      customerId: updatedInvoice.customerId,
      customerName: updatedInvoice.customerName,
      paidAmount: actualPay,
      remainingAfter: newRemaining,
      date: new Date().toISOString(),
      notes: notes || `سداد ${newRemaining <= 0 ? 'كلي' : 'جزئي'} للدين على الفاتورة ${updatedInvoice.invoiceNumber}`,
      receiver: config.managerName,
    };

    await this.saveDebtPayments([paymentRecord, ...payments]);

    return { invoice: updatedInvoice, paymentRecord };
  }

  // --- EXCEL EXPORT (PRODUCTS) ---
  static async exportProductsToExcel(): Promise<void> {
    const products = await this.getProducts();
    const data = products.map((p, idx) => ({
      'م': idx + 1,
      'كود الباركود': p.barcode,
      'اسم المنتج / الصنف': p.name,
      'القسم / التصنيف': p.category,
      'سعر الشراء (التكلفة)': p.costPrice,
      'سعر البيع': p.sellPrice,
      'الربح للقطعة': p.sellPrice - p.costPrice,
      'الكمية المتوفرة': p.stockQuantity,
      'الوحدة': p.unit,
      'حد التنبيه': p.minStockThreshold,
      'إجمالي قيمة المخزون (بيع)': p.stockQuantity * p.sellPrice,
      'إجمالي قيمة المخزون (شراء)': p.stockQuantity * p.costPrice,
      'الوصف': p.description || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!dir'] = 'rtl'; // Right to left excel sheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'مخزون عالم الصوت');
    XLSX.writeFile(workbook, `مخزون_عالم_الصوت_والالكترونيات_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // --- EXCEL EXPORT (DEBTS) ---
  static async exportDebtsToExcel(): Promise<void> {
    const invoices = await this.getInvoices();
    const debtInvoices = invoices.filter((i) => i.remainingDebt > 0);
    const data = debtInvoices.map((inv, idx) => ({
      'م': idx + 1,
      'رقم الفاتورة': inv.invoiceNumber,
      'اسم العميل / المدين': inv.customerName,
      'رقم الهاتف': inv.customerPhone,
      'إجمالي الفاتورة': inv.totalAmount,
      'المدفوع': inv.paidAmount,
      'المتبقي (الديـن المستحق)': inv.remainingDebt,
      'تاريخ الفاتورة': new Date(inv.createdAt).toLocaleDateString('ar-EG'),
      'تاريخ الاستحقاق': inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('ar-EG') : 'غير محدد',
      'ملاحظات': inv.notes || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!dir'] = 'rtl';
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل الديون والآجل');
    XLSX.writeFile(workbook, `ديون_عالم_الصوت_والالكترونيات_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // --- EXCEL IMPORT (PRODUCTS) ---
  static async importProductsFromExcel(file: File): Promise<{
    addedCount: number;
    updatedCount: number;
    products: Product[];
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result;
          const workbook = XLSX.read(buffer, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

          const existingProducts = await StorageService.getProducts();
          const existingMap = new Map(existingProducts.map((p) => [p.barcode, p]));

          let addedCount = 0;
          let updatedCount = 0;

          for (const row of rawRows) {
            // Flexible Arabic and English column name mapping
            const name = String(row['اسم المنتج / الصنف'] || row['اسم المنتج'] || row['الاسم'] || row['Name'] || row['name'] || '').trim();
            if (!name) continue;

            const barcode = String(row['كود الباركود'] || row['الباركود'] || row['Barcode'] || row['barcode'] || `622${Date.now().toString().slice(-7)}`).trim();
            const category = String(row['القسم / التصنيف'] || row['القسم'] || row['التصنيف'] || row['Category'] || 'مكبرات صوت وسماعات').trim();
            const costPrice = Number(row['سعر الشراء (التكلفة)'] || row['سعر الشراء'] || row['التكلفة'] || row['Cost'] || 0) || 0;
            const sellPrice = Number(row['سعر البيع'] || row['البيع'] || row['Price'] || row['price'] || costPrice * 1.3) || 0;
            const stockQuantity = Number(row['الكمية المتوفرة'] || row['الكمية'] || row['Stock'] || row['stock'] || 1) || 0;
            const minStockThreshold = Number(row['حد التنبيه'] || row['الحد الأدنى'] || row['MinStock'] || 3) || 3;
            const unit = String(row['الوحدة'] || row['Unit'] || 'قطعة').trim();
            const description = String(row['الوصف'] || row['Description'] || '').trim();

            if (existingMap.has(barcode)) {
              const prev = existingMap.get(barcode)!;
              existingMap.set(barcode, {
                ...prev,
                name,
                category,
                costPrice: costPrice || prev.costPrice,
                sellPrice: sellPrice || prev.sellPrice,
                stockQuantity: stockQuantity !== undefined ? stockQuantity : prev.stockQuantity,
                minStockThreshold: minStockThreshold || prev.minStockThreshold,
                unit: unit || prev.unit,
                description: description || prev.description,
                updatedAt: new Date().toISOString(),
              });
              updatedCount++;
            } else {
              const newProd: Product = {
                id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                barcode,
                name,
                category,
                costPrice,
                sellPrice,
                stockQuantity,
                minStockThreshold,
                image: '',
                unit,
                description,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              existingMap.set(barcode, newProd);
              addedCount++;
            }
          }

          const allProducts = Array.from(existingMap.values());
          await StorageService.saveProducts(allProducts);
          resolve({ addedCount, updatedCount, products: allProducts });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('فشل قراءة ملف الإكسل'));
      reader.readAsBinaryString(file);
    });
  }

  // --- FULL JSON BACKUP EXPORT & RESTORE ---
  static async exportFullBackupJSON(): Promise<void> {
    const [products, customers, invoices, debtPayments, restockRecords, treasuryTransactions, config] = await Promise.all([
      this.getProducts(),
      this.getCustomers(),
      this.getInvoices(),
      this.getDebtPayments(),
      this.getRestockRecords(),
      this.getTreasuryTransactions(),
      this.getConfig(),
    ]);

    const backupData = {
      system: 'عالم الصوت والإلكترونيات - نظام إدارة المبيعات والمخزون',
      manager: 'أ. أحمد محمد حامد',
      phone: '01005168499',
      exportDate: new Date().toISOString(),
      version: '1.1.0',
      data: {
        products,
        customers,
        invoices,
        debtPayments,
        restockRecords,
        treasuryTransactions,
        config,
      },
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_شاملة_عالم_الصوت_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async restoreFullBackupJSON(file: File): Promise<{
    productsCount: number;
    invoicesCount: number;
    customersCount: number;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);
          if (!parsed.data) {
            throw new Error('ملف النسخة الاحتياطية غير متوافق');
          }

          const { products, customers, invoices, debtPayments, restockRecords, treasuryTransactions, config } = parsed.data;

          if (Array.isArray(products)) await this.saveProducts(products);
          if (Array.isArray(customers)) await this.saveCustomers(customers);
          if (Array.isArray(invoices)) await this.saveInvoices(invoices);
          if (Array.isArray(debtPayments)) await this.saveDebtPayments(debtPayments);
          if (Array.isArray(restockRecords)) await this.saveRestockRecords(restockRecords);
          if (Array.isArray(treasuryTransactions)) await this.saveTreasuryTransactions(treasuryTransactions);
          if (config) await this.saveConfig(config);

          resolve({
            productsCount: Array.isArray(products) ? products.length : 0,
            invoicesCount: Array.isArray(invoices) ? invoices.length : 0,
            customersCount: Array.isArray(customers) ? customers.length : 0,
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('فشل قراءة ملف النسخة الاحتياطية'));
      reader.readAsText(file);
    });
  }

  // --- RESET TO INITIAL DATA ---
  static async resetToSampleData(): Promise<void> {
    await this.saveProducts(INITIAL_PRODUCTS);
    await this.saveCustomers(INITIAL_CUSTOMERS);
    await this.saveInvoices(INITIAL_INVOICES);
    await this.saveDebtPayments([]);
    await this.saveConfig(DEFAULT_STORE_CONFIG);
  }
}
