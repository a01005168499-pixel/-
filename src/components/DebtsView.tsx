import React, { useState, useMemo } from 'react';
import { Invoice, Customer, DebtPaymentRecord, StoreConfig } from '../types';
import { StorageService } from '../services/storage';
import { OfficialSeal } from './OfficialSeal';
import {
  AlertCircle,
  CheckCircle2,
  Phone,
  Calendar,
  DollarSign,
  Download,
  Search,
  Eye,
  HandCoins,
  FileSpreadsheet,
  X,
  Printer,
  Clock,
  UserCheck,
  Trash2,
} from 'lucide-react';

interface DebtsViewProps {
  invoices: Invoice[];
  customers: Customer[];
  config: StoreConfig;
  onRefreshData: () => Promise<void>;
  onViewInvoice: (invoice: Invoice, initialAction?: 'print' | 'whatsapp' | 'image' | null) => void;
}

export const DebtsView: React.FC<DebtsViewProps> = ({
  invoices,
  customers,
  config,
  onRefreshData,
  onViewInvoice,
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'customers'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [lastPaymentReceipt, setLastPaymentReceipt] = useState<{
    invoice: Invoice;
    payment: DebtPaymentRecord;
  } | null>(null);

  // Manual Delete states
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleteAllDebtsModalOpen, setIsDeleteAllDebtsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debts calculations
  const debtInvoices = useMemo(() => {
    return invoices.filter((i) => i.remainingDebt > 0);
  }, [invoices]);

  const settledInvoices = useMemo(() => {
    return invoices.filter((i) => i.remainingDebt === 0 && (i.paymentType === 'debt' || i.paymentType === 'partial'));
  }, [invoices]);

  const totalOutstandingDebt = useMemo(() => {
    return debtInvoices.reduce((sum, i) => sum + i.remainingDebt, 0);
  }, [debtInvoices]);

  const debtorCustomersCount = useMemo(() => {
    const names = new Set(debtInvoices.map((i) => i.customerName.trim()));
    return names.size;
  }, [debtInvoices]);

  // Filtered lists
  const filteredActiveDebts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return debtInvoices.filter((inv) => {
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [debtInvoices, searchQuery]);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return settledInvoices.filter((inv) => {
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [settledInvoices, searchQuery]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customers.filter((c) => {
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
    });
  }, [customers, searchQuery]);

  // Open Pay Modal
  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPayAmountInput(String(invoice.remainingDebt)); // Default to full remaining
    setPaymentNotes('');
  };

  const closePaymentModal = () => {
    setSelectedInvoiceForPayment(null);
    setPayAmountInput('');
    setPaymentNotes('');
  };

  // Submit Debt Payment
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    const amount = parseFloat(payAmountInput);
    if (!amount || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح للسداد');
      return;
    }

    if (amount > selectedInvoiceForPayment.remainingDebt) {
      alert('المبلغ المدخل أكبر من إجمالي الدين المتبقي على هذه الفاتورة.');
      return;
    }

    setIsSubmittingPay(true);
    try {
      const res = await StorageService.settleDebt(
        selectedInvoiceForPayment.id,
        amount,
        paymentNotes.trim()
      );
      await onRefreshData();
      closePaymentModal();
      setLastPaymentReceipt({ invoice: res.invoice, payment: res.paymentRecord });
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تسجيل السداد.');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Export Debts to Excel
  const handleExportDebts = async () => {
    await StorageService.exportDebtsToExcel();
  };

  // Delete Handlers
  const handleConfirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      await StorageService.deleteInvoice(invoiceToDelete.id);
      await onRefreshData();
      setInvoiceToDelete(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حذف الفاتورة والدين.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteAllDebts = async () => {
    setIsDeleting(true);
    try {
      await StorageService.deleteAllInvoices();
      await onRefreshData();
      setIsDeleteAllDebtsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تفريغ سجل الديون.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await StorageService.deleteCustomer(customerToDelete.id);
      await onRefreshData();
      setCustomerToDelete(null);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حذف العميل.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-white">إدارة الديون والحسابات الآجلة</h2>
            {debtInvoices.length > 0 && (
              <span className="rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs px-2.5 py-0.5 font-bold">
                {debtInvoices.length} ديون نشطة
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            تتبع دقيق للمبالغ المتبقية على العملاء، سداد كلي أو جزئي مع إيصالات رسمية بختم الإدارة
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {invoices.length > 0 && (
            <button
              onClick={() => setIsDeleteAllDebtsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-800/60 bg-rose-950/40 px-3.5 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 hover:text-white transition"
              title="تفريغ سجل الديون التجريبية أو الحالية بالكامل"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>تفريغ سجل الديون</span>
            </button>
          )}

          <button
            onClick={handleExportDebts}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>تصدير كشف الديون Excel</span>
          </button>
        </div>
      </div>

      {/* Debt Metrics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-4">
          <div className="flex items-center justify-between text-xs text-rose-300 font-semibold">
            <span>إجمالي الديون القائمة (المستحقة)</span>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-rose-400 font-mono">
              {totalOutstandingDebt.toLocaleString()}
            </span>
            <span className="text-xs text-rose-300">{config.currency}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">مبالغ واجبة التحصيل من العملاء</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>عدد الفواتير الآجلة النشطة</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 font-mono">{debtInvoices.length}</span>
            <span className="text-xs text-slate-500">فاتورة غير مسددة</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">تشمل السداد الجزئي والآجل الكامل</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>عدد العملاء المدينين</span>
            <UserCheck className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">{debtorCustomersCount}</span>
            <span className="text-xs text-slate-500">عميل في قائمة الديون</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">يمكن فتح كشف حساب لكل عميل</p>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl text-xs">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            <span>الديون النشطة ({debtInvoices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>فواتير تم سدادها ({settledInvoices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'customers'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>دليل حسابات العملاء ({customers.length})</span>
          </button>
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم العميل أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pr-8 pl-3 text-xs text-white placeholder-slate-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* TAB 1: ACTIVE DEBTS TABLE */}
      {activeTab === 'active' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">رقم الفاتورة والتاريخ</th>
                  <th className="py-3 px-3 font-semibold">العميل والهاتف</th>
                  <th className="py-3 px-3 font-semibold text-center">إجمالي الفاتورة</th>
                  <th className="py-3 px-3 font-semibold text-center">المدفوع سابقاً</th>
                  <th className="py-3 px-3 font-semibold text-center text-rose-400">الدين المتبقي</th>
                  <th className="py-3 px-3 font-semibold text-center">تاريخ الاستحقاق</th>
                  <th className="py-3 px-4 font-semibold text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredActiveDebts.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white font-mono">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(inv.createdAt).toLocaleDateString('ar-EG')}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-200">{inv.customerName}</div>
                      {inv.customerPhone && (
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 inline text-slate-500" />
                          <span>{inv.customerPhone}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-slate-300">
                      {inv.totalAmount.toLocaleString()} {config.currency}
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-emerald-400 font-semibold">
                      {inv.paidAmount.toLocaleString()} {config.currency}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 font-black font-mono text-xs">
                        {inv.remainingDebt.toLocaleString()} {config.currency}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center text-slate-400">
                      {inv.dueDate ? (
                        <span className="text-[11px] font-medium text-amber-300">
                          {new Date(inv.dueDate).toLocaleDateString('ar-EG')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">غير محدد</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            let rawPhone = inv.customerPhone?.replace(/\D/g, '') || '';
                            if (rawPhone.startsWith('0') && rawPhone.length === 11) rawPhone = '2' + rawPhone;
                            const text = [
                              `مرحباً أستاذ *${inv.customerName}*، تحياتنا من *${config.storeName}* (إدارة: ${config.managerName}).`,
                              `نود تذكير سيادتكم بالمبلغ المتبقي على الفاتورة رقم *${inv.invoiceNumber}*.`,
                              `💵 *المبلغ المطلوب سداده:* ${inv.remainingDebt.toLocaleString()} ${config.currency}`,
                              inv.dueDate ? `📅 *تاريخ الاستحقاق:* ${new Date(inv.dueDate).toLocaleDateString('ar-EG')}` : '',
                              `📞 للتواصل والاستفسار: ${config.phone}`,
                              `شاكرين ومقدرين حسن تعاونكم الدائم معنا!`,
                            ].filter(Boolean).join('\n');
                            const waUrl = rawPhone
                              ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(text)}`
                              : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                            window.open(waUrl, '_blank');
                          }}
                          className="p-1.5 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 border border-[#25D366]/30 transition"
                          title="إرسال تذكير بالدين عبر واتساب"
                        >
                          <Phone className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => openPaymentModal(inv)}
                          className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                        >
                          <HandCoins className="h-3.5 w-3.5" />
                          <span>تسديد</span>
                        </button>

                        <button
                          onClick={() => onViewInvoice(inv, 'image')}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-cyan-400 transition"
                          title="حفظ الفاتورة كصورة PNG عالية الدقة"
                        >
                          <Download className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => onViewInvoice(inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
                          title="عرض الفاتورة ومشاركتها أو طباعتها"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => setInvoiceToDelete(inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-950/70 hover:text-rose-400 border border-transparent hover:border-rose-800/40 transition"
                          title="حذف الفاتورة والدين يدوياً"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredActiveDebts.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-200">لا توجد ديون نشطة حالياً!</p>
              <p className="text-slate-500 mt-1">جميع الفواتير الآجلة مسددة بالكامل أو لا تطابق البحث</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SETTLED INVOICES HISTORY */}
      {activeTab === 'history' && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold">رقم الفاتورة</th>
                  <th className="py-3 px-3 font-semibold">العميل</th>
                  <th className="py-3 px-3 font-semibold text-center">المبلغ الإجمالي</th>
                  <th className="py-3 px-3 font-semibold text-center">الحالة</th>
                  <th className="py-3 px-3 font-semibold text-center">تاريخ الإصدار</th>
                  <th className="py-3 px-4 font-semibold text-left">معاينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredHistory.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-white">{inv.invoiceNumber}</td>
                    <td className="py-3 px-3 font-medium text-slate-200">{inv.customerName}</td>
                    <td className="py-3 px-3 text-center font-mono text-emerald-400 font-bold">
                      {inv.totalAmount.toLocaleString()} {config.currency}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        مسدد بالكامل
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-400">
                      {new Date(inv.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-3 px-4 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewInvoice(inv)}
                          className="rounded-lg bg-slate-800 px-3 py-1 text-slate-300 hover:text-white text-xs"
                        >
                          عرض
                        </button>
                        <button
                          onClick={() => setInvoiceToDelete(inv)}
                          className="p-1 rounded-lg text-slate-500 hover:bg-rose-950/70 hover:text-rose-400 transition"
                          title="حذف الفاتورة من السجل"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredHistory.length === 0 && (
            <div className="py-12 text-center text-slate-500 text-xs">لا يوجد سجل سوابق ديون مسددة بعد</div>
          )}
        </div>
      )}

      {/* TAB 3: CUSTOMERS DIRECTORY & BALANCES */}
      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCustomers.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{c.name}</h4>
                    {c.phone && (
                      <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-slate-500" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.currentDebt > 0 ? (
                      <span className="rounded-lg bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 text-[10px] font-bold">
                        مدين
                      </span>
                    ) : (
                      <span className="rounded-lg bg-slate-800 text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                        خالص
                      </span>
                    )}
                    <button
                      onClick={() => setCustomerToDelete(c)}
                      className="p-1 rounded-lg text-slate-500 hover:bg-rose-950/70 hover:text-rose-400 transition"
                      title="حذف هذا العميل"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {c.address && <p className="text-[11px] text-slate-500 mt-2">{c.address}</p>}
                {c.notes && <p className="text-[11px] text-amber-400/80 mt-1">{c.notes}</p>}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block">إجمالي المشتريات:</span>
                  <span className="text-xs font-bold text-slate-200 font-mono">
                    {c.totalSpent.toLocaleString()} {config.currency}
                  </span>
                </div>

                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block">الدين الحالي:</span>
                  <span
                    className={`text-sm font-black font-mono ${
                      c.currentDebt > 0 ? 'text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {c.currentDebt.toLocaleString()} {config.currency}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SETTLE DEBT MODAL */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold text-white">تسجيل سداد دين</h3>
              </div>
              <button onClick={closePaymentModal} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="mt-4 space-y-4">
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">الفاتورة:</span>
                  <span className="font-mono font-bold text-white">{selectedInvoiceForPayment.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">العميل المدين:</span>
                  <span className="font-bold text-slate-200">{selectedInvoiceForPayment.customerName}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-900">
                  <span className="text-slate-400">إجمالي الدين المتبقي:</span>
                  <span className="font-mono font-black text-rose-400 text-sm">
                    {selectedInvoiceForPayment.remainingDebt.toLocaleString()} {config.currency}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    المبلغ المراد سداده الآن ({config.currency}) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setPayAmountInput(String(selectedInvoiceForPayment.remainingDebt))}
                    className="text-[10px] text-amber-400 hover:underline"
                  >
                    سداد الدين كاملاً
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoiceForPayment.remainingDebt}
                  step="any"
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/50 bg-slate-950 p-2.5 text-base text-emerald-400 font-mono font-black focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ملاحظات أو رقم إيصال التحصيل:
                </label>
                <input
                  type="text"
                  placeholder="مثال: دفعة نقدية بالخزينة عن شهر أكتوبر"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md transition"
                >
                  {isSubmittingPay ? 'جار الحفظ...' : 'تأكيد استلام المبلغ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT RECEIPT POPUP WITH OFFICIAL SEAL */}
      {lastPaymentReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl p-6 text-center">
            <h4 className="text-base font-black text-slate-950 font-['Cairo',sans-serif]">
              {config.storeName}
            </h4>
            <p className="text-[11px] font-bold text-slate-600">إيصال استلام وسداد دين رسمي</p>
            <div className="text-[10px] text-slate-500 mt-0.5">هاتف: {config.phone}</div>

            <div className="my-3 py-2 border-y border-dashed border-slate-300 text-xs text-right space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">رقم الإيصال:</span>
                <span className="font-mono font-bold">{lastPaymentReceipt.payment.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">الفاتورة الأصلية:</span>
                <span className="font-mono">{lastPaymentReceipt.invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-700">العميل:</span>
                <span>{lastPaymentReceipt.payment.customerName}</span>
              </div>
              <div className="flex justify-between text-emerald-800 font-bold pt-1 border-t border-slate-200">
                <span>المبلغ المستلم نقداً:</span>
                <span className="font-mono text-sm font-black">
                  {lastPaymentReceipt.payment.paidAmount.toLocaleString()} {config.currency}
                </span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>المتبقي بعد هذا السداد:</span>
                <span className="font-mono font-bold text-rose-700">
                  {lastPaymentReceipt.payment.remainingAfter.toLocaleString()} {config.currency}
                </span>
              </div>
            </div>

            {/* Official Stamp */}
            <div className="flex justify-center my-2">
              <OfficialSeal size="sm" serialNumber={lastPaymentReceipt.payment.id} />
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
              <button
                onClick={() => {
                  const p = lastPaymentReceipt.payment;
                  const inv = lastPaymentReceipt.invoice;
                  let rawPhone = inv.customerPhone?.replace(/\D/g, '') || '';
                  if (rawPhone.startsWith('0') && rawPhone.length === 11) rawPhone = '2' + rawPhone;
                  const text = [
                    `🌟 *إيصال سداد دين رسمي - ${config.storeName}*`,
                    `👤 *إدارة:* ${config.managerName}`,
                    `📞 *هاتف:* ${config.phone}`,
                    `━━━━━━━━━━━━━━━━━`,
                    `📄 *رقم الإيصال:* ${p.id}`,
                    `🧾 *الفاتورة الأصلية:* ${inv.invoiceNumber}`,
                    `👤 *العميل:* ${p.customerName}`,
                    `💵 *المبلغ المسدد نقداً:* ${p.paidAmount.toLocaleString()} ${config.currency}`,
                    `📉 *المتبقي بعد هذا السداد:* ${p.remainingAfter.toLocaleString()} ${config.currency}`,
                    `📅 *تاريخ السداد:* ${new Date(p.date).toLocaleDateString('ar-EG')}`,
                    `━━━━━━━━━━━━━━━━━`,
                    `✨ الإيصال موثق ومسجل بختم الإدارة الرسمي.`,
                    `🙏 شكراً لتعاملكم مع ${config.storeName}`,
                  ].join('\n');
                  const waUrl = rawPhone
                    ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodeURIComponent(text)}`
                    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                  window.open(waUrl, '_blank');
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white py-2 px-3 text-xs font-bold shadow-md transition"
                title="إرسال إيصال السداد عبر واتساب للعميل"
              >
                <span>إرسال واتساب</span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-xl bg-slate-900 text-white py-2 text-xs font-bold hover:bg-slate-800 transition"
              >
                طباعة الإيصال
              </button>
              <button
                onClick={() => setLastPaymentReceipt(null)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM SINGLE INVOICE DELETION MODAL */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/60 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تأكيد حذف الفاتورة والدين</h3>
                <p className="text-[11px] text-slate-400">حذف نهائي للفاتورة من سجل المعاملات</p>
              </div>
            </div>

            <div className="my-4 rounded-xl bg-slate-950 p-3.5 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-white">{invoiceToDelete.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">اسم العميل:</span>
                <span className="font-bold text-slate-200">{invoiceToDelete.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">إجمالي الفاتورة:</span>
                <span className="font-mono text-slate-300">
                  {invoiceToDelete.totalAmount.toLocaleString()} {config.currency}
                </span>
              </div>
              {invoiceToDelete.remainingDebt > 0 && (
                <div className="flex justify-between pt-1 border-t border-slate-800 text-rose-400 font-bold">
                  <span>الدين المرتبط بالفاتورة:</span>
                  <span className="font-mono">
                    {invoiceToDelete.remainingDebt.toLocaleString()} {config.currency}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف هذه الفاتورة؟ سيتم حذفها نهائياً وإلغاء أي مبالغ دين مسجلة عليها من حساب العميل.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setInvoiceToDelete(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteInvoice}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-md shadow-rose-950 transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? 'جار الحذف...' : 'تأكيد الحذف نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ALL DEBTS MODAL */}
      {isDeleteAllDebtsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/60 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تفريغ وحذف سجل الديون والفواتير</h3>
                <p className="text-[11px] text-slate-400">إجراء شامل لمسح الديون التجريبية وتصفير الحسابات</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 my-4 leading-relaxed bg-rose-950/30 p-3 rounded-xl border border-rose-900/40">
              ⚠️ هذا الإجراء سيقوم بحذف كافة فواتير الديون التجريبية وتصفير أرصدة الديون لجميع العملاء لتبدأ بسجل نظيف تماماً لمحل عالم الصوت والإلكترونيات.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteAllDebtsModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteAllDebts}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-md shadow-rose-950 transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? 'جار التفريغ...' : 'نعم، تفريغ السجل بالكامل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE CUSTOMER MODAL */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-rose-900/60 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">تأكيد حذف العميل</h3>
                <p className="text-[11px] text-slate-400">حذف العميل من دليل الحسابات</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 my-4 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف العميل <strong className="text-white">({customerToDelete.name})</strong> نهائياً من دليل العملاء؟
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCustomerToDelete(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteCustomer}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-md shadow-rose-950 transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? 'جار الحذف...' : 'تأكيد الحذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
