import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    if (window.confirm('هل تريد مسح الملفات المؤقتة وإعادة فتح التطبيق؟ (لن يتم حذف النسخ الاحتياطية المحفوظة)')) {
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-['Cairo',sans-serif]" dir="rtl">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">عالم الصوت والإلكترونيات</h2>
            <p className="text-sm text-slate-300 mb-4">
              حدث خطأ غير متوقع أثناء تشغيل واجهة التطبيق. يمكنك إعادة المحاولة الآن.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-6 text-xs text-rose-300 font-mono text-left overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل التطبيق</span>
              </button>
              <button
                onClick={this.handleResetStorage}
                className="py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition cursor-pointer"
              >
                مسح التخزين المؤقت
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
