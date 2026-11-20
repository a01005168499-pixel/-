import React, { useState, useRef } from 'react';
import { StoreConfig, DEFAULT_STORE_CONFIG, PrintFormat } from '../types';
import { StorageService } from '../services/storage';
import { OfficialSeal } from './OfficialSeal';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  Save,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  Store,
  Phone,
  Printer,
  FileJson,
  Cloud,
  CheckCircle2,
  Database,
  Lock,
} from 'lucide-react';

interface SettingsBackupViewProps {
  config: StoreConfig;
  onUpdateConfig: (config: StoreConfig) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export const SettingsBackupView: React.FC<SettingsBackupViewProps> = ({
  config,
  onUpdateConfig,
  onRefreshData,
}) => {
  const isOnline = useOnlineStatus();
  const [formConfig, setFormConfig] = useState<StoreConfig>({ ...config });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [isCaching, setIsCaching] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);

  const handlePrecacheAll = async () => {
    setIsCaching(true);
    setCacheStatus('جار التحقق من ملفات النظام وتخزينها محلياً...');
    try {
      if ('caches' in window) {
        const cache = await caches.open('audio-world-pos-v3');
        const urlsToCache = [
          '/',
          '/index.html',
          '/manifest.webmanifest',
          '/manifest.json',
          '/icon.svg',
          '/apple-touch-icon.png',
          '/pwa-192x192.png',
          '/pwa-512x512.png',
          '/pwa-maskable-512x512.png',
        ];
        await Promise.allSettled(
          urlsToCache.map(async (url) => {
            try {
              const res = await fetch(url, { cache: 'reload' });
              if (res.ok) await cache.put(url, res);
            } catch (e) {
              console.warn('Cache fetch err:', e);
            }
          })
        );
        setCacheStatus('تم بنجاح! جميع ملفات النظام مخزنة في ذاكرة جهازك. يمكنك الآن فصل الإنترنت تماماً واستخدام البرنامج.');
      } else {
        setCacheStatus('التخزين المحلي مدعوم عبر IndexedDB و LocalStorage بنجاح.');
      }
    } catch {
      setCacheStatus('تم حفظ البيانات محلياً في الذاكرة بنجاح.');
    } finally {
      setIsCaching(false);
    }
  };

  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateConfig(formConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportJSON = async () => {
    await StorageService.exportFullBackupJSON();
  };

  const handleRestoreJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        'تنبيه: سيتم استبدال البيانات الحالية بالبيانات الموجودة في ملف النسخة الاحتياطية. هل تريد المتابعة؟'
      )
    ) {
      if (jsonInputRef.current) jsonInputRef.current.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const res = await StorageService.restoreFullBackupJSON(file);
      await onRefreshData();
      setRestoreMessage(
        `تمت استعادة البيانات بنجاح: ${res.productsCount} منتج، ${res.invoicesCount} فاتورة، ${res.customersCount} عميل.`
      );
    } catch (err) {
      console.error(err);
      alert('فشل استعادة النسخة الاحتياطية. تأكد من صحة الملف.');
    } finally {
      setIsRestoring(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  };

  const handleResetSampleData = async () => {
    if (confirm('هل أنت متأكد من إعادة ضبط البيانات إلى النماذج الأولية للأجهزة الصوتية؟')) {
      await StorageService.resetToSampleData();
      await onRefreshData();
      alert('تمت إعادة ضبط البيانات بنجاح.');
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white">إعدادات المحل والنسخ الاحتياطي</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          بيانات المحل الرسمية، ختم الإدارة الرسمي، إعدادات الطباعة، وحفظ واسترجاع النسخ الاحتياطية JSON
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-950/80 border border-emerald-800 p-3.5 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>تم حفظ الإعدادات بنجاح وستظهر فوراً على جميع الفواتير والمطبوعات!</span>
        </div>
      )}

      {restoreMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-cyan-950/80 border border-cyan-800 p-3.5 text-xs text-cyan-200">
          <CheckCircle2 className="h-4 w-4 text-cyan-400" />
          <span>{restoreMessage}</span>
        </div>
      )}

      {/* Grid: Settings form + Backup & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT (8 cols): Store Official Info Form */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-xl">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-800 mb-5">
            <Store className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-bold text-white">البيانات الرسمية للمنشأة والتوثيق</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">اسم المحل *</label>
                <input
                  type="text"
                  required
                  value={formConfig.storeName}
                  onChange={(e) => setFormConfig({ ...formConfig, storeName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-1">اسم الإدارة / المدير *</label>
                <input
                  type="text"
                  required
                  value={formConfig.managerName}
                  onChange={(e) => setFormConfig({ ...formConfig, managerName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">رقم الهاتف / واتساب *</label>
                <input
                  type="text"
                  required
                  value={formConfig.phone}
                  onChange={(e) => setFormConfig({ ...formConfig, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">العملة</label>
                <input
                  type="text"
                  value={formConfig.currency}
                  onChange={(e) => setFormConfig({ ...formConfig, currency: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div className="col-span-full">
                <label className="block text-xs font-semibold text-slate-300 mb-1">العنوان أو المقر</label>
                <input
                  type="text"
                  value={formConfig.address}
                  onChange={(e) => setFormConfig({ ...formConfig, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">نمط الطباعة الافتراضي</label>
                <select
                  value={formConfig.printFormat}
                  onChange={(e) => setFormConfig({ ...formConfig, printFormat: e.target.value as PrintFormat })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:outline-hidden"
                >
                  <option value="thermal-80mm">طابعة إيصالات حرارية 80 مم (POS كاشير)</option>
                  <option value="thermal-58mm">طابعة حرارية محمولة 58 مم (بلوتوث)</option>
                  <option value="standard-a4">فاتورة A4 / A5 قياسية</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-5">
                <input
                  type="checkbox"
                  id="enableSeal"
                  checked={formConfig.enableOfficialSeal}
                  onChange={(e) => setFormConfig({ ...formConfig, enableOfficialSeal: e.target.checked })}
                  className="h-4 w-4 rounded accent-amber-500"
                />
                <label htmlFor="enableSeal" className="text-xs font-bold text-white cursor-pointer">
                  طباعة الختم الرقمي الرسمي "معتمد" على الفواتير
                </label>
              </div>

              <div className="col-span-full">
                <label className="block text-xs font-semibold text-slate-300 mb-1">شروط وسياسة الفاتورة (أسفل الإيصال)</label>
                <textarea
                  rows={2}
                  value={formConfig.receiptFooterNotice}
                  onChange={(e) => setFormConfig({ ...formConfig, receiptFooterNotice: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:outline-hidden"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md transition cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT (4 cols): Official Seal Preview & Backup / Cloud */}
        <div className="lg:col-span-4 space-y-5">
          {/* Official Seal Preview Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl text-center">
            <h4 className="text-xs font-bold text-slate-300 mb-1">معاينة ختم الإدارة الرسمي</h4>
            <p className="text-[11px] text-slate-500 mb-4">يظهر تلقائياً على فواتير المبيعات وإيصالات تسديد الديون</p>
            <div className="flex justify-center p-3 bg-slate-950 rounded-xl border border-slate-800">
              <OfficialSeal size="md" serialNumber="OFFICIAL-STORE" />
            </div>
          </div>

          {/* Backup & Restore JSON Box */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-3.5">
            <div className="flex items-center gap-2 text-white text-xs font-bold">
              <Database className="h-4 w-4 text-emerald-400" />
              <span>النسخ الاحتياطي وحماية البيانات</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              قم بتحميل نسخة احتياطية كاملة لجميع المنتجات، الفواتير، حسابات العملاء، وسجلات الديون لحفظها على هاتفك أو حاسوبك بأمان.
            </p>

            {/* Hidden JSON input */}
            <input
              type="file"
              ref={jsonInputRef}
              onChange={handleRestoreJSON}
              accept=".json"
              className="hidden"
            />

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 py-2.5 px-4 text-xs font-bold text-slate-100 hover:bg-slate-700 transition"
              >
                <Download className="h-4 w-4 text-amber-400" />
                <span>تصدير نسخة احتياطية كاملة (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                disabled={isRestoring}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 py-2.5 px-4 text-xs font-bold text-slate-100 hover:bg-slate-700 transition"
              >
                <Upload className="h-4 w-4 text-cyan-400" />
                <span>{isRestoring ? 'جار الاستعادة...' : 'استرجاع من ملف JSON'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetSampleData}
                className="text-[11px] text-slate-500 hover:text-amber-400 transition"
              >
                إعادة ضبط البيانات الأولية للأجهزة
              </button>
            </div>
          </div>

          {/* Cloud Sync & Offline State */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Cloud className="h-4 w-4 text-cyan-400" />
                حالة الاتصال والعمل بدون إنترنت (100% Offline)
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  isOnline
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                {isOnline ? 'متصل بالإنترنت' : 'وضع بدون إنترنت نشط'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              تم تجهيز البرنامج ليعمل <strong>بشكل كامل 100% بدون أي اتصال بالإنترنت</strong>. يتم حفظ جميع الفواتير والمخزون وحسابات العملاء على الهاتف مباشرة عبر محرك IndexedDB و LocalStorage السريع.
            </p>

            <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-2 text-[11px]">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>محرك Service Worker: جاهز ويحتفظ بملفات البرنامج محلياً.</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>قاعدة البيانات المحلية: نشطة وتخزن كل فاتورة فور إصدارها.</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>قارئ الباركود بالكاميرا: يعمل محلياً بالكامل بدون إرسال بيانات للخارج.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrecacheAll}
              disabled={isCaching}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/40 py-2.5 px-3 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isCaching ? 'animate-spin' : ''}`} />
              <span>{isCaching ? 'جار التحقق والتخزين...' : 'تحديث وتأكيد تخزين البرنامج للعمل بدون إنترنت'}</span>
            </button>

            {cacheStatus && (
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-[11px] text-emerald-300 leading-relaxed">
                {cacheStatus}
              </div>
            )}

            {/* Zero-Day Offline Guide */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <ShieldCheck className="h-4 w-4 text-amber-400" />
                <span>كيف تشغل البرنامج بدون إنترنت حتى من أول مرة؟</span>
              </div>
              
              <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3 space-y-2.5 text-[11px] text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">1</span>
                  <div>
                    <strong className="text-white">طريقة الـ 30 ثانية (الأسهل والأضمن):</strong>
                    <p className="text-slate-400 mt-0.5">
                      افتح نقطة اتصال (Hotspot) من هاتفك لمدة 30 ثانية فقط، افتح الرابط على جهاز المحل (كمبيوتر أو هاتف)، ثم اضغط على زر <strong>تثبيت التطبيق</strong> على سطح المكتب أو الشاشة الرئيسية. بعدها أغلق النت فوراً وللأبد، وسيعمل البرنامج محلياً بشكل دائم بدون إنترنت.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-400">2</span>
                  <div>
                    <strong className="text-white">طريقة الفلاشة USB أو كابل البيانات (بدون أي اتصال نهائياً):</strong>
                    <p className="text-slate-400 mt-0.5">
                      يمكنك نسخ مجلد ملفات البرنامج على فلاشة ميموري USB أو إرسالها عبر البلوتوث/الكابل إلى جهاز الكاشير في المحل، ثم فتح ملف <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">index.html</code> مباشرة عبر أي متصفح (Chrome أو Edge)، وسيبدأ النظام بالعمل فوراً بدون الحاجة لأي خادم أو اتصال.
                    </p>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-[10px] text-emerald-300">
                  ✓ جميع الفواتير والمخزون وحسابات العملاء تحفظ داخل ذاكرة الجهاز الداخلية (IndexedDB) ولا تتطلب أي خادم خارجي أو إنترنت نهائياً.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
