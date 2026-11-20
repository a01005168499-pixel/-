import React, { useState, useRef, useEffect } from 'react';
import { Invoice, StoreConfig, PrintFormat } from '../types';
import { OfficialSeal } from './OfficialSeal';
import { StorageService } from '../services/storage';
import html2canvas from 'html2canvas-pro';
import {
  Printer,
  X,
  Download,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Share2,
  MessageCircle,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  FileText,
  User,
  Edit3,
} from 'lucide-react';

interface InvoicePrintModalProps {
  invoice: Invoice | null;
  config: StoreConfig;
  isOpen: boolean;
  onClose: () => void;
  initialAction?: 'print' | 'whatsapp' | 'image' | null;
  onRefreshData?: () => Promise<void>;
  onInvoiceUpdated?: (updated: Invoice) => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoice: propInvoice,
  config,
  isOpen,
  onClose,
  initialAction = null,
  onRefreshData,
  onInvoiceUpdated,
}) => {
  const [overrideInvoice, setOverrideInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    setOverrideInvoice(null);
  }, [propInvoice]);

  const invoice = overrideInvoice || propInvoice;

  const [format, setFormat] = useState<PrintFormat>(config.printFormat || 'thermal-80mm');
  const [isCompactPage, setIsCompactPage] = useState<boolean>(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState('');
  const [shareStatusMessage, setShareStatusMessage] = useState<string | null>(null);
  const receiptContainerRef = useRef<HTMLDivElement>(null);

  // Edit Customer Name modal states
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [editCustomerNameInput, setEditCustomerNameInput] = useState('');
  const [editCustomerPhoneInput, setEditCustomerPhoneInput] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [customerSavedToast, setCustomerSavedToast] = useState(false);

  const isDebt = invoice ? invoice.remainingDebt > 0 : false;

  const openEditCustomerModal = () => {
    if (!invoice) return;
    setEditCustomerNameInput(invoice.customerName === 'عميل نقدي سريع' ? '' : invoice.customerName);
    setEditCustomerPhoneInput(invoice.customerPhone || '');
    setIsEditCustomerOpen(true);
  };

  const handleSaveCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!invoice) return;
    setIsSavingCustomer(true);
    try {
      const res = await StorageService.updateInvoiceCustomer(
        invoice.id,
        editCustomerNameInput,
        editCustomerPhoneInput
      );
      if (res) {
        setOverrideInvoice(res.invoice);
        onInvoiceUpdated?.(res.invoice);
        await onRefreshData?.();
        setCustomerSavedToast(true);
        setTimeout(() => setCustomerSavedToast(false), 2500);
        setIsEditCustomerOpen(false);
      }
    } catch (err) {
      console.error('Failed to update invoice customer', err);
      alert('حدث خطأ أثناء حفظ اسم العميل');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Convert phone number to international WhatsApp format (e.g. 01005168499 -> 201005168499)
  const formatPhoneForWhatsApp = (rawPhone: string): string => {
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.startsWith('00')) {
      clean = clean.slice(2);
    }
    if (clean.startsWith('0') && clean.length === 11) {
      // Egyptian mobile numbers (010, 011, 012, 015)
      clean = '2' + clean;
    }
    return clean;
  };

  // Build the text message that accompanies the WhatsApp invoice image
  const getWhatsAppTextMessage = (): string => {
    if (!invoice) return '';
    const isDebt = invoice.remainingDebt > 0;
    const lines = [
      `🧾 *فاتورة شراء رسمية - ${config.storeName}*`,
      `👤 *إدارة:* ${config.managerName}`,
      `📞 *هاتف:* ${config.phone}`,
      `━━━━━━━━━━━━━━━━━`,
      `📄 *رقم الفاتورة:* ${invoice.invoiceNumber}`,
      `📅 *التاريخ:* ${new Date(invoice.createdAt).toLocaleDateString('ar-EG')} - ${new Date(invoice.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`,
      `👤 *العميل:* ${invoice.customerName}`,
      invoice.customerPhone ? `📱 *رقم العميل:* ${invoice.customerPhone}` : '',
      `━━━━━━━━━━━━━━━━━`,
      `🛒 *الأصناف:*`,
      ...invoice.items.map(
        (it, idx) =>
          ` ${idx + 1}. ${it.productName} (الكمية: ${it.quantity} ${it.unit || ''}) = ${it.total.toLocaleString()} ${config.currency}`
      ),
      `━━━━━━━━━━━━━━━━━`,
      `💰 *المجموع:* ${invoice.subtotal.toLocaleString()} ${config.currency}`,
      invoice.discount > 0 ? `🎁 *الخصم الممنوح:* -${invoice.discount.toLocaleString()} ${config.currency}` : '',
      `💵 *الإجمالي الصافي:* ${invoice.totalAmount.toLocaleString()} ${config.currency}`,
      `✅ *المدفوع نقداً:* ${invoice.paidAmount.toLocaleString()} ${config.currency}`,
      isDebt
        ? `⚠️ *المتبقي كدين (آجل):* ${invoice.remainingDebt.toLocaleString()} ${config.currency}${invoice.dueDate ? ` (الاستحقاق: ${new Date(invoice.dueDate).toLocaleDateString('ar-EG')})` : ''}`
        : '🎉 *الحالة:* مسدد بالكامل (نقدي)',
      `━━━━━━━━━━━━━━━━━`,
      `✨ تم إرفاق صورة الفاتورة بختم الإدارة الرسمي أعلاه.`,
      `🙏 ${config.receiptFooterNotice}`,
    ];
    return lines.filter(Boolean).join('\n');
  };

  // Auto trigger initial actions if requested
  useEffect(() => {
    if (isOpen && invoice) {
      if (initialAction === 'whatsapp') {
        setTargetPhone(invoice.customerPhone || '');
        setIsWhatsAppModalOpen(true);
      } else if (initialAction === 'image') {
        const timer = setTimeout(() => {
          handleDownloadImage();
        }, 350);
        return () => clearTimeout(timer);
      } else if (initialAction === 'print') {
        const timer = setTimeout(() => {
          handlePrint();
        }, 350);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, invoice, initialAction]);

  if (!isOpen || !invoice) return null;

  // Generate Image Blob from Receipt DOM element
  const generateReceiptImage = async (): Promise<{ blob: Blob; file: File; dataUrl: string } | null> => {
    const el = document.getElementById('printable-receipt');
    if (!el) return null;

    // Use html2canvas with scale 2.5 for crisp font, seal & barcode resolution
    const canvas = await html2canvas(el, {
      scale: 2.5,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.getElementById('printable-receipt');
        if (clonedEl) {
          clonedEl.style.maxHeight = 'none';
          clonedEl.style.overflow = 'visible';
          clonedEl.style.transform = 'none';
        }
      },
    });

    const dataUrl = canvas.toDataURL('image/png');
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
    );

    const safeNumber = invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `فاتورة_${safeNumber}_${config.storeName.replace(/\s+/g, '_')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    return { blob, file, dataUrl };
  };

  // Download receipt as PNG image
  const handleDownloadImage = async () => {
    setIsGeneratingImage(true);
    setShareStatusMessage('جار تحويل الفاتورة إلى صورة عالية الدقة وحفظها...');
    try {
      const res = await generateReceiptImage();
      if (!res) return;

      const blobUrl = URL.createObjectURL(res.blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = res.file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);

      // Attempt to also copy to clipboard if supported
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': res.blob }),
          ]);
        }
      } catch {}

      setShareStatusMessage('تم تنزيل وحفظ صورة الفاتورة (PNG) بنجاح على جهازك!');
      setTimeout(() => setShareStatusMessage(null), 4500);
    } catch (err) {
      console.error('Failed to generate image', err);
      alert('حدث خطأ أثناء حفظ الفاتورة كصورة.');
      setShareStatusMessage(null);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Copy receipt image to clipboard
  const handleCopyImage = async () => {
    setIsGeneratingImage(true);
    setShareStatusMessage('جار نسخ صورة الفاتورة إلى الحافظة...');
    try {
      const res = await generateReceiptImage();
      if (!res) return;

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': res.blob }),
        ]);
        setShareStatusMessage('تم نسخ صورة الفاتورة للحافظة بنجاح! يمكنك لصقها (Ctrl+V) مباشرة في واتساب أو أي برنامج.');
        setTimeout(() => setShareStatusMessage(null), 5000);
      } else {
        await handleDownloadImage();
      }
    } catch (err) {
      console.warn('Failed to copy to clipboard', err);
      await handleDownloadImage();
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Main WhatsApp Sharing Trigger
  const handleOpenWhatsAppShare = () => {
    setTargetPhone(invoice.customerPhone || '');
    setIsWhatsAppModalOpen(true);
  };

  // Execute WhatsApp Sharing
  const handleExecuteWhatsAppShare = async () => {
    setIsGeneratingImage(true);
    setShareStatusMessage('جار تجهيز صورة الفاتورة وإرسالها عبر واتساب...');

    try {
      const result = await generateReceiptImage();
      if (!result) throw new Error('Could not generate receipt image');

      const textMessage = getWhatsAppTextMessage();
      const phoneDigits = formatPhoneForWhatsApp(targetPhone);

      // Check if navigator.share supports files (Mobile devices, Android Chrome, iOS Safari)
      const canShareFiles =
        typeof navigator !== 'undefined' &&
        !!navigator.canShare &&
        navigator.canShare({ files: [result.file] });

      if (canShareFiles) {
        try {
          // Native Web Share API directly transfers the actual PNG file to WhatsApp / Apps
          await navigator.share({
            files: [result.file],
            title: `فاتورة ${invoice.invoiceNumber} - ${config.storeName}`,
            text: textMessage,
          });

          setShareStatusMessage('تمت المشاركة بنجاح عبر واتساب!');
          setIsWhatsAppModalOpen(false);
          setTimeout(() => setShareStatusMessage(null), 4000);
        } catch (shareErr: unknown) {
          if ((shareErr as Error)?.name === 'AbortError') {
            // User cancelled share sheet
            setIsWhatsAppModalOpen(false);
            return;
          }
          // If sharing with text caused issue, retry with only file
          try {
            await navigator.share({
              files: [result.file],
              title: `فاتورة ${invoice.invoiceNumber} - ${config.storeName}`,
            });
            setShareStatusMessage('تمت المشاركة بنجاح عبر واتساب!');
            setIsWhatsAppModalOpen(false);
            setTimeout(() => setShareStatusMessage(null), 4000);
          } catch {
            // Fallback to chat URL + download
            handleFallbackWhatsAppChat(result, textMessage, phoneDigits);
          }
        }
      } else {
        handleFallbackWhatsAppChat(result, textMessage, phoneDigits);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('WhatsApp share error', err);
        const textMessage = getWhatsAppTextMessage();
        const phoneDigits = formatPhoneForWhatsApp(targetPhone);
        const encodedText = encodeURIComponent(textMessage);
        const waUrl = phoneDigits
          ? `https://api.whatsapp.com/send?phone=${phoneDigits}&text=${encodedText}`
          : `https://api.whatsapp.com/send?text=${encodedText}`;
        window.open(waUrl, '_blank');
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleFallbackWhatsAppChat = async (
    result: { blob: Blob; file: File; dataUrl: string },
    textMessage: string,
    phoneDigits: string
  ) => {
    // 1. Copy image to clipboard if supported
    let copiedToClipboard = false;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': result.blob }),
        ]);
        copiedToClipboard = true;
      }
    } catch {
      // clipboard write requires gesture
    }

    // 2. Trigger automatic download of PNG
    const dlLink = document.createElement('a');
    dlLink.href = result.dataUrl;
    dlLink.download = result.file.name;
    document.body.appendChild(dlLink);
    dlLink.click();
    document.body.removeChild(dlLink);

    // 3. Open WhatsApp Web or Mobile
    const encodedText = encodeURIComponent(textMessage);
    const waUrl = phoneDigits
      ? `https://api.whatsapp.com/send?phone=${phoneDigits}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;

    window.open(waUrl, '_blank');

    setShareStatusMessage(
      copiedToClipboard
        ? 'تم نسخ صورة الفاتورة للحافظة وتنزيلها، وجار فتح واتساب! اضغط (Ctrl+V) للصق الصورة في المحادثة.'
        : 'تم تنزيل صورة الفاتورة وجار فتح واتساب! قم بإرفاق الصورة المحفوظة في المحادثة.'
    );
    setIsWhatsAppModalOpen(false);
    setTimeout(() => setShareStatusMessage(null), 7000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl my-auto text-slate-100 no-print-modal-wrapper">
        {/* Controls bar (Hidden during print) */}
        <div className="no-print flex flex-wrap items-center justify-between border-b border-slate-800 px-4 sm:px-5 py-3.5 bg-slate-950/80 rounded-t-2xl gap-3">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-bold text-white">معاينة وطباعة ومشاركة الفاتورة</h3>
          </div>

          {/* Format selector and Page Fit buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={() => setFormat('thermal-80mm')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  format === 'thermal-80mm'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                حراري 80مم
              </button>
              <button
                onClick={() => setFormat('thermal-58mm')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  format === 'thermal-58mm'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                حراري 58مم
              </button>
              <button
                onClick={() => setFormat('standard-a4')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  format === 'standard-a4'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                نموذج A4 / A5
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsCompactPage(!isCompactPage)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                isCompactPage
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="تصغير الخط والمسافات لاستيعاب كامل الفاتورة في صفحة واحدة بدون تجاوز"
            >
              <FileText className="h-3.5 w-3.5 text-cyan-400" />
              <span>{isCompactPage ? 'ملاءمة صفحة واحدة ✓' : 'حجم عادي'}</span>
            </button>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center gap-2">
            {/* DOWNLOAD PNG IMAGE BUTTON */}
            <button
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-cyan-600/20 transition cursor-pointer"
              title="حفظ الفاتورة كملف صورة PNG عالي الدقة على جهازك"
            >
              {isGeneratingImage ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Download className="h-4 w-4 text-white" />
              )}
              <span>حفظ كصورة (PNG)</span>
            </button>

            {/* COPY IMAGE TO CLIPBOARD */}
            <button
              onClick={handleCopyImage}
              disabled={isGeneratingImage}
              className="hidden sm:flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 text-xs font-semibold transition cursor-pointer"
              title="نسخ صورة الفاتورة للحافظة للصقها مباشرة في أي محادثة (Ctrl+V)"
            >
              <Copy className="h-3.5 w-3.5 text-amber-400" />
              <span>نسخ صورة</span>
            </button>

            {/* WHATSAPP SHARE BUTTON */}
            <button
              onClick={handleOpenWhatsAppShare}
              disabled={isGeneratingImage}
              className="flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-[#25D366]/20 transition cursor-pointer"
              title="مشاركة صورة الفاتورة مباشرة عبر واتساب"
            >
              {isGeneratingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4 fill-white" />
              )}
              <span className="hidden xs:inline">واتساب</span>
            </button>

            {/* EDIT CUSTOMER NAME BUTTON */}
            <button
              onClick={openEditCustomerModal}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 text-xs font-semibold transition cursor-pointer"
              title="إضافة أو تعديل اسم العميل ورقم هاتفه على هذه الفاتورة"
            >
              <User className="h-4 w-4 text-amber-400" />
              <span>تعديل اسم العميل</span>
            </button>

            {/* PRINT BUTTON */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm transition cursor-pointer"
              title="طباعة إيصال ورقي"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status notification toast */}
        {shareStatusMessage && (
          <div className="no-print mx-4 mt-3 rounded-xl bg-cyan-950/90 border border-cyan-800 p-3 text-xs text-cyan-200 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>{shareStatusMessage}</span>
            </div>
            <button onClick={() => setShareStatusMessage(null)} className="text-cyan-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Printable Invoice Container */}
        <div className="max-h-[75vh] overflow-y-auto p-3 sm:p-6 bg-slate-900/60 flex justify-center">
          <div
            id="printable-receipt"
            ref={receiptContainerRef}
            className={`relative overflow-hidden bg-white text-slate-950 shadow-2xl transition-all rounded-md border-2 border-slate-800 ${
              isCompactPage ? 'p-3 sm:p-4 leading-tight receipt-compact-a4' : 'p-4 sm:p-5'
            } ${
              format === 'thermal-80mm'
                ? `w-full max-w-[340px] receipt-thermal-80 font-mono ${isCompactPage ? 'text-[10px]' : 'text-xs'}`
                : format === 'thermal-58mm'
                ? `w-full max-w-[270px] receipt-thermal-58 font-mono ${isCompactPage ? 'text-[9px]' : 'text-[10px]'}`
                : `w-full max-w-xl font-sans ${isCompactPage ? 'text-[11px]' : 'text-xs'}`
            }`}
          >
            {/* Watermark stamp for returned invoices */}
            {invoice.status === 'returned' && (
              <div
                aria-hidden="true"
                className="pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden z-10"
              >
                <div className="transform -rotate-25 border-8 border-rose-600/25 px-8 py-3 rounded-2xl text-rose-600/25 text-5xl sm:text-6xl font-black tracking-widest font-mono uppercase">
                  مـرتـجـع
                </div>
              </div>
            )}

            {/* Organized Store Header */}
            <div className={`text-center border-b-2 border-slate-800 ${isCompactPage ? 'pb-1.5' : 'pb-2.5'}`}>
              {invoice.status === 'returned' ? (
                <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-sm bg-rose-700 text-white text-xs sm:text-sm font-black tracking-widest mb-1 shadow-xs border border-rose-800 font-['Cairo',sans-serif]">
                  <span>★</span>
                  <span>فـاتـورة مـرتـجـعـة بـالـكـامـل</span>
                  <span>★</span>
                </div>
              ) : (invoice.returnedAmount && invoice.returnedAmount > 0) || invoice.status === 'partially_returned' ? (
                <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-sm bg-amber-600 text-white text-xs font-black tracking-wider mb-1 shadow-xs border border-amber-700 font-['Cairo',sans-serif]">
                  <span>★</span>
                  <span>فـاتـورة بـهـا مـرتـجـع جـزئـي</span>
                  <span>★</span>
                </div>
              ) : (
                <div className="inline-block px-2.5 py-0.5 rounded-xs bg-slate-900 text-white text-[10px] font-bold tracking-wider mb-1 font-['Cairo',sans-serif]">
                  فاتورة مبيعات نقدية وآجلة
                </div>
              )}

              <h1 className={`${isCompactPage ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-black tracking-tight text-slate-950 mb-0.5 font-['Cairo',sans-serif]`}>
                {config.storeName}
              </h1>
              <p className="text-[10px] font-semibold text-slate-700 font-['Cairo',sans-serif]">
                لتجارة وصيانة وتجهيز المعدات الصوتية والأجهزة الإلكترونية
              </p>
              <div className={`flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 text-[10px] font-bold text-slate-900 border-t border-slate-300 ${isCompactPage ? 'mt-1 pt-1' : 'mt-1.5 pt-1.5 text-xs'}`}>
                <span className="font-['Cairo',sans-serif]">إدارة: {config.managerName}</span>
                <span className="text-slate-400">•</span>
                <span className="dir-ltr inline-flex items-center gap-1 font-mono text-slate-950">
                  <Phone className="h-2.5 w-2.5 inline text-slate-700" />
                  {config.phone}
                </span>
                {config.address && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span className="text-[9.5px] text-slate-600 font-normal">{config.address}</span>
                  </>
                )}
              </div>
            </div>

            {/* Structured Metadata Box (2 Columns with clean tabular borders) */}
            <div className={`border border-slate-400 rounded-xs overflow-hidden bg-slate-50/70 ${isCompactPage ? 'my-1.5 text-[10px]' : 'my-2.5 text-[11px]'}`}>
              <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-400 border-b border-slate-400">
                <div className={`${isCompactPage ? 'p-1' : 'p-1.5'} flex justify-between items-center`}>
                  <span className="text-slate-600 font-medium">رقم الفاتورة:</span>
                  <span className="font-mono font-black text-blue-900">{invoice.invoiceNumber}</span>
                </div>
                <div className={`${isCompactPage ? 'p-1' : 'p-1.5'} flex justify-between items-center`}>
                  <span className="text-slate-600 font-medium">تاريخ الإصدار:</span>
                  <span className="font-mono text-[10px] text-slate-800 font-semibold">
                    {new Date(invoice.createdAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-400 border-b border-slate-400">
                <div className={`${isCompactPage ? 'p-1' : 'p-1.5'} flex justify-between items-center`}>
                  <span className="text-slate-600 font-medium">العميل:</span>
                  <div className="flex items-center gap-1.5 max-w-[150px]">
                    <span className="font-bold text-slate-950 truncate">
                      {invoice.customerName || 'عميل نقدي سريع'}
                    </span>
                    <button
                      type="button"
                      onClick={openEditCustomerModal}
                      className="print:hidden text-amber-700 hover:text-amber-900 hover:bg-amber-100 p-0.5 rounded transition cursor-pointer"
                      title="تعديل أو كتابة اسم العميل على الفاتورة"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className={`${isCompactPage ? 'p-1' : 'p-1.5'} flex justify-between items-center`}>
                  <span className="text-slate-600 font-medium">الهاتف:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {invoice.customerPhone || '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-x-reverse divide-slate-400">
                <div className={`${isCompactPage ? 'p-1' : 'p-1.5'} flex justify-between items-center`}>
                  <span className="text-slate-600 font-medium">طريقة السداد:</span>
                  <span className="font-bold text-slate-900">
                    {invoice.status === 'returned'
                      ? 'مرتجع بالكامل'
                      : invoice.status === 'paid'
                      ? 'نقدي (خالص)'
                      : invoice.status === 'partial'
                      ? 'سداد جزئي'
                      : 'آجل (دين مستحق)'}
                  </span>
                </div>
                <div className={`${isCompactPage ? 'p-1' : 'p-1.5'} flex justify-between items-center`}>
                  <span className="text-slate-600 font-medium">حالة الفاتورة:</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-black ${
                      invoice.status === 'returned'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : invoice.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    {invoice.status === 'returned'
                      ? 'مرتجع'
                      : invoice.status === 'paid'
                      ? 'خالصة بالكامل'
                      : 'عليها دين متبقي'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table - Highly organized with clear borders */}
            <div className={isCompactPage ? 'my-1.5' : 'my-2.5'}>
              <table className={`w-full text-right border-collapse border border-slate-400 ${isCompactPage ? 'text-[10px]' : 'text-[11px]'}`}>
                <thead>
                  <tr className="bg-slate-200 text-slate-900 border-b-2 border-slate-700 font-bold">
                    <th className={`text-center border-l border-slate-300 w-5 ${isCompactPage ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>م</th>
                    <th className={`border-l border-slate-300 ${isCompactPage ? 'py-0.5 px-1.5' : 'py-1 px-2'}`}>الصنف والبيان</th>
                    <th className={`text-center border-l border-slate-300 w-11 ${isCompactPage ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>الكمية</th>
                    <th className={`text-center border-l border-slate-300 w-12 ${isCompactPage ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>السعر</th>
                    <th className={`text-left w-14 ${isCompactPage ? 'py-0.5 px-1.5' : 'py-1 px-2'}`}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="align-top hover:bg-slate-50">
                      <td className={`text-center font-mono text-slate-600 border-l border-slate-300 ${isCompactPage ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>
                        {idx + 1}
                      </td>
                      <td className={`font-medium leading-tight border-l border-slate-300 text-slate-900 ${isCompactPage ? 'py-0.5 px-1.5' : 'py-1 px-2'}`}>
                        <div>{item.productName}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {item.discount > 0 && (
                            <span className="text-[9px] text-rose-700 font-mono">
                              خصم: -{item.discount} {config.currency}
                            </span>
                          )}
                          {item.returnedQuantity && item.returnedQuantity > 0 && (
                            <span className="text-[9px] font-bold text-rose-800 bg-rose-100 px-1 rounded-xs">
                              (مرتجع: {item.returnedQuantity} {item.unit || ''})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`text-center font-mono font-bold border-l border-slate-300 ${isCompactPage ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>
                        {item.quantity} {item.unit || ''}
                      </td>
                      <td className={`text-center font-mono border-l border-slate-300 ${isCompactPage ? 'py-0.5 px-1' : 'py-1 px-1.5'}`}>
                        {item.sellPrice.toLocaleString()}
                      </td>
                      <td className={`text-left font-mono font-black text-slate-950 ${isCompactPage ? 'py-0.5 px-1.5' : 'py-1 px-2'}`}>
                        {item.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Calculation Summary (Structured Box) */}
            <div className={`border border-slate-400 rounded-xs overflow-hidden ${isCompactPage ? 'my-1.5 text-[10px]' : 'my-2.5 text-xs'}`}>
              <div className="divide-y divide-slate-300 bg-white">
                <div className={`flex justify-between text-slate-700 ${isCompactPage ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}>
                  <span>إجمالي الأصناف (المجموع الفرعي):</span>
                  <span className="font-mono font-bold">
                    {invoice.subtotal.toLocaleString()} {config.currency}
                  </span>
                </div>

                {invoice.discount > 0 && (
                  <div className={`flex justify-between text-rose-700 font-bold bg-rose-50/50 ${isCompactPage ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}>
                    <span>إجمالي الخصم الممنوح:</span>
                    <span className="font-mono">
                      -{invoice.discount.toLocaleString()} {config.currency}
                    </span>
                  </div>
                )}

                {invoice.returnedAmount && invoice.returnedAmount > 0 && (
                  <div className={`flex justify-between text-rose-800 font-bold bg-rose-100/70 ${isCompactPage ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}>
                    <span>قيمة البضاعة المسترجعة (مرتجع):</span>
                    <span className="font-mono">
                      -{invoice.returnedAmount.toLocaleString()} {config.currency}
                    </span>
                  </div>
                )}

                <div className={`flex justify-between bg-slate-100 text-slate-950 font-black border-t-2 border-slate-700 ${isCompactPage ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'}`}>
                  <span>صافي الفاتورة الإجمالي:</span>
                  <span className={`font-mono text-blue-900 font-black ${isCompactPage ? 'text-sm' : 'text-base'}`}>
                    {invoice.totalAmount.toLocaleString()} {config.currency}
                  </span>
                </div>

                <div className={`flex justify-between text-emerald-800 font-bold ${isCompactPage ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}>
                  <span>المبلغ المدفوع:</span>
                  <span className="font-mono">
                    {invoice.paidAmount.toLocaleString()} {config.currency}
                  </span>
                </div>

                {isDebt && (
                  <div className={`flex justify-between bg-rose-50 text-rose-900 font-black border-t border-rose-300 ${isCompactPage ? 'px-2 py-1' : 'px-2.5 py-1.5'}`}>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-rose-600 inline" />
                      المتبقي كدين مستحق (آجل):
                    </span>
                    <span className="font-mono text-rose-700 font-bold">
                      {invoice.remainingDebt.toLocaleString()} {config.currency}
                    </span>
                  </div>
                )}

                {invoice.dueDate && isDebt && (
                  <div className={`flex justify-between text-slate-700 bg-amber-50/60 ${isCompactPage ? 'px-2 py-0.5 text-[9.5px]' : 'px-2.5 py-1 text-[11px]'}`}>
                    <span>تاريخ استحقاق الدين:</span>
                    <span className="font-bold text-amber-900 font-mono">
                      {new Date(invoice.dueDate).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Official Seal and Signatures - GUARANTEED ON THE SAME SHEET */}
            {config.enableOfficialSeal && (
              <div className={`border-t-2 border-dashed border-slate-400 flex items-center justify-between gap-3 break-inside-avoid ${isCompactPage ? 'mt-1.5 pt-1' : 'mt-3 pt-2.5'}`}>
                {/* Signature Section */}
                <div className="flex-1 text-[9.5px] text-slate-700 space-y-1 text-right">
                  <p className="font-bold text-slate-950 text-[10px]">توقيع المستلم / العميل:</p>
                  <div className={`border-b border-dotted border-slate-500 w-32 ${isCompactPage ? 'h-4' : 'h-7'}`}></div>
                  <p className="text-[8px] text-slate-500 leading-tight">
                    استلمت البضاعة أعلاه كاملة وبحالة سليمة ومطابقة للمواصفات.
                  </p>
                </div>

                {/* Circular Official Seal */}
                <div className="flex flex-col items-center shrink-0">
                  <OfficialSeal
                    size="sm"
                    monochrome={format !== 'standard-a4'}
                    serialNumber={invoice.invoiceNumber}
                  />
                </div>
              </div>
            )}

            {/* Standard Legal & Policy Footer */}
            <div className={`text-center border-t border-slate-300 text-slate-600 space-y-0.5 ${isCompactPage ? 'mt-1.5 pt-1 text-[8.5px]' : 'mt-2.5 pt-2 text-[10px]'}`}>
              <p className="font-bold text-slate-800">{config.receiptFooterNotice}</p>
              <div className="flex items-center justify-center gap-1 text-[8px] text-slate-500 font-mono">
                <span>عالم الصوت والإلكترونيات</span>
                <span>•</span>
                <span>إدارة أ. أحمد محمد حامد (01005168499)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="no-print flex flex-wrap items-center justify-between border-t border-slate-800 px-4 sm:px-5 py-3.5 bg-slate-950/90 rounded-b-2xl gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Save as Image Button */}
            <button
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 text-xs font-bold shadow-lg shadow-cyan-600/25 transition cursor-pointer"
              title="حفظ الفاتورة كملف صورة PNG على جهازك"
            >
              {isGeneratingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>حفظ الفاتورة كصورة (PNG)</span>
            </button>

            {/* Copy to clipboard button */}
            <button
              onClick={handleCopyImage}
              disabled={isGeneratingImage}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer"
              title="نسخ صورة الفاتورة للحافظة لصقها مباشرة"
            >
              <Copy className="h-4 w-4 text-amber-400" />
              <span>نسخ صورة للحافظة</span>
            </button>

            {/* WhatsApp Share */}
            <button
              onClick={handleOpenWhatsAppShare}
              disabled={isGeneratingImage}
              className="flex items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white px-3.5 py-2.5 text-xs font-bold shadow-md shadow-[#25D366]/20 transition cursor-pointer"
              title="إرسال صورة الفاتورة للعميل عبر واتساب"
            >
              <MessageCircle className="h-4 w-4 fill-white" />
              <span>إرسال واتساب</span>
            </button>

            {/* Thermal Print */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 text-xs font-bold shadow-sm transition cursor-pointer"
              title="طباعة إيصال ورقي"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة إيصال</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>

      {/* WHATSAPP CONFIRMATION & NUMBER MODAL */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366] text-white">
                  <MessageCircle className="h-4 w-4 fill-white" />
                </div>
                <h4 className="text-sm font-bold text-white">مشاركة صورة الفاتورة عبر واتساب</h4>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  رقم هاتف العميل (واتساب):
                </label>
                <input
                  type="text"
                  placeholder="مثال: 01005168499 أو اتركه فارغاً لاختيار جهة الاتصال"
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:border-[#25D366] focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  إذا تركت الرقم فارغاً، سيفتح واتساب لتختار العميل أو المجموعة التي تريد إرسال الفاتورة إليها.
                </p>
              </div>

              {/* Message preview summary */}
              <div className="rounded-xl bg-slate-950/80 p-3 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="flex justify-between font-bold text-white">
                  <span>العميل:</span>
                  <span>{invoice.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-mono text-amber-400">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>الإجمالي الصافي:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {invoice.totalAmount.toLocaleString()} {config.currency}
                  </span>
                </div>
                {isDebt && (
                  <div className="flex justify-between text-rose-400 font-bold">
                    <span>المتبقي كدين:</span>
                    <span className="font-mono">{invoice.remainingDebt.toLocaleString()} {config.currency}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-700 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleExecuteWhatsAppShare}
                  disabled={isGeneratingImage}
                  className="flex-2 flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white py-2.5 text-xs font-bold shadow-lg shadow-[#25D366]/20 transition cursor-pointer"
                >
                  {isGeneratingImage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جار المعالجة...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      <span>إرسال الصورة الآن</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER NAME MODAL */}
      {isEditCustomerOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">إضافة / تعديل اسم العميل على الفاتورة</h4>
                  <div className="text-[11px] text-slate-400 font-mono">فاتورة: {invoice.invoiceNumber}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCustomerOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  اسم العميل على الفاتورة:
                </label>
                <input
                  type="text"
                  placeholder="اكتب اسم العميل (مثال: أ. أحمد محمد حامد)"
                  value={editCustomerNameInput}
                  onChange={(e) => setEditCustomerNameInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                  autoFocus
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>اتركه فارغاً للتعيين كـ (عميل نقدي سريع)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditCustomerNameInput('عميل نقدي سريع');
                      setEditCustomerPhoneInput('');
                    }}
                    className="text-amber-400 hover:underline"
                  >
                    تعيين كـ عميل نقدي سريع
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  رقم هاتف العميل (اختياري للواتساب):
                </label>
                <input
                  type="text"
                  placeholder="مثال: 01005168499"
                  value={editCustomerPhoneInput}
                  onChange={(e) => setEditCustomerPhoneInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {isSavingCustomer ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>حفظ وتحديث الفاتورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditCustomerOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER SAVED TOAST */}
      {customerSavedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4" />
          <span>تم تحديث وحفظ اسم العميل على الفاتورة بنجاح!</span>
        </div>
      )}
    </div>
  );
};
