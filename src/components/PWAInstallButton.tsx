import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Monitor, X, CheckCircle2, Share2, Zap, WifiOff } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'pc' | 'android' | 'ios'>(isIOS ? 'ios' : 'pc');

  // If already running as an installed PWA, show a subtle active badge or null
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>مثبت محلياً (يعمل بدون نت)</span>
      </div>
    );
  }

  const handleButtonClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleButtonClick}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-3 py-1.5 text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
        title="تثبيت التطبيق على جهاز الكمبيوتر أو الهاتف ليعمل 100% بدون إنترنت وفوراً بدون انتظار"
      >
        <Download className="w-3.5 h-3.5 text-slate-950" />
        <span>تثبيت التطبيق (بدون نت)</span>
      </button>

      {/* Installation & Offline Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">تثبيت التطبيق للعمل بدون إنترنت نهائياً</h3>
                  <p className="text-[11px] text-slate-400">والتخلص من رسالة انتظار تشغيل السيرفر تماماً</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Why install banner */}
            <div className="mt-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5 leading-relaxed">
              <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>لماذا تثبّت التطبيق؟</strong>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  تظهر رسالة <em>"Please wait while your application starts..."</em> فقط في السيرفر المؤقت. عند تثبيت التطبيق على جهازك، سيتم تخزين النظام وقاعدة البيانات بالكامل على جهازك ويعمل 100% بدون إنترنت وبدون انتظار!
                </p>
              </div>
            </div>

            {/* Device Tabs */}
            <div className="mt-4 flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('pc')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition ${
                  activeTab === 'pc' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>كمبيوتر ولابتوب</span>
              </button>
              <button
                onClick={() => setActiveTab('android')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition ${
                  activeTab === 'android' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>هاتف أندرويد</span>
              </button>
              <button
                onClick={() => setActiveTab('ios')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-bold transition ${
                  activeTab === 'ios' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>آيفون وآيباد</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="mt-4 space-y-3 text-xs text-slate-300 leading-relaxed">
              {activeTab === 'pc' && (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">1</span>
                    <span>من شريط العنوان في أعلى متصفح <strong>Google Chrome</strong> أو <strong>Microsoft Edge</strong>، اضغط على أيقونة التثبيت <strong>( ⬇ أو ⊕ )</strong> في يمين أو يسار شريط الرابط.</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">2</span>
                    <span>أو اضغط على قائمة المتصفح <strong>(⋮ الثلاث نقاط)</strong> ثم اختر <strong>"تثبيت تطبيق عالم الصوت" (Install App)</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">3</span>
                    <span>ستظهر لك أيقونة على <strong>سطح المكتب</strong> (Desktop). عند فتحها سيعمل البرنامج كنافذة مستقلة بدون متصفح وبسرعة فورية وبدون نت إطلاقاً!</span>
                  </div>
                </div>
              )}

              {activeTab === 'android' && (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">1</span>
                    <span>في متصفح Chrome، اضغط على <strong>النقاط الثلاث (⋮)</strong> في أعلى الشاشة.</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">2</span>
                    <span>اضغط على <strong>"تثبيت التطبيق"</strong> أو <strong>"إضافة إلى الشاشة الرئيسية" / "إنشاء اختصار"</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">3</span>
                    <span>سيظهر تطبيق "عالم الصوت" كأيقونة على شاشة هاتفك ويفتح مثل أي تطبيق مثبت بدون متصفح وبدون اتصال بالإنترنت.</span>
                  </div>
                </div>
              )}

              {activeTab === 'ios' && (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">1</span>
                    <span>في متصفح Safari، اضغط على زر <strong>المشاركة (Share)</strong> في أسفل الشاشة.</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">2</span>
                    <span>مرر للأسفل واضغط على <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">3</span>
                    <span>اضغط <strong>إضافة (Add)</strong>، وسيتم تشغيله من شاشة الهاتف مباشرة.</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-400 transition cursor-pointer"
            >
              فهمت، حسناً
            </button>
          </div>
        </div>
      )}
    </>
  );
};
