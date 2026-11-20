import React, { useState, useMemo } from 'react';
import { Invoice, StoreConfig, Customer, Product } from '../types';
import { StorageService } from '../services/storage';
import * as XLSX from 'xlsx';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  Download,
  Share2,
  Printer,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  MessageCircle,
  Plus,
  RefreshCw,
  TrendingUp,
  CreditCard,
  Wallet,
  ArrowUpDown,
  ShoppingBag,
  ExternalLink,
  X,
  FileSpreadsheet,
  RotateCcw,
  PackageCheck,
  Loader2,
  Undo2,
  Edit3,
} from 'lucide-react';

interface InvoicesViewProps {
  invoices: Invoice[];
  customers: Customer[];
  config: StoreConfig;
  onRefreshData: () => Promise<void>;
  onViewInvoice: (invoice: Invoice, initialAction?: 'print' | 'whatsapp' | 'image' | null) => void;
  onNavigateToPOS: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  customers,
  config,
  onRefreshData,
  onViewInvoice,
  onNavigateToPOS,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'paid' | 'debt' | 'month' | 'returned'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Return & Refund Modal state
  const [returnInvoice, setReturnInvoice] = useState<Invoice | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnToStockMap, setReturnToStockMap] = useState<Record<string, boolean>>({});
  const [returnReason, setReturnReason] = useState<string>('رغبة العميل (عدم الحاجة)');
  const [customReason, setCustomReason] = useState<string>('');
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  const openReturnModal = (inv: Invoice) => {
    setReturnInvoice(inv);
    setReturnError(null);
    setReturnReason('رغبة العميل (عدم الحاجة)');
    setCustomReason('');
    const initQtys: Record<string, number> = {};
    const initStock: Record<string, boolean> = {};
    for (const item of inv.items) {
      const remainingQty = item.quantity - (item.returnedQuantity || 0);
      initQtys[item.productId] = remainingQty > 0 ? remainingQty : 0;
      initStock[item.productId] = true;
    }
    setReturnQuantities(initQtys);
    setReturnToStockMap(initStock);
  };

  const closeReturnModal = () => {
    setReturnInvoice(null);
    setReturnError(null);
    setIsProcessingReturn(false);
  };

  const handleExecuteReturn = async () => {
    if (!returnInvoice) return;
    setReturnError(null);

    const returnItems = returnInvoice.items
      .map((item) => {
        const qty = returnQuantities[item.productId] || 0;
        const returnStock = returnToStockMap[item.productId] ?? true;
        return {
          productId: item.productId,
          quantity: qty,
          returnToStock: returnStock,
        };
      })
      .filter((i) => i.quantity > 0);

    if (returnItems.length === 0) {
      setReturnError('يرجى تحديد كمية قطعة واحدة على الأقل للاسترجاع.');
      return;
    }

    setIsProcessingReturn(true);
    try {
      const reasonText =
        returnReason === 'أخرى' && customReason.trim()
          ? customReason.trim()
          : returnReason;

      await StorageService.processInvoiceReturn({
        invoiceId: returnInvoice.id,
        items: returnItems,
        reason: reasonText,
      });

      const totalItemsReturned = returnItems.reduce((acc, it) => acc + it.quantity, 0);
      await onRefreshData();
      closeReturnModal();
      setNotificationMsg(`تم استرجاع عدد (${totalItemsReturned}) قطعة وإعادتها إلى رصيد المخزن بنجاح!`);
      setTimeout(() => setNotificationMsg(null), 4000);
    } catch (err: unknown) {
      console.error('Failed to process return', err);
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ عملية الاسترجاع';
      setReturnError(`تعذر الاسترجاع: ${msg}`);
    } finally {
      setIsProcessingReturn(false);
    }
  };

  // 1. Calculate overall metrics
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalSales = 0;
    let totalPaid = 0;
    let totalDebt = 0;
    let todayCount = 0;
    let todaySales = 0;
    let returnedCount = 0;

    for (const inv of invoices) {
      totalSales += inv.totalAmount;
      totalPaid += inv.paidAmount;
      totalDebt += inv.remainingDebt;

      const isRet = inv.status === 'returned' || inv.status === 'partially_returned' || Boolean(inv.returnedAmount && inv.returnedAmount > 0);
      if (isRet) {
        returnedCount += 1;
      }

      const invDateStr = inv.createdAt.split('T')[0];
      if (invDateStr === todayStr) {
        todayCount += 1;
        todaySales += inv.totalAmount;
      }
    }

    return {
      totalCount: invoices.length,
      totalSales,
      totalPaid,
      totalDebt,
      todayCount,
      todaySales,
      returnedCount,
    };
  }, [invoices]);

  // 2. Filter & search invoices
  const filteredInvoices = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return invoices.filter((inv) => {
      // Text search in number, customer name, phone, or items
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = inv.invoiceNumber.toLowerCase().includes(q);
        const nameMatch = inv.customerName.toLowerCase().includes(q);
        const phoneMatch = inv.customerPhone?.toLowerCase().includes(q);
        const itemsMatch = inv.items.some((it) => it.productName.toLowerCase().includes(q));

        if (!numMatch && !nameMatch && !phoneMatch && !itemsMatch) {
          return false;
        }
      }

      // Quick filter
      const invDateStr = inv.createdAt.split('T')[0];
      if (statusFilter === 'today' && invDateStr !== todayStr) return false;
      if (statusFilter === 'paid' && inv.remainingDebt > 0) return false;
      if (statusFilter === 'debt' && inv.remainingDebt <= 0) return false;
      if (statusFilter === 'month' && !inv.createdAt.startsWith(currentMonthPrefix)) return false;
      if (statusFilter === 'returned') {
        const isRet = inv.status === 'returned' || inv.status === 'partially_returned' || Boolean(inv.returnedAmount && inv.returnedAmount > 0);
        if (!isRet) return false;
      }

      // Custom date range filter
      if (startDate && invDateStr < startDate) return false;
      if (endDate && invDateStr > endDate) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'date-asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'amount-desc') return b.totalAmount - a.totalAmount;
      if (sortBy === 'amount-asc') return a.totalAmount - b.totalAmount;
      return 0;
    });
  }, [invoices, searchQuery, statusFilter, startDate, endDate, sortBy]);

  // Handle single invoice deletion
  const handleDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      await StorageService.deleteInvoice(invoiceToDelete.id);
      await onRefreshData();
      setNotificationMsg(`تم حذف الفاتورة ${invoiceToDelete.invoiceNumber} بنجاح.`);
      setInvoiceToDelete(null);
      setTimeout(() => setNotificationMsg(null), 3500);
    } catch (err) {
      console.error('Failed to delete invoice', err);
      alert('حدث خطأ أثناء حذف الفاتورة');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export invoices to Excel
  const handleExportExcel = () => {
    if (filteredInvoices.length === 0) {
      alert('لا توجد فواتير لتصديرها طبقاً للفلتر الحالي');
      return;
    }

    const data = filteredInvoices.map((inv, idx) => ({
      'م': idx + 1,
      'رقم الفاتورة': inv.invoiceNumber,
      'التاريخ': new Date(inv.createdAt).toLocaleDateString('ar-EG'),
      'الوقت': new Date(inv.createdAt).toLocaleTimeString('ar-EG'),
      'اسم العميل': inv.customerName,
      'هاتف العميل': inv.customerPhone || '—',
      'عدد الأصناف': inv.items.reduce((sum, it) => sum + it.quantity, 0),
      'إجمالي الأصناف': inv.items.map((it) => `${it.productName} (${it.quantity})`).join('، '),
      'المجموع الفرعي': inv.subtotal,
      'الخصم': inv.discount,
      'الصافي الإجمالي': inv.totalAmount,
      'المدفوع نقداً': inv.paidAmount,
      'المتبقي كدين': inv.remainingDebt,
      'حالة السداد': inv.remainingDebt > 0 ? 'دين آجل' : 'مسدد بالكامل',
      'تاريخ الاستحقاق': inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('ar-EG') : '—',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل الفواتير');
    const fileName = `فواتير_${config.storeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    setNotificationMsg('تم تصدير ملف إكسيل الفواتير بنجاح!');
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">سجل الفواتير والمبيعات</h2>
              <p className="text-xs text-slate-400">
                إدارة وعرض وتصدير فواتير {config.storeName} مع دعم الحفظ كصورة والمشاركة على واتساب
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition cursor-pointer"
            title="تصدير الفواتير الحالية كملف إكسيل"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={onNavigateToPOS}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold shadow-md shadow-amber-500/20 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إصدار فاتورة جديدة</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notificationMsg && (
        <div className="rounded-xl bg-emerald-950/80 border border-emerald-700 p-3 text-xs text-emerald-200 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{notificationMsg}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 5 Top Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Invoices */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium">إجمالي الفواتير</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {metrics.totalCount.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">فاتورة مسجلة بالنظام</div>
          </div>
        </div>

        {/* Total Sales */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium">إجمالي المبيعات</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
              {metrics.totalSales.toLocaleString()} <span className="text-xs text-amber-300 font-normal">{config.currency}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">قيمة صافي الفواتير</div>
          </div>
        </div>

        {/* Paid Cash */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium">المحصل نقداً</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {metrics.totalPaid.toLocaleString()} <span className="text-xs text-emerald-300 font-normal">{config.currency}</span>
            </div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">كاش تم تحصيله</div>
          </div>
        </div>

        {/* Remaining Debt */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span className="font-medium">ديون آجلة متبقية</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono">
              {metrics.totalDebt.toLocaleString()} <span className="text-xs text-rose-300 font-normal">{config.currency}</span>
            </div>
            <div className="text-[10px] text-rose-400/80 mt-0.5">مبالغ آجلة على العملاء</div>
          </div>
        </div>

        {/* Today's Sales */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-300 text-xs mb-2">
            <span className="font-bold">فواتير اليوم</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {metrics.todaySales.toLocaleString()} <span className="text-xs text-slate-300 font-normal">{config.currency}</span>
            </div>
            <div className="text-[10px] text-amber-300 font-semibold mt-0.5">
              {metrics.todayCount} فاتورة محررة اليوم
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Live Search */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة، اسم العميل، الهاتف، أو اسم المنتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pr-10 pl-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-amber-500 focus:outline-hidden"
            >
              <option value="date-desc">الأحدث تاريخاً أولاً</option>
              <option value="date-asc">الأقدم تاريخاً أولاً</option>
              <option value="amount-desc">الأعلى قيمة أولاً</option>
              <option value="amount-asc">الأقل قيمة أولاً</option>
            </select>
          </div>
        </div>

        {/* Filter Chips + Date Range */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Status Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              الكل ({invoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('today')}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                statusFilter === 'today'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              فواتير اليوم ({metrics.todayCount})
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                statusFilter === 'paid'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              خالصة نقداً ({invoices.filter((i) => i.remainingDebt === 0).length})
            </button>
            <button
              onClick={() => setStatusFilter('debt')}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                statusFilter === 'debt'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              عليها ديون ({invoices.filter((i) => i.remainingDebt > 0).length})
            </button>
            <button
              onClick={() => setStatusFilter('month')}
              className={`px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                statusFilter === 'month'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              فواتير هذا الشهر
            </button>
            <button
              onClick={() => setStatusFilter('returned')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                statusFilter === 'returned'
                  ? 'bg-rose-600 text-white font-bold shadow-md'
                  : 'bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/50'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>المرتجعات ({metrics.returnedCount})</span>
            </button>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>من:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
            />
            <span>إلى:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-xs text-amber-400 hover:underline cursor-pointer"
              >
                إلغاء التاريخ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoices List Display */}
      {filteredInvoices.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">لا توجد فواتير مطابقة</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
            لم يتم العثور على أي فواتير بالبحث أو الفلتر المختار. يمكنك مسح البحث أو إصدار فاتورة جديدة.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setStartDate('');
                setEndDate('');
              }}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              إلغاء الفلاتر
            </button>
            <button
              onClick={onNavigateToPOS}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              إصدار فاتورة بيع جديدة
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Result Count Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              عرض <strong className="text-amber-400 font-mono">{filteredInvoices.length}</strong> فاتورة
            </span>
            <span className="text-[11px]">
              إجمالي القيمة المعروضة:{' '}
              <strong className="text-white font-mono">
                {filteredInvoices.reduce((s, i) => s + i.totalAmount, 0).toLocaleString()} {config.currency}
              </strong>
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">الأصناف</th>
                  <th className="py-3 px-4 text-left">إجمالي الفاتورة</th>
                  <th className="py-3 px-4 text-left">المدفوع / المتبقي</th>
                  <th className="py-3 px-4 text-center">حالة السداد</th>
                  <th className="py-3 px-4 text-center w-52">خيارات الفاتورة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredInvoices.map((inv, idx) => {
                  const isDebt = inv.remainingDebt > 0;
                  const totalItemsCount = inv.items.reduce((acc, it) => acc + it.quantity, 0);
                  const isReturned = inv.status === 'returned';
                  const isPartialReturn = inv.status === 'partially_returned' || Boolean(inv.returnedAmount && inv.returnedAmount > 0);

                  return (
                    <tr
                      key={inv.id}
                      className={`transition group cursor-pointer ${
                        isReturned
                          ? 'bg-rose-950/25 hover:bg-rose-950/45 border-r-4 border-r-rose-500'
                          : isPartialReturn
                          ? 'bg-amber-950/20 hover:bg-amber-950/35 border-r-4 border-r-amber-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                      onClick={() => onViewInvoice(inv, null)}
                    >
                      <td className="py-3 px-4 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-amber-400 group-hover:underline">
                            {inv.invoiceNumber}
                          </span>
                          {isReturned && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10.5px] font-black bg-rose-600 text-white shadow-xs">
                              <RotateCcw className="h-3 w-3 shrink-0" />
                              مرتجع بالكامل
                            </span>
                          )}
                          {isPartialReturn && !isReturned && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10.5px] font-black bg-amber-500 text-slate-950 shadow-xs">
                              <RotateCcw className="h-3 w-3 shrink-0" />
                              مرتجع جزئي
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                        <div>{new Date(inv.createdAt).toLocaleDateString('ar-EG')}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(inv.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white">{inv.customerName}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewInvoice(inv, null);
                            }}
                            className="text-slate-400 hover:text-amber-400 p-0.5 rounded cursor-pointer"
                            title="تعديل اسم العميل عبر معاينة الفاتورة"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {inv.customerPhone && (
                          <div className="font-mono text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 text-slate-500" />
                            {inv.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div className="font-medium text-slate-200">
                          {totalItemsCount} قطعة ({inv.items.length} أصناف)
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]" title={inv.items.map((i) => i.productName).join('، ')}>
                          {inv.items.map((i) => i.productName).join('، ')}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-white text-sm">
                        {inv.totalAmount.toLocaleString()} {config.currency}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs">
                        <div className="text-emerald-400">
                          مدفوع: {inv.paidAmount.toLocaleString()}
                        </div>
                        {isDebt && (
                          <div className="text-rose-400 font-bold">
                            باقي: {inv.remainingDebt.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-600 text-white border border-rose-500 shadow-sm">
                            <RotateCcw className="h-3.5 w-3.5" />
                            مرتجع بالكامل
                          </span>
                        ) : isPartialReturn ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/25 text-amber-300 border border-amber-500/40">
                              <RotateCcw className="h-3 w-3" />
                              مرتجع جزئي
                            </span>
                            {inv.returnedAmount ? (
                              <span className="text-[10px] text-amber-400 font-mono">
                                (مسترجع {inv.returnedAmount.toLocaleString()})
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              !isDebt
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {!isDebt ? 'خالصة' : 'دين مستحق'}
                          </span>
                        )}
                      </td>
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()} // Prevent row click
                      >
                        <div className="flex items-center justify-center gap-1">
                          {/* VIEW & PRINT */}
                          <button
                            onClick={() => onViewInvoice(inv, null)}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                            title="معاينة وطباعة الفاتورة"
                          >
                            <Eye className="h-4 w-4 text-blue-400" />
                          </button>

                          {/* RETURN / REFUND TO STOCK */}
                          {inv.status !== 'returned' && (
                            <button
                              onClick={() => openReturnModal(inv)}
                              className="rounded-lg p-1.5 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition cursor-pointer"
                              title="استرجاع منتجات وإعادتها للمخزن"
                            >
                              <RotateCcw className="h-4 w-4 text-amber-400" />
                            </button>
                          )}

                          {/* SAVE AS IMAGE */}
                          <button
                            onClick={() => onViewInvoice(inv, 'image')}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                            title="حفظ الفاتورة كصورة PNG عالية الدقة"
                          >
                            <Download className="h-4 w-4 text-cyan-400" />
                          </button>

                          {/* WHATSAPP SHARE AS IMAGE */}
                          <button
                            onClick={() => onViewInvoice(inv, 'whatsapp')}
                            className="rounded-lg p-1.5 text-[#25D366] hover:bg-[#25D366]/20 transition cursor-pointer"
                            title="مشاركة صورة الفاتورة عبر واتساب"
                          >
                            <MessageCircle className="h-4 w-4 fill-[#25D366]" />
                          </button>

                          {/* PRINT */}
                          <button
                            onClick={() => onViewInvoice(inv, 'print')}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                            title="طباعة حرارية مباشرة"
                          >
                            <Printer className="h-4 w-4 text-amber-400" />
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={() => setInvoiceToDelete(inv)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition cursor-pointer"
                            title="حذف هذه الفاتورة من السجل"
                          >
                            <Trash2 className="h-4 w-4 text-rose-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Cards View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3">
            {filteredInvoices.map((inv) => {
              const isDebt = inv.remainingDebt > 0;
              const totalItemsCount = inv.items.reduce((acc, it) => acc + it.quantity, 0);
              const isReturned = inv.status === 'returned';
              const isPartialReturn = inv.status === 'partially_returned' || Boolean(inv.returnedAmount && inv.returnedAmount > 0);

              return (
                <div
                  key={inv.id}
                  className={`rounded-2xl border p-4 space-y-3 shadow-lg transition ${
                    isReturned
                      ? 'border-rose-600/70 bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-900/95 ring-1 ring-rose-500/30'
                      : isPartialReturn
                      ? 'border-amber-600/60 bg-gradient-to-br from-amber-950/30 via-slate-900/90 to-slate-900/95 ring-1 ring-amber-500/30'
                      : 'border-slate-800 bg-slate-900/80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between border-b border-slate-800/80 pb-2.5">
                    <div>
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {inv.invoiceNumber}
                        </span>
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-xs">
                            <RotateCcw className="h-3 w-3" />
                            مرتجع بالكامل
                          </span>
                        ) : isPartialReturn ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 shadow-xs">
                            <RotateCcw className="h-3 w-3" />
                            مرتجع جزئي
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              !isDebt
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {!isDebt ? 'خالصة' : 'دين مستحق'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {new Date(inv.createdAt).toLocaleDateString('ar-EG')} -{' '}
                        {new Date(inv.createdAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <div className="text-left">
                      <div className="text-base font-black text-white font-mono">
                        {inv.totalAmount.toLocaleString()} {config.currency}
                      </div>
                      {isDebt ? (
                        <div className="text-[11px] text-rose-400 font-bold font-mono">
                          متبقي: {inv.remainingDebt.toLocaleString()}
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-400 font-mono">مسدد بالكامل</div>
                      )}
                    </div>
                  </div>

                  {/* Customer and Items info */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">العميل:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white">{inv.customerName}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewInvoice(inv, null);
                          }}
                          className="text-slate-400 hover:text-amber-400 p-0.5 rounded"
                          title="تعديل اسم العميل"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {inv.customerPhone && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">رقم الهاتف:</span>
                        <span className="font-mono text-amber-300 dir-ltr">{inv.customerPhone}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">الأصناف:</span>
                      <span className="text-slate-200">
                        {totalItemsCount} قطعة ({inv.items.map((i) => i.productName).join('، ')})
                      </span>
                    </div>
                  </div>

                  {/* Actions Grid */}
                  <div className={`pt-2 border-t border-slate-800/80 grid ${inv.status !== 'returned' ? 'grid-cols-5' : 'grid-cols-4'} gap-1.5`}>
                    {/* View */}
                    <button
                      onClick={() => onViewInvoice(inv, null)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-slate-800/90 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                      title="معاينة الفاتورة"
                    >
                      <Eye className="h-3.5 w-3.5 text-blue-400" />
                      <span>معاينة</span>
                    </button>

                    {/* Return / Refund */}
                    {inv.status !== 'returned' && (
                      <button
                        onClick={() => openReturnModal(inv)}
                        className="flex items-center justify-center gap-1 rounded-xl bg-amber-500/15 border border-amber-500/30 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition"
                        title="استرجاع منتجات وإعادتها للمخزن"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-amber-400" />
                        <span>مرتجع</span>
                      </button>
                    )}

                    {/* Save Image */}
                    <button
                      onClick={() => onViewInvoice(inv, 'image')}
                      className="flex items-center justify-center gap-1 rounded-xl bg-cyan-950/60 border border-cyan-800/50 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/60 transition"
                      title="حفظ كصورة"
                    >
                      <Download className="h-3.5 w-3.5 text-cyan-400" />
                      <span>صورة</span>
                    </button>

                    {/* WhatsApp */}
                    <button
                      onClick={() => onViewInvoice(inv, 'whatsapp')}
                      className="flex items-center justify-center gap-1 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 py-2 text-xs font-bold text-[#25D366] hover:bg-[#25D366]/30 transition"
                      title="مشاركة واتساب"
                    >
                      <MessageCircle className="h-3.5 w-3.5 fill-[#25D366]" />
                      <span>واتساب</span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setInvoiceToDelete(inv)}
                      className="flex items-center justify-center gap-1 rounded-xl bg-rose-950/50 border border-rose-800/40 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 transition"
                      title="حذف الفاتورة"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RETURN & REFUND MODAL */}
      {returnInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl text-slate-100 my-8 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">استرجاع منتجات وإعادتها للمخزن</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>فاتورة: <strong className="font-mono text-amber-400">{returnInvoice.invoiceNumber}</strong></span>
                    <span>•</span>
                    <span>العميل: <strong className="text-slate-200">{returnInvoice.customerName}</strong></span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeReturnModal}
                disabled={isProcessingReturn}
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Banner */}
            {returnError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{returnError}</span>
              </div>
            )}

            {/* Items List to Return */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  حدد الكميات المراد استرجاعها من كل صنف:
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const allQtys: Record<string, number> = {};
                    returnInvoice.items.forEach((it) => {
                      const maxQty = it.quantity - (it.returnedQuantity || 0);
                      allQtys[it.productId] = maxQty > 0 ? maxQty : 0;
                    });
                    setReturnQuantities(allQtys);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline"
                >
                  استرجاع الفاتورة كاملة
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 rounded-xl bg-slate-950 p-3 border border-slate-800">
                {returnInvoice.items.map((item) => {
                  const alreadyReturned = item.returnedQuantity || 0;
                  const maxReturnable = Math.max(0, item.quantity - alreadyReturned);
                  const currentQty = returnQuantities[item.productId] ?? 0;
                  const returnToStock = returnToStockMap[item.productId] ?? true;
                  const itemUnitPrice = item.sellPrice - (item.discount || 0);
                  const itemSubtotal = itemUnitPrice * currentQty;

                  return (
                    <div
                      key={item.productId}
                      className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white truncate">{item.productName}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap gap-x-3">
                          <span>سعر القطعة: {itemUnitPrice.toLocaleString()} {config.currency}</span>
                          <span>الكمية المباعة: {item.quantity}</span>
                          {alreadyReturned > 0 && (
                            <span className="text-amber-400 font-semibold">مسترجع سابقاً: {alreadyReturned}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Quantity input */}
                        <div className="flex items-center gap-1">
                          <label className="text-[11px] text-slate-400">كمية الإرجاع:</label>
                          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setReturnQuantities((prev) => ({
                                  ...prev,
                                  [item.productId]: Math.max(0, (prev[item.productId] || 0) - 1),
                                }));
                              }}
                              disabled={currentQty <= 0 || isProcessingReturn}
                              className="px-2 py-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={maxReturnable}
                              value={currentQty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const clamped = Math.min(Math.max(0, val), maxReturnable);
                                setReturnQuantities((prev) => ({
                                  ...prev,
                                  [item.productId]: clamped,
                                }));
                              }}
                              disabled={isProcessingReturn || maxReturnable === 0}
                              className="w-12 text-center bg-transparent py-1 font-mono font-bold text-white text-xs outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setReturnQuantities((prev) => ({
                                  ...prev,
                                  [item.productId]: Math.min(maxReturnable, (prev[item.productId] || 0) + 1),
                                }));
                              }}
                              disabled={currentQty >= maxReturnable || isProcessingReturn}
                              className="px-2 py-1 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">/ {maxReturnable}</span>
                        </div>

                        {/* Re-add to stock checkbox */}
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 select-none">
                          <input
                            type="checkbox"
                            checked={returnToStock}
                            disabled={isProcessingReturn}
                            onChange={(e) =>
                              setReturnToStockMap((prev) => ({
                                ...prev,
                                [item.productId]: e.target.checked,
                              }))
                            }
                            className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                          />
                          <span className="text-emerald-400 font-medium">إعادة للمخزن</span>
                        </label>

                        {/* Subtotal */}
                        <div className="w-20 text-left font-mono font-bold text-amber-300 text-xs">
                          {itemSubtotal.toLocaleString()} {config.currency}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Return Reason */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-slate-300">سبب الاسترجاع:</label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  disabled={isProcessingReturn}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                >
                  <option value="رغبة العميل (عدم الحاجة)">رغبة العميل (عدم الحاجة)</option>
                  <option value="منتج معيب أو به خلل">منتج معيب أو به خلل</option>
                  <option value="استبدال بمنتج آخر">استبدال بمنتج آخر</option>
                  <option value="خطأ في تسجيل الفاتورة">خطأ في تسجيل الفاتورة</option>
                  <option value="أخرى">سبب آخر (كتابة يدوية)</option>
                </select>
                {returnReason === 'أخرى' && (
                  <input
                    type="text"
                    placeholder="اكتب سبب الاسترجاع هنا..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    disabled={isProcessingReturn}
                    className="w-full mt-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
                  />
                )}
              </div>

              {/* Financial & Stock Impact Summary */}
              {(() => {
                let totalReturnQty = 0;
                let totalReturnAmount = 0;
                let totalRestockQty = 0;

                returnInvoice.items.forEach((item) => {
                  const qty = returnQuantities[item.productId] || 0;
                  if (qty > 0) {
                    totalReturnQty += qty;
                    const unitPrice = item.sellPrice - (item.discount || 0);
                    totalReturnAmount += unitPrice * qty;
                    if (returnToStockMap[item.productId] ?? true) {
                      totalRestockQty += qty;
                    }
                  }
                });

                const customerRemainingDebt = returnInvoice.remainingDebt || 0;
                const debtDeducted = Math.min(customerRemainingDebt, totalReturnAmount);
                const cashRefund = Math.max(0, totalReturnAmount - debtDeducted);

                return (
                  <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>إجمالي القطع المسترجعة:</span>
                      <span className="font-bold text-white font-mono">{totalReturnQty} قطعة</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-300">
                      <span>قطع ستعود لرصيد المخزن فوراً:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        <PackageCheck className="inline h-3.5 w-3.5 ml-1" />
                        {totalRestockQty} قطعة
                      </span>
                    </div>

                    <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center">
                      <span className="font-bold text-white">إجمالي قيمة المرتجع:</span>
                      <span className="font-mono font-black text-amber-400 text-sm">
                        {totalReturnAmount.toLocaleString()} {config.currency}
                      </span>
                    </div>

                    {debtDeducted > 0 && (
                      <div className="flex justify-between items-center text-cyan-400 text-[11px]">
                        <span>خصم من دين الفاتورة/العميل:</span>
                        <span className="font-mono font-bold">-{debtDeducted.toLocaleString()} {config.currency}</span>
                      </div>
                    )}

                    {cashRefund > 0 && (
                      <div className="flex justify-between items-center text-emerald-400 text-[11px]">
                        <span>مبلغ نقدي يُرد للعميل:</span>
                        <span className="font-mono font-bold">{cashRefund.toLocaleString()} {config.currency}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeReturnModal}
                disabled={isProcessingReturn}
                className="flex-1 rounded-xl border border-slate-700 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleExecuteReturn}
                disabled={isProcessingReturn}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-bold text-white shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                {isProcessingReturn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جار معالجة المرتجع والمخزن...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="h-4 w-4" />
                    <span>تأكيد الاسترجاع وإعادة للمخزن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
                  <Trash2 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-white">تأكيد حذف الفاتورة</h3>
              </div>
              <button
                onClick={() => setInvoiceToDelete(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-300">
              <p>
                هل أنت متأكد من حذف الفاتورة رقم{' '}
                <strong className="text-amber-400 font-mono">{invoiceToDelete.invoiceNumber}</strong>؟
              </p>
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span className="font-bold text-white">{invoiceToDelete.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>إجمالي المبلغ:</span>
                  <span className="font-mono font-bold text-white">
                    {invoiceToDelete.totalAmount.toLocaleString()} {config.currency}
                  </span>
                </div>
                {invoiceToDelete.remainingDebt > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>دين متبقي سيتم خصمه من حساب العميل:</span>
                    <span className="font-mono font-bold">
                      {invoiceToDelete.remainingDebt.toLocaleString()} {config.currency}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                ملاحظة: هذا الإجراء لا يمكن التراجع عنه وسيتم تحديث إجمالي مبيعات وديون المحل تلقائياً.
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-700 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteInvoice}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition cursor-pointer"
              >
                {isDeleting ? 'جار الحذف...' : 'نعم، احذف الفاتورة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
