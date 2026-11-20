import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, RefreshCw, Keyboard, Volume2 } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'html5-qrcode-scanner-view';

  // Audio feedback beep on scan
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz tone
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio not permitted
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.333,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          playBeep();
          stopScanner();
          onScanSuccess(decodedText.trim());
          onClose();
        },
        () => {
          // scanning frame failed to detect barcode, regular frame loop
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      const errStr = String(err);
      const isPermissionDenied =
        errStr.includes('NotAllowedError') ||
        errStr.includes('Permission denied') ||
        (err instanceof Error && err.name === 'NotAllowedError');

      if (isPermissionDenied) {
        console.warn('Camera permission was not granted by user or browser setting.');
        setCameraError('permission_denied');
      } else {
        console.warn('Camera initialization could not complete:', err);
        setCameraError('general_error');
      }
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  useEffect(() => {
    if (isOpen) {
      // Slight delay for DOM element to mount
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playBeep();
      stopScanner();
      onScanSuccess(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-bold text-white">مسح الباركود بكاميرا الهاتف</h3>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewfinder area */}
        <div className="p-4">
          <div className="relative overflow-hidden rounded-xl bg-black min-h-[260px] flex items-center justify-center border border-slate-800">
            <div id={scannerContainerId} className="w-full h-full" />

            {/* Viewfinder Laser overlay when scanning */}
            {isScanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-44 w-64 rounded-lg border-2 border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                  {/* Laser line animation */}
                  <div className="absolute top-0 right-0 left-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-amber-300 font-medium whitespace-nowrap bg-slate-900/90 px-2 py-0.5 rounded">
                    وجّه الباركود داخل المربع
                  </span>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-5 text-center bg-slate-900/95 overflow-y-auto">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 mb-2">
                  <Camera className="h-6 w-6" />
                </div>
                {cameraError === 'permission_denied' ? (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs font-bold text-amber-300">إذن الكاميرا بحاجة للتفعيل</p>
                    <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 text-right">
                      لتشغيل الكاميرا: اضغط على رمز 🔒 بجانب رابط الموقع في أعلى المتصفح، ثم اختر <strong>أذونات الموقع (Permissions)</strong> وفعّل <strong>الكاميرا (Allow)</strong>.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-rose-300 mb-3">
                    تعذر فتح الكاميرا على هذا الجهاز. يمكنك إدخال كود الباركود يدوياً بالأسفل.
                  </p>
                )}
                <button
                  onClick={startScanner}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  إعادة محاولة فتح الكاميرا
                </button>
              </div>
            )}
          </div>

          {/* Quick Manual Entry Input */}
          <form onSubmit={handleManualSubmit} className="mt-4">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              أو اكتب كود الباركود / استخدم القارئ اليدوي:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Keyboard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  autoFocus
                  placeholder="مثال: 6221001001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 py-2.5 pr-9 pl-3 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-hidden font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition"
              >
                إضافة
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800/80 bg-slate-950/60 px-5 py-3 text-center text-xs text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-amber-500" />
            صوت تنبيه فوري عند الالتقاط
          </span>
          <span>عالم الصوت والإلكترونيات</span>
        </div>
      </div>
    </div>
  );
};
