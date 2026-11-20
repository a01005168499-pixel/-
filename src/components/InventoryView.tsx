import React, { useState, useMemo, useRef } from 'react';
import { Product, StoreConfig, PRODUCT_CATEGORIES } from '../types';
import { StorageService } from '../services/storage';
import {
  Search,
  Plus,
  Upload,
  Download,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
  Image as ImageIcon,
  Barcode,
  Sparkles,
  PackageX,
  PackagePlus,
  CheckSquare,
  Square,
  AlertOctagon,
  AlertCircle,
  Loader2,
  TrendingUp,
  Tag,
  LayoutGrid,
  List,
  Boxes,
} from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  config: StoreConfig;
  onRefreshData: () => Promise<void>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  config,
  onRefreshData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('جميع الأقسام');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Deletion States
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form state for Add/Edit
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCategory, setFormCategory] = useState(PRODUCT_CATEGORIES[1]);
  const [formCostPrice, setFormCostPrice] = useState<number | ''>('');
  const [formSellPrice, setFormSellPrice] = useState<number | ''>('');
  const [formStock, setFormStock] = useState<number | ''>('');
  const [formMinStock, setFormMinStock] = useState<number | ''>(3);
  const [formUnit, setFormUnit] = useState('قطعة');
  const [formImage, setFormImage] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'جميع الأقسام' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchLowStock = onlyLowStock ? p.stockQuantity <= p.minStockThreshold : true;
      return matchCat && matchSearch && matchLowStock;
    });
  }, [products, selectedCategory, searchQuery, onlyLowStock]);

  // Inventory Totals
  const totalItemsCount = products.reduce((sum, p) => sum + p.stockQuantity, 0);
  const totalCostValue = products.reduce((sum, p) => sum + p.stockQuantity * p.costPrice, 0);
  const totalSellValue = products.reduce((sum, p) => sum + p.stockQuantity * p.sellPrice, 0);
  const totalExpectedProfit = totalSellValue - totalCostValue;
  const expectedMarginPercent =
    totalCostValue > 0 ? ((totalExpectedProfit / totalCostValue) * 100).toFixed(1) : '0';
  const lowStockCount = products.filter((p) => p.stockQuantity <= p.minStockThreshold).length;

  // Quick Stock Adjustment (+1, +5, -1)
  const handleQuickAdjust = async (productId: string, delta: number) => {
    await StorageService.updateProductStock(productId, delta);
    await onRefreshData();
  };

  // Open Modal for Create or Edit
  const openModal = (product?: Product) => {
    setFormError(null);
    setIsSaving(false);
    if (product) {
      setEditingProduct(product);
      setFormName(product.name || '');
      setFormBarcode(product.barcode || '');
      setFormCategory(product.category || PRODUCT_CATEGORIES[1]);
      setFormCostPrice(product.costPrice !== undefined ? product.costPrice : '');
      setFormSellPrice(product.sellPrice !== undefined ? product.sellPrice : '');
      setFormStock(product.stockQuantity !== undefined ? product.stockQuantity : 0);
      setFormMinStock(product.minStockThreshold !== undefined ? product.minStockThreshold : 3);
      setFormUnit(product.unit || 'قطعة');
      setFormImage(product.image || '');
      setFormDescription(product.description || '');
    } else {
      setEditingProduct(null);
      setFormName('');
      setFormBarcode(`622${Date.now().toString().slice(-7)}`);
      setFormCategory(PRODUCT_CATEGORIES[1]);
      setFormCostPrice('');
      setFormSellPrice('');
      setFormStock(10);
      setFormMinStock(3);
      setFormUnit('قطعة');
      setFormImage('');
      setFormDescription('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormError(null);
    setIsSaving(false);
  };

  // Save Product (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError('يرجى كتابة اسم المنتج أو الجهاز أولاً.');
      return;
    }

    if (formSellPrice === '' || isNaN(Number(formSellPrice))) {
      setFormError('يرجى تحديد سعر البيع للجمهور.');
      return;
    }

    const sell = Number(formSellPrice);
    if (sell < 0) {
      setFormError('سعر البيع لا يمكن أن يكون قيمة سالبة.');
      return;
    }

    const cost = formCostPrice === '' ? 0 : Number(formCostPrice);
    if (cost < 0) {
      setFormError('سعر التكلفة لا يمكن أن يكون قيمة سالبة.');
      return;
    }

    const stock = formStock === '' ? 0 : Number(formStock);
    const minStock = formMinStock === '' ? 3 : Number(formMinStock);
    const barcode = formBarcode.trim() || (editingProduct ? editingProduct.barcode : `622${Date.now().toString().slice(-7)}`);

    setIsSaving(true);

    try {
      // Fetch latest products from storage, fallback to props.products
      let allProducts = await StorageService.getProducts();
      if ((!allProducts || allProducts.length === 0) && products && products.length > 0) {
        allProducts = [...products];
      }

      let restockDeductedNotice = '';

      if (editingProduct) {
        const previousStock = Number(editingProduct.stockQuantity) || 0;
        const quantityAdded = stock - previousStock;

        if (quantityAdded > 0) {
          const unitCost = cost;
          const totalDeducted = quantityAdded * unitCost;
          await StorageService.recordRestock({
            productId: editingProduct.id,
            productName: trimmedName,
            category: formCategory,
            quantityAdded,
            unitCostPrice: unitCost,
            previousStock,
            newStock: stock,
            reason: `تزويد رصيد الصنف (+${quantityAdded} ${formUnit}) بسعر تكلفة ${unitCost} ج.م - خصم من تكلفة البضاعة المباعة`,
            type: 'manual_increase',
          });
          restockDeductedNotice = ` (تم تزويد المخزون +${quantityAdded} ${formUnit} وخصم ${totalDeducted.toLocaleString()} ${config.currency} من تكلفة البضاعة المباعة)`;
        }

        const updatedItem: Product = {
          ...editingProduct,
          name: trimmedName,
          barcode,
          category: formCategory,
          costPrice: cost,
          sellPrice: sell,
          stockQuantity: stock,
          minStockThreshold: minStock,
          unit: formUnit,
          image: formImage,
          description: formDescription.trim(),
          updatedAt: new Date().toISOString(),
        };

        const existsInStorage = allProducts.some(
          (p) => String(p.id) === String(editingProduct.id) || (p.barcode && p.barcode === editingProduct.barcode)
        );

        let updatedList: Product[];
        if (existsInStorage) {
          updatedList = allProducts.map((p) =>
            String(p.id) === String(editingProduct.id) || (editingProduct.barcode && p.barcode === editingProduct.barcode)
              ? updatedItem
              : p
          );
        } else {
          updatedList = [updatedItem, ...allProducts];
        }

        await StorageService.saveProducts(updatedList);
        setImportNotice(`تم حفظ تعديل المنتج "${trimmedName}" بنجاح!${restockDeductedNotice}`);
      } else {
        const newProduct: Product = {
          id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          barcode,
          name: trimmedName,
          category: formCategory,
          costPrice: cost,
          sellPrice: sell,
          stockQuantity: stock,
          minStockThreshold: minStock,
          unit: formUnit,
          image: formImage,
          description: formDescription.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (stock > 0) {
          const unitCost = cost;
          const totalDeducted = stock * unitCost;
          await StorageService.recordRestock({
            productId: newProduct.id,
            productName: trimmedName,
            category: formCategory,
            quantityAdded: stock,
            unitCostPrice: unitCost,
            previousStock: 0,
            newStock: stock,
            reason: `إضافة صنف جديد (${trimmedName}) برصيد افتتاحي (${stock} ${formUnit}) بسعر تكلفة ${unitCost} ج.م - خصم من تكلفة البضاعة المباعة`,
            type: 'product_creation',
          });
          restockDeductedNotice = ` (تم تسجيل رصيد افتتاحي ${stock} ${formUnit} وخصم ${totalDeducted.toLocaleString()} ${config.currency} من تكلفة البضاعة المباعة)`;
        }

        await StorageService.saveProducts([newProduct, ...allProducts]);
        setImportNotice(`تمت إضافة المنتج الجديد "${trimmedName}" بنجاح!${restockDeductedNotice}`);
      }

      await onRefreshData();
      closeModal();
      setTimeout(() => setImportNotice(null), 3500);
    } catch (err: unknown) {
      console.error('Failed to save product:', err);
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الحفظ';
      setFormError(`تعذر حفظ التعديلات: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // SINGLE PRODUCT DELETION
  const confirmDeleteSingleProduct = async () => {
    if (!productToDelete) return;
    await StorageService.deleteProduct(productToDelete.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(productToDelete.id);
      return next;
    });
    setProductToDelete(null);
    closeModal();
    await onRefreshData();
    setImportNotice(`تم حذف المنتج "${productToDelete.name}" بنجاح.`);
    setTimeout(() => setImportNotice(null), 3000);
  };

  // DELETE ALL SAMPLE / ALL PRODUCTS
  const confirmDeleteAllProducts = async () => {
    await StorageService.deleteAllProducts();
    setSelectedIds(new Set());
    setIsDeleteAllModalOpen(false);
    await onRefreshData();
    setImportNotice('تم تفريغ المخزون وحذف جميع المنتجات التجريبية بنجاح.');
    setTimeout(() => setImportNotice(null), 3500);
  };

  // BULK DELETE SELECTED
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const all = await StorageService.getProducts();
      const remaining = all.filter((p) => !selectedIds.has(p.id));
      await StorageService.saveProducts(remaining);
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setIsBulkDeleteModalOpen(false);
      await onRefreshData();
      setImportNotice(`تم حذف ${count} منتج بنجاح.`);
      setTimeout(() => setImportNotice(null), 3000);
    } catch (err) {
      console.error('Failed to bulk delete', err);
      setIsBulkDeleteModalOpen(false);
      setImportNotice('حدث خطأ أثناء محاولة حذف المنتجات المحددة.');
      setTimeout(() => setImportNotice(null), 3000);
    }
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Image Upload with Client-Side Canvas Resizing & Compression (~30KB vs 10MB)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setFormError('حجم الصورة كبير جداً، يرجى اختيار صورة أصغر من 25 ميجابايت.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const rawResult = reader.result as string;
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const maxDim = 600;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.82);
              setFormImage(compressed);
            } else {
              setFormImage(rawResult);
            }
          } catch {
            setFormImage(rawResult);
          }
        };
        img.onerror = () => {
          setFormImage(rawResult);
        };
        img.src = rawResult;
      };
      reader.readAsDataURL(file);
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    await StorageService.exportProductsToExcel();
  };

  // Excel Import Trigger
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportNotice(null);
    try {
      const result = await StorageService.importProductsFromExcel(file);
      await onRefreshData();
      setImportNotice(
        `تم استيراد الملف بنجاح! تم إضافة ${result.addedCount} منتج جديد وتحديث ${result.updatedCount} منتج حالي.`
      );
    } catch (err) {
      console.error(err);
      setImportNotice('فشل استيراد ملف الإكسل. يرجى التأكد من أن الملف بصيغة Excel صحيحة.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setImportNotice(null), 4000);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Top Header & Actions Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white">إدارة المخزون والتسعير</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            التحكم في إضافة وحذف الأصناف يدوياً، أزرار التحديث السريع (+1/+5)، واستيراد وتصدير الإكسل
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden file input for excel */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportExcel}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          {/* Bulk Delete Button if selected */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 shadow-md transition"
            >
              <Trash2 className="h-4 w-4" />
              <span>حذف المحدد ({selectedIds.size})</span>
            </button>
          )}

          {/* Delete All Sample Products / Clear All button */}
          {products.length > 0 && (
            <button
              onClick={() => setIsDeleteAllModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-800/80 bg-rose-950/30 px-3.5 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 hover:text-white transition"
              title="حذف جميع المنتجات التجريبية وتفريغ المخزون للبدء من الصفر"
            >
              <PackageX className="h-4 w-4 text-rose-400" />
              <span>تفريغ المخزون بالكامل</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <Upload className="h-4 w-4 text-amber-400" />
            <span>{isImporting ? 'جار الاستيراد...' : 'استيراد Excel'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <Download className="h-4 w-4 text-emerald-400" />
            <span>تصدير Excel</span>
          </button>

          <button
            onClick={() => openModal()}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/15 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة صنف جديد</span>
          </button>
        </div>
      </div>

      {/* Import / Delete Success Banner if exists */}
      {importNotice && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-950/60 border border-emerald-800 p-3.5 text-xs text-emerald-200 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{importNotice}</span>
          </div>
          <button onClick={() => setImportNotice(null)} className="text-emerald-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <span className="text-xs text-slate-400">إجمالي أصناف المخزن</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{products.length}</span>
            <span className="text-xs text-slate-500">صنف ({totalItemsCount} قطعة)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <span className="text-xs text-slate-400">قيمة المخزون بسعر الشراء</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {totalCostValue.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">رأس المال في البضاعة</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
          <span className="text-xs text-slate-400">قيمة المخزون بسعر البيع</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {totalSellValue.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">{config.currency}</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">القيمة البيعية الكلية</span>
        </div>

        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">الأرباح المتوقعة من البضاعة</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              +{totalExpectedProfit.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">{config.currency}</span>
          </div>
          <span className="text-[10px] text-emerald-400/90 font-bold block mt-0.5">
            هامش ربح {expectedMarginPercent}%
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 col-span-2 md:col-span-1">
          <span className="text-xs text-slate-400">تنبيهات نواقص المخزون</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-black font-mono ${
                lowStockCount > 0 ? 'text-rose-400' : 'text-slate-200'
              }`}
            >
              {lowStockCount}
            </span>
            <span className="text-xs text-slate-500">منتجات قاربت على النفاد</span>
          </div>
        </div>
      </div>

      {/* Search, Category Filters & View Mode Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، الباركود، أو القسم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pr-9 pl-3 text-xs text-white placeholder-slate-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:outline-hidden"
          >
            {PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              onlyLowStock
                ? 'bg-rose-500 text-white'
                : 'border border-slate-700 bg-slate-950 text-slate-300 hover:text-white'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>نواقص فقط</span>
          </button>

          {/* View Mode Toggle: Cards (like POS) vs Table */}
          <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض كروت (مثل مظهر صفحة البيع)"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>كروت (مظهر البيع)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض جدول تفصيلي"
            >
              <List className="h-3.5 w-3.5" />
              <span>جدول تفصيلي</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selection & Count Bar */}
      {products.length > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 py-0.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 hover:text-white transition font-medium cursor-pointer"
            >
              {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-amber-400" />
              ) : (
                <Square className="h-4 w-4 text-slate-500" />
              )}
              <span>
                {selectedIds.size > 0
                  ? `تم تحديد ${selectedIds.size} من أصل ${filteredProducts.length}`
                  : `تحديد الكل (${filteredProducts.length} صنف)`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-slate-500 hover:text-rose-400 transition"
              >
                إلغاء التحديد
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            معروض <span className="font-bold text-white font-mono">{filteredProducts.length}</span> من إجمالي{' '}
            <span className="font-bold text-white font-mono">{products.length}</span> صنف
          </div>
        </div>
      )}

      {/* PRODUCTS DISPLAY: GRID (POS-STYLE) OR TABLE */}
      {viewMode === 'grid' ? (
        /* GRID VIEW - MATCHING POS/SALES PAGE APPEARANCE */
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredProducts.map((product) => {
              const isLowStock = product.stockQuantity <= product.minStockThreshold;
              const isOutOfStock = product.stockQuantity <= 0;
              const isSelected = selectedIds.has(product.id);
              const profit = product.sellPrice - product.costPrice;
              const profitMargin =
                product.costPrice > 0 ? ((profit / product.costPrice) * 100).toFixed(0) : '100';

              return (
                <div
                  key={product.id}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 select-none ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-500/50 bg-slate-900 shadow-xl'
                      : isOutOfStock
                      ? 'border-slate-800 bg-slate-900/40 opacity-75'
                      : 'border-slate-800 bg-slate-900/90 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5'
                  }`}
                >
                  {/* Product Image - Exact POS aspect-square & badges layout */}
                  <div className="relative aspect-square w-full overflow-hidden bg-slate-950/60 flex items-center justify-center">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-600 p-2 text-center">
                        <Tag className="h-8 w-8 mb-1 text-slate-500" />
                        <span className="text-[10px] text-slate-400 font-medium">معدة صوتية</span>
                      </div>
                    )}

                    {/* Stock Quantity Badge - Exactly as in Sales / POS View */}
                    <span
                      className={`absolute top-2 right-2 rounded-lg px-2 py-0.5 text-[10px] font-bold shadow-md ${
                        isOutOfStock
                          ? 'bg-rose-950/90 text-rose-300 border border-rose-800'
                          : isLowStock
                          ? 'bg-amber-950/90 text-amber-300 border border-amber-700'
                          : 'bg-slate-900/90 text-emerald-400 border border-slate-700'
                      }`}
                    >
                      {isOutOfStock ? 'نفد المخزون' : `${product.stockQuantity} ${product.unit}`}
                    </span>

                    {/* Select Item Checkbox Badge (Top Left) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectOne(product.id);
                      }}
                      className={`absolute top-2 left-2 rounded-lg p-1.5 shadow-md backdrop-blur-xs transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-950/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                      title={isSelected ? 'إلغاء تحديد الصنف' : 'تحديد هذا الصنف'}
                    >
                      {isSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Info Section - Identical typography & structure to POS */}
                  <div className="p-3 flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-slate-400 line-clamp-1">{product.category}</span>
                        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-0.5">
                          <Barcode className="h-2.5 w-2.5 text-slate-600" />
                          {product.barcode}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 mt-0.5 leading-snug">
                        {product.name}
                      </h4>
                    </div>

                    {/* Pricing, Profit & Inventory Controls */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2">
                      {/* Price Row: Sell Price (amber like POS) & Profit */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm sm:text-base font-black text-amber-400 font-mono">
                            {product.sellPrice.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 mr-1">{config.currency}</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/40 border border-emerald-900/40 px-1.5 py-0.5 rounded-md">
                          +{profit.toLocaleString()} ({profitMargin}%)
                        </div>
                      </div>

                      {/* Purchasing Cost */}
                      <div className="text-[10px] text-slate-400 flex items-center justify-between bg-slate-950/50 px-2 py-1 rounded-lg border border-slate-800/50">
                        <span>سعر الشراء:</span>
                        <span className="font-mono text-slate-300 font-semibold">
                          {product.costPrice.toLocaleString()} {config.currency}
                        </span>
                      </div>

                      {/* Quick Adjust Quantity (-1, +1, +5) & Edit/Delete Controls */}
                      <div className="pt-1 flex items-center justify-between gap-1">
                        {/* Quick adjust quantity buttons */}
                        <div className="inline-flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-xl border border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(product.id, -1)}
                            disabled={product.stockQuantity <= 0}
                            className="px-2 py-1 rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-30 text-xs font-mono font-bold transition cursor-pointer"
                            title="إنقاص 1"
                          >
                            -1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(product.id, 1)}
                            className="px-2 py-1 rounded-lg bg-slate-900 text-emerald-400 hover:bg-slate-800 text-xs font-mono font-bold transition cursor-pointer"
                            title="إضافة 1"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(product.id, 5)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-mono font-bold transition cursor-pointer"
                            title="إضافة 5 قطع دفعة واحدة"
                          >
                            +5
                          </button>
                        </div>

                        {/* Edit & Delete Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openModal(product)}
                            className="p-1.5 rounded-xl bg-slate-800/80 text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition cursor-pointer"
                            title="تعديل بيانات المنتج"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductToDelete(product)}
                            className="p-1.5 rounded-xl bg-rose-950/30 border border-rose-900/40 text-rose-400 hover:bg-rose-900/60 hover:text-white transition cursor-pointer"
                            title="حذف هذا المنتج"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State in Grid Mode */}
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40">
              <div className="h-16 w-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
                <PackagePlus className="h-8 w-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                المخزون فارغ حالياً - جاهز لإضافة منتجاتك الحقيقية
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-6 leading-relaxed">
                تم حذف المنتجات التجريبية بنجاح! يمكنك الآن بدء إضافة بضائع محل عالم الصوت والإلكترونيات
                يدوياً واحدة تلو الأخرى، أو استيرادها دفعة واحدة من ملف Excel.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => openModal()}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة أول منتج يدوي</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Upload className="h-4 w-4 text-amber-400" />
                  <span>استيراد مئات المنتجات عبر Excel</span>
                </button>
              </div>
            </div>
          ) : (
            filteredProducts.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-xs rounded-2xl border border-dashed border-slate-800 bg-slate-900/40">
                لا توجد منتجات مطابقة لخيارات الفلترة أو البحث المحددة
              </div>
            )
          )}
        </div>
      ) : (
        /* TABLE VIEW - DETAILED SPREADSHEET-STYLE VIEW */
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-white transition"
                      title="تحديد الكل"
                    >
                      {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-amber-400" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4 font-semibold">المنتج والباركود</th>
                  <th className="py-3 px-3 font-semibold">القسم</th>
                  <th className="py-3 px-3 font-semibold text-center">سعر الشراء</th>
                  <th className="py-3 px-3 font-semibold text-center">سعر البيع</th>
                  <th className="py-3 px-3 font-semibold text-center">الربح المتوقع</th>
                  <th className="py-3 px-3 font-semibold text-center">الكمية المتوفرة</th>
                  <th className="py-3 px-4 font-semibold text-center">تحديث سريع للكميات</th>
                  <th className="py-3 px-4 font-semibold text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((p) => {
                  const profit = p.sellPrice - p.costPrice;
                  const profitMargin =
                    p.costPrice > 0 ? ((profit / p.costPrice) * 100).toFixed(0) : '100';
                  const isLow = p.stockQuantity <= p.minStockThreshold;
                  const isEmpty = p.stockQuantity <= 0;
                  const isSelected = selectedIds.has(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`transition ${isSelected ? 'bg-amber-500/5' : 'hover:bg-slate-800/40'}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => toggleSelectOne(p.id)}
                          className="text-slate-500 hover:text-amber-400 transition"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-amber-400" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      {/* Name + Image + Barcode */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-slate-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs sm:text-sm line-clamp-1">{p.name}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-0.5">
                              <Barcode className="h-3 w-3 inline text-slate-500" />
                              <span>{p.barcode}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-slate-300">{p.category}</td>

                      {/* Cost */}
                      <td className="py-3 px-3 text-center font-mono text-slate-400">
                        {p.costPrice.toLocaleString()} {config.currency}
                      </td>

                      {/* Sell Price */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                        {p.sellPrice.toLocaleString()} {config.currency}
                      </td>

                      {/* Profit */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-mono text-emerald-400 font-bold">
                          +{profit.toLocaleString()} {config.currency}
                        </div>
                        <div className="text-[10px] text-slate-500">هامش {profitMargin}%</div>
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                            isEmpty
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : isLow
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {p.stockQuantity} {p.unit}
                        </span>
                      </td>

                      {/* Quick stock adjustment buttons (+1, +5, -1) */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                          <button
                            onClick={() => handleQuickAdjust(p.id, -1)}
                            disabled={p.stockQuantity <= 0}
                            className="px-2 py-1 rounded-lg bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-30 text-xs font-mono font-bold transition"
                            title="إنقاص 1"
                          >
                            -1
                          </button>
                          <button
                            onClick={() => handleQuickAdjust(p.id, 1)}
                            className="px-2 py-1 rounded-lg bg-slate-900 text-emerald-400 hover:bg-slate-800 text-xs font-mono font-bold transition"
                            title="إضافة قطعة واحدة"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleQuickAdjust(p.id, 5)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-mono font-bold transition"
                            title="إضافة 5 قطع دفعة واحدة"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      {/* Action edit & delete */}
                      <td className="py-3 px-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openModal(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
                            title="تعديل بيانات المنتج"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setProductToDelete(p)}
                            className="p-1.5 rounded-lg text-rose-400/80 hover:bg-rose-950/80 hover:text-rose-300 border border-transparent hover:border-rose-900/50 transition cursor-pointer"
                            title="حذف هذا المنتج يدوياً"
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

          {/* Empty State when zero products exist */}
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400 mb-4 shadow-xl">
                <PackagePlus className="h-8 w-8" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                المخزون فارغ حالياً - جاهز لإضافة منتجاتك الحقيقية
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-1 mb-6 leading-relaxed">
                تم حذف المنتجات التجريبية بنجاح! يمكنك الآن بدء إضافة بضائع محل عالم الصوت والإلكترونيات
                يدوياً واحدة تلو الأخرى، أو استيرادها دفعة واحدة من ملف Excel.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => openModal()}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة أول منتج يدوي</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition cursor-pointer"
                >
                  <Upload className="h-4 w-4 text-amber-400" />
                  <span>استيراد مئات المنتجات عبر Excel</span>
                </button>
              </div>
            </div>
          ) : (
            filteredProducts.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-xs">
                لا توجد منتجات مطابقة لخيارات الفلترة أو البحث المحددة
              </div>
            )
          )}
        </div>
      )}

      {/* CONFIRM SINGLE PRODUCT DELETE MODAL */}
      {productToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-rose-900/60 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تأكيد حذف المنتج</h3>
                <p className="text-xs text-rose-300">سيتم حذف هذا الصنف نهائياً من قاعدة بيانات المخزون</p>
              </div>
            </div>

            <div className="my-4 rounded-xl bg-slate-950 p-3.5 border border-slate-800 text-xs space-y-2">
              <div className="font-bold text-white text-sm">{productToDelete.name}</div>
              <div className="flex justify-between text-slate-400">
                <span>الباركود:</span>
                <span className="font-mono text-slate-200">{productToDelete.barcode}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>الكمية المسجلة:</span>
                <span className="font-mono text-amber-400 font-bold">
                  {productToDelete.stockQuantity} {productToDelete.unit}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>سعر البيع:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {productToDelete.sellPrice.toLocaleString()} {config.currency}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingleProduct}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition cursor-pointer"
              >
                نعم، احذف المنتج نهائياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ALL PRODUCTS MODAL */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-rose-900/80 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تأكيد تفريغ المخزون بالكامل</h3>
                <p className="text-xs text-rose-300">حذف جميع الأصناف والمنتجات التجريبية</p>
              </div>
            </div>

            <p className="my-4 text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف كافة المنتجات (<strong>{products.length} صنف</strong>) من
              المخزن؟
              <br />
              هذا الإجراء سيفرغ المخزون لتتمكن من إدخال منتجاتك وبضائعك الحقيقية.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={confirmDeleteAllProducts}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition cursor-pointer"
              >
                نعم، تفريغ المخزون وحذف الكل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM BULK DELETE MODAL */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-rose-900/80 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تأكيد حذف المنتجات المحددة</h3>
                <p className="text-xs text-rose-300">سيتم حذف {selectedIds.size} صنف من المخزون</p>
              </div>
            </div>

            <p className="my-4 text-xs text-slate-300 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف المنتجات التي قمت بتحديدها (<strong>{selectedIds.size} منتج</strong>)؟
              لا يمكن التراجع عن هذا الإجراء بعد تنفيذه.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition cursor-pointer"
              >
                نعم، احذف الأصناف المحددة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PRODUCT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl my-auto text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <h3 className="text-base font-bold text-white">
                {editingProduct ? 'تعديل بيانات المنتج والمخزون' : 'إضافة منتج صوتي / إلكتروني جديد'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} noValidate className="p-6 space-y-4">
              {/* Error Banner inside Modal */}
              {formError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span className="font-semibold leading-relaxed">{formError}</span>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  اسم المنتج / الجهاز *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ميكروفون لاسلكي شور مزدوج عالي التردد"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Barcode & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">الباركود</label>
                    <button
                      type="button"
                      onClick={() => setFormBarcode(`622${Date.now().toString().slice(-7)}`)}
                      className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      توليد تلقائي
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">القسم / التصنيف</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:outline-hidden"
                  >
                    {PRODUCT_CATEGORIES.filter((c) => c !== 'جميع الأقسام').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cost Price & Sell Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    سعر الشراء (التكلفة) ({config.currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={formCostPrice}
                    onChange={(e) =>
                      setFormCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-slate-200 font-mono font-bold focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-amber-400 mb-1">
                    سعر البيع للجمهور ({config.currency}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    placeholder="0"
                    value={formSellPrice}
                    onChange={(e) =>
                      setFormSellPrice(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="w-full rounded-xl border border-amber-500/50 bg-slate-900 p-2.5 text-xs text-amber-400 font-mono font-black focus:outline-hidden"
                  />
                </div>

                {/* Instant calculated profit */}
                {typeof formSellPrice === 'number' && typeof formCostPrice === 'number' && (
                  <div className="col-span-full text-xs text-emerald-400 font-medium pt-1 flex justify-between">
                    <span>
                      الربح المتوقع للقطعة: {(formSellPrice - formCostPrice).toLocaleString()}{' '}
                      {config.currency}
                    </span>
                    <span>
                      هامش الربح:{' '}
                      {formCostPrice > 0
                        ? (((formSellPrice - formCostPrice) / formCostPrice) * 100).toFixed(1)
                        : 100}
                      %
                    </span>
                  </div>
                )}
              </div>

              {/* Stock Quantity, Min Stock, Unit */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    الكمية المتوفرة
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formStock}
                    onChange={(e) =>
                      setFormStock(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-mono focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">حد التنبيه</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formMinStock}
                    onChange={(e) =>
                      setFormMinStock(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white font-mono focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">الوحدة</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white focus:outline-hidden"
                  >
                    <option value="قطعة">قطعة</option>
                    <option value="طقم">طقم</option>
                    <option value="جهاز">جهاز</option>
                    <option value="متر">متر</option>
                    <option value="لفة">لفة</option>
                    <option value="زوج">زوج</option>
                  </select>
                </div>
              </div>

              {/* Live Restock Cost Deduction Badge */}
              {(() => {
                const currentStockVal = typeof formStock === 'number' ? formStock : 0;
                const costVal = typeof formCostPrice === 'number' ? formCostPrice : 0;
                const prevStock = editingProduct ? Number(editingProduct.stockQuantity) || 0 : 0;
                const addedQty = editingProduct ? currentStockVal - prevStock : currentStockVal;

                if (addedQty > 0 && costVal > 0) {
                  const totalDeduction = addedQty * costVal;
                  return (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-200 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-amber-400 shrink-0" />
                        <span className="font-semibold text-slate-200">
                          خصم تكلفة زيادة المخزون (+{addedQty} {formUnit}) من تكلفة البضاعة المباعة:
                        </span>
                      </div>
                      <span className="font-mono text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                        -{totalDeduction.toLocaleString()} {config.currency}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Product Image Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">صورة المنتج</label>
                  {formImage && (
                    <button
                      type="button"
                      onClick={() => setFormImage('')}
                      className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
                    >
                      إزالة الصورة
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {formImage ? (
                    <img
                      src={formImage}
                      alt="preview"
                      className="h-12 w-12 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="block w-full text-xs text-slate-400 file:mr-0 file:ml-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">يتم ضغط الصورة تلقائياً لسرعة التطبيق وخفة التخزين</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  وصف أو ملاحظات فنية
                </label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات فنية، التردد، الموديل، التوافق..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-hidden"
                />
              </div>

              {/* Submit Buttons + Delete button if editing */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => setProductToDelete(editingProduct)}
                      className="flex items-center gap-1.5 rounded-xl border border-rose-800/80 bg-rose-950/40 px-3.5 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>حذف هذا الصنف</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin text-slate-950" />}
                    <span>
                      {isSaving
                        ? 'جارٍ الحفظ...'
                        : editingProduct
                        ? 'حفظ التعديلات'
                        : 'إضافة إلى المخزون'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
