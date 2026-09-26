import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Tag,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Upload,
  ShieldCheck,
  ArrowRight,
  Search,
} from 'lucide-react';
import {
  CartEvaluation,
  PaymentMethodConfig,
  StoreProduct,
  StoreOrder,
} from '../types/store.ts';
import { SmartImage } from './SmartImage.tsx';
import { optimizeImageFile } from '../lib/imageOptimizer.ts';

interface CartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: Array<{ productId: number; quantity: number }>;
  products?: StoreProduct[];
  paymentMethods: PaymentMethodConfig[];
  currencySymbol?: string;
  authToken?: string | null;
  initialPromoCode?: string;
  onPromoCodeChange?: (code: string) => void;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveItem?: (productId: number) => void;
  onClearCart: () => void;
  onOrderSuccess: (order: StoreOrder) => void;
  onNavigateToLookup?: (invoiceId: string, username: string) => void;
}

export const CartCheckoutModal: React.FC<CartCheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  products = [],
  paymentMethods,
  currencySymbol = '$',
  authToken,
  initialPromoCode = '',
  onPromoCodeChange,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSuccess,
  onNavigateToLookup,
}) => {
  const [step, setStep] = useState<'cart' | 'checkout' | 'confirmation'>('cart');
  const [promoCodeInput, setPromoCodeInput] = useState(initialPromoCode || '');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(
    initialPromoCode ? initialPromoCode.trim().toUpperCase() : null
  );
  const [evaluation, setEvaluation] = useState<CartEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  // Customer Checkout Fields
  const [minecraftUsername, setMinecraftUsername] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const enabledPaymentMethods = paymentMethods.filter((m) => m.enabled);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>(
    enabledPaymentMethods[0]?.id || 'jazzcash'
  );
  const [paymentReference, setPaymentReference] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<StoreOrder | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  useEffect(() => {
    if (initialPromoCode && initialPromoCode.trim()) {
      const clean = initialPromoCode.trim().toUpperCase();
      setPromoCodeInput(clean);
      setAppliedPromoCode(clean);
    }
  }, [initialPromoCode]);

  useEffect(() => {
    if (!isOpen) return;
    if (cartItems.length === 0) {
      setEvaluation(null);
      return;
    }

    let cancelled = false;
    const runEval = async () => {
      setEvaluating(true);
      try {
        const res = await fetch('/api/cart/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cartItems,
            promoCode: appliedPromoCode,
            minecraftUsername: minecraftUsername.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setEvaluation(data);
        }
      } catch (err) {
        console.error('Failed to evaluate cart:', err);
      } finally {
        if (!cancelled) setEvaluating(false);
      }
    };

    runEval();
    return () => {
      cancelled = true;
    };
  }, [isOpen, cartItems, appliedPromoCode, minecraftUsername]);

  if (!isOpen) return null;

  const selectedMethod =
    enabledPaymentMethods.find((m) => m.id === selectedPaymentId) ||
    enabledPaymentMethods[0];

  const handleApplyPromo = () => {
    const clean = promoCodeInput.trim().toUpperCase();
    if (!clean) return;
    setAppliedPromoCode(clean);
    onPromoCodeChange?.(clean);
  };

  const handleRemovePromo = () => {
    setAppliedPromoCode(null);
    setPromoCodeInput('');
    onPromoCodeChange?.('');
  };

  const handleRemoveCartItem = (productId: number) => {
    if (onRemoveItem) {
      onRemoveItem(productId);
    } else {
      onUpdateQuantity(productId, 0);
    }
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setOrderError('Receipt image must be smaller than 10MB.');
      return;
    }

    setUploadingReceipt(true);
    setOrderError(null);

    try {
      const dataUri = await optimizeImageFile(file, 1400, 0.85);
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          filename: file.name,
          dataUri,
          category: 'receipt',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error || 'Failed to upload receipt.');
      } else {
        setReceiptUrl(data.url);
      }
    } catch {
      setOrderError('Error uploading receipt screenshot.');
    } finally {
      setUploadingReceipt(false);
      e.target.value = '';
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);

    const cleanMc = minecraftUsername.trim();
    const cleanDiscord = discordUsername.trim();
    const cleanRef = paymentReference.trim();

    if (!cleanMc || !/^[.a-zA-Z0-9_]{2,32}$/.test(cleanMc)) {
      setOrderError(
        'Please enter a valid Minecraft username (2–32 characters, letters, numbers, underscores, or Bedrock dot prefix).'
      );
      return;
    }
    if (!cleanDiscord || cleanDiscord.length < 2) {
      setOrderError('Please enter your Discord username for order updates.');
      return;
    }
    if (!cleanRef || cleanRef.length < 3) {
      setOrderError('Please enter your Payment Reference / Transaction ID.');
      return;
    }

    setSubmittingOrder(true);
    try {
      const idempotencyKey = `${cleanMc.toLowerCase()}-${cleanRef}-${Date.now()}`;
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          items: cartItems,
          promoCode: evaluation?.promoCodeApplied || null,
          minecraftUsername: cleanMc,
          discordUsername: cleanDiscord,
          paymentMethod: selectedMethod?.name || selectedPaymentId,
          paymentReference: cleanRef,
          receiptImageUrl: receiptUrl,
          customerNotes: customerNotes.trim() || null,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error || 'Checkout failed. Please review your order.');
      } else {
        setCompletedOrder(data.order);
        onClearCart();
        onOrderSuccess(data.order);
        setStep('confirmation');
      }
    } catch {
      setOrderError('Network error while submitting order. Please try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const isPromoValid = Boolean(
    evaluation?.promoCodeApplied && !evaluation?.promoError
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#110B0D] border border-[#2C181D] rounded-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#160E11] border-b border-[#2C181D] shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <h2 className="text-lg font-extrabold text-white tracking-tight uppercase">
              {step === 'cart' && 'Your Shopping Cart'}
              {step === 'checkout' && 'Complete Payment & Verification'}
              {step === 'confirmation' && 'Order Confirmed — Invoice Generated'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (step === 'confirmation') setStep('cart');
              onClose();
            }}
            className="p-1.5 rounded-lg bg-[#1E1317] hover:bg-[#2A1A20] text-zinc-400 hover:text-white border border-[#351D22] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 sm:p-7 flex-1">
          {step === 'confirmation' && completedOrder ? (
            <div className="space-y-6 text-center max-w-xl mx-auto py-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-red-400">
                  Order Registered & Queued
                </span>
                <h3 className="text-2xl font-extrabold text-white mt-1">
                  Thank You, {completedOrder.minecraftUsername}!
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Your order has been logged and sent to our verification system. Save your Invoice ID below to track your delivery status anytime.
                </p>
              </div>

              {/* Invoice Summary Card */}
              <div className="bg-[#160E11] border border-[#2C181D] rounded-xl p-5 text-left space-y-4">
                <div className="flex items-center justify-between border-b border-[#2C181D] pb-3">
                  <div>
                    <span className="text-xs text-zinc-400 block">Unique Invoice / Order ID</span>
                    <span className="text-lg font-mono font-extrabold text-red-400">
                      {completedOrder.invoiceId}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(completedOrder.invoiceId);
                      setCopiedInvoice(true);
                      setTimeout(() => setCopiedInvoice(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#1E1317] hover:bg-[#2A1A20] text-xs font-mono text-zinc-200 border border-[#351D22] flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedInvoice ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-red-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Minecraft Username</span>
                    <span className="text-zinc-200 font-semibold font-mono">
                      {completedOrder.minecraftUsername}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Discord Username</span>
                    <span className="text-zinc-200 font-semibold">
                      {completedOrder.discordUsername}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Payment Method</span>
                    <span className="text-zinc-200 font-semibold">
                      {completedOrder.paymentMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Current Status</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold">
                      {completedOrder.status}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#2C181D] pt-3 space-y-1.5">
                  {completedOrder.items.map((item) => (
                    <div key={item.productId} className="flex justify-between text-xs text-zinc-300">
                      <span>
                        {item.name} <strong className="text-zinc-400">x{item.quantity}</strong>
                      </span>
                      <span className="font-mono">
                        {currencySymbol}
                        {item.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-[#2C181D]/60">
                    <span>Final Total Paid</span>
                    <span className="font-mono text-red-400">
                      {currencySymbol}
                      {completedOrder.finalTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const inv = completedOrder.invoiceId;
                    const mc = completedOrder.minecraftUsername;
                    setStep('cart');
                    onClose();
                    if (onNavigateToLookup) {
                      onNavigateToLookup(inv, mc);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#1E1317] hover:bg-[#2A1A20] text-zinc-200 text-xs font-bold uppercase tracking-wider border border-[#351D22] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  Track Order Status
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('cart');
                    onClose();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                >
                  Return to Storefront
                </button>
              </div>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-zinc-400 text-sm">
                Your shopping cart is currently empty. Explore our ranks, crate keys, and bundles!
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
              >
                Browse Packages
              </button>
            </div>
          ) : step === 'cart' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
              {/* Left 7 Cols: Line Items */}
              <div className="lg:col-span-7 space-y-3">
                {evaluation?.stockErrors && evaluation.stockErrors.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 space-y-1">
                    {evaluation.stockErrors.map((err, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                {cartItems.map((cartItem) => {
                  const prod = products.find((p) => p.id === cartItem.productId);
                  const evalLine = evaluation?.items.find((i) => i.productId === cartItem.productId);
                  const displayName = prod?.name || evalLine?.name || `Package #${cartItem.productId}`;
                  const displayCode = prod?.productCode || evalLine?.productCode || '';
                  const displayImage =
                    prod?.productImageUrl ||
                    prod?.kitPreviewImageUrl ||
                    prod?.customLogoUrl ||
                    evalLine?.imageUrl ||
                    '';
                  const unitFinal = evalLine
                    ? evalLine.unitFinalPrice
                    : prod?.effectivePrice ?? prod?.price ?? 0;
                  const unitOriginal = evalLine
                    ? evalLine.unitOriginalPrice
                    : prod?.originalPrice ?? prod?.price ?? 0;

                  const maxQty =
                    prod?.stockType === 'limited' && prod.stockQuantity !== null
                      ? prod.stockQuantity
                      : 99;

                  return (
                    <div
                      key={cartItem.productId}
                      className="p-4 rounded-xl bg-[#160E11] border border-[#2C181D] flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <SmartImage
                          src={displayImage}
                          alt={displayName}
                          fallbackTitle={displayName}
                          fallbackEmoji={prod?.emojiIcon || '⚔️'}
                          className="w-14 h-14 rounded-lg bg-[#090708] border border-[#2C181D] shrink-0"
                          imgClassName="w-full h-full object-cover rounded-lg"
                        />
                        <div className="min-w-0">
                          {displayCode && (
                            <span className="text-[11px] font-mono text-zinc-500 block">
                              {displayCode}
                            </span>
                          )}
                          <h4 className="text-sm font-bold text-white truncate">
                            {displayName}
                          </h4>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-xs font-mono font-bold text-red-400">
                              {currencySymbol}
                              {unitFinal.toFixed(2)} each
                            </span>
                            {unitFinal < unitOriginal && (
                              <span className="text-[11px] font-mono text-zinc-500 line-through">
                                {currencySymbol}
                                {unitOriginal.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center border border-[#351D22] rounded-lg bg-[#090708]">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(cartItem.productId, cartItem.quantity - 1)
                            }
                            className="px-2.5 py-1 text-zinc-300 hover:text-white cursor-pointer"
                          >
                            -
                          </button>
                          <span className="px-2.5 py-1 text-xs font-mono font-bold text-white border-x border-[#351D22]">
                            {cartItem.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={cartItem.quantity >= maxQty}
                            onClick={() =>
                              onUpdateQuantity(
                                cartItem.productId,
                                Math.min(maxQty, cartItem.quantity + 1)
                              )
                            }
                            className="px-2.5 py-1 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCartItem(cartItem.productId)}
                          className="p-2 rounded-lg bg-[#1E1317] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right 5 Cols: Promo Code & Summary */}
              <div className="lg:col-span-5 bg-[#160E11] border border-[#2C181D] rounded-xl p-5 space-y-5 h-fit">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                  Order Summary & Discounts
                </h3>

                {/* Promo Code Input */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-red-400" />
                    Promo / Creator Code
                  </label>
                  {appliedPromoCode && isPromoValid ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div>
                        <span className="text-xs font-mono font-extrabold text-red-400 block">
                          CODE: {evaluation?.promoCodeApplied}
                        </span>
                        <span className="text-[11px] text-zinc-300">
                          {evaluation?.promoCodeDescription || 'Discount applied'} (-
                          {currencySymbol}
                          {(evaluation?.promoDiscountTotal ?? 0).toFixed(2)})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoCodeInput}
                          onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                          placeholder="e.g. MAK20"
                          className="flex-1 px-3 py-2 rounded-lg bg-[#090708] border border-[#351D22] focus:border-red-500 text-xs font-mono text-white uppercase outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="px-4 py-2 rounded-lg bg-[#1E1317] hover:bg-[#2A1A20] text-xs font-bold uppercase tracking-wider text-white border border-[#351D22] cursor-pointer"
                        >
                          Apply
                        </button>
                      </div>
                      {appliedPromoCode && evaluation?.promoError && (
                        <div className="flex items-center justify-between text-xs text-red-400 pt-1">
                          <span>{evaluation.promoError}</span>
                          <button
                            type="button"
                            onClick={handleRemovePromo}
                            className="underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Totals Breakdown */}
                <div className="space-y-2.5 border-t border-[#2C181D] pt-4 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>Original Price Total</span>
                    <span className="font-mono">
                      {currencySymbol}
                      {(evaluation?.subtotalOriginal ?? 0).toFixed(2)}
                    </span>
                  </div>
                  {(evaluation?.saleDiscountTotal ?? 0) > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>Active Sale Savings</span>
                      <span className="font-mono">
                        -{currencySymbol}
                        {(evaluation?.saleDiscountTotal ?? 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-300 font-medium">
                    <span>Subtotal</span>
                    <span className="font-mono">
                      {currencySymbol}
                      {(evaluation?.subtotalAfterSales ?? 0).toFixed(2)}
                    </span>
                  </div>
                  {(evaluation?.promoDiscountTotal ?? 0) > 0 && (
                    <div className="flex justify-between text-red-400 font-semibold">
                      <span>Promo Code ({evaluation?.promoCodeApplied})</span>
                      <span className="font-mono">
                        -{currencySymbol}
                        {(evaluation?.promoDiscountTotal ?? 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-white border-t border-[#2C181D] pt-3">
                    <span>Final Total</span>
                    <span className="font-mono text-red-400">
                      {currencySymbol}
                      {(evaluation?.finalTotal ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    evaluating ||
                    !evaluation ||
                    (evaluation.stockErrors && evaluation.stockErrors.length > 0)
                  }
                  onClick={() => setStep('checkout')}
                  className="w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-red-950/50"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Checkout Form */
            <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-7">
              <div className="lg:col-span-7 space-y-5">
                {orderError && (
                  <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-300 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{orderError}</span>
                  </div>
                )}

                {/* Player Identity */}
                <div className="bg-[#160E11] border border-[#2C181D] rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                    1. Player & Discord Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Minecraft Username <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={minecraftUsername}
                        onChange={(e) => setMinecraftUsername(e.target.value)}
                        placeholder="e.g. Notch (Include . for Bedrock)"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#090708] border border-[#351D22] focus:border-red-500 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Discord Username <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={discordUsername}
                        onChange={(e) => setDiscordUsername(e.target.value)}
                        placeholder="e.g. ownverse_player"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#090708] border border-[#351D22] focus:border-red-500 text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="bg-[#160E11] border border-[#2C181D] rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                    2. Select Payment Method
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {enabledPaymentMethods.map((method) => {
                      const active = selectedMethod?.id === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSelectedPaymentId(method.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'bg-red-500/15 border-red-500 text-white'
                              : 'bg-[#090708] border-[#2C181D] text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <span className="text-xs font-extrabold block">{method.name}</span>
                          <span className="text-[10px] text-zinc-500 truncate block mt-0.5">
                            {method.accountTitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Method Instructions */}
                  {selectedMethod && (
                    <div className="p-4 rounded-xl bg-[#090708] border border-[#2C181D] space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-mono uppercase text-zinc-500 block">
                            Account Title: {selectedMethod.accountTitle}
                          </span>
                          <span className="text-sm font-mono font-bold text-red-400">
                            {selectedMethod.accountNumber}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedMethod.accountNumber);
                            setCopiedAccount(true);
                            setTimeout(() => setCopiedAccount(false), 2000);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#160E11] hover:bg-[#1E1317] text-xs font-mono text-zinc-300 border border-[#351D22] flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedAccount ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-red-400" />
                              <span className="text-red-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Account</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {selectedMethod.instructions}
                      </p>
                    </div>
                  )}

                  {/* Transaction Reference + Screenshot */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Transaction / Reference ID <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="TID / TXID / Reference #"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#090708] border border-[#351D22] focus:border-red-500 text-xs font-mono text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Payment Receipt / Screenshot (Optional)
                      </label>
                      <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#090708] hover:bg-[#1E1317] border border-dashed border-[#351D22] text-xs text-zinc-300 cursor-pointer transition-colors">
                        <Upload className="w-4 h-4 text-red-400" />
                        <span className="truncate">
                          {uploadingReceipt
                            ? 'Optimizing & Uploading...'
                            : receiptUrl
                            ? 'Receipt Uploaded ✓'
                            : 'Upload Receipt Image'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleReceiptFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Order Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder="Any special notes or realm preferences..."
                      className="w-full px-3.5 py-2 rounded-lg bg-[#090708] border border-[#351D22] focus:border-red-500 text-xs text-white outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Final Review */}
              <div className="lg:col-span-5 bg-[#160E11] border border-[#2C181D] rounded-xl p-5 space-y-5 h-fit">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Final Order Verification
                  </h3>
                  <button
                    type="button"
                    onClick={() => setStep('cart')}
                    className="text-xs text-red-400 hover:underline cursor-pointer"
                  >
                    &larr; Edit Cart
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {evaluation?.items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-[#2C181D]"
                    >
                      <span className="text-zinc-200 truncate pr-2">
                        {item.name} <strong className="text-zinc-400">x{item.quantity}</strong>
                      </span>
                      <span className="font-mono text-zinc-200 shrink-0">
                        {currencySymbol}
                        {item.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-xs pt-2">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span className="font-mono">
                      {currencySymbol}
                      {(evaluation?.subtotalAfterSales ?? 0).toFixed(2)}
                    </span>
                  </div>
                  {(evaluation?.promoDiscountTotal ?? 0) > 0 && (
                    <div className="flex justify-between text-red-400">
                      <span>Promo ({evaluation?.promoCodeApplied})</span>
                      <span className="font-mono">
                        -{currencySymbol}
                        {(evaluation?.promoDiscountTotal ?? 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-white border-t border-[#2C181D] pt-3">
                    <span>Amount Due</span>
                    <span className="font-mono text-red-400">
                      {currencySymbol}
                      {(evaluation?.finalTotal ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#090708] border border-[#2C181D] flex items-start gap-2.5 text-[11px] text-zinc-400">
                  <ShieldCheck className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>
                    By placing this order, you agree to the OwnVerse Store Terms of Service. Orders are atomic and protected against double-charging.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submittingOrder || uploadingReceipt}
                  className="w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-red-950/50"
                >
                  {submittingOrder
                    ? 'Processing & Locking Stock...'
                    : `Submit Order — ${currencySymbol}${(evaluation?.finalTotal ?? 0).toFixed(2)}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
