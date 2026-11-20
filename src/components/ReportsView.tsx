import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, Product, StoreConfig, RestockRecord, TreasuryTransaction } from '../types';
import { StorageService } from '../services/storage';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  ShoppingBag,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpRight,
  Trash2,
  Eye,
  RefreshCw,
  AlertTriangle,
  X,
  BarChart3,
  Calculator,
  Boxes,
  Percent,
  Wallet,
  FileText,
  Clock,
  User,
  RotateCcw,
  ArrowDownLeft,
  ArrowDownRight,
  PlusCircle,
  Info,
  ArrowUpCircle,
  ArrowDownCircle,
  Coins,
  ArrowRightLeft,
  HandCoins,
  Plus,
  Minus,
} from 'lucide-react';

interface ReportsViewProps {
  invoices: Invoice[];
  products: Product[];
  config: StoreConfig;
  onRefreshData: () => Promise<void>;
  onViewInvoice: (invoice: Invoice) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  invoices,
  products,
  config,
  onRefreshData,
  onViewInvoice,
}) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoicesFilter, setInvoicesFilter] = useState<'all' | 'sales' | 'returns'>('all');
  const [restockRecords, setRestockRecords] = useState<RestockRecord[]>([]);
  const [restockSearchQuery, setRestockSearchQuery] = useState('');
  const [restockToDelete, setRestockToDelete] = useState<RestockRecord | null>(null);

  // Treasury State (إيداع وسحب نقدية ومصروفات)
  const [treasuryTransactions, setTreasuryTransactions] = useState<TreasuryTransaction[]>([]);
  const [isTreasuryModalOpen, setIsTreasuryModalOpen] = useState(false);
  const [treasuryModalType, setTreasuryModalType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [treasuryAmountInput, setTreasuryAmountInput] = useState('');
  const [treasuryReasonInput, setTreasuryReasonInput] = useState('');
  const [treasuryCategoryInput, setTreasuryCategoryInput] = useState('');
  const [treasuryNotesInput, setTreasuryNotesInput] = useState('');
  const [treasurySearchQuery, setTreasurySearchQuery] = useState('');
  const [treasuryTypeFilter, setTreasuryTypeFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [treasuryTxToDelete, setTreasuryTxToDelete] = useState<TreasuryTransaction | null>(null);

  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);
  const [actionErrorNotice, setActionErrorNotice] = useState<string | null>(null);
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);

  // Load Restock & Treasury Records
  const loadFinancialRecords = async () => {
    try {
      const [records, txs] = await Promise.all([
        StorageService.getRestockRecords(),
        StorageService.getTreasuryTransactions(),
      ]);
      setRestockRecords(records);
      setTreasuryTransactions(txs);
    } catch (err) {
      console.error('Failed to load financial records:', err);
    }
  };

  useEffect(() => {
    loadFinancialRecords();
  }, [invoices, products]);

  // Filter Restock Records by Period
  const filteredRestocks = useMemo(() => {
    const now = new Date();
    return restockRecords.filter((rec) => {
      const recDate = new Date(rec.date);
      if (period === 'today') {
        return recDate.toDateString() === now.toDateString();
      }
      if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return recDate >= weekAgo;
      }
      if (period === 'month') {
        return (
          recDate.getMonth() === now.getMonth() && recDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [restockRecords, period]);

  // Compute Restock Expenditure Metrics (المبالغ المخصومة من الأرباح بسبب تزويد المخزون)
  const restockMetrics = useMemo(() => {
    let totalRestockExpenditure = 0;
    let totalRestockUnits = 0;
    for (const rec of filteredRestocks) {
      totalRestockExpenditure += rec.totalCostDeducted || rec.quantityAdded * rec.unitCostPrice;
      totalRestockUnits += rec.quantityAdded || 0;
    }
    return {
      totalRestockExpenditure,
      totalRestockUnits,
      count: filteredRestocks.length,
    };
  }, [filteredRestocks]);

  // Filtered & Searched Restocks for Table
  const searchedRestocks = useMemo(() => {
    if (!restockSearchQuery.trim()) return filteredRestocks;
    const q = restockSearchQuery.toLowerCase().trim();
    return filteredRestocks.filter(
      (rec) =>
        rec.productName.toLowerCase().includes(q) ||
        (rec.category && rec.category.toLowerCase().includes(q)) ||
        (rec.reason && rec.reason.toLowerCase().includes(q))
    );
  }, [filteredRestocks, restockSearchQuery]);

  // Filter Treasury Transactions by Period
  const filteredTreasuryTx = useMemo(() => {
    const now = new Date();
    return treasuryTransactions.filter((tx) => {
      const txDate = new Date(tx.date);
      if (period === 'today') return txDate.toDateString() === now.toDateString();
      if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return txDate >= weekAgo;
      }
      if (period === 'month') {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [treasuryTransactions, period]);

  // Compute Treasury Metrics (مجموع الإيداعات والسحوبات)
  const treasuryMetrics = useMemo(() => {
    let totalDeposits = 0;
    let totalWithdrawals = 0;
    for (const tx of filteredTreasuryTx) {
      if (tx.type === 'deposit') {
        totalDeposits += tx.amount || 0;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += tx.amount || 0;
      }
    }
    return {
      totalDeposits,
      totalWithdrawals,
      netAdjustment: totalDeposits - totalWithdrawals,
      count: filteredTreasuryTx.length,
    };
  }, [filteredTreasuryTx]);

  // Filtered & Searched Treasury Transactions for Table
  const searchedTreasuryTx = useMemo(() => {
    let list = filteredTreasuryTx;
    if (treasuryTypeFilter !== 'all') {
      list = list.filter((tx) => tx.type === treasuryTypeFilter);
    }
    if (!treasurySearchQuery.trim()) return list;
    const q = treasurySearchQuery.toLowerCase().trim();
    return list.filter(
      (tx) =>
        tx.reason.toLowerCase().includes(q) ||
        (tx.category && tx.category.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        (tx.performedBy && tx.performedBy.toLowerCase().includes(q))
    );
  }, [filteredTreasuryTx, treasuryTypeFilter, treasurySearchQuery]);

  // 1. INVENTORY VALUATION & EXPECTED PROFITS CALCULATION
  const inventoryMetrics = useMemo(() => {
    let totalStockUnits = 0;
    let totalCostValue = 0;
    let totalSellValue = 0;

    const categoryStats: Record<
      string,
      { count: number; units: number; cost: number; sell: number; expectedProfit: number }
    > = {};

    const productProfitabilityList: {
      id: string;
      name: string;
      category: string;
      stockQuantity: number;
      unitCost: number;
      unitSell: number;
      unitProfit: number;
      totalCost: number;
      totalSell: number;
      totalExpectedProfit: number;
      marginPercent: number;
    }[] = [];

    for (const p of products) {
      const qty = p.stockQuantity;
      const cost = p.costPrice;
      const sell = p.sellPrice;
      const itemCostTotal = qty * cost;
      const itemSellTotal = qty * sell;
      const itemExpectedProfit = itemSellTotal - itemCostTotal;
      const unitProfit = sell - cost;
      const margin = cost > 0 ? (unitProfit / cost) * 100 : 0;

      totalStockUnits += qty;
      totalCostValue += itemCostTotal;
      totalSellValue += itemSellTotal;

      // Category breakdown
      const cat = p.category || 'أخرى';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, units: 0, cost: 0, sell: 0, expectedProfit: 0 };
      }
      categoryStats[cat].count += 1;
      categoryStats[cat].units += qty;
      categoryStats[cat].cost += itemCostTotal;
      categoryStats[cat].sell += itemSellTotal;
      categoryStats[cat].expectedProfit += itemExpectedProfit;

      if (qty > 0) {
        productProfitabilityList.push({
          id: p.id,
          name: p.name,
          category: p.category,
          stockQuantity: qty,
          unitCost: cost,
          unitSell: sell,
          unitProfit,
          totalCost: itemCostTotal,
          totalSell: itemSellTotal,
          totalExpectedProfit: itemExpectedProfit,
          marginPercent: Math.round(margin),
        });
      }
    }

    const totalExpectedProfit = totalSellValue - totalCostValue;
    const expectedMarginPercent =
      totalCostValue > 0 ? ((totalExpectedProfit / totalCostValue) * 100).toFixed(1) : '0';

    const topExpectedProfitableProducts = [...productProfitabilityList]
      .sort((a, b) => b.totalExpectedProfit - a.totalExpectedProfit)
      .slice(0, 5);

    return {
      totalProductsCount: products.length,
      totalStockUnits,
      totalCostValue,
      totalSellValue,
      totalExpectedProfit,
      expectedMarginPercent,
      categoryStats: Object.entries(categoryStats).map(([name, data]) => ({
        name,
        ...data,
        marginPercent: data.cost > 0 ? ((data.expectedProfit / data.cost) * 100).toFixed(1) : '0',
      })),
      topExpectedProfitableProducts,
    };
  }, [products]);

  // 2. FILTER INVOICES BY TIME PERIOD
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    return invoices.filter((inv) => {
      const invDate = new Date(inv.createdAt);
      if (period === 'today') {
        return invDate.toDateString() === now.toDateString();
      }
      if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        return invDate >= weekAgo;
      }
      if (period === 'month') {
        return (
          invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [invoices, period]);

  // Search in invoices table with status sub-filtering
  const searchedInvoices = useMemo(() => {
    let list = filteredInvoices;

    if (invoicesFilter === 'sales') {
      list = list.filter((inv) => inv.status !== 'returned');
    } else if (invoicesFilter === 'returns') {
      list = list.filter(
        (inv) =>
          inv.status === 'returned' ||
          inv.status === 'partially_returned' ||
          Boolean(inv.returnedAmount && inv.returnedAmount > 0)
      );
    }

    if (!invoiceSearchQuery.trim()) return list;
    const q = invoiceSearchQuery.toLowerCase().trim();
    return list.filter(
      (inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.items.some((item) => item.productName.toLowerCase().includes(q))
    );
  }, [filteredInvoices, invoiceSearchQuery, invoicesFilter]);

  // 3. REALIZED METRICS (HISTORICAL SALES & PROFITS WITH ACCURATE RETURNS DEDUCTION)
  const realizedMetrics = useMemo(() => {
    let grossSubtotal = 0;
    let totalDiscounts = 0;
    let grossSales = 0;
    let totalReturnsAmount = 0;
    let totalReturnedUnits = 0;
    let returnedInvoicesCount = 0;
    let totalCostOfSoldGoods = 0;
    let cashCollected = 0;
    let outstandingDebt = 0;

    const productSalesMap: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};

    for (const inv of filteredInvoices) {
      grossSubtotal += inv.subtotal;
      totalDiscounts += inv.discount;
      grossSales += inv.totalAmount;
      cashCollected += inv.paidAmount;
      outstandingDebt += inv.remainingDebt;

      const isFullReturn = inv.status === 'returned';
      const isPartialReturn =
        inv.status === 'partially_returned' || Boolean(inv.returnedAmount && inv.returnedAmount > 0);

      let invReturnedAmount = 0;
      if (isFullReturn) {
        invReturnedAmount = inv.returnedAmount || inv.totalAmount;
        returnedInvoicesCount += 1;
      } else if (isPartialReturn) {
        invReturnedAmount = inv.returnedAmount || 0;
        returnedInvoicesCount += 1;
      }
      totalReturnsAmount += invReturnedAmount;

      for (const item of inv.items) {
        const returnedQty = isFullReturn
          ? item.quantity
          : Math.min(item.quantity, item.returnedQuantity || 0);

        totalReturnedUnits += returnedQty;
        const effectiveSoldQty = Math.max(0, item.quantity - returnedQty);

        const itemUnitPrice = item.sellPrice - (item.discount || 0);
        const itemEffectiveRevenue = itemUnitPrice * effectiveSoldQty;
        const itemEffectiveCost = item.costPrice * effectiveSoldQty;
        const itemEffectiveProfit = itemEffectiveRevenue - itemEffectiveCost;

        totalCostOfSoldGoods += itemEffectiveCost;

        if (effectiveSoldQty > 0) {
          if (!productSalesMap[item.productId]) {
            productSalesMap[item.productId] = {
              name: item.productName,
              qty: 0,
              revenue: 0,
              profit: 0,
            };
          }
          productSalesMap[item.productId].qty += effectiveSoldQty;
          productSalesMap[item.productId].revenue += itemEffectiveRevenue;
          productSalesMap[item.productId].profit += itemEffectiveProfit;
        }
      }
    }

    const netSales = Math.max(0, grossSales - totalReturnsAmount);
    // تكلفة البضاعة المباعة الأصلية
    const originalCostOfSoldGoods = totalCostOfSoldGoods;
    // خصم تكلفة شراء وتزويد المخزون من تكلفة البضاعة المباعة (وليس من صافي الربح مباشرة)
    const restockDeduction = restockMetrics.totalRestockExpenditure;
    const netCostOfSoldGoods = Math.max(0, originalCostOfSoldGoods - restockDeduction);
    // صافي الربح = صافي المبيعات - صافي تكلفة البضاعة المباعة
    const netProfit = netSales - netCostOfSoldGoods;
    const profitMargin = netSales > 0 ? ((netProfit / netSales) * 100).toFixed(1) : '0';

    // نقدية الخزينة المتوفرة = النقدية المحصلة من المبيعات + إيداعات إضافية - تكلفة تزويد المخزون - سحوبات ومصروفات
    const totalSalesCashCollected = cashCollected;
    const totalDeposits = treasuryMetrics.totalDeposits;
    const totalWithdrawals = treasuryMetrics.totalWithdrawals;
    const netCashInRegister = totalSalesCashCollected + totalDeposits - restockDeduction - totalWithdrawals;

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      grossSubtotal,
      totalDiscounts,
      grossSales,
      totalReturnsAmount,
      totalReturnedUnits,
      returnedInvoicesCount,
      netSales,
      totalCost: originalCostOfSoldGoods, // تكلفة البضاعة المباعة (قبل الخصم)
      netCostOfSoldGoods, // صافي تكلفة البضاعة المباعة (بعد خصم تزويد المخزون)
      totalRestockExpenditure: restockDeduction,
      totalRestockUnits: restockMetrics.totalRestockUnits,
      restockCount: restockMetrics.count,
      totalDeposits, // إجمالي المبالغ المضافة للخزينة
      totalWithdrawals, // إجمالي المبالغ المسحوبة من الخزينة
      netProfit, // صافي الربح
      profitMargin,
      totalSalesCashCollected, // إجمالي السيولة المحصلة من الفواتير
      netCashInRegister, // صافي النقدية المتوفرة بالخزينة
      cashCollected: netCashInRegister, // لضمان ظهور النقدية الصافية المتبقية بالخزينة
      outstandingDebt,
      invoiceCount: filteredInvoices.length,
      topProducts,
    };
  }, [filteredInvoices, restockMetrics, treasuryMetrics]);

  // 4. ACTION: RESET ALL PROFITS & REPORTS
  const handleResetAllReports = async () => {
    try {
      setIsProcessing(true);
      await StorageService.deleteAllInvoices();
      await StorageService.clearAllRestockRecords();
      await StorageService.clearAllTreasuryTransactions();
      setRestockRecords([]);
      setTreasuryTransactions([]);
      await onRefreshData();
      setIsResetAllModalOpen(false);
      setActionSuccessNotice('تم تصفير الأرباح وسجل المبيعات وتكاليف المخزون وحركات الخزينة بنجاح.');
      setTimeout(() => setActionSuccessNotice(null), 4000);
    } catch (err) {
      console.error(err);
      setActionErrorNotice('حدث خطأ أثناء تصفير التقارير.');
      setTimeout(() => setActionErrorNotice(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. TREASURY ACTION HANDLERS (إيداع وسحب نقدية ومصروفات)
  const openTreasuryModal = (type: 'deposit' | 'withdrawal') => {
    setTreasuryModalType(type);
    setTreasuryAmountInput('');
    setTreasuryReasonInput('');
    setTreasuryCategoryInput(type === 'deposit' ? 'إيداع نقدي' : 'مصروفات تشغيلية');
    setTreasuryNotesInput('');
    setIsTreasuryModalOpen(true);
  };

  const handleSaveTreasuryTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(treasuryAmountInput);
    if (isNaN(amount) || amount <= 0) {
      alert('يرجى إدخال مبلغ مالي صحيح أكبر من الصفر.');
      return;
    }
    if (!treasuryReasonInput.trim()) {
      alert('يرجى إدخال سبب أو بيان الحركة المالية.');
      return;
    }

    setIsProcessing(true);
    try {
      await StorageService.addTreasuryTransaction({
        type: treasuryModalType,
        amount,
        reason: treasuryReasonInput.trim(),
        category: treasuryCategoryInput.trim() || undefined,
        notes: treasuryNotesInput.trim() || undefined,
        performedBy: config.managerName,
      });

      await loadFinancialRecords();
      setIsTreasuryModalOpen(false);
      setActionSuccessNotice(
        treasuryModalType === 'deposit'
          ? `تم إضافة مبلغ (+${amount.toLocaleString()} ${config.currency}) إلى نقدية الخزينة بنجاح!`
          : `تم تسجيل سحب مبلغ ومصروفات (-${amount.toLocaleString()} ${config.currency}) من الخزينة بنجاح!`
      );
      setTimeout(() => setActionSuccessNotice(null), 4000);
    } catch (err) {
      console.error('Error saving treasury transaction:', err);
      setActionErrorNotice('حدث خطأ أثناء حفظ حركة الخزينة.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTreasuryTransaction = async (id: string) => {
    setIsProcessing(true);
    try {
      await StorageService.deleteTreasuryTransaction(id);
      await loadFinancialRecords();
      setTreasuryTxToDelete(null);
      setActionSuccessNotice('تم حذف حركة الخزينة وتحديث الرصيد بنجاح!');
      setTimeout(() => setActionSuccessNotice(null), 3500);
    } catch (err) {
      console.error('Error deleting treasury transaction:', err);
      setActionErrorNotice('حدث خطأ أثناء حذف الحركة.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. ACTION: DELETE INDIVIDUAL INVOICE
  const handleDeleteSingleInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      setIsProcessing(true);
      await StorageService.deleteInvoice(invoiceToDelete.id);
      await onRefreshData();
      const num = invoiceToDelete.invoiceNumber;
      setInvoiceToDelete(null);
      setActionSuccessNotice(`تم حذف الفاتورة رقم ${num} بنجاح وإعادة حساب الأرباح.`);
      setTimeout(() => setActionSuccessNotice(null), 3500);
    } catch (err) {
      console.error(err);
      setActionErrorNotice('حدث خطأ أثناء حذف الفاتورة.');
      setTimeout(() => setActionErrorNotice(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. ACTION: DELETE INDIVIDUAL RESTOCK RECORD
  const handleDeleteRestockRecord = async () => {
    if (!restockToDelete) return;
    try {
      setIsProcessing(true);
      await StorageService.deleteRestockRecord(restockToDelete.id);
      await loadFinancialRecords();
      const name = restockToDelete.productName;
      setRestockToDelete(null);
      setActionSuccessNotice(`تم حذف قيد تزويد "${name}" واستعادة المبلغ المخصوم لصافي الأرباح.`);
      setTimeout(() => setActionSuccessNotice(null), 3500);
    } catch (err) {
      console.error(err);
      setActionErrorNotice('حدث خطأ أثناء حذف قيد تزويد المخزون.');
      setTimeout(() => setActionErrorNotice(null), 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Top Header & Reset Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-amber-500" />
            <h2 className="text-xl sm:text-2xl font-black text-white">التقارير المالية وحساب أرباح المخزون</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            متابعة شاملة لصافي الأرباح المحققة، حساب القيمة الإجمالية للمنتجات بالمحل، وتوقع الأرباح من البضاعة المتاحة
          </p>
        </div>

        {/* Header Actions: Reset Reports Button & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {(invoices.length > 0 || restockRecords.length > 0) && (
            <button
              onClick={() => setIsResetAllModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-800/80 bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-300 hover:bg-rose-900/60 hover:text-white transition shadow-sm"
              title="تصفير كل المبيعات والأرباح وتزويد المخزون وحساب الخزينة"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>تصفير الأرباح والتقارير بالكامل</span>
            </button>
          )}

          {/* Period Selector Tabs */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                period === 'today'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                period === 'week'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                period === 'month'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                period === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              كل الفترات
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessNotice && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-950/80 border border-emerald-800 p-3.5 text-xs text-emerald-200 animate-in fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionSuccessNotice}</span>
          </div>
          <button
            onClick={() => setActionSuccessNotice(null)}
            className="text-emerald-400 hover:text-white transition p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Notification Alert */}
      {actionErrorNotice && (
        <div className="flex items-center justify-between rounded-xl bg-rose-950/80 border border-rose-800 p-3.5 text-xs text-rose-200 animate-in fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{actionErrorNotice}</span>
          </div>
          <button
            onClick={() => setActionErrorNotice(null)}
            className="text-rose-400 hover:text-white transition p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 1: INVENTORY VALUATION & EXPECTED PROFITS (طلب المستخدم) */}
      {/* ============================================================== */}
      <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 p-5 shadow-2xl relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          {/* Header of the Inventory Valuation Box */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Calculator className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white">
                    حساب قيمة المنتجات الكلية والأرباح المتوقعة من المخزون
                  </h3>
                  <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] px-2.5 py-0.5 font-black border border-emerald-500/30">
                    بضاعة المحل الحالية
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  حساب دقيق لرأس المال المستثمر في البضاعة المتوفرة وصافي الأرباح المتوقع جنيها عند بيعها
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCategoryBreakdown(!showCategoryBreakdown)}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 self-start sm:self-auto bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg transition"
            >
              <PieChart className="h-3.5 w-3.5" />
              <span>{showCategoryBreakdown ? 'إخفاء تفاصيل الأقسام' : 'عرض تفاصيل الأقسام'}</span>
            </button>
          </div>

          {/* 4 Core Inventory Valuation Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
            {/* 1. Total Cost Value (رأس المال المستثمر) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">إجمالي قيمة المنتجات بالتكلفة</span>
                <Boxes className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                  {inventoryMetrics.totalCostValue.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">{config.currency}</span>
              </div>
              <span className="text-[11px] text-amber-400/90 mt-1 block">
                رأس المال المستثمر في البضاعة
              </span>
            </div>

            {/* 2. Total Retail Value (القيمة البيعية الكلية) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">إجمالي القيمة البيعية للمخزون</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
                  {inventoryMetrics.totalSellValue.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">{config.currency}</span>
              </div>
              <span className="text-[11px] text-emerald-500/80 mt-1 block">
                القيمة الإجمالية بسعر البيع
              </span>
            </div>

            {/* 3. Expected Profits (صافي الأرباح المتوقعة) */}
            <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300">صافي الأرباح المتوقعة</span>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  +{inventoryMetrics.totalExpectedProfit.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">{config.currency}</span>
              </div>
              <span className="text-[11px] text-emerald-300 font-bold mt-1 block">
                هامش ربح متوقع: {inventoryMetrics.expectedMarginPercent}%
              </span>
            </div>

            {/* 4. Units & Product Variety Count */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">حجم البضاعة المتاحة</span>
                <Package className="h-4 w-4 text-sky-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                  {inventoryMetrics.totalStockUnits.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">قطعة</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                موزعة على {inventoryMetrics.totalProductsCount} صنف بالمحل
              </span>
            </div>
          </div>

          {/* Optional Category Breakdown Drawer */}
          {showCategoryBreakdown && (
            <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in">
              <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                <span>تفصيل قيمة المخزون والأرباح المتوقعة حسب أقسام المحل:</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3 font-semibold">القسم</th>
                      <th className="py-2 px-3 font-semibold text-center">عدد الأصناف</th>
                      <th className="py-2 px-3 font-semibold text-center">الكمية المتوفرة</th>
                      <th className="py-2 px-3 font-semibold">قيمة التكلفة</th>
                      <th className="py-2 px-3 font-semibold">القيمة البيعية</th>
                      <th className="py-2 px-3 font-semibold text-emerald-400">الربح المتوقع</th>
                      <th className="py-2 px-3 font-semibold text-center">نسبة الربح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {inventoryMetrics.categoryStats.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-slate-950/50">
                        <td className="py-2.5 px-3 font-sans font-bold text-white">{cat.name}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300">{cat.count}</td>
                        <td className="py-2.5 px-3 text-center text-slate-300">{cat.units} قطعة</td>
                        <td className="py-2.5 px-3 text-slate-300">{cat.cost.toLocaleString()} {config.currency}</td>
                        <td className="py-2.5 px-3 text-white font-bold">{cat.sell.toLocaleString()} {config.currency}</td>
                        <td className="py-2.5 px-3 font-black text-emerald-400">+{cat.expectedProfit.toLocaleString()} {config.currency}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-300">{cat.marginPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 2: REALIZED SALES & NET PROFIT WITH NET COGS */}
      {/* ============================================================== */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-900 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Box 1: صافي الربح المحقق */}
            <div className="border-r border-slate-800 pr-0 pl-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400">صافي الربح</span>
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 font-bold">
                  هامش {realizedMetrics.profitMargin}%
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono mt-1.5">
                {realizedMetrics.netProfit.toLocaleString()} <span className="text-sm text-slate-400">{config.currency}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                صافي المبيعات ({realizedMetrics.netSales.toLocaleString()}) - صافي تكلفة المباعة ({realizedMetrics.netCostOfSoldGoods.toLocaleString()})
              </p>
            </div>

            {/* Box 2: صافي تكلفة البضاعة المباعة */}
            <div className="border-r border-slate-800 pr-4 pl-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-300">صافي تكلفة البضاعة المباعة</span>
                {realizedMetrics.totalRestockExpenditure > 0 && (
                  <span className="rounded-full bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 font-bold">
                    خصم تزويد المخزون -{realizedMetrics.totalRestockExpenditure.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="text-3xl sm:text-4xl font-black text-rose-400 font-mono mt-1.5">
                {realizedMetrics.netCostOfSoldGoods.toLocaleString()} <span className="text-sm text-slate-400">{config.currency}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                تكلفة المباع ({realizedMetrics.totalCost.toLocaleString()}) {realizedMetrics.totalRestockExpenditure > 0 ? `- خصم تزويد المخزون (${realizedMetrics.totalRestockExpenditure.toLocaleString()})` : ''}
              </p>
            </div>

            {/* Box 3: النقدية المتوفرة في الخزينة */}
            <div className="border-r border-slate-800 pr-4 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-amber-300">النقدية المتوفرة في الخزينة</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openTreasuryModal('deposit')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
                    title="إيداع / إضافة مبلغ مالي للخزينة"
                  >
                    <Plus className="h-3 w-3" />
                    <span>إيداع مبلغ</span>
                  </button>
                  <button
                    onClick={() => openTreasuryModal('withdrawal')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition cursor-pointer"
                    title="سحب مبلغ مالي أو تسجيل مصروفات من الخزينة"
                  >
                    <Minus className="h-3 w-3" />
                    <span>سحب مبلغ</span>
                  </button>
                </div>
              </div>
              <div className={`text-3xl sm:text-4xl font-black font-mono mt-1.5 ${realizedMetrics.netCashInRegister >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {realizedMetrics.netCashInRegister.toLocaleString()} <span className="text-sm text-slate-400">{config.currency}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                (مبيعات {realizedMetrics.totalSalesCashCollected.toLocaleString()} {realizedMetrics.totalDeposits > 0 ? `+ إيداعات ${realizedMetrics.totalDeposits.toLocaleString()}` : ''}) {realizedMetrics.totalRestockExpenditure > 0 ? `- مشتريات مخزون (${realizedMetrics.totalRestockExpenditure.toLocaleString()})` : ''} {realizedMetrics.totalWithdrawals > 0 ? `- سحوبات (${realizedMetrics.totalWithdrawals.toLocaleString()})` : ''}
              </p>
            </div>
          </div>

          {/* Equation Breakdown Box */}
          <div className="flex flex-col gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-center px-2">
                <span className="text-[10px] text-slate-400 block">صافي المبيعات</span>
                <span className="font-mono font-bold text-white text-sm">{realizedMetrics.netSales.toLocaleString()}</span>
              </div>
              <span className="text-slate-500 font-bold text-base">-</span>
              <div className="text-center px-2 bg-rose-950/40 border border-rose-800/60 rounded-lg p-1">
                <span className="text-[10px] text-rose-300 block font-bold">صافي تكلفة المباعة</span>
                <span className="font-mono font-bold text-rose-400 text-sm">{realizedMetrics.netCostOfSoldGoods.toLocaleString()}</span>
              </div>
              <span className="text-slate-500 font-bold text-base">=</span>
              <div className="text-center px-2 bg-emerald-950/50 border border-emerald-800/60 rounded-lg p-1">
                <span className="text-[10px] text-emerald-400 block font-bold">صافي الربح</span>
                <span className="font-mono font-black text-emerald-300 text-sm">{realizedMetrics.netProfit.toLocaleString()} {config.currency}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-1.5">
              <span className="font-bold text-amber-400">حركة الخزينة:</span>
              <span className="font-mono text-slate-300">
                {realizedMetrics.totalSalesCashCollected.toLocaleString()} مبيعات
                {realizedMetrics.totalDeposits > 0 && ` + ${realizedMetrics.totalDeposits.toLocaleString()} إيداعات`}
                {realizedMetrics.totalRestockExpenditure > 0 && ` - ${realizedMetrics.totalRestockExpenditure.toLocaleString()} مشتريات`}
                {realizedMetrics.totalWithdrawals > 0 && ` - ${realizedMetrics.totalWithdrawals.toLocaleString()} سحوبات`}
                {' = '}
                <strong className={realizedMetrics.netCashInRegister >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {realizedMetrics.netCashInRegister.toLocaleString()} {config.currency}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Blocks Grid with Dedicated Cards for Net Profit & Net COGS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* 1. Gross Sales */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
          <span className="text-xs text-slate-400">إجمالي المبيعات</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-white font-mono">
              {realizedMetrics.grossSales.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            عدد {realizedMetrics.invoiceCount} فواتير
          </span>
        </div>

        {/* 2. Total Returns Block */}
        <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300">إجمالي المرتجعات</span>
            <RotateCcw className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-rose-400 font-mono">
              {realizedMetrics.totalReturnsAmount > 0 ? `-${realizedMetrics.totalReturnsAmount.toLocaleString()}` : '0'}
            </span>
            <span className="text-xs text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[11px] text-rose-300/80 mt-1 block">
            {realizedMetrics.totalReturnedUnits} قطعة مسترجعة
          </span>
        </div>

        {/* 3. Net Sales After Returns */}
        <div className="rounded-2xl border border-sky-900/50 bg-sky-950/20 p-3.5">
          <span className="text-xs text-sky-300 font-semibold">صافي المبيعات</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-white font-mono">
              {realizedMetrics.netSales.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            المبيعات بعد المرتجع
          </span>
        </div>

        {/* 4. DEDICATED CARD: صافي تكلفة البضاعة المباعة */}
        <div className="rounded-2xl border-2 border-rose-500/60 bg-rose-950/30 p-3.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-300">صافي تكلفة البضاعة المباعة</span>
            <ShoppingBag className="h-3.5 w-3.5 text-rose-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-rose-400 font-mono">
              {realizedMetrics.netCostOfSoldGoods.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">{config.currency}</span>
          </div>
          <span className="text-[10.5px] text-slate-300 mt-1 block font-mono">
            {realizedMetrics.totalRestockExpenditure > 0
              ? `(تكلفة ${realizedMetrics.totalCost.toLocaleString()} - تزويد ${realizedMetrics.totalRestockExpenditure.toLocaleString()})`
              : 'تكلفة البضاعة المباعة'}
          </span>
        </div>

        {/* 5. DEDICATED CARD: صافي الربح */}
        <div className="rounded-2xl border-2 border-emerald-500/70 bg-emerald-950/40 p-3.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-300">صافي الربح</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-400 font-mono">
              {realizedMetrics.netProfit.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-300/80">{config.currency}</span>
          </div>
          <span className="text-[10.5px] text-emerald-300/90 mt-1 block font-bold">
            هامش ربح: {realizedMetrics.profitMargin}%
          </span>
        </div>

        {/* 6. Available Cash in Treasury (نقدية الخزينة المتوفرة بعد خصم مشتريات وتزويد المخزون) */}
        <div className="rounded-2xl border-2 border-amber-500/60 bg-slate-900/90 p-3.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">النقدية المتوفرة بالخزينة</span>
            <Wallet className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-black font-mono ${realizedMetrics.netCashInRegister >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {realizedMetrics.netCashInRegister.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">{config.currency}</span>
          </div>
          <div className="mt-1 flex flex-col gap-0.5 text-[10px]">
            <span className="text-slate-300 font-mono">
              مبيعات: +{realizedMetrics.totalSalesCashCollected.toLocaleString()}
            </span>
            {realizedMetrics.totalDeposits > 0 && (
              <span className="text-emerald-400 font-mono">
                إيداعات: +{realizedMetrics.totalDeposits.toLocaleString()}
              </span>
            )}
            {realizedMetrics.totalRestockExpenditure > 0 && (
              <span className="text-rose-400 font-mono">
                مشتريات: -{realizedMetrics.totalRestockExpenditure.toLocaleString()}
              </span>
            )}
            {realizedMetrics.totalWithdrawals > 0 && (
              <span className="text-rose-400 font-mono">
                سحوبات: -{realizedMetrics.totalWithdrawals.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* 7. Outstanding Debt */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5">
          <span className="text-xs text-slate-400">ديون معلقة (آجل)</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-black text-amber-400 font-mono">
              {realizedMetrics.outstandingDebt.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[11px] text-amber-400/80 mt-1 block">
            ديون واجبة التحصيل
          </span>
        </div>
      </div>

      {/* Top 5 Best Selling Audio Equipment */}
      {realizedMetrics.topProducts.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-amber-400" />
            أعلى المعدات الصوتية والإلكترونية مبيعاً وتحقيقاً للأرباح في هذه الفترة
          </h3>

          <div className="space-y-3">
            {realizedMetrics.topProducts.map((p, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs font-mono shrink-0">
                    #{idx + 1}
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-white line-clamp-1">{p.name}</h5>
                    <span className="text-[11px] text-slate-400">
                      تم بيع: <strong className="text-slate-200 font-mono">{p.qty}</strong> قطع
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">إجمالي الإيراد</span>
                    <span className="text-xs font-bold text-white font-mono">
                      {p.revenue.toLocaleString()} {config.currency}
                    </span>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-emerald-400 block font-semibold">صافي الربح</span>
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      +{p.profit.toLocaleString()} {config.currency}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 3: INVOICES LOG & MANUAL DELETION (إمكانية حذف وتتبع الفواتير والمرتجعات) */}
      {/* ============================================================== */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">سجل فواتير المبيعات والمرتجعات وتفاصيل الأرباح</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              متابعة دقيقة لكل عملية بيع أو مرتجع وتأثيرها المالي الفعلي على أرباح وتكاليف المحل
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Filter Tabs between All, Sales, Returns */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setInvoicesFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  invoicesFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                الكل ({filteredInvoices.length})
              </button>
              <button
                onClick={() => setInvoicesFilter('sales')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  invoicesFilter === 'sales'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                المبيعات ({filteredInvoices.filter((i) => i.status !== 'returned').length})
              </button>
              <button
                onClick={() => setInvoicesFilter('returns')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  invoicesFilter === 'returns'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-rose-300 hover:bg-rose-950/40'
                }`}
              >
                <RotateCcw className="h-3 w-3" />
                <span>المرتجعات ({realizedMetrics.returnedInvoicesCount})</span>
              </button>
            </div>

            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو العميل..."
              value={invoiceSearchQuery}
              onChange={(e) => setInvoiceSearchQuery(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden w-full sm:w-56"
            />
          </div>
        </div>

        {searchedInvoices.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            لا توجد فواتير مطابقة للبحث أو التصفية في هذه الفترة
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">رقم الفاتورة</th>
                  <th className="py-2.5 px-3 font-semibold">التاريخ والوقت</th>
                  <th className="py-2.5 px-3 font-semibold">العميل</th>
                  <th className="py-2.5 px-3 font-semibold text-center">القطع المباعة</th>
                  <th className="py-2.5 px-3 font-semibold">قيمة الفاتورة والصافي</th>
                  <th className="py-2.5 px-3 font-semibold">التكلفة الفعلية</th>
                  <th className="py-2.5 px-3 font-semibold text-emerald-400">الربح الصافي</th>
                  <th className="py-2.5 px-3 font-semibold text-center">حالة الفاتورة</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {searchedInvoices.map((inv) => {
                  const isFullReturn = inv.status === 'returned';
                  const isPartialReturn =
                    inv.status === 'partially_returned' || Boolean(inv.returnedAmount && inv.returnedAmount > 0);
                  const returnedAmount = inv.returnedAmount || (isFullReturn ? inv.totalAmount : 0);

                  let effectiveCost = 0;
                  let originalCost = 0;
                  let effectiveSoldUnits = 0;
                  let returnedUnits = 0;

                  for (const it of inv.items) {
                    originalCost += it.costPrice * it.quantity;
                    const rQty = isFullReturn ? it.quantity : Math.min(it.quantity, it.returnedQuantity || 0);
                    returnedUnits += rQty;
                    const sQty = Math.max(0, it.quantity - rQty);
                    effectiveSoldUnits += sQty;
                    effectiveCost += it.costPrice * sQty;
                  }

                  const effectiveRevenue = isFullReturn ? 0 : Math.max(0, inv.totalAmount - returnedAmount);
                  const effectiveProfit = isFullReturn ? 0 : effectiveRevenue - effectiveCost;
                  const isFullyPaid = inv.remainingDebt <= 0;

                  const formattedDate = new Date(inv.createdAt).toLocaleDateString('ar-EG', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={inv.id}
                      className={`transition ${
                        isFullReturn
                          ? 'bg-rose-950/20 hover:bg-rose-950/35 border-r-4 border-r-rose-500'
                          : isPartialReturn
                          ? 'bg-amber-950/15 hover:bg-amber-950/30 border-r-4 border-r-amber-500'
                          : 'hover:bg-slate-950/50'
                      }`}
                    >
                      {/* Invoice Number */}
                      <td className="py-3 px-3 font-mono font-bold text-amber-400">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{inv.invoiceNumber}</span>
                          {isFullReturn && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-rose-600 text-white">
                              مرتجع
                            </span>
                          )}
                          {isPartialReturn && !isFullReturn && (
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-amber-500 text-slate-950">
                              مرتجع جزئي
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-3 text-white font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-500" />
                          <span>{inv.customerName || 'عميل نقدي'}</span>
                        </div>
                      </td>

                      {/* Items Count */}
                      <td className="py-3 px-3 text-center font-mono">
                        {isFullReturn ? (
                          <div>
                            <span className="line-through text-slate-500 text-[11px]">
                              {inv.items.reduce((s, it) => s + it.quantity, 0)}
                            </span>
                            <span className="text-rose-400 font-bold block text-[10.5px]">
                              استرجع {returnedUnits}
                            </span>
                          </div>
                        ) : isPartialReturn ? (
                          <div>
                            <span className="text-slate-200 font-bold">{effectiveSoldUnits} قطعة</span>
                            <span className="text-amber-400 text-[10px] block">
                              (استرجع {returnedUnits})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">
                            {inv.items.reduce((s, it) => s + it.quantity, 0)} قطعة
                          </span>
                        )}
                      </td>

                      {/* Total Amount & Net */}
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {isFullReturn ? (
                          <div>
                            <span className="line-through text-slate-500 text-[11px] block">
                              {inv.totalAmount.toLocaleString()} {config.currency}
                            </span>
                            <span className="text-rose-400 font-bold text-xs">
                              0 {config.currency} (مسترجع بالكامل)
                            </span>
                          </div>
                        ) : isPartialReturn ? (
                          <div>
                            <span className="font-bold text-white text-xs block">
                              {effectiveRevenue.toLocaleString()} {config.currency}
                            </span>
                            <span className="text-amber-400 text-[10.5px] block font-mono">
                              -(مسترجع {returnedAmount.toLocaleString()})
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-white">
                            {inv.totalAmount.toLocaleString()} {config.currency}
                          </span>
                        )}
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {isFullReturn ? (
                          <div>
                            <span className="line-through text-slate-500 text-[11px] block">
                              {originalCost.toLocaleString()}
                            </span>
                            <span className="text-slate-400 text-xs">0 {config.currency}</span>
                          </div>
                        ) : isPartialReturn ? (
                          <div>
                            <span className="text-slate-300 font-semibold block text-xs">
                              {effectiveCost.toLocaleString()} {config.currency}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {originalCost.toLocaleString()} {config.currency}
                          </span>
                        )}
                      </td>

                      {/* Profit */}
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {isFullReturn ? (
                          <span className="font-bold text-slate-400 text-xs">
                            0.00 {config.currency}
                          </span>
                        ) : (
                          <span className="font-black text-emerald-400 text-xs">
                            +{effectiveProfit.toLocaleString()} {config.currency}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isFullReturn ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                            <RotateCcw className="h-3 w-3" />
                            مرتجع بالكامل
                          </span>
                        ) : isPartialReturn ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <RotateCcw className="h-3 w-3" />
                            مرتجع جزئي
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              isFullyPaid
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80'
                                : 'bg-rose-950/60 text-rose-400 border border-rose-800/80'
                            }`}
                          >
                            {isFullyPaid ? 'خالص بالكامل' : `متبقي ${inv.remainingDebt.toLocaleString()}`}
                          </span>
                        )}
                      </td>

                      {/* Actions: View / Delete */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewInvoice(inv)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            title="عرض وطباعة الفاتورة ومشاركتها عبر واتساب"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setInvoiceToDelete(inv)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-900/50 transition cursor-pointer"
                            title="حذف هذه الفاتورة يدوياً من التقارير"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SECTION 4: INVENTORY RESTOCK & DEDUCTIONS AUDIT LOG */}
      {/* (سجل مشتريات وتزويد المخزون وخصمها من الخزينة وتكلفة البضاعة المباعة) */}
      {/* ============================================================== */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">
                سجل مشتريات وتزويد المخزون وخصمها من الخزينة وتكلفة المباعة
              </h3>
              <span className="rounded-full bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 font-bold">
                {filteredRestocks.length} عملية تزويد
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              بيان تفصيلي لكل عملية زيادة في المخزون وسعر التكلفة المخصوم مباشرة من نقدية الخزينة وتكلفة البضاعة المباعة
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="بحث باسم المنتج، القسم، أو السبب..."
              value={restockSearchQuery}
              onChange={(e) => setRestockSearchQuery(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden w-full sm:w-64"
            />
          </div>
        </div>

        {searchedRestocks.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            {restockRecords.length === 0
              ? 'لا توجد عمليات تزويد مسجلة حتى الآن. عند إضافة أو زيادة أي كمية في المخزون ستظهر هنا وتُخصم تكلفتها من نقدية الخزينة وتكلفة البضاعة المباعة تلقائياً.'
              : 'لا توجد عمليات تزويد مخزون مطابقة للبحث أو التصفية في هذه الفترة'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">التاريخ والوقت</th>
                  <th className="py-2.5 px-3 font-semibold">المنتج / الصنف</th>
                  <th className="py-2.5 px-3 font-semibold">القسم</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الكمية المضافة</th>
                  <th className="py-2.5 px-3 font-semibold">سعر التكلفة للقطعة</th>
                  <th className="py-2.5 px-3 font-semibold text-rose-300">خصم من الخزينة والمباعة</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الرصيد (قبل / بعد)</th>
                  <th className="py-2.5 px-3 font-semibold">السبب والبيان</th>
                  <th className="py-2.5 px-3 font-semibold text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {searchedRestocks.map((rec) => {
                  const recDate = new Date(rec.date);
                  const formattedDate = recDate.toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const formattedTime = recDate.toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={rec.id} className="hover:bg-slate-950/40">
                      {/* Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                          <Calendar className="h-3 w-3 text-slate-500" />
                          <span>{formattedDate}</span>
                          <span className="text-slate-500 text-[10px]">{formattedTime}</span>
                        </div>
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-white block">{rec.productName}</span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="text-slate-400 text-[11px]">{rec.category || 'عام'}</span>
                      </td>

                      {/* Quantity Added */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="inline-flex items-center gap-0.5 font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          +{rec.quantityAdded}
                        </span>
                      </td>

                      {/* Cost per unit */}
                      <td className="py-3 px-3 font-mono whitespace-nowrap text-slate-300">
                        {rec.unitCostPrice.toLocaleString()} {config.currency}
                      </td>

                      {/* Total Deducted Cost */}
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        <span className="font-black text-rose-400 text-xs bg-rose-950/40 px-2 py-1 rounded-md border border-rose-900/50 block w-fit">
                          -{rec.totalCostDeducted.toLocaleString()} {config.currency}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">خصم من الخزينة والمباعة</span>
                      </td>

                      {/* Previous / New Stock */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap text-[11px]">
                        <span className="text-slate-400">{rec.previousStock}</span>
                        <span className="text-slate-600 mx-1">←</span>
                        <span className="font-bold text-emerald-400">{rec.newStock}</span>
                      </td>

                      {/* Reason / Explanation */}
                      <td className="py-3 px-3 text-slate-300 max-w-xs">
                        <div className="flex items-start gap-1.5">
                          <Info className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span className="text-[11px] leading-relaxed text-slate-300">{rec.reason}</span>
                        </div>
                      </td>

                      {/* Action: Delete restock record */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setRestockToDelete(rec)}
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-900/50 transition cursor-pointer"
                          title="حذف هذا القيد واستعادة المبلغ المخصوم لصافي الأرباح"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SECTION 5: TREASURY CASH FLOW (حركات الخزينة: إيداع وسحب نقدية) */}
      {/* ============================================================== */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">
                سجل حركات الخزينة (إيداع وسحب مبالغ مالية ومصروفات)
              </h3>
              <span className="rounded-full bg-amber-500/20 text-amber-300 text-[10px] px-2.5 py-0.5 font-bold">
                {filteredTreasuryTx.length} حركة مسجلة
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              تسجيل ومتابعة كافة المبالغ المودعة والمسحوبة والمصروفات النثرية مع توثيق السبب والتأثير المباشر على رصيد الخزينة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openTreasuryModal('deposit')}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>إيداع مبلغ بالخزينة</span>
            </button>

            <button
              onClick={() => openTreasuryModal('withdrawal')}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
            >
              <Minus className="h-4 w-4" />
              <span>سحب مبلغ / مصروفات</span>
            </button>
          </div>
        </div>

        {/* Quick Treasury Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-300 font-semibold block">إجمالي الإيداعات الإضافية (+)</span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                +{treasuryMetrics.totalDeposits.toLocaleString()} {config.currency}
              </span>
            </div>
            <ArrowUpCircle className="h-6 w-6 text-emerald-400 opacity-80" />
          </div>

          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-rose-300 font-semibold block">إجمالي السحوبات والمصروفات (-)</span>
              <span className="text-xl font-black text-rose-400 font-mono">
                -{treasuryMetrics.totalWithdrawals.toLocaleString()} {config.currency}
              </span>
            </div>
            <ArrowDownCircle className="h-6 w-6 text-rose-400 opacity-80" />
          </div>

          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-amber-300 font-semibold block">صافي حركة الخزينة اليدوية</span>
              <span className={`text-xl font-black font-mono ${treasuryMetrics.netAdjustment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {treasuryMetrics.netAdjustment >= 0 ? '+' : ''}{treasuryMetrics.netAdjustment.toLocaleString()} {config.currency}
              </span>
            </div>
            <ArrowRightLeft className="h-6 w-6 text-amber-400 opacity-80" />
          </div>
        </div>

        {/* Controls: Search and Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setTreasuryTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                treasuryTypeFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل ({filteredTreasuryTx.length})
            </button>
            <button
              onClick={() => setTreasuryTypeFilter('deposit')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                treasuryTypeFilter === 'deposit'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-emerald-300 hover:bg-emerald-950/40'
              }`}
            >
              إيداعات فقط ({filteredTreasuryTx.filter((t) => t.type === 'deposit').length})
            </button>
            <button
              onClick={() => setTreasuryTypeFilter('withdrawal')}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                treasuryTypeFilter === 'withdrawal'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-rose-300 hover:bg-rose-950/40'
              }`}
            >
              سحوبات ومصروفات ({filteredTreasuryTx.filter((t) => t.type === 'withdrawal').length})
            </button>
          </div>

          <input
            type="text"
            placeholder="بحث في حركات الخزينة والبيان..."
            value={treasurySearchQuery}
            onChange={(e) => setTreasurySearchQuery(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden w-full sm:w-64"
          />
        </div>

        {/* Transactions Table */}
        {searchedTreasuryTx.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            {treasuryTransactions.length === 0
              ? 'لا توجد حركات إيداع أو سحب مسجلة بالخزينة حتى الآن. يمكنك إضافة رصيد افتتاحي أو تسجيل مصروفات من الأزرار أعلاه.'
              : 'لا توجد حركات خزينة مطابقة للبحث أو التصفية الحالية.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-semibold text-center w-8">م</th>
                  <th className="py-2.5 px-3 font-semibold">التاريخ والوقت</th>
                  <th className="py-2.5 px-3 font-semibold text-center">نوع الحركة</th>
                  <th className="py-2.5 px-3 font-semibold">المبلغ</th>
                  <th className="py-2.5 px-3 font-semibold">البيان / السبب</th>
                  <th className="py-2.5 px-3 font-semibold">التصنيف</th>
                  <th className="py-2.5 px-3 font-semibold">المسؤول</th>
                  <th className="py-2.5 px-3 font-semibold text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {searchedTreasuryTx.map((tx, idx) => {
                  const isDeposit = tx.type === 'deposit';
                  const formattedDate = new Date(tx.date).toLocaleDateString('ar-EG', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-950/50 transition">
                      <td className="py-3 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1 font-sans">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>{formattedDate}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-sans">
                        {isDeposit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                            <ArrowUpCircle className="h-3 w-3" />
                            إيداع نقدي (+)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800">
                            <ArrowDownCircle className="h-3 w-3" />
                            سحب ومصروفات (-)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`text-sm font-black ${isDeposit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isDeposit ? '+' : '-'}{tx.amount.toLocaleString()} {config.currency}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-white font-sans font-medium max-w-xs">
                        <div>{tx.reason}</div>
                        {tx.notes && <div className="text-[10px] text-slate-400 mt-0.5">{tx.notes}</div>}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {tx.category || (isDeposit ? 'إيداع' : 'مصروفات')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-sans text-[11px]">
                        {tx.performedBy}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setTreasuryTxToDelete(tx)}
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-900/50 transition cursor-pointer"
                          title="حذف هذه الحركة المالية"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: RESET ALL REPORTS CONFIRMATION */}
      {/* ============================================================== */}
      {isResetAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">تصفير كافة الأرباح والتقارير</h4>
                <p className="text-xs text-rose-300">إجراء لإعادة ضبط الحسابات إلى الصفر</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mt-3">
              هل أنت متأكد من رغبتك في <strong>تصفير كافة سجلات المبيعات والأرباح وحركة الخزينة</strong>؟
              <br />
              <span className="text-rose-400 block mt-2 font-semibold">
                • سيتم حذف جميع فواتير المبيعات المسجلة وتصفير صافي الأرباح المحققة والإيرادات.
                <br />
                • سيتم تصفير سجل مشتريات وتزويد المخزون وإعادة نقدية الخزينة إلى نقطة الصفر.
                <br />
                • لن يتم حذف أي منتج من المخزن أو التأثير على قائمة البضاعة الحالية.
              </span>
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsResetAllModalOpen(false)}
                disabled={isProcessing}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={handleResetAllReports}
                disabled={isProcessing}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>تأكيد تصفير الأرباح الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: DELETE INDIVIDUAL INVOICE CONFIRMATION */}
      {/* ============================================================== */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">حذف فاتورة مبيعات</h4>
                <p className="text-xs text-rose-300">
                  الفاتورة: {invoiceToDelete.invoiceNumber}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mt-3">
              هل تريد بالتأكيد حذف هذه الفاتورة الخاصة بالعميل <strong>{invoiceToDelete.customerName}</strong> بقيمة <strong>{invoiceToDelete.totalAmount.toLocaleString()} {config.currency}</strong>؟
              <br />
              <span className="text-amber-400 block mt-2 text-[11px]">
                سيتم استبعاد إيراداتها وأرباحها المحققة ({invoiceToDelete.totalAmount - invoiceToDelete.items.reduce((s, it) => s + it.costPrice * it.quantity, 0)} {config.currency}) من التقارير فوراً.
              </span>
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setInvoiceToDelete(null)}
                disabled={isProcessing}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteSingleInvoice}
                disabled={isProcessing}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>حذف الفاتورة وتحديث الأرباح</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: CONFIRM DELETE RESTOCK RECORD */}
      {/* ============================================================== */}
      {restockToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-amber-700 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-700">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">حذف قيد تزويد المخزون</h4>
                <p className="text-xs text-amber-300">إلغاء خصم تكلفة الشراء من الخزينة وتكلفة البضاعة المباعة</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mt-3">
              هل أنت متأكد من رغبتك في حذف قيد تزويد بضاعة المنتج{' '}
              <strong className="text-white">"{restockToDelete.productName}"</strong> بمقدار{' '}
              <strong className="text-amber-300 font-mono">+{restockToDelete.quantityAdded} قطعة</strong>؟
              <br />
              <span className="text-amber-300 block mt-2 font-semibold">
                • سيتم إلغاء خصم تكلفة الشراء (+{restockToDelete.totalCostDeducted.toLocaleString()} {config.currency}) واستعادتها لنقدية الخزينة وتكلفة المباعة فوراً.
              </span>
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setRestockToDelete(null)}
                disabled={isProcessing}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteRestockRecord}
                disabled={isProcessing}
                className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 shadow-lg shadow-amber-600/30 transition cursor-pointer"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>تأكيد الحذف واستعادة الربح</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: TREASURY DEPOSIT OR WITHDRAWAL MODAL */}
      {/* ============================================================== */}
      {isTreasuryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl my-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    treasuryModalType === 'deposit'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {treasuryModalType === 'deposit' ? (
                    <ArrowUpCircle className="h-6 w-6" />
                  ) : (
                    <ArrowDownCircle className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">
                    {treasuryModalType === 'deposit'
                      ? 'إيداع / إضافة مبلغ مالي للخزينة'
                      : 'سحب مبلغ مالي / تسجيل مصروفات من الخزينة'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {treasuryModalType === 'deposit'
                      ? 'زيادة في السيولة النقدية المتوفرة بدرج الكاشير / الخزينة'
                      : 'خصم من النقدية المتوفرة في الخزينة وتسجيل المصروف'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTreasuryModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Type Toggle Tabs */}
            <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTreasuryModalType('deposit');
                  if (!treasuryCategoryInput || treasuryCategoryInput === 'مصروفات تشغيلية') {
                    setTreasuryCategoryInput('إيداع نقدي');
                  }
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition cursor-pointer ${
                  treasuryModalType === 'deposit'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>إيداع مبلغ (+)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTreasuryModalType('withdrawal');
                  if (!treasuryCategoryInput || treasuryCategoryInput === 'إيداع نقدي') {
                    setTreasuryCategoryInput('مصروفات تشغيلية');
                  }
                }}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition cursor-pointer ${
                  treasuryModalType === 'withdrawal'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Minus className="h-4 w-4" />
                <span>سحب مصروفات (-)</span>
              </button>
            </div>

            <form onSubmit={handleSaveTreasuryTransaction} className="mt-4 space-y-4">
              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  المبلغ المالي ({config.currency}): <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    required
                    placeholder="0.00"
                    value={treasuryAmountInput}
                    onChange={(e) => setTreasuryAmountInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pr-3 pl-12 text-sm text-white font-mono font-bold placeholder-slate-500 focus:border-amber-500 focus:outline-hidden"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                    {config.currency}
                  </span>
                </div>
              </div>

              {/* Reason / Statement Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  البيان والسبب: <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    treasuryModalType === 'deposit'
                      ? 'مثال: رصيد بداية اليوم، سيولة من المالك، تحصيل نقدي...'
                      : 'مثال: مصاريف نقل، إيجار المحل، فواتير كهرباء، بوفيه، سحب شخصي...'
                  }
                  value={treasuryReasonInput}
                  onChange={(e) => setTreasuryReasonInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 px-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-hidden"
                />

                {/* Quick Suggestion Chips */}
                <div className="mt-2">
                  <span className="text-[10px] text-slate-400 block mb-1">اقتراحات سريعة بنقرة واحدة:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(treasuryModalType === 'deposit'
                      ? [
                          'رصيد بداية اليوم / الوردية',
                          'سيولة نقدية مضافة من المالك',
                          'تحصيل خارجي / سداد نقدي',
                          'استرداد عهدة مؤقتة',
                        ]
                      : [
                          'مصاريف نقل وتوصيل',
                          'بوفيه ومشروبات وضيافة',
                          'فواتير كهرباء ومياه وإنترنت',
                          'إيجار المحل',
                          'سحب أرباح شخصية للمالك',
                          'أدوات نظافة ومستلزمات',
                          'قطع غيار وصيانة عاجلة',
                        ]
                    ).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setTreasuryReasonInput(suggestion);
                          if (treasuryModalType === 'withdrawal') {
                            if (suggestion.includes('إيجار')) setTreasuryCategoryInput('إيجار');
                            else if (suggestion.includes('فواتير')) setTreasuryCategoryInput('فواتير وخدمات');
                            else if (suggestion.includes('أرباح')) setTreasuryCategoryInput('سحب أرباح');
                            else setTreasuryCategoryInput('مصروفات تشغيلية');
                          }
                        }}
                        className="rounded-lg bg-slate-800/90 hover:bg-slate-750 px-2 py-1 text-[10.5px] text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  التصنيف (اختياري):
                </label>
                <input
                  type="text"
                  placeholder="مثال: مصروفات تشغيلية، عهدة، إيجار، إيداع مالك..."
                  value={treasuryCategoryInput}
                  onChange={(e) => setTreasuryCategoryInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظات إضافية (اختياري):
                </label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل أو ملاحظات إضافية ترغب بتسجيلها..."
                  value={treasuryNotesInput}
                  onChange={(e) => setTreasuryNotesInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 px-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTreasuryModalOpen(false)}
                  disabled={isProcessing}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer ${
                    treasuryModalType === 'deposit'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  }`}
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : treasuryModalType === 'deposit' ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                  <span>
                    {treasuryModalType === 'deposit'
                      ? 'تأكيد إضافة المبلغ للخزينة'
                      : 'تأكيد سحب المبلغ من الخزينة'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: DELETE TREASURY TRANSACTION CONFIRMATION */}
      {/* ============================================================== */}
      {treasuryTxToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-800 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-950/60 border border-rose-800">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">حذف حركة خزينة</h4>
                <p className="text-xs text-rose-300">
                  {treasuryTxToDelete.type === 'deposit' ? 'إلغاء إيداع نقدي' : 'إلغاء سحب نقدي'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mt-3">
              هل أنت متأكد من رغبتك في حذف حركة{' '}
              <strong className="text-white">"{treasuryTxToDelete.reason}"</strong> بقيمة{' '}
              <strong className="text-amber-400 font-mono">
                {treasuryTxToDelete.amount.toLocaleString()} {config.currency}
              </strong>
              ؟
              <br />
              <span className="text-slate-400 block mt-2">
                سيتم تحديث رصيد الخزينة تلقائياً فور الحذف.
              </span>
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setTreasuryTxToDelete(null)}
                disabled={isProcessing}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDeleteTreasuryTransaction(treasuryTxToDelete.id)}
                disabled={isProcessing}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                {isProcessing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>تأكيد حذف الحركة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
