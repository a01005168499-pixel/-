import React, { useState, useMemo } from 'react';
import { Product, CartItem, Customer, Invoice, StoreConfig, PRODUCT_CATEGORIES } from '../types';
import { StorageService } from '../services/storage';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import confetti from 'canvas-confetti';
import {
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  User,
  CreditCard,
  Banknote,
  Percent,
  CheckCircle2,
  AlertCircle,
  Tag,
  Clock,
  Printer,
  ChevronDown,
  X,
} from 'lucide-react';

interface POSViewProps {
  products: Product[];
  customers: Customer[];
  config: StoreConfig;
  onSaleComplete: (invoice: Invoice) => void;
  onRefreshData: () => Promise<void>;
  onNavigateToInventory?: () => void;
}

export const POSView: React.FC<POSViewProps> = ({
  products,
  customers,
  config,
  onSaleComplete,
  onRefreshData,
  onNavigateToInventory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('جميع الأقسام');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Sale form states
  const [customerType, setCustomerType] = useState<'quick' | 'existing' | 'new'>('quick');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('عميل نقدي سريع');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'debt' | 'partial'>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountInputValue, setDiscountInputValue] = useState<string>('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Filter products by category and search term (name or barcode)
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'جميع الأقسام' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const itemsDiscount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.discount, 0);
  }, [cart]);

  // Order discount calculation (amount or percentage)
  const computedOrderDiscount = useMemo(() => {
    const val = parseFloat(discountInputValue) || 0;
    if (val <= 0) return 0;
    if (discountType === 'percent') {
      return (cartSubtotal * Math.min(100, val)) / 100;
    }
    return Math.min(cartSubtotal, val);
  }, [cartSubtotal, discountInputValue, discountType]);

  const totalDiscount = itemsDiscount + computedOrderDiscount;
  const totalNet = Math.max(0, cartSubtotal - totalDiscount);

  // Calculated Paid & Remaining Debt
  const calculatedPaid = useMemo(() => {
    if (paymentType === 'cash') return totalNet;
    if (paymentType === 'debt') return 0;
    const entered = parseFloat(paidAmountInput) || 0;
    return Math.min(entered, totalNet);
  }, [paymentType, paidAmountInput, totalNet]);

  const remainingDebt = Math.max(0, totalNet - calculatedPaid);

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) return;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) return prevCart; // cannot exceed stock
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice - item.discount }
            : item
        );
      }
      return [
        ...prevCart,
        {
          product,
          quantity: 1,
          unitPrice: product.sellPrice,
          discount: 0,
          total: product.sellPrice,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, newQty: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const clampedQty = Math.min(newQty, product.stockQuantity);
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: clampedQty, total: clampedQty * item.unitPrice - item.discount }
          : item
      )
    );
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const disc = Math.max(0, discount);
          return {
            ...item,
            discount: disc,
            total: Math.max(0, item.quantity * item.unitPrice - disc),
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountInputValue('');
    setDiscountType('amount');
    setInvoiceNotes('');
    setPaymentType('cash');
    setPaidAmountInput('');
  };

  // Barcode scanned handler
  const handleBarcodeScanned = (barcode: string) => {
    const matched = products.find(
      (p) => p.barcode.toLowerCase() === barcode.toLowerCase()
    );
    if (matched) {
      addToCart(matched);
    } else {
      setSearchQuery(barcode);
    }
  };

  // Customer selection change
  const handleCustomerSelectionChange = (type: 'quick' | 'existing' | 'new') => {
    setCustomerType(type);
    if (type === 'quick') {
      setCustomerName('عميل نقدي سريع');
      setCustomerPhone('');
      setSelectedCustomerId('');
      setPaymentType('cash');
    } else if (type === 'new') {
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomerId('');
    }
  };

  const handleSelectExistingCustomer = (id: string) => {
    setSelectedCustomerId(id);
    const found = customers.find((c) => c.id === id);
    if (found) {
      setCustomerName(found.name);
      setCustomerPhone(found.phone);
    }
  };

  // Execute Sale Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (paymentType !== 'cash' && (!customerName.trim() || customerName === 'عميل نقدي سريع')) {
      alert('برجاء إدخال اسم العميل لتسجيل الفاتورة الآجلة أو الدين عليه بدقة.');
      return;
    }

    setIsProcessing(true);
    try {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      const invoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber,
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim() || 'عميل نقدي سريع',
        customerPhone: customerPhone.trim(),
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          barcode: item.product.barcode,
          unit: item.product.unit,
          quantity: item.quantity,
          costPrice: item.product.costPrice,
          sellPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
        })),
        subtotal: cartSubtotal,
        discount: totalDiscount,
        totalAmount: totalNet,
        paidAmount: calculatedPaid,
        remainingDebt: remainingDebt,
        paymentType,
        status: remainingDebt <= 0 ? 'paid' : calculatedPaid > 0 ? 'partial' : 'unpaid',
        notes: invoiceNotes.trim() || undefined,
        dueDate: dueDate || undefined,
        createdAt: new Date().toISOString(),
        officialSealConfirmed: config.enableOfficialSeal,
      };

      await StorageService.processSale(invoice);
      await onRefreshData();

      // Confetti celebration
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.8 },
      });

      clearCart();
      setIsMobileCartOpen(false);
      onSaleComplete(invoice);
    } catch (err) {
      console.error('Error during sale checkout', err);
      alert('حدث خطأ أثناء حفظ الفاتورة.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20 lg:pb-6">
      {/* LEFT COLUMN (COL 1-8): PRODUCTS CATALOG & SEARCH */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        {/* Search Bar & Camera Trigger */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن جهاز صوت، كابل، ميكروفون، أو امسح الباركود..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 py-3 pr-10 pl-4 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                مسح
              </button>
            )}
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/10 transition shrink-0"
            title="فتح كاميرا الهاتف لمسح الباركود"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">مسح بكاميرا الهاتف</span>
          </button>
        </div>

        {/* Categories Horizontal Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-3.5 py-2 rounded-xl font-medium transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredProducts.map((product) => {
            const isLowStock = product.stockQuantity <= product.minStockThreshold;
            const isOutOfStock = product.stockQuantity <= 0;
            const inCart = cart.find((i) => i.product.id === product.id);

            return (
              <div
                key={product.id}
                onClick={() => !isOutOfStock && addToCart(product)}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 select-none ${
                  isOutOfStock
                    ? 'border-slate-800 bg-slate-900/40 opacity-60 cursor-not-allowed'
                    : 'border-slate-800 bg-slate-900/90 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 cursor-pointer active:scale-[0.98]'
                }`}
              >
                {/* Product Image */}
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

                  {/* Stock Quantity Badge */}
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

                  {/* Quantity In Cart Badge */}
                  {inCart && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-amber-500 text-slate-950 px-2 py-0.5 text-[11px] font-black shadow-lg">
                      ×{inCart.quantity}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col justify-between flex-1">
                  <div>
                    <span className="text-[10px] text-slate-400 line-clamp-1">{product.category}</span>
                    <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-2 mt-0.5 leading-snug">
                      {product.name}
                    </h4>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-sm sm:text-base font-black text-amber-400 font-mono">
                        {product.sellPrice.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 mr-1">{config.currency}</span>
                    </div>

                    <button
                      type="button"
                      disabled={isOutOfStock}
                      className="rounded-xl bg-slate-800 p-1.5 text-slate-300 group-hover:bg-amber-500 group-hover:text-slate-950 transition"
                      title="إضافة إلى السلة"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 py-16 px-4 text-center text-slate-400 bg-slate-900/40">
            <Tag className="h-10 w-10 text-slate-600 mb-2" />
            {products.length === 0 ? (
              <>
                <p className="text-base font-bold text-white">المخزون فارغ حالياً</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  تم حذف الأصناف التجريبية. انتقل إلى إدارة المخزون لإضافة منتجات المحل الحقيقية لبدء عمليات البيع.
                </p>
                {onNavigateToInventory && (
                  <button
                    onClick={onNavigateToInventory}
                    className="mt-4 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 shadow-md transition"
                  >
                    الانتقال لصفحة المخزون لإضافة منتجات
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">لم يتم العثور على منتجات مطابقة للبحث</p>
                <p className="text-xs text-slate-500 mt-1">تأكد من كتابة الاسم أو الباركود بشكل صحيح، أو اختر قسماً آخر</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN (COL 9-12): ACTIVE SALE CART */}
      <div className="hidden lg:block lg:col-span-4">
        <div className="sticky top-20 rounded-2xl border border-slate-800 bg-slate-900/95 shadow-xl flex flex-col h-[calc(100vh-100px)]">
          {/* Cart Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-bold text-white">فاتورة البيع الحالية</h3>
              {cart.length > 0 && (
                <span className="rounded-full bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 font-bold">
                  {cart.length}
                </span>
              )}
            </div>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-slate-400 hover:text-rose-400 transition"
              >
                تفريغ السلة
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 py-10">
                <ShoppingCart className="h-10 w-10 mb-2 text-slate-700 stroke-1" />
                <p className="text-xs font-semibold">السلة فارغة حالياً</p>
                <p className="text-[11px] text-slate-600 mt-1">اضغط على أي منتج أو امسح الباركود لإضافته</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h5 className="text-xs font-bold text-white leading-tight line-clamp-1">
                        {item.product.name}
                      </h5>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {item.unitPrice.toLocaleString()} {config.currency} / {item.product.unit}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-500 hover:text-rose-400 transition p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Quantity and Line Total */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 rounded text-slate-300 hover:bg-slate-800 transition"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.product.stockQuantity}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.product.id, parseInt(e.target.value) || 1)}
                        className="w-10 text-center text-xs font-bold text-white bg-transparent font-mono focus:outline-hidden"
                      />
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stockQuantity}
                        className="p-1 rounded text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="text-left">
                      <span className="text-xs font-black text-amber-400 font-mono">
                        {item.total.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-500 mr-1">{config.currency}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Checkout Controls */}
          {cart.length > 0 && (
            <div className="border-t border-slate-800 p-4 space-y-3 bg-slate-950/80 rounded-b-2xl">
              {/* Customer Selector & Direct Name Entry */}
              <div className="space-y-2 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-amber-400" />
                    اسم العميل على الفاتورة:
                  </span>
                  {customers.length > 0 && (
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) {
                          setSelectedCustomerId('');
                          setCustomerName('عميل نقدي سريع');
                          setCustomerPhone('');
                        } else {
                          handleSelectExistingCustomer(id);
                        }
                      }}
                      className="text-[11px] bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-amber-400 font-semibold focus:outline-hidden cursor-pointer max-w-[170px] truncate"
                    >
                      <option value="">+ اختيار عميل مسجل...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.currentDebt > 0 ? `(دين: ${c.currentDebt} ج.م)` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="اكتب اسم العميل هنا (مثال: أ. محمد حامد)"
                      value={customerName === 'عميل نقدي سريع' ? '' : customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        if (selectedCustomerId) setSelectedCustomerId('');
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                    />
                    {customerName && customerName !== 'عميل نقدي سريع' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerName('عميل نقدي سريع');
                          setCustomerPhone('');
                          setSelectedCustomerId('');
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-amber-400 font-bold"
                        title="إعادة تعيين إلى عميل نقدي سريع"
                      >
                        مسح
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="رقم الهاتف (اختياري للواتساب)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-500 shrink-0">سيظهر بالفاتورة:</span>
                    <span className="font-bold text-amber-400 truncate">
                      {customerName.trim() || 'عميل نقدي سريع'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerName('عميل نقدي سريع');
                      setCustomerPhone('');
                      setSelectedCustomerId('');
                    }}
                    className="text-[10px] text-slate-400 hover:text-white underline decoration-dotted shrink-0"
                  >
                    نقدي سريع بدون اسم
                  </button>
                </div>
              </div>

              {/* Payment Type: Cash vs Debt vs Partial */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-400">طريقة الدفع:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      setPaymentType('cash');
                      setPaidAmountInput('');
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                      paymentType === 'cash'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-900 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    نقدي (خالص)
                  </button>
                  <button
                    onClick={() => {
                      setPaymentType('partial');
                      if (customerType === 'quick') setCustomerType('new');
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                      paymentType === 'partial'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-900 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    دفعة + دين
                  </button>
                  <button
                    onClick={() => {
                      setPaymentType('debt');
                      setPaidAmountInput('0');
                      if (customerType === 'quick') setCustomerType('new');
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                      paymentType === 'debt'
                        ? 'bg-rose-700 text-white shadow-xs'
                        : 'bg-slate-900 border border-slate-800 text-slate-300'
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    آجل بالكامل
                  </button>
                </div>
              </div>

              {/* Partial / Debt inputs */}
              {paymentType === 'partial' && (
                <div className="grid grid-cols-2 gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">المدفوع نقداً الآن:</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-emerald-400 font-bold font-mono focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">تاريخ الاستحقاق:</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Dedicated Order Discount Box */}
              <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-amber-400" />
                    خصم الفاتورة:
                  </span>
                  {/* Type Toggle: Fixed Amount vs Percent */}
                  <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDiscountType('amount')}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                        discountType === 'amount'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      مبلغ ({config.currency})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                        discountType === 'percent'
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      نسبة (%)
                    </button>
                  </div>
                </div>

                {/* Input with unit badge & clear button */}
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={discountType === 'percent' ? 'أدخل النسبة (مثال: 10)' : 'أدخل قيمة الخصم (مثال: 50)'}
                    value={discountInputValue}
                    onChange={(e) => setDiscountInputValue(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-rose-400 font-bold font-mono focus:border-amber-500 focus:outline-hidden"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">
                      {discountType === 'percent' ? '%' : config.currency}
                    </span>
                    {discountInputValue && (
                      <button
                        type="button"
                        onClick={() => setDiscountInputValue('')}
                        className="text-slate-500 hover:text-white p-0.5 cursor-pointer"
                        title="إلغاء الخصم"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick preset discount pills */}
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  {discountType === 'amount' ? (
                    <>
                      {[10, 20, 50, 100].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDiscountInputValue(String(amt))}
                          className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-500/50 hover:text-amber-400 font-mono transition cursor-pointer"
                        >
                          {amt} ج.م
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {[3, 5, 10, 15].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountInputValue(String(pct))}
                          className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-500/50 hover:text-amber-400 font-mono transition cursor-pointer"
                        >
                          {pct}%
                        </button>
                      ))}
                    </>
                  )}
                  {discountInputValue && (
                    <button
                      type="button"
                      onClick={() => setDiscountInputValue('')}
                      className="px-1.5 py-0.5 rounded-md bg-rose-950/40 border border-rose-900/60 text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
                    >
                      تصفير
                    </button>
                  )}
                </div>
              </div>

              {/* Summary Totals */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>إجمالي الأصناف:</span>
                  <span className="font-mono">{cartSubtotal.toLocaleString()} {config.currency}</span>
                </div>

                {totalDiscount > 0 && (
                  <div className="flex justify-between text-rose-400 font-bold bg-rose-950/30 border border-rose-900/40 px-2 py-1 rounded-lg">
                    <span>الخصم المطبق:</span>
                    <span className="font-mono">-{totalDiscount.toLocaleString()} {config.currency}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-black text-white pt-1">
                  <span>الصافي المطلوب:</span>
                  <span className="font-mono text-amber-400 text-lg">
                    {totalNet.toLocaleString()} {config.currency}
                  </span>
                </div>

                {/* Remaining Debt highlight */}
                {remainingDebt > 0 && (
                  <div className="flex justify-between text-xs font-bold text-rose-400 bg-rose-950/40 border border-rose-900/60 p-2 rounded-xl">
                    <span>دين مسجل على العميل:</span>
                    <span className="font-mono">{remainingDebt.toLocaleString()} {config.currency}</span>
                  </div>
                )}
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>إتمام البيع وطباعة الفاتورة</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE STICKY BOTTOM BAR FOR POS CART */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 p-3 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-30">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="flex-1 flex items-center justify-between rounded-xl bg-amber-500 px-4 py-3 text-slate-950 font-bold shadow-lg"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <span className="text-sm">سلة البيع ({cart.length})</span>
            </div>
            <div className="text-sm font-black font-mono">
              {totalNet.toLocaleString()} {config.currency}
            </div>
          </button>
        </div>
      </div>

      {/* MOBILE CART BOTTOM DRAWER / MODAL */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs">
          <div className="w-full max-h-[85vh] rounded-t-3xl bg-slate-900 border-t border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Grab handle */}
            <div className="w-10 h-1.5 bg-slate-700 rounded-full mx-auto my-3" />
            <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-amber-500" />
                فاتورة البيع ({cart.length} أصناف)
              </h3>
              <button
                onClick={() => setIsMobileCartOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                إغلاق
              </button>
            </div>

            {/* Mobile Scrollable Cart items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex justify-between items-center">
                  <div>
                    <h5 className="text-xs font-bold text-white">{item.product.name}</h5>
                    <div className="text-[10px] text-amber-400 font-mono">
                      {item.unitPrice.toLocaleString()} {config.currency} × {item.quantity} = {item.total.toLocaleString()} {config.currency}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      className="p-1 rounded text-slate-300"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-white font-mono">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                      className="p-1 rounded text-slate-300"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Mobile Order Discount Box */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 flex items-center gap-1">
                    <Percent className="h-3 w-3 text-amber-400" />
                    خصم الفاتورة:
                  </span>
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setDiscountType('amount')}
                      className={`px-2 py-0.5 rounded font-bold transition ${
                        discountType === 'amount'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400'
                      }`}
                    >
                      مبلغ ({config.currency})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2 py-0.5 rounded font-bold transition ${
                        discountType === 'percent'
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-400'
                      }`}
                    >
                      نسبة (%)
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder={discountType === 'percent' ? 'نسبة الخصم (مثال: 10)' : 'قيمة الخصم'}
                    value={discountInputValue}
                    onChange={(e) => setDiscountInputValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-rose-400 font-bold font-mono focus:border-amber-500 focus:outline-hidden"
                  />
                  {discountInputValue && (
                    <button
                      type="button"
                      onClick={() => setDiscountInputValue('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[10px]">
                  {discountType === 'amount' ? (
                    <>
                      {[10, 20, 50, 100].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDiscountInputValue(String(amt))}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono"
                        >
                          {amt} ج.م
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {[5, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountInputValue(String(pct))}
                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono"
                        >
                          {pct}%
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Mobile customer and payment selectors */}
              <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setPaymentType('cash')}
                    className={`py-2 rounded-lg text-xs font-bold ${paymentType === 'cash' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                  >
                    نقدي
                  </button>
                  <button
                    onClick={() => setPaymentType('partial')}
                    className={`py-2 rounded-lg text-xs font-bold ${paymentType === 'partial' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                  >
                    سداد جزئي
                  </button>
                  <button
                    onClick={() => setPaymentType('debt')}
                    className={`py-2 rounded-lg text-xs font-bold ${paymentType === 'debt' ? 'bg-rose-700 text-white' : 'bg-slate-800 text-slate-300'}`}
                  >
                    آجل دين
                  </button>
                </div>

                {/* Mobile customer name and phone inputs (available for all payment types) */}
                <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-1">
                      <User className="h-3 w-3 text-amber-400" />
                      اسم العميل على الفاتورة:
                    </span>
                    {customers.length > 0 && (
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (!id) {
                            setSelectedCustomerId('');
                            setCustomerName('عميل نقدي سريع');
                            setCustomerPhone('');
                          } else {
                            handleSelectExistingCustomer(id);
                          }
                        }}
                        className="text-[10px] bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-amber-400 max-w-[130px] truncate"
                      >
                        <option value="">عميل مسجل...</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="اسم العميل (مثال: أ. أحمد) أو اتركه لنقدي سريع"
                    value={customerName === 'عميل نقدي سريع' ? '' : customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (selectedCustomerId) setSelectedCustomerId('');
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="رقم هاتف العميل (اختياري للواتساب)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white placeholder-slate-500 font-mono"
                  />
                  {paymentType === 'partial' && (
                    <input
                      type="number"
                      placeholder="المبلغ المدفوع الآن نقدياً *"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      className="w-full rounded-lg border border-emerald-500/50 bg-slate-900 p-2 text-xs text-emerald-400 font-bold font-mono"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Checkout Footer */}
            <div className="border-t border-slate-800 p-4 bg-slate-950">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-bold text-white">الإجمالي الصافي:</span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  {totalNet.toLocaleString()} {config.currency}
                </span>
              </div>
              <button
                onClick={handleCheckout}
                disabled={isProcessing}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 shadow-lg"
              >
                إتمام الفاتورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </div>
  );
};
