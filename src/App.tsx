/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useTransition } from 'react';
import { Product, Customer, Invoice, StoreConfig, DEFAULT_STORE_CONFIG } from './types';
import { StorageService } from './services/storage';
import { POSView } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { DebtsView } from './components/DebtsView';
import { ReportsView } from './components/ReportsView';
import { SettingsBackupView } from './components/SettingsBackupView';
import { InvoicePrintModal } from './components/InvoicePrintModal';
import { InvoicesView } from './components/InvoicesView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  ShoppingBag,
  FileText,
  Package,
  Layers,
  BarChart3,
  Settings,
  Phone,
  Radio,
  WifiOff,
  Speaker,
  RefreshCw,
  Check,
} from 'lucide-react';

export default function App() {
  const isOnline = useOnlineStatus();
  const [activeView, setActiveView] = useState<'pos' | 'invoices' | 'inventory' | 'debts' | 'reports' | 'settings'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [config, setConfig] = useState<StoreConfig>(DEFAULT_STORE_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshToast, setShowRefreshToast] = useState(false);

  // Invoice Print & Share Modal state
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [initialActionForPrint, setInitialActionForPrint] = useState<'print' | 'whatsapp' | 'image' | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Load initial data
  const loadData = async () => {
    try {
      let prods = await StorageService.getProducts();
      // One-time purge of initial sample dummy products if present
      if (prods.some((p) => p.id.startsWith('prod-00'))) {
        prods = await StorageService.deleteSampleProducts();
      }

      let [custs, invs, conf] = await Promise.all([
        StorageService.getCustomers(),
        StorageService.getInvoices(),
        StorageService.getConfig(),
      ]);

      // One-time purge of initial sample dummy invoices/debts if present
      if (invs.some((i) => i.id.startsWith('inv-100'))) {
        const cleaned = await StorageService.deleteSampleInvoices();
        invs = cleaned.invoices;
        custs = cleaned.customers;
      }

      setProducts(prods);
      setCustomers(custs);
      setInvoices(invs);
      setConfig(conf);
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaleComplete = (invoice: Invoice) => {
    setSelectedInvoiceForPrint(invoice);
    setInitialActionForPrint(null);
    setIsPrintModalOpen(true);
  };

  const handleViewInvoice = (
    invoice: Invoice,
    initialAction?: 'print' | 'whatsapp' | 'image' | null
  ) => {
    setSelectedInvoiceForPrint(invoice);
    setInitialActionForPrint(initialAction || null);
    setIsPrintModalOpen(true);
  };

  const handleUpdateConfig = async (newConfig: StoreConfig) => {
    await StorageService.saveConfig(newConfig);
    setConfig(newConfig);
  };

  const handleRefreshApp = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update().catch(() => {});
        }
      }
      setShowRefreshToast(true);
      setTimeout(() => setShowRefreshToast(false), 2500);
    } catch (e) {
      console.error('Refresh error', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Active debts count
  const activeDebtsCount = invoices.filter((i) => i.remainingDebt > 0).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif]">
      {/* Offline Status Warning Bar if offline */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2">
          <WifiOff className="h-4 w-4" />
          <span>وضع غير متصل بالإنترنت (Offline Mode) - النظام يعمل بكامل مميزاته وقاعدة البيانات المحلية نشطة</span>
        </div>
      )}

      {/* TOP BAR CONTRACT: Zone 1 (Wordmark) - Zone 2 (Nav Links) - Zone 3 (CTA & Tools) */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Zone 1: Single text wordmark */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20">
            <Speaker className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
              عالم الصوت والإلكترونيات
            </h1>
            <div className="text-[10px] text-slate-400 leading-none mt-0.5">
              إدارة أ. أحمد محمد حامد
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setActiveView('pos')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeView === 'pos'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>نقطة البيع (POS)</span>
          </button>

          <button
            onClick={() => setActiveView('invoices')}
            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeView === 'invoices'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>سجل الفواتير</span>
            {invoices.length > 0 && (
              <span className="flex h-5 px-1.5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400 border border-slate-700 font-bold font-mono">
                {invoices.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView('inventory')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeView === 'inventory'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Package className="h-4 w-4" />
            <span>المخزون والتسعير</span>
          </button>

          <button
            onClick={() => setActiveView('debts')}
            className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeView === 'debts'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>سجل الديون</span>
            {activeDebtsCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white font-bold font-mono">
                {activeDebtsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeView === 'reports'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>الأرباح والتقارير</span>
          </button>

          <button
            onClick={() => setActiveView('settings')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition cursor-pointer ${
              activeView === 'settings'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>الإعدادات والنسخ</span>
          </button>
        </nav>

        {/* Zone 3: Tools & PWA install & Phone */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefreshApp}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-amber-500/40 active:scale-95 transition cursor-pointer"
            title="تحديث بيانات الموقع والبرنامج"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'جار التحديث...' : 'تحديث'}</span>
          </button>

          <PWAInstallButton />

          <a
            href="tel:01005168499"
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs font-mono font-bold text-amber-400 hover:border-amber-500/40 transition"
            title="الاتصال المباشر بإدارة المحل"
          >
            <Phone className="h-3.5 w-3.5" />
            <span>01005168499</span>
          </a>
        </div>
      </header>

      {/* MAIN VIEWPORT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent mb-3" />
            <p className="text-xs">جار تحميل بيانات عالم الصوت والإلكترونيات...</p>
          </div>
        ) : (
          <>
            {activeView === 'pos' && (
              <POSView
                products={products}
                customers={customers}
                config={config}
                onSaleComplete={handleSaleComplete}
                onRefreshData={loadData}
                onNavigateToInventory={() => setActiveView('inventory')}
              />
            )}

            {activeView === 'invoices' && (
              <InvoicesView
                invoices={invoices}
                customers={customers}
                config={config}
                onRefreshData={loadData}
                onViewInvoice={handleViewInvoice}
                onNavigateToPOS={() => setActiveView('pos')}
              />
            )}

            {activeView === 'inventory' && (
              <InventoryView
                products={products}
                config={config}
                onRefreshData={loadData}
              />
            )}

            {activeView === 'debts' && (
              <DebtsView
                invoices={invoices}
                customers={customers}
                config={config}
                onRefreshData={loadData}
                onViewInvoice={handleViewInvoice}
              />
            )}

            {activeView === 'reports' && (
              <ReportsView
                invoices={invoices}
                products={products}
                config={config}
                onRefreshData={loadData}
                onViewInvoice={handleViewInvoice}
              />
            )}

            {activeView === 'settings' && (
              <SettingsBackupView
                config={config}
                onUpdateConfig={handleUpdateConfig}
                onRefreshData={loadData}
              />
            )}
          </>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION TAB BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 py-1">
        <div className="grid grid-cols-6 items-center">
          <button
            onClick={() => setActiveView('pos')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeView === 'pos' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="text-[10px] mt-1">البيع</span>
          </button>

          <button
            onClick={() => setActiveView('invoices')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeView === 'invoices' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[10px] mt-1">الفواتير</span>
          </button>

          <button
            onClick={() => setActiveView('inventory')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeView === 'inventory' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Package className="h-5 w-5" />
            <span className="text-[10px] mt-1">المخزون</span>
          </button>

          <button
            onClick={() => setActiveView('debts')}
            className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeView === 'debts' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <div className="relative">
              <Layers className="h-5 w-5" />
              {activeDebtsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] text-white font-bold">
                  {activeDebtsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1">الديون</span>
          </button>

          <button
            onClick={() => setActiveView('reports')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeView === 'reports' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-[10px] mt-1">الأرباح</span>
          </button>

          <button
            onClick={() => setActiveView('settings')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition ${
              activeView === 'settings' ? 'text-amber-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px] mt-1">الإعدادات</span>
          </button>
        </div>
      </nav>

      {/* INVOICE PRINT & OFFICIAL SEAL MODAL */}
      <InvoicePrintModal
        invoice={selectedInvoiceForPrint}
        config={config}
        isOpen={isPrintModalOpen}
        initialAction={initialActionForPrint}
        onClose={() => {
          setIsPrintModalOpen(false);
          setInitialActionForPrint(null);
        }}
        onRefreshData={loadData}
        onInvoiceUpdated={(updated) => setSelectedInvoiceForPrint(updated)}
      />

      {/* Floating Offline Status Toast */}
      <OfflineIndicator />

      {/* Refresh Success Toast */}
      {showRefreshToast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg shadow-emerald-950/40 flex items-center gap-2 animate-bounce">
          <Check className="h-4 w-4" />
          <span>تم تحديث بيانات ومحتوى الموقع بنجاح!</span>
        </div>
      )}
    </div>
  );
}
