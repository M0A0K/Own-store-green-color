import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  Share2,
  Check,
  Clock,
  ShieldCheck,
  Terminal,
  PackageCheck,
  AlertTriangle,
  FileText,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { StoreProduct, StoreSale, StoreSection } from '../types/store.ts';
import { SafeMarkdown } from './SafeMarkdown.tsx';
import { SmartImage } from './SmartImage.tsx';
import { formatUsdPkr } from '../lib/currency.ts';

interface ProductDetailModalProps {
  product: StoreProduct | null;
  section?: StoreSection;
  sections?: StoreSection[];
  sales?: StoreSale[];
  allProducts: StoreProduct[];
  currencySymbol?: string;
  onClose: () => void;
  onAddToCart: (product: StoreProduct, quantity: number) => void;
  onSelectProduct: (product: StoreProduct) => void;
  calculateDiscountedPrice?: (product: StoreProduct) => {
    effectivePrice: number;
    originalPrice: number;
    saleDiscountPercent: number;
    hasActiveSale: boolean;
    saleTitle?: string;
  };
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  section: sectionProp,
  sections,
  allProducts,
  currencySymbol = '$',
  onClose,
  onAddToCart,
  onSelectProduct,
  calculateDiscountedPrice,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'perks' | 'delivery' | 'terms'>('overview');
  const [previewMode, setPreviewMode] = useState<'kit' | 'product' | 'logo'>('kit');

  if (!product) return null;

  const getPricing = (p: StoreProduct) => {
    if (calculateDiscountedPrice) return calculateDiscountedPrice(p);
    return {
      effectivePrice: p.effectivePrice ?? p.salePrice ?? p.price,
      originalPrice: p.originalPrice ?? p.price,
      saleDiscountPercent: p.discountPercent ?? 0,
      hasActiveSale: Boolean(p.isOnSale),
      saleTitle: p.appliedSaleBadge || undefined,
    };
  };

  const pricing = getPricing(product);
  const section = sectionProp || sections?.find((s) => s.id === product.sectionId);
  const isOutOfStock = product.stockType === 'limited' && (product.stockQuantity === null || product.stockQuantity <= 0);
  const isLowStock = product.stockType === 'limited' && product.stockQuantity !== null && product.stockQuantity > 0 && product.stockQuantity <= 5;
  const maxAvailable = product.stockType === 'limited' && product.stockQuantity !== null ? product.stockQuantity : 99;

  const relatedProducts = allProducts
    .filter(
      (p) =>
        p.id !== product.id &&
        p.visible !== false &&
        (p.sectionId === product.sectionId ||
          (p.tags || []).some((t) => (product.tags || []).includes(t)))
    )
    .slice(0, 3);

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?product=${encodeURIComponent(product.productCode)}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const infoBlocks = {
    whatYouGet: product.whatYouGet || [],
    requirements: product.requirements || [],
    commandsAndPerks: product.commandsPerks || [],
    duration: product.duration || 'Permanent (Lifetime)',
    protection: product.protection || 'Verified Delivery',
    deliveryInfo:
      product.deliveryInfo ||
      'Automated in-game delivery within 1-5 minutes of verification.',
    importantNotes: product.importantNotes
      ? product.importantNotes.split('\n').filter(Boolean)
      : [],
    terms: product.productTerms || 'Subject to OwnVerse Store Terms of Service.',
  };

  const kitSrc = product.kitPreviewImageUrl || product.productImageUrl || product.customLogoUrl || '';
  const productSrc = product.productImageUrl || product.kitPreviewImageUrl || product.customLogoUrl || '';
  const logoSrc = product.customLogoUrl || product.productImageUrl || '';
  const displayedImage =
    previewMode === 'kit'
      ? kitSrc
      : previewMode === 'product'
      ? productSrc
      : logoSrc;

  const accentColor = product.cardAccentColor || '#EF4444';
  const badgeColor = product.badgeColor || '#EF4444';
  const buttonColor = product.buttonColor || '#DC2626';

  return (
    <div className="animate-ov-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 overflow-y-auto">
      <div
        className="animate-ov-modal-in relative w-full max-w-5xl bg-[#110B0D] border border-[#2C181D] rounded-xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        style={{
          borderTopWidth: '3px',
          borderTopColor: accentColor,
        }}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#160E11] border-b border-[#2C181D] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-1 rounded bg-[#1E1317] text-zinc-300 border border-[#351D22]">
              {section?.name || 'Store Item'}
            </span>
            <span className="text-xs font-mono text-zinc-400 truncate">
              ID: {product.productCode}
            </span>
            {product.rarityTier && (
              <span
                className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${badgeColor}20`,
                  color: badgeColor,
                  border: `1px solid ${badgeColor}45`,
                }}
              >
                {product.rarityTier} Tier
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyShareLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1317] hover:bg-[#2A1A20] text-zinc-300 text-xs font-medium border border-[#351D22] transition-colors cursor-pointer"
              title="Copy direct product link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-red-400">Link Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#1E1317] hover:bg-[#2A1A20] text-zinc-400 hover:text-white border border-[#351D22] transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 sm:p-7 space-y-8 flex-1">
          {/* Upper Grid: Image Preview + Purchase Box */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            {/* Left 7 Cols: Kit / Item Preview Image */}
            <div className="lg:col-span-7 space-y-3">
              <div className="relative rounded-xl overflow-hidden bg-[#090708] border border-[#2C181D] aspect-16/10 group">
                <SmartImage
                  src={displayedImage}
                  alt={`${product.name} preview`}
                  fallbackTitle={product.name}
                  fallbackEmoji={product.emojiIcon}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090708] via-transparent to-transparent opacity-75 pointer-events-none" />

                {/* Floating Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  {product.customBadge && (
                    <span
                      className="px-3 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider shadow-lg"
                      style={{
                        backgroundColor: badgeColor,
                        color: '#FFFFFF',
                      }}
                    >
                      {product.customBadge}
                    </span>
                  )}
                  {pricing.hasActiveSale && (
                    <span className="px-3 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider bg-red-600 text-white shadow-lg">
                      SAVE {pricing.saleDiscountPercent}%
                    </span>
                  )}
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div className="flex items-center gap-3">
                    {product.customLogoUrl && (
                      <SmartImage
                        src={product.customLogoUrl}
                        alt={product.name}
                        fallbackEmoji={product.emojiIcon}
                        className="w-12 h-12 rounded-lg bg-[#120C0E]/90 p-1.5 border border-[#351D22]"
                        imgClassName="w-full h-full object-contain"
                      />
                    )}
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 block">
                        {previewMode === 'kit'
                          ? 'In-Game Kit & Perks Preview'
                          : previewMode === 'product'
                          ? 'Main Product Artwork'
                          : 'Custom Emblem / Logo'}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                        {product.name}
                      </h2>
                    </div>
                  </div>
                </div>
              </div>

              {/* Switch between Kit Preview / Product Image if multiple exist */}
              {(product.kitPreviewImageUrl || product.productImageUrl || product.customLogoUrl) && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('kit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      previewMode === 'kit'
                        ? 'bg-red-500/15 border-red-500/50 text-red-300'
                        : 'bg-[#160E11] border-[#2C181D] text-zinc-400 hover:text-white'
                    }`}
                  >
                    Kit / Item Preview
                  </button>
                  {product.productImageUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewMode('product')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        previewMode === 'product'
                          ? 'bg-red-500/15 border-red-500/50 text-red-300'
                          : 'bg-[#160E11] border-[#2C181D] text-zinc-400 hover:text-white'
                      }`}
                    >
                      Product Artwork
                    </button>
                  )}
                  {product.customLogoUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewMode('logo')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        previewMode === 'logo'
                          ? 'bg-red-500/15 border-red-500/50 text-red-300'
                          : 'bg-[#160E11] border-[#2C181D] text-zinc-400 hover:text-white'
                      }`}
                    >
                      Badge / Logo
                    </button>
                  )}
                </div>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-mono px-2.5 py-1 rounded bg-[#160E11] text-zinc-400 border border-[#2C181D]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right 5 Cols: Pricing, Stock, Action Box */}
            <div className="lg:col-span-5 bg-[#160E11] border border-[#2C181D] rounded-xl p-5 space-y-5">
              <div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {product.shortDescription}
                </p>
              </div>

              {/* Price Display */}
              <div className="p-4 rounded-xl bg-[#090708] border border-[#2C181D] flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                    Package Price
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <span className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                      {formatUsdPkr(pricing.effectivePrice, currencySymbol)}
                    </span>
                    {pricing.effectivePrice < pricing.originalPrice && (
                      <span className="text-xs sm:text-sm text-zinc-500 line-through font-mono">
                        {formatUsdPkr(pricing.originalPrice, currencySymbol)}
                      </span>
                    )}
                  </div>
                  {pricing.saleTitle && (
                    <span className="text-xs text-red-400 font-medium mt-1 block">
                      Active Event: {pricing.saleTitle}
                    </span>
                  )}
                </div>

                {/* Stock Status Indicator */}
                <div className="text-right">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                    Availability
                  </span>
                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-bold">
                      Out of Stock
                    </span>
                  ) : isLowStock ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold">
                      Only {product.stockQuantity} Left!
                    </span>
                  ) : product.stockType === 'limited' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-bold">
                      {product.stockQuantity} In Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-bold">
                      Instant Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Meta Highlights */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-[#110B0D] border border-[#2C181D] flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-red-500 shrink-0" />
                  <div>
                    <span className="text-zinc-500 block">Duration</span>
                    <span className="text-zinc-200 font-semibold">{infoBlocks.duration}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#110B0D] border border-[#2C181D] flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-red-500 shrink-0" />
                  <div>
                    <span className="text-zinc-500 block">Protection</span>
                    <span className="text-zinc-200 font-semibold">{infoBlocks.protection}</span>
                  </div>
                </div>
              </div>

              {/* Quantity + Add to Cart */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Select Quantity
                  </span>
                  <div className="flex items-center border border-[#351D22] rounded-lg bg-[#090708]">
                    <button
                      type="button"
                      disabled={isOutOfStock || quantity <= 1}
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3 py-1.5 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3 py-1.5 text-sm font-mono font-bold text-white border-x border-[#351D22]">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={isOutOfStock || quantity >= maxAvailable}
                      onClick={() => setQuantity((q) => Math.min(maxAvailable, q + 1))}
                      className="px-3 py-1.5 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => {
                    onAddToCart(product, quantity);
                    onClose();
                  }}
                  className="w-full py-3.5 px-5 rounded-xl font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white"
                  style={{
                    backgroundColor: isOutOfStock ? '#27272A' : buttonColor,
                  }}
                >
                  <ShoppingBag className="w-4 h-4" />
                  {isOutOfStock
                    ? 'Out of Stock'
                    : `Add to Cart — ${formatUsdPkr(pricing.effectivePrice * quantity, currencySymbol)}`}
                </button>
              </div>
            </div>
          </div>

          {/* Information Navigation Tabs */}
          <div className="border-b border-[#2C181D] flex flex-wrap gap-2">
            {[
              { id: 'overview', label: 'Detailed Overview & What You Get', icon: PackageCheck },
              { id: 'perks', label: 'Commands, Perks & Requirements', icon: Terminal },
              { id: 'delivery', label: 'Delivery & Important Notes', icon: AlertTriangle },
              { id: 'terms', label: 'Package Terms', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'border-red-500 text-red-400 bg-red-500/10'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
            <div className="lg:col-span-7 bg-[#160E11] border border-[#2C181D] rounded-xl p-5 sm:p-6">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <SafeMarkdown content={product.markdownDescription} />
                </div>
              )}

              {activeTab === 'perks' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-red-400 mb-3 flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      Unlocked Commands & Perks
                    </h4>
                    {infoBlocks.commandsAndPerks && infoBlocks.commandsAndPerks.length > 0 ? (
                      <ul className="space-y-2">
                        {infoBlocks.commandsAndPerks.map((cmd: string, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#090708] border border-[#2C181D] text-xs sm:text-sm font-mono text-zinc-200"
                          >
                            <span className="text-red-500 font-bold">&gt;</span>
                            <span>{cmd}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-400">See package overview for full perks list.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Requirements
                    </h4>
                    {infoBlocks.requirements && infoBlocks.requirements.length > 0 ? (
                      <ul className="space-y-2">
                        {infoBlocks.requirements.map((req: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-zinc-400">Valid Minecraft username on OwnVerse network.</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'delivery' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25">
                    <h4 className="text-sm font-bold text-red-400 mb-1">Delivery Information</h4>
                    <p className="text-sm text-zinc-200 leading-relaxed">
                      {infoBlocks.deliveryInfo}
                    </p>
                  </div>

                  {infoBlocks.importantNotes && infoBlocks.importantNotes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3">
                        Important Notes Before Buying
                      </h4>
                      <ul className="space-y-2">
                        {infoBlocks.importantNotes.map((note: string, idx: number) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 p-3 rounded-lg bg-[#090708] border border-[#2C181D] text-sm text-zinc-300"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'terms' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                    Product Terms & Refund Conditions
                  </h4>
                  <p className="text-sm text-zinc-300 leading-relaxed bg-[#090708] p-4 rounded-xl border border-[#2C181D]">
                    {infoBlocks.terms}
                  </p>
                </div>
              )}
            </div>

            {/* Right 5 Cols: Structured "What You Get" Checklist */}
            <div className="lg:col-span-5 bg-[#160E11] border border-[#2C181D] rounded-xl p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-red-500" />
                What You Get Included
              </h3>
              {infoBlocks.whatYouGet && infoBlocks.whatYouGet.length > 0 ? (
                <ul className="space-y-2.5">
                  {infoBlocks.whatYouGet.map((item: string, idx: number) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#090708] border border-[#2C181D] text-sm text-zinc-200"
                    >
                      <Check className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400">
                  Full package contents are listed in the detailed description.
                </p>
              )}
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="pt-4 border-t border-[#2C181D] space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300">
                Related Packages You Might Like
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedProducts.map((rel) => {
                  const relPrice = getPricing(rel);
                  return (
                    <div
                      key={rel.id}
                      onClick={() => {
                        setQuantity(1);
                        onSelectProduct(rel);
                      }}
                      className="group p-3.5 rounded-xl bg-[#160E11] hover:bg-[#1E1317] border border-[#2C181D] hover:border-red-500/40 transition-all cursor-pointer flex items-center gap-3.5"
                    >
                      <SmartImage
                        src={rel.productImageUrl || rel.kitPreviewImageUrl || rel.customLogoUrl}
                        alt={rel.name}
                        fallbackTitle={rel.name}
                        fallbackEmoji={rel.emojiIcon}
                        className="w-14 h-14 rounded-lg bg-[#090708] shrink-0 border border-[#2C181D]"
                        imgClassName="w-full h-full object-cover rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-red-400 transition-colors">
                          {rel.name}
                        </h4>
                        <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
                          <span className="text-xs font-mono font-bold text-red-400">
                            {formatUsdPkr(relPrice.effectivePrice, currencySymbol)}
                          </span>
                          {relPrice.effectivePrice < relPrice.originalPrice && (
                            <span className="text-[11px] font-mono text-zinc-500 line-through">
                              {formatUsdPkr(relPrice.originalPrice, currencySymbol)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-red-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
