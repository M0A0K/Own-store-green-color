import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ShoppingBag,
  Search,
  Copy,
  Check,
  Info,
  Clock,
  Tag,
  ArrowRight,
  SlidersHorizontal,
  ShieldCheck,
  MessageSquare,
  LogIn,
  LogOut,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { auth, googleAuthProvider } from './lib/firebase.ts';
import {
  StoreSettings,
  StoreSection,
  StoreProduct,
  StoreSale,
  ServerStatus,
  AdSlotConfig,
} from './types/store.ts';
import { SmartImage } from './components/SmartImage.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { CartCheckoutModal } from './components/CartCheckoutModal.tsx';
import {
  OrderLookupSection,
  FaqSupportPoliciesView,
} from './components/OrderLookupAndPolicies.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { formatUsdPkr } from './lib/currency.ts';

type ViewMode =
  | 'store'
  | 'order-lookup'
  | 'faq'
  | 'support'
  | 'terms'
  | 'privacy'
  | 'refund'
  | 'delivery'
  | 'admin';

function normalizeExternalAdUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return 'https://discord.gg/ownverse';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const StoreAdBannerCard: React.FC<{
  slot: AdSlotConfig;
  compact?: boolean;
}> = ({ slot, compact = false }) => {
  if (!slot || !slot.enabled || !slot.imageUrl) return null;
  const href = normalizeExternalAdUrl(slot.targetUrl);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={slot.title ? `${slot.title} — Opens in new tab` : 'Open sponsored link in new tab'}
      className="group block rounded-2xl bg-[#120C0E] border border-[#2C181D] hover:border-red-500/60 ov-ad-banner animate-ov-fade-up cursor-pointer shadow-lg"
    >
      <div
        className={`relative w-full bg-[#090708] overflow-hidden ${
          compact
            ? 'aspect-[16/5] sm:aspect-[16/4.6] max-h-52'
            : 'aspect-[16/5] sm:aspect-[21/5] max-h-60'
        }`}
      >
        <SmartImage
          src={slot.imageUrl}
          alt={slot.title || `Store Ad Banner #${slot.slotNumber}`}
          fallbackTitle={slot.title || `Ad Space #${slot.slotNumber}`}
          fallbackEmoji="📢"
          className="w-full h-full"
          imgClassName="w-full h-full object-cover group-hover:scale-[1.025] transition-transform duration-500 ease-out"
        />

        {/* Top-right Sponsored / New Tab Indicator */}
        <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-sm border border-white/15 group-hover:border-red-500/60 group-hover:bg-red-600/90 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-200 group-hover:text-white flex items-center gap-1 transition-colors">
          <span>{slot.badgeText || 'Sponsored'}</span>
          <ExternalLink className="w-3 h-3" />
        </div>
      </div>

      {(slot.title || slot.subtitle) && (
        <div className="px-4 py-3 bg-[#120C0E] border-t border-[#2C181D] flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {slot.title && (
              <div className="text-xs sm:text-sm font-bold text-white group-hover:text-red-400 transition-colors truncate">
                {slot.title}
              </div>
            )}
            {slot.subtitle && (
              <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                {slot.subtitle}
              </div>
            )}
          </div>
          <span className="px-3 py-1 rounded-lg bg-[#181013] group-hover:bg-red-600 border border-[#2C181D] group-hover:border-red-500 text-[11px] font-bold text-zinc-200 group-hover:text-white flex items-center gap-1.5 transition-colors shrink-0">
            <span>Visit Link</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      )}
    </a>
  );
};

export default function App() {
  // Storefront data from PostgreSQL
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [activeSales, setActiveSales] = useState<StoreSale[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);

  // Auth & Admin state (stored strictly in memory, never in localStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Navigation & URL routing
  const [viewMode, setViewMode] = useState<ViewMode>('store');
  const [selectedSectionSlug, setSelectedSectionSlug] = useState<string>('all');
  const [activeProductModal, setActiveProductModal] = useState<StoreProduct | null>(
    null
  );
  const [lookupPrefill, setLookupPrefill] = useState<{
    invoiceId: string;
    username: string;
  }>({ invoiceId: '', username: '' });

  // Search, Filters, Sorting & Recently Viewed
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'featured' | 'price-asc' | 'price-desc' | 'name-asc' | 'newest'
  >('featured');
  const [filterFeaturedOnly, setFilterFeaturedOnly] = useState(false);
  const [filterOnSaleOnly, setFilterOnSaleOnly] = useState(false);
  const [filterLimitedStockOnly, setFilterLimitedStockOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>([]);

  // Cart & Promo state
  const [cart, setCart] = useState<{ productId: number; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activePromoCode, setActivePromoCode] = useState<string>('');
  const [promoAppliedToast, setPromoAppliedToast] = useState<string | null>(null);
  const [copiedIpKey, setCopiedIpKey] = useState<string | null>(null);
  const [addedProductId, setAddedProductId] = useState<number | null>(null);

  const loadStoreData = useCallback(async () => {
    try {
      setStoreError(null);
      const [storeRes, statusRes] = await Promise.all([
        fetch('/api/store'),
        fetch('/api/server-status'),
      ]);

      if (!storeRes.ok) {
        const errJson = await storeRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load storefront data.');
      }

      const storeData = await storeRes.json();
      setSettings(storeData.settings);
      setSections(storeData.sections || []);
      setProducts(storeData.products || []);
      setActiveSales(storeData.activeSales || []);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setServerStatus(statusData);
      }
    } catch (error: any) {
      console.error('Error loading OwnVerse store:', error);
      setStoreError(error.message || 'Unable to connect to store backend.');
    } finally {
      setLoadingStore(false);
    }
  }, []);

  useEffect(() => {
    loadStoreData();
    const interval = setInterval(() => {
      fetch('/api/server-status')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setServerStatus(d);
        })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadStoreData]);

  // Sync Firebase Auth state in memory
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          setAuthToken(token);
          setUserEmail(user.email);

          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(adminSessionToken ? { 'x-admin-token': adminSessionToken } : {}),
            },
          });
          if (res.ok) {
            const me = await res.json();
            setIsAdmin(Boolean(me.isAdmin));
          }
        } catch (err) {
          console.error('Failed to verify session:', err);
        }
      } else {
        setAuthToken(null);
        setUserEmail(null);
        setIsAdmin(Boolean(adminSessionToken));
      }
    });
    return () => unsubscribe();
  }, [adminSessionToken]);

  // Clean URL synchronization
  useEffect(() => {
    const applyRouteFromPath = (pathname: string) => {
      if (pathname === '/admin') {
        setViewMode('admin');
      } else if (pathname === '/order-lookup') {
        setViewMode('order-lookup');
      } else if (pathname === '/faq') {
        setViewMode('faq');
      } else if (pathname === '/support') {
        setViewMode('support');
      } else if (pathname === '/terms') {
        setViewMode('terms');
      } else if (pathname === '/privacy') {
        setViewMode('privacy');
      } else if (pathname === '/refund-policy') {
        setViewMode('refund');
      } else if (pathname === '/delivery-policy') {
        setViewMode('delivery');
      } else if (pathname.startsWith('/section/')) {
        const slug = decodeURIComponent(pathname.replace('/section/', ''));
        setViewMode('store');
        setSelectedSectionSlug(slug || 'all');
      } else if (pathname.startsWith('/product/')) {
        const slug = decodeURIComponent(pathname.replace('/product/', ''));
        setViewMode('store');
        const found = products.find((p) => p.slug === slug);
        if (found) setActiveProductModal(found);
      } else {
        setViewMode('store');
      }
    };

    applyRouteFromPath(window.location.pathname);

    const handlePopState = () => applyRouteFromPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [products]);

  const navigateTo = (mode: ViewMode, customPath?: string) => {
    setViewMode(mode);
    const targetPath =
      customPath ||
      (mode === 'store'
        ? '/'
        : mode === 'refund'
        ? '/refund-policy'
        : mode === 'delivery'
        ? '/delivery-policy'
        : `/${mode}`);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Dynamic SEO Title, Meta & Browser Tab Icon (Favicon) updates
  useEffect(() => {
    if (!settings) return;
    if (activeProductModal) {
      document.title = `${activeProductModal.name} — ${settings.storeName}`;
    } else if (viewMode === 'order-lookup') {
      document.title = `Order Lookup — ${settings.storeName}`;
    } else if (viewMode === 'admin') {
      document.title = `Admin Console — ${settings.storeName}`;
    } else {
      document.title = `${settings.storeName} — ${settings.storeTagline}`;
    }

    const rawFavicon = settings.faviconUrl?.trim();
    const targetFavicon =
      rawFavicon && rawFavicon !== '/favicon.svg'
        ? rawFavicon
        : '/favicon.png';

    const iconLinks = document.querySelectorAll<HTMLLinkElement>(
      "link[rel='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']"
    );
    if (iconLinks.length > 0) {
      iconLinks.forEach((link) => {
        if (link.href !== targetFavicon) {
          link.href = targetFavicon;
        }
        if (targetFavicon.endsWith('.svg')) {
          link.type = 'image/svg+xml';
        } else {
          link.type = 'image/png';
        }
      });
    } else {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = targetFavicon;
      document.head.appendChild(link);
    }
  }, [settings, activeProductModal, viewMode]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      console.error('Google Sign-In error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAdminSessionToken(null);
      setIsAdmin(false);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  const handleOpenProductDetail = (product: StoreProduct) => {
    setActiveProductModal(product);
    setRecentlyViewedIds((prev) => {
      const filtered = prev.filter((id) => id !== product.id);
      return [product.id, ...filtered].slice(0, 4);
    });
    window.history.pushState({}, '', `/product/${product.slug}`);
  };

  const handleCloseProductDetail = () => {
    setActiveProductModal(null);
    if (window.location.pathname.startsWith('/product/')) {
      window.history.pushState({}, '', '/');
    }
  };

  const handleAddToCart = (product: StoreProduct, quantity = 1) => {
    if (product.isOutOfStock) return;
    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product.id);
      const maxAllowed =
        product.stockType === 'limited'
          ? Math.max(0, product.stockQuantity ?? 0)
          : 99;

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = {
          productId: product.id,
          quantity: Math.min(maxAllowed, updated[existingIndex].quantity + quantity),
        };
        return updated;
      }
      return [...prev, { productId: product.id, quantity: Math.min(maxAllowed, quantity) }];
    });

    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 1400);
  };

  const handleUpdateCartQuantity = (productId: number, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    const product = products.find((p) => p.id === productId);
    const maxAllowed =
      product?.stockType === 'limited'
        ? Math.max(0, product.stockQuantity ?? 0)
        : 99;

    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(maxAllowed, nextQuantity) }
          : i
      )
    );
  };

  const handleApplyBannerPromo = (code: string) => {
    const clean = code.trim().toUpperCase();
    setActivePromoCode(clean);
    setPromoAppliedToast(`Promo code ${clean} activated for your checkout!`);
    setTimeout(() => setPromoAppliedToast(null), 3500);
  };

  const handleCopyIpValue = (value: string, key: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedIpKey(key);
    setTimeout(() => setCopiedIpKey((prev) => (prev === key ? null : prev)), 2000);
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const activeSection = sections.find((s) => s.slug === selectedSectionSlug);

    const list = products.filter((p) => {
      if (selectedSectionSlug !== 'all' && activeSection) {
        if (p.sectionId !== activeSection.id) return false;
      }
      if (filterFeaturedOnly && !p.featured) return false;
      if (filterOnSaleOnly && !p.isOnSale) return false;
      if (filterLimitedStockOnly && p.stockType !== 'limited') return false;
      if (selectedTag !== 'all' && !(p.tags || []).includes(selectedTag)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.productCode.toLowerCase().includes(q);
        const matchDesc = p.shortDescription.toLowerCase().includes(q);
        const matchTag = (p.tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchCode && !matchDesc && !matchTag) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return a.effectivePrice - b.effectivePrice;
      if (sortBy === 'price-desc') return b.effectivePrice - a.effectivePrice;
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'newest') return b.id - a.id;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.displayOrder - b.displayOrder;
    });
  }, [
    products,
    sections,
    selectedSectionSlug,
    filterFeaturedOnly,
    filterOnSaleOnly,
    filterLimitedStockOnly,
    selectedTag,
    searchQuery,
    sortBy,
  ]);

  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewedIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is StoreProduct => Boolean(p)),
    [recentlyViewedIds, products]
  );

  const sectionMap = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const currencySymbol = settings?.currencySymbol || '$';
  const theme = settings?.themeConfig;

  const spacingPaddingClass =
    theme?.spacingScale === 'compact'
      ? 'py-8'
      : theme?.spacingScale === 'spacious'
      ? 'py-16'
      : 'py-12';

  const adsEnabled = Boolean(settings?.adsConfig?.enabled);
  const adSlots = settings?.adsConfig?.slots || [];
  const adSlot1 = adSlots.find((s) => s.slotNumber === 1 && s.enabled);
  const adSlot2 = adSlots.find((s) => s.slotNumber === 2 && s.enabled);
  const bottomAdSlots = adSlots.filter(
    (s) => (s.slotNumber === 3 || s.slotNumber === 4) && s.enabled
  );

  return (
    <div
      style={
        {
          '--bg-primary': theme?.bgPrimary || '#090708',
          '--bg-secondary': theme?.bgSecondary || '#120C0E',
          '--bg-card': theme?.bgCard || '#181013',
          '--text-primary': theme?.textPrimary || '#FAF5F6',
          '--text-muted': theme?.textMuted || '#A8999D',
          '--accent-primary': theme?.accentPrimary || '#EF4444',
          '--accent-secondary': theme?.accentSecondary || '#F59E0B',
          '--btn-color': theme?.buttonColor || '#DC2626',
          '--border-color': theme?.borderColor || '#2C181D',
          '--card-radius': theme?.cardRadius || '12px',
          '--font-display': theme?.fontDisplay || 'Syne',
          '--font-body': theme?.fontBody || 'Plus Jakarta Sans',
          '--font-mono': theme?.fontMono || 'JetBrains Mono',
          backgroundColor: theme?.bgPrimary || '#090708',
          color: theme?.textPrimary || '#FAF5F6',
          fontFamily: `var(--font-body), sans-serif`,
        } as React.CSSProperties
      }
      className="min-h-screen flex flex-col"
    >
      {/* Slim Editable Promo Announcement Banner (<= 40px height) */}
      {settings?.promoBannerConfig?.enabled && (
        <div
          style={{
            backgroundColor: settings.promoBannerConfig.bgColor || '#1F090D',
            color: settings.promoBannerConfig.textColor || '#FFE4E6',
          }}
          className="h-9 px-4 border-b border-[#2C181D] flex items-center justify-center gap-3 text-xs overflow-hidden"
        >
          <span className="truncate">
            <strong className="font-semibold mr-1.5">
              {settings.promoBannerConfig.title}:
            </strong>
            {settings.promoBannerConfig.text}
          </span>
          {settings.promoBannerConfig.code && (
            <button
              type="button"
              onClick={() => handleApplyBannerPromo(settings.promoBannerConfig.code)}
              className="px-2.5 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-600 hover:text-white font-mono font-semibold text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activePromoCode === settings.promoBannerConfig.code
                ? `✓ ${settings.promoBannerConfig.code} Active`
                : settings.promoBannerConfig.buttonText ||
                  `Apply ${settings.promoBannerConfig.code}`}
            </button>
          )}
        </div>
      )}

      {/* Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="sticky top-0 z-40 h-16 px-4 sm:px-8 bg-[#090708]/95 border-b border-[#2C181D] flex items-center justify-between">
        {/* Zone 1: Single Text Element Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setSelectedSectionSlug('all');
            navigateTo('store', '/');
          }}
          style={{ fontFamily: 'var(--font-display), sans-serif' }}
          className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          {settings?.storeName || 'OwnVerse Store'}
        </a>

        {/* Zone 2: 5 Single-Line Navigation Text Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300">
          <button
            type="button"
            onClick={() => {
              setSelectedSectionSlug('all');
              navigateTo('store', '/');
            }}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'store' ? 'text-red-400 font-semibold' : ''
            }`}
          >
            Catalog
          </button>
          <button
            type="button"
            onClick={() => navigateTo('order-lookup')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'order-lookup' ? 'text-red-400 font-semibold' : ''
            }`}
          >
            Order Lookup
          </button>
          <button
            type="button"
            onClick={() => navigateTo('faq')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'faq' ? 'text-red-400 font-semibold' : ''
            }`}
          >
            FAQ
          </button>
          <button
            type="button"
            onClick={() => navigateTo('support')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'support' ? 'text-red-400 font-semibold' : ''
            }`}
          >
            Support
          </button>
          <button
            type="button"
            onClick={() => navigateTo('admin')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap cursor-pointer ${
              viewMode === 'admin' ? 'text-red-400 font-semibold' : ''
            }`}
          >
            Admin
          </button>
        </nav>

        {/* Zone 3: 2 Primary Actions (Cart & Sign In) */}
        <div className="flex items-center gap-2.5">
          {userEmail ? (
            <button
              type="button"
              onClick={handleSignOut}
              title={`Signed in as ${userEmail}`}
              className="px-3 py-2 rounded-lg bg-[#181013] border border-[#2C181D] hover:border-red-500/40 text-xs font-medium text-zinc-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline max-w-[110px] truncate">{userEmail}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="px-3 py-2 rounded-lg bg-[#181013] border border-[#2C181D] hover:border-red-500/40 text-xs font-medium text-zinc-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            style={{ backgroundColor: theme?.buttonColor || '#DC2626' }}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white hover:opacity-95 transition-opacity flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-md shadow-red-950/50"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums">Cart ({totalCartCount})</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex items-center justify-around px-3 py-2 bg-[#120C0E] border-b border-[#2C181D] text-xs font-medium text-zinc-300 overflow-x-auto">
        <button
          type="button"
          onClick={() => navigateTo('store', '/')}
          className={viewMode === 'store' ? 'text-red-400 font-semibold' : ''}
        >
          Catalog
        </button>
        <button
          type="button"
          onClick={() => navigateTo('order-lookup')}
          className={viewMode === 'order-lookup' ? 'text-red-400 font-semibold' : ''}
        >
          Order Lookup
        </button>
        <button
          type="button"
          onClick={() => navigateTo('faq')}
          className={viewMode === 'faq' ? 'text-red-400 font-semibold' : ''}
        >
          FAQ
        </button>
        <button
          type="button"
          onClick={() => navigateTo('support')}
          className={viewMode === 'support' ? 'text-red-400 font-semibold' : ''}
        >
          Support
        </button>
        <button
          type="button"
          onClick={() => navigateTo('admin')}
          className={viewMode === 'admin' ? 'text-red-400 font-semibold' : ''}
        >
          Admin
        </button>
      </div>

      {/* Toast Notification for Promo Application */}
      {promoAppliedToast && (
        <div className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-xl bg-[#120C0E] border border-red-500/50 text-xs font-medium text-red-300 shadow-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-red-400" />
          <span>{promoAppliedToast}</span>
        </div>
      )}

      {/* Main View Router */}
      <div className="flex-1">
        {loadingStore ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-8">
            <div className="h-72 rounded-2xl bg-[#120C0E] border border-[#2C181D] animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-96 rounded-xl bg-[#120C0E] border border-[#2C181D] animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : storeError ? (
          <div className="max-w-xl mx-auto my-16 p-6 rounded-xl bg-[#120C0E] border border-red-500/30 text-center space-y-4">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <h2 className="text-base font-bold text-white">
              Store Connection Interrupted
            </h2>
            <p className="text-xs text-zinc-400">{storeError}</p>
            <button
              type="button"
              onClick={loadStoreData}
              className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-xs cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        ) : viewMode === 'admin' ? (
          <AdminDashboard
            authToken={authToken}
            adminSessionToken={adminSessionToken}
            isAdmin={isAdmin}
            userEmail={userEmail}
            onGoogleSignIn={handleGoogleSignIn}
            onAdminUnlockSuccess={(token) => {
              setAdminSessionToken(token);
              setIsAdmin(true);
            }}
            onStoreUpdated={loadStoreData}
            onCloseAdmin={() => navigateTo('store', '/')}
          />
        ) : viewMode === 'order-lookup' ? (
          <OrderLookupSection
            currencySymbol={currencySymbol}
            initialInvoiceId={lookupPrefill.invoiceId}
            initialUsername={lookupPrefill.username}
          />
        ) : viewMode === 'faq' ||
          viewMode === 'support' ||
          viewMode === 'terms' ||
          viewMode === 'privacy' ||
          viewMode === 'refund' ||
          viewMode === 'delivery' ? (
          settings && (
            <FaqSupportPoliciesView
              settings={settings}
              activeSubPage={viewMode}
              onChangeSubPage={(sub) => navigateTo(sub)}
            />
          )
        ) : (
          /* STOREFRONT HOMEPAGE & CATALOG VIEW */
          <main className="space-y-12 pb-16">
            {/* 1. Storefront Hero Section */}
            <section className="relative border-b border-[#2C181D] overflow-hidden">
              {settings?.heroConfig.bannerImage ? (
                <div className="absolute inset-0">
                  <SmartImage
                    src={settings.heroConfig.bannerImage}
                    alt="OwnVerse Citadel Backdrop"
                    className="w-full h-full opacity-40"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#090708] via-[#090708]/80 to-[#090708]/45" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#1A090D] via-[#0E0709] to-[#090708]" />
              )}

              <div className="relative max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-16 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  <div className="lg:col-span-8 space-y-5 animate-ov-fade-up">
                    <div className="flex items-center gap-3">
                      <SmartImage
                        src={settings?.logoUrl}
                        alt="OwnVerse Crest"
                        fallbackEmoji="👑"
                        className="w-12 h-12 rounded-xl border border-red-500/30 shrink-0 animate-ov-float"
                      />
                      <div className="text-xs text-red-400 font-semibold tracking-wide uppercase font-mono">
                        {settings?.heroConfig.kicker ||
                          'OwnVerse Network • Season 2'}
                      </div>
                    </div>

                    <h1
                      style={{ fontFamily: 'var(--font-display), sans-serif' }}
                      className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight max-w-2xl leading-[1.12]"
                    >
                      {settings?.heroConfig.title}
                    </h1>

                    <p className="text-sm sm:text-base text-zinc-300 max-w-2xl leading-relaxed">
                      {settings?.heroConfig.subtitle}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <a
                        href="#catalog"
                        style={{ backgroundColor: theme?.buttonColor || '#DC2626' }}
                        className="px-5 py-3 rounded-lg text-xs sm:text-sm font-bold text-white hover:opacity-95 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap shadow-lg shadow-red-950/50"
                      >
                        <span>
                          {settings?.heroConfig.primaryCtaText || 'Explore Store Catalog'}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => navigateTo('order-lookup')}
                        className="px-5 py-3 rounded-lg bg-[#181013] border border-[#2C181D] hover:border-red-500/50 hover:-translate-y-0.5 active:scale-95 text-xs sm:text-sm font-medium text-white transition-all whitespace-nowrap cursor-pointer"
                      >
                        {settings?.heroConfig.secondaryCtaText || 'Track Existing Order'}
                      </button>

                      {settings?.discordInviteUrl && (
                        <a
                          href={settings.discordInviteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-3 rounded-lg bg-[#120C0E] border border-[#2C181D] hover:border-red-500/50 hover:-translate-y-0.5 active:scale-95 text-xs sm:text-sm font-medium text-zinc-200 flex items-center gap-2 transition-all whitespace-nowrap"
                        >
                          <MessageSquare className="w-4 h-4 text-red-400" />
                          <span>Join Discord</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Live Server Status Card */}
                  {settings?.heroConfig.showServerStatus && (
                    <div className="lg:col-span-4 animate-ov-fade-up" style={{ animationDelay: '90ms' }}>
                      <div className="rounded-xl bg-[#120C0E] border border-[#2C181D] hover:border-red-500/35 transition-colors p-5 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-[#2C181D] pb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                serverStatus?.online !== false
                                  ? 'bg-red-500'
                                  : 'bg-zinc-600'
                              }`}
                            />
                            <span className="text-xs font-semibold text-white">
                              {serverStatus?.online !== false
                                ? 'Realm Status: Online'
                                : 'Realm Status: Offline'}
                            </span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-red-400 font-semibold">
                            {serverStatus?.playersOnline ?? settings.manualPlayersOnline} /{' '}
                            {serverStatus?.playersMax ?? settings.manualPlayersMax} Players
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          <div className="text-[11px] text-zinc-400">
                            Connect via Java or Bedrock (1.20.4 – 1.21.x)
                          </div>

                          {/* Java Edition IP */}
                          <div className="p-2.5 rounded-lg bg-[#090708] border border-[#2C181D] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                                Java Edition IP
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500">
                                Default Port 25565
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs sm:text-sm font-bold text-white select-all">
                                {settings.serverIp && settings.serverIp !== 'mc.ownverse.net'
                                  ? settings.serverIp
                                  : 'mc.ownverse.net'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyIpValue(
                                    settings.serverIp && settings.serverIp !== 'mc.ownverse.net'
                                      ? settings.serverIp
                                      : 'mc.ownverse.net',
                                    'java'
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-[#181013] border border-[#2C181D] hover:border-red-500/50 text-[11px] font-medium text-zinc-200 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                              >
                                {copiedIpKey === 'java' ? (
                                  <>
                                    <Check className="w-3 h-3 text-red-400" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy IP</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Bedrock Edition IP & Port */}
                          <div className="p-2.5 rounded-lg bg-[#090708] border border-[#2C181D] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                Bedrock Edition IP
                              </span>
                              <span className="text-[10px] font-mono font-bold text-amber-300">
                                Port: 19132
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs sm:text-sm font-bold text-white select-all">
                                play.ownverse.fun
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyIpValue('play.ownverse.fun', 'bedrock')}
                                className="px-2.5 py-1 rounded bg-[#181013] border border-[#2C181D] hover:border-red-500/50 text-[11px] font-medium text-zinc-200 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                              >
                                {copiedIpKey === 'bedrock' ? (
                                  <>
                                    <Check className="w-3 h-3 text-red-400" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy IP</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Pakistan Low-Ping Proxy IP */}
                          <div className="p-2.5 rounded-lg bg-[#090708] border border-red-500/30 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                                Pakistan · Better Ping IP
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                Low Latency Route
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs sm:text-sm font-bold text-white select-all">
                                uae.ownverse.net
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyIpValue('uae.ownverse.net', 'pk')}
                                className="px-2.5 py-1 rounded bg-[#181013] border border-[#2C181D] hover:border-red-500/50 text-[11px] font-medium text-zinc-200 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                              >
                                {copiedIpKey === 'pk' ? (
                                  <>
                                    <Check className="w-3 h-3 text-red-400" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy IP</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums pt-1">
                          <span>Automated RCON Delivery</span>
                          <span>
                            Updated{' '}
                            {serverStatus?.lastUpdated
                              ? new Date(serverStatus.lastUpdated).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Just now'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active Store Sale Campaign Strip */}
                {activeSales.length > 0 && (
                  <div className="rounded-xl bg-[#120C0E] border border-red-500/35 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 animate-ov-glow">
                    <div className="flex items-center gap-3 text-xs sm:text-sm">
                      <Tag className="w-4 h-4 text-red-400 shrink-0" />
                      <div>
                        <strong className="text-white font-semibold mr-2">
                          {activeSales[0].title}:
                        </strong>
                        <span className="text-zinc-300">
                          {activeSales[0].description}
                        </span>
                      </div>
                    </div>
                    {activeSales[0].showCountdown && activeSales[0].endDate && (
                      <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          Ends {new Date(activeSales[0].endDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* AD SPACE 1: Top Storefront Leaderboard Banner (Below Hero) */}
            {adsEnabled && adSlot1 && (
              <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-2">
                <StoreAdBannerCard slot={adSlot1} />
              </section>
            )}

            {/* 2. Catalog Controls, Section Tabs, Search & Product Grid */}
            <section
              id="catalog"
              className={`max-w-7xl mx-auto px-4 sm:px-8 space-y-8 ${spacingPaddingClass}`}
            >
              {/* Section Navigation Tabs + Search Input */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#2C181D] pb-5">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#120C0E] border border-[#2C181D] overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSectionSlug('all');
                      window.history.pushState({}, '', '/');
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedSectionSlug === 'all'
                        ? 'bg-red-600 text-white font-bold'
                        : 'text-zinc-300 hover:text-white'
                    }`}
                  >
                    All Packages ({products.length})
                  </button>
                  {sections.map((sec) => {
                    const count = products.filter((p) => p.sectionId === sec.id).length;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          setSelectedSectionSlug(sec.slug);
                          window.history.pushState({}, '', `/section/${sec.slug}`);
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                          selectedSectionSlug === sec.slug
                            ? 'bg-red-600 text-white font-bold'
                            : 'text-zinc-300 hover:text-white'
                        }`}
                      >
                        {sec.name} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Search & Sort Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ranks, kits, codes..."
                      className="w-full rounded-lg bg-[#120C0E] border border-[#2C181D] pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    aria-label="Sort products"
                    className="rounded-lg bg-[#120C0E] border border-[#2C181D] px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                  >
                    <option value="featured">Sort: Featured First</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                    <option value="name-asc">Name: A to Z</option>
                    <option value="newest">Newest Added</option>
                  </select>
                </div>
              </div>

              {/* Secondary Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-zinc-400 flex items-center gap-1 mr-1">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterFeaturedOnly((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      filterFeaturedOnly
                        ? 'bg-red-500/15 border-red-500 text-red-300 font-medium'
                        : 'bg-[#120C0E] border-[#2C181D] text-zinc-300 hover:text-white'
                    }`}
                  >
                    Featured Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterOnSaleOnly((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      filterOnSaleOnly
                        ? 'bg-red-500/15 border-red-500 text-red-300 font-medium'
                        : 'bg-[#120C0E] border-[#2C181D] text-zinc-300 hover:text-white'
                    }`}
                  >
                    On Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLimitedStockOnly((v) => !v)}
                    className={`px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      filterLimitedStockOnly
                        ? 'bg-red-500/15 border-red-500 text-red-300 font-medium'
                        : 'bg-[#120C0E] border-[#2C181D] text-zinc-300 hover:text-white'
                    }`}
                  >
                    Limited Stock
                  </button>

                  {allTags.length > 0 && (
                    <select
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value)}
                      aria-label="Filter by tag"
                      className="rounded-lg bg-[#120C0E] border border-[#2C181D] px-2.5 py-1.5 text-xs text-zinc-300"
                    >
                      <option value="all">All Tags</option>
                      {allTags.map((tag) => (
                        <option key={tag} value={tag}>
                          #{tag}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="text-zinc-400 font-mono tabular-nums">
                  Showing {filteredProducts.length} package
                  {filteredProducts.length === 1 ? '' : 's'}
                </div>
              </div>

              {/* AD SPACE 2: Catalog Mid-Page Banner */}
              {adsEnabled && adSlot2 && <StoreAdBannerCard slot={adSlot2} />}

              {/* 3-Column Product Collection Grid */}
              {filteredProducts.length === 0 ? (
                <div className="rounded-xl bg-[#120C0E] border border-[#2C181D] p-12 text-center space-y-3">
                  <p className="text-sm font-semibold text-white">
                    No store packages match your active filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSectionSlug('all');
                      setSearchQuery('');
                      setFilterFeaturedOnly(false);
                      setFilterOnSaleOnly(false);
                      setFilterLimitedStockOnly(false);
                      setSelectedTag('all');
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-xs cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {filteredProducts.map((product, prodIdx) => {
                    const sec = product.sectionId
                      ? sectionMap.get(product.sectionId)
                      : undefined;
                    const isJustAdded = addedProductId === product.id;

                    return (
                      <article
                        key={product.id}
                        style={{
                          backgroundColor: theme?.bgCard || '#181013',
                          borderRadius: theme?.cardRadius || '12px',
                          animationDelay: `${Math.min(prodIdx * 60, 360)}ms`,
                        }}
                        className="group border border-[#2C181D] hover:border-red-500/50 ov-card-animated animate-ov-fade-up flex flex-col overflow-hidden"
                      >
                        {/* Lead with Imagery (4:3 aspect ratio) */}
                        <div
                          onClick={() => handleOpenProductDetail(product)}
                          className="relative aspect-[4/3] w-full bg-[#090708] border-b border-[#2C181D] cursor-pointer overflow-hidden"
                        >
                          <SmartImage
                            src={product.productImageUrl}
                            alt={product.name}
                            fallbackTitle={product.name}
                            fallbackEmoji={product.emojiIcon}
                            className="w-full h-full"
                            imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          />

                          {/* Max 1 Clean Tag on Image */}
                          {(product.customBadge || product.appliedSaleBadge) && (
                            <div
                              style={{
                                backgroundColor: product.isOutOfStock
                                  ? '#3F3F46'
                                  : product.badgeColor || '#EF4444',
                              }}
                              className="absolute top-3 left-3 px-2.5 py-1 rounded text-[11px] font-bold tracking-wide text-white"
                            >
                              {product.isOutOfStock
                                ? 'OUT OF STOCK'
                                : product.customBadge || product.appliedSaleBadge}
                            </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-5 flex-1 flex flex-col justify-between space-y-5">
                          <div className="space-y-2">
                            {/* Clean Unboxed Metadata with Typographic Separators */}
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                              <span>{product.emojiIcon}</span>
                              <span>{sec?.name || 'Catalog'}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-zinc-300">{product.rarityTier}</span>
                              <span aria-hidden="true">·</span>
                              {product.isOutOfStock ? (
                                <span className="text-red-400 font-medium">
                                  Sold Out
                                </span>
                              ) : product.isLowStock ? (
                                <span className="text-amber-400 font-mono tabular-nums">
                                  {product.stockQuantity} left
                                </span>
                              ) : product.stockType === 'limited' ? (
                                <span className="text-red-400 font-mono tabular-nums">
                                  {product.stockQuantity} in stock
                                </span>
                              ) : (
                                <span className="text-red-400">In Stock</span>
                              )}
                            </div>

                            <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors">
                              <button
                                type="button"
                                onClick={() => handleOpenProductDetail(product)}
                                className="text-left focus:outline-none cursor-pointer"
                              >
                                {product.name}
                              </button>
                            </h3>

                            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                              {product.shortDescription}
                            </p>
                          </div>

                          {/* Price Baseline & Action Buttons */}
                          <div className="pt-4 border-t border-[#2C181D] space-y-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-1 font-mono tabular-nums">
                              <div className="flex flex-wrap items-baseline gap-2">
                                <span className="text-base sm:text-lg font-bold text-white">
                                  {formatUsdPkr(product.effectivePrice, currencySymbol)}
                                </span>
                                {product.isOnSale && (
                                  <span className="text-xs text-zinc-500 line-through">
                                    {formatUsdPkr(product.originalPrice, currencySymbol)}
                                  </span>
                                )}
                              </div>
                              {product.isOnSale && (
                                <span className="text-xs font-bold text-red-400">
                                  -{product.discountPercent}%
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={() => handleOpenProductDetail(product)}
                                className="py-2.5 px-3 rounded-lg bg-[#090708] border border-[#2C181D] hover:border-red-500/40 text-xs font-medium text-zinc-200 hover:text-white transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                              >
                                <Info className="w-3.5 h-3.5 text-red-400" />
                                <span>More Info</span>
                              </button>

                              <button
                                type="button"
                                disabled={product.isOutOfStock}
                                onClick={() => handleAddToCart(product, 1)}
                                style={{
                                  backgroundColor: product.isOutOfStock
                                    ? '#27272A'
                                    : product.buttonColor ||
                                      theme?.buttonColor ||
                                      '#DC2626',
                                }}
                                className="py-2.5 px-3 rounded-lg text-xs font-bold text-white hover:opacity-95 disabled:opacity-50 disabled:text-zinc-400 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                              >
                                {product.isOutOfStock ? (
                                  <span>Out of Stock</span>
                                ) : isJustAdded ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Added</span>
                                  </>
                                ) : (
                                  <>
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    <span>Add to Cart</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Recently Viewed Products Strip */}
              {recentlyViewedProducts.length > 0 && (
                <div className="pt-8 border-t border-[#2C181D] space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">
                      Recently Viewed Packages
                    </h2>
                    <span className="text-xs text-zinc-400">
                      Click to re-open kit details
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {recentlyViewedProducts.map((rv) => (
                      <button
                        key={rv.id}
                        type="button"
                        onClick={() => handleOpenProductDetail(rv)}
                        className="p-3 rounded-xl bg-[#120C0E] border border-[#2C181D] hover:border-red-500/50 text-left flex items-center gap-3 transition-colors cursor-pointer"
                      >
                        <SmartImage
                          src={rv.productImageUrl}
                          alt={rv.name}
                          fallbackEmoji={rv.emojiIcon}
                          className="w-12 h-12 rounded-lg shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {rv.name}
                          </div>
                          <div className="text-xs font-mono text-red-400 tabular-nums">
                            {formatUsdPkr(rv.effectivePrice, currencySymbol)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* AD SPACES 3 & 4: Store Showcase Ad Banners (Below Catalog) */}
            {adsEnabled && bottomAdSlots.length > 0 && (
              <section className="max-w-7xl mx-auto px-4 sm:px-8">
                <div
                  className={`grid grid-cols-1 ${
                    bottomAdSlots.length > 1 ? 'lg:grid-cols-2' : ''
                  } gap-6`}
                >
                  {bottomAdSlots.map((slot) => (
                    <StoreAdBannerCard
                      key={slot.id}
                      slot={slot}
                      compact={bottomAdSlots.length > 1}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 3. Store Trust, Delivery & Payment Ecosystem Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-8">
              <div className="rounded-2xl bg-[#120C0E] border border-[#2C181D] p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <ShieldCheck className="w-4 h-4 text-red-500" />
                    <span>Atomic Stock & Fraud Protection</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Every purchase is processed inside a PostgreSQL database transaction
                    with automatic stock reservation, preventing overselling on limited
                    seasonal ranks.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>1–5 Minute Automated Delivery</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Orders generate a permanent Invoice ID (`OV-2026-XXXXXX`) and trigger
                    instant Discord webhook notifications for rapid verification and RCON
                    dispatch.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Tag className="w-4 h-4 text-red-400" />
                    <span>Local & Global Payment Methods</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Pay seamlessly with JazzCash, Easypaisa, Raast, Pakistani Bank
                    Transfer (IBFT), USDT/USDC Crypto, or Visa/Mastercard.
                  </p>
                </div>
              </div>
            </section>
          </main>
        )}
      </div>

      {/* Storefront Footer */}
      <footer className="bg-[#090708] border-t border-[#2C181D] py-10 px-4 sm:px-8 text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-lg">
            <div
              className="text-sm font-bold text-white"
              style={{ fontFamily: 'var(--font-display), sans-serif' }}
            >
              {settings?.storeName || 'OwnVerse Store'}
            </div>
            <div className="text-[11px] font-mono text-zinc-300 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Java: <strong className="text-red-400">mc.ownverse.net</strong></span>
              <span aria-hidden="true">·</span>
              <span>Bedrock: <strong className="text-amber-400">play.ownverse.fun</strong> (Port <strong className="text-amber-400">19132</strong>)</span>
              <span aria-hidden="true">·</span>
              <span>Pakistan Ping: <strong className="text-red-400">uae.ownverse.net</strong></span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              OwnVerse Network is not affiliated with Mojang Studios or Microsoft
              Corporation. Minecraft is a registered trademark of Mojang Synergies AB.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => navigateTo('order-lookup')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Order Lookup
            </button>
            <button
              type="button"
              onClick={() => navigateTo('faq')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={() => navigateTo('support')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Support
            </button>
            <button
              type="button"
              onClick={() => navigateTo('terms')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Terms & Conditions
            </button>
            <button
              type="button"
              onClick={() => navigateTo('privacy')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => navigateTo('refund')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Refund Policy
            </button>
            <button
              type="button"
              onClick={() => navigateTo('delivery')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Delivery Policy
            </button>
          </div>
        </div>
      </footer>

      {/* Detailed Product Modal (More Info) */}
      {activeProductModal && (
        <ProductDetailModal
          product={activeProductModal}
          section={
            activeProductModal.sectionId
              ? sectionMap.get(activeProductModal.sectionId)
              : undefined
          }
          allProducts={products}
          currencySymbol={currencySymbol}
          onClose={handleCloseProductDetail}
          onSelectProduct={(nextProd) => handleOpenProductDetail(nextProd)}
          onAddToCart={(prod, qty) => handleAddToCart(prod, qty)}
        />
      )}

      {/* Cart & Checkout Drawer */}
      <CartCheckoutModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        products={products}
        onUpdateQuantity={handleUpdateCartQuantity}
        onClearCart={() => setCart([])}
        initialPromoCode={activePromoCode}
        onPromoCodeChange={(code) => setActivePromoCode(code)}
        paymentMethods={settings?.paymentMethodsConfig || []}
        currencySymbol={currencySymbol}
        authToken={authToken}
        onOrderSuccess={() => {
          loadStoreData();
        }}
        onNavigateToLookup={(invoiceId, username) => {
          setLookupPrefill({ invoiceId, username });
          navigateTo('order-lookup');
        }}
      />
    </div>
  );
}
