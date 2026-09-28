import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  Percent,
  Tag,
  Palette,
  CreditCard,
  FileText,
  Database,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Edit3,
  X,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  KeyRound,
  LogIn,
  Megaphone,
  ExternalLink,
} from 'lucide-react';
import {
  StoreSettings,
  StoreSection,
  StoreProduct,
  StoreSale,
  StorePromoCode,
  StoreOrder,
  StoreAnalytics,
} from '../types/store.ts';
import { MarkdownEditorWithPreview } from './SafeMarkdown.tsx';
import { SmartImage } from './SmartImage.tsx';
import {
  ImageFieldControl,
  AdminImageSettingsTab,
  MediaAssetItem,
} from './ImageMediaManager.tsx';
import { optimizeImageFile } from '../lib/imageOptimizer.ts';
import { formatUsdPkr } from '../lib/currency.ts';

interface AdminDashboardProps {
  authToken?: string | null;
  adminSessionToken?: string | null;
  isAdmin?: boolean;
  userEmail?: string | null;
  onGoogleSignIn?: () => void;
  onAdminUnlockSuccess?: (token: string) => void;
  onStoreUpdated?: () => void;
  onCloseAdmin?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  authToken,
  adminSessionToken,
  isAdmin,
  userEmail,
  onGoogleSignIn,
  onAdminUnlockSuccess,
  onStoreUpdated,
  onCloseAdmin,
}) => {
  const [localAdminToken, setLocalAdminToken] = useState<string | null>(
    adminSessionToken || null
  );
  const [isUnlocked, setIsUnlocked] = useState(Boolean(isAdmin || adminSessionToken));
  const [accessKeyInput, setAccessKeyInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<
    | 'analytics'
    | 'orders'
    | 'products'
    | 'sections'
    | 'media'
    | 'sales'
    | 'promos'
    | 'ads'
    | 'theme'
    | 'payments'
    | 'policies'
    | 'backup'
  >('analytics');

  const [loadingData, setLoadingData] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Store State
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [sections, setSections] = useState<StoreSection[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [sales, setSales] = useState<StoreSale[]>([]);
  const [promoCodes, setPromoCodes] = useState<StorePromoCode[]>([]);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [analytics, setAnalytics] = useState<StoreAnalytics | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetItem[]>([]);

  // Order Filters & Detail Modal
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [adminOrderNotes, setAdminOrderNotes] = useState('');
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);

  // Product Form Modal
  const [editingProduct, setEditingProduct] = useState<Partial<StoreProduct> | null>(null);
  const [whatYouGetText, setWhatYouGetText] = useState('');
  const [requirementsText, setRequirementsText] = useState('');
  const [commandsText, setCommandsText] = useState('');
  const [importantNotesText, setImportantNotesText] = useState('');
  const [tagsText, setTagsText] = useState('');

  // Section Form
  const [editingSection, setEditingSection] = useState<Partial<StoreSection> | null>(null);

  // Sale Form
  const [editingSale, setEditingSale] = useState<Partial<StoreSale> | null>(null);

  // Promo Form
  const [editingPromo, setEditingPromo] = useState<Partial<StorePromoCode> | null>(null);

  // Security & Backup State
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [confirmImportModal, setConfirmImportModal] = useState(false);

  useEffect(() => {
    if (adminSessionToken) {
      setLocalAdminToken(adminSessionToken);
      setIsUnlocked(true);
    } else if (isAdmin) {
      setIsUnlocked(true);
    }
  }, [adminSessionToken, isAdmin]);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const getAuthHeaders = useCallback(
    (tokenOverride?: string | null): Record<string, string> => {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const activeAdminTok = tokenOverride || localAdminToken || adminSessionToken;
      if (activeAdminTok) {
        headers['x-admin-token'] = activeAdminTok;
      }
      return headers;
    },
    [authToken, localAdminToken, adminSessionToken]
  );

  const adminFetch = useCallback(
    async (url: string, options: RequestInit = {}, tokenOverride?: string | null) => {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }
      const authHeaders = getAuthHeaders(tokenOverride);
      Object.entries(authHeaders).forEach(([k, v]) => headers.set(k, v));

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [getAuthHeaders]
  );

  const syncLocalBackupSnapshot = useCallback(
    async (tokenOverride?: string | null) => {
      try {
        const res = await adminFetch('/api/admin/backup/export', {}, tokenOverride);
        if (res.ok) {
          const backupData = await res.json();
          localStorage.setItem('ownverse_persistent_backup_v1', JSON.stringify(backupData));
        }
      } catch {
        // Ignore storage quota or network errors during background snapshot sync
      }
    },
    [adminFetch]
  );

  const fetchFullAdminState = useCallback(
    async (tokenOverride?: string | null, saveSnapshot = false) => {
      setLoadingData(true);
      try {
        const res = await adminFetch('/api/admin/state', {}, tokenOverride);
        if (res.status === 401 || res.status === 403) {
          setIsUnlocked(false);
          return;
        }
        const data = await res.json();
        if (res.ok) {
          setSettings(data.settings);
          setSections(data.sections || []);
          setProducts(data.products || []);
          setSales(data.sales || []);
          setPromoCodes(data.promoCodes || []);
          setOrders(data.orders || []);
          setAnalytics(data.analytics || null);
          setMediaAssets(data.mediaAssets || []);
          setIsUnlocked(true);
          if (saveSnapshot) {
            await syncLocalBackupSnapshot(tokenOverride);
          }
        }
      } catch (err) {
        console.error('Failed to load admin state:', err);
      } finally {
        setLoadingData(false);
      }
    },
    [adminFetch, syncLocalBackupSnapshot]
  );

  useEffect(() => {
    if (isUnlocked || authToken || localAdminToken || adminSessionToken) {
      fetchFullAdminState();
    }
  }, [isUnlocked, authToken, localAdminToken, adminSessionToken, fetchFullAdminState]);

  const handleUnlockWithKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKeyInput.trim()) {
      setAuthError('Please enter your administrator password.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/admin-unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ accessKey: accessKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Invalid administrator password.');
      } else {
        const tok = data.adminToken || data.token;
        setLocalAdminToken(tok);
        setIsUnlocked(true);
        setAccessKeyInput('');
        onAdminUnlockSuccess?.(tok);
        await fetchFullAdminState(tok);
      }
    } catch {
      setAuthError('Network error while verifying administrator password.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setLocalAdminToken(null);
    setIsUnlocked(false);
    if (onCloseAdmin) {
      onCloseAdmin();
    } else {
      window.location.href = '/';
    }
  };

  // --- Image Upload & Media Management ---
  const handleUploadImageFile = async (
    file: File,
    category = 'product'
  ): Promise<string | null> => {
    if (file.size > 10 * 1024 * 1024) {
      showNotice('error', 'Image must be smaller than 10MB.');
      return null;
    }
    try {
      const dataUri = await optimizeImageFile(file, 1400, 0.84);
      const res = await adminFetch('/api/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          dataUri,
          category,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Failed to upload image.');
        return null;
      }
      showNotice('success', 'Image optimized & saved to PostgreSQL media vault.');
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
      return data.url as string;
    } catch {
      showNotice('error', 'Failed to upload image.');
      return null;
    }
  };

  const handleDeleteMediaAsset = async (id: number) => {
    const res = await adminFetch(`/api/admin/media/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMediaAssets((prev) => prev.filter((m) => m.id !== id));
      await syncLocalBackupSnapshot();
      showNotice('success', 'Image deleted from database.');
    } else {
      showNotice('error', 'Failed to delete image.');
    }
  };

  const handleQuickUpdateProductImages = async (
    product: StoreProduct,
    updates: {
      productImageUrl: string;
      kitPreviewImageUrl: string;
      customLogoUrl: string;
    }
  ) => {
    const payload = {
      ...product,
      productImageUrl: updates.productImageUrl,
      kitPreviewImageUrl: updates.kitPreviewImageUrl,
      customLogoUrl: updates.customLogoUrl || null,
    };
    const res = await adminFetch('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Failed to update product images.');
    } else {
      showNotice('success', `Updated images for "${product.name}".`);
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    }
  };

  // --- Order Actions ---
  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    setUpdatingOrderStatus(true);
    try {
      const res = await adminFetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: newStatus,
          adminNotes: adminOrderNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || 'Failed to update order status.');
      } else {
        showNotice('success', `Order ${data.order.invoiceId} updated to ${newStatus}.`);
        setSelectedOrder(data.order);
        await fetchFullAdminState();
        onStoreUpdated?.();
      }
    } catch {
      showNotice('error', 'Network error updating order.');
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  // --- Product Actions ---
  const openProductEditor = (prod?: StoreProduct) => {
    if (prod) {
      setEditingProduct({
        ...prod,
        duration: prod.duration || 'Permanent (Lifetime)',
        protection: prod.protection || 'Verified Delivery',
      });
      setTagsText((prod.tags || []).join(', '));
      setWhatYouGetText((prod.whatYouGet || []).join('\n'));
      setRequirementsText((prod.requirements || []).join('\n'));
      setCommandsText((prod.commandsPerks || []).join('\n'));
      setImportantNotesText(prod.importantNotes || '');
    } else {
      setEditingProduct({
        productCode: `OV-ITEM-${Math.floor(100 + Math.random() * 900)}`,
        sectionId: sections[0]?.id || 1,
        name: '',
        price: 9.99,
        salePrice: null,
        emojiIcon: '⚔️',
        customLogoUrl: '',
        productImageUrl: '',
        kitPreviewImageUrl: '',
        shortDescription: '',
        markdownDescription:
          '## Package Overview\nDescribe the rank perks, items, or crate rewards included in this package.',
        rarityTier: 'Legendary',
        customBadge: 'FEATURED',
        badgeColor: '#EF4444',
        cardAccentColor: '#EF4444',
        buttonColor: '#DC2626',
        featured: false,
        visible: true,
        stockType: 'unlimited',
        stockQuantity: null,
        lowStockThreshold: 5,
        displayOrder: products.length + 1,
        duration: 'Permanent (Lifetime)',
        protection: 'Verified Delivery',
        deliveryInfo: 'Delivered automatically within 1–5 minutes of verification.',
        importantNotes: 'Double check your Minecraft username before checkout.',
        productTerms: 'All digital Minecraft packages are final once delivered in-game.',
      });
      setTagsText('rank, perks');
      setWhatYouGetText('Instant in-game package delivery');
      setRequirementsText('Must have a valid Minecraft account');
      setCommandsText('/kit preview');
      setImportantNotesText('Double check your Minecraft username before checkout.');
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const payload = {
      ...editingProduct,
      duration: (editingProduct.duration || 'Permanent (Lifetime)').trim(),
      protection: (editingProduct.protection || 'Verified Delivery').trim(),
      tags: tagsText
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      whatYouGet: whatYouGetText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      requirements: requirementsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      commandsPerks: commandsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      importantNotes: importantNotesText.trim(),
    };

    const res = await adminFetch('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Failed to save product.');
    } else {
      showNotice('success', `Product "${data.product.name}" saved.`);
      setEditingProduct(null);
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    }
  };

  const handleDeleteProduct = async (id: number) => {
    const res = await adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showNotice('success', 'Product deleted.');
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    }
  };

  // --- Section Actions ---
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;
    const res = await adminFetch('/api/admin/sections', {
      method: 'POST',
      body: JSON.stringify(editingSection),
    });
    const data = await res.json();
    if (!res.ok) {
      showNotice('error', data.error || 'Failed to save section.');
    } else {
      showNotice('success', `Section "${data.section.name}" saved.`);
      setEditingSection(null);
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    }
  };

  const handleMoveSection = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    setSections(reordered);

    await adminFetch('/api/admin/sections/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds: reordered.map((s) => s.id) }),
    });
    await syncLocalBackupSnapshot();
    onStoreUpdated?.();
  };

  const handleDeleteSection = async (id: number) => {
    const res = await adminFetch(`/api/admin/sections/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showNotice('success', 'Section deleted.');
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    }
  };

  // --- Sale Actions ---
  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;
    const res = await adminFetch('/api/admin/sales', {
      method: 'POST',
      body: JSON.stringify(editingSale),
    });
    if (res.ok) {
      showNotice('success', 'Sale campaign saved.');
      setEditingSale(null);
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    } else {
      showNotice('error', 'Failed to save sale campaign.');
    }
  };

  const handleDeleteSale = async (id: number) => {
    const res = await adminFetch(`/api/admin/sales/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showNotice('success', 'Sale campaign deleted.');
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    }
  };

  // --- Promo Actions ---
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromo) return;
    const res = await adminFetch('/api/admin/promo-codes', {
      method: 'POST',
      body: JSON.stringify(editingPromo),
    });
    if (res.ok) {
      showNotice('success', 'Promo code saved.');
      setEditingPromo(null);
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    } else {
      showNotice('error', 'Failed to save promo code.');
    }
  };

  const handleDeletePromo = async (id: number) => {
    const res = await adminFetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showNotice('success', 'Promo code deleted.');
      await fetchFullAdminState(undefined, true);
      onStoreUpdated?.();
    }
  };

  // --- Settings Actions ---
  const handleSaveStoreSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settings) return;

    setSavingSettings(true);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showNotice('success', 'Store settings & visuals saved!');
        await fetchFullAdminState(undefined, true);
        onStoreUpdated?.();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotice('error', err.error || 'Failed to save store settings.');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminPassword || newAdminPassword.trim().length < 6) {
      showNotice('error', 'New admin password must be at least 6 characters.');
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      showNotice('error', 'New password and confirmation do not match.');
      return;
    }

    const res = await adminFetch('/api/admin/password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: currentAdminPassword.trim() || undefined,
        newPassword: newAdminPassword.trim(),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showNotice('success', 'Admin password updated and encrypted in PostgreSQL!');
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
    } else {
      showNotice('error', data.error || 'Failed to update admin password.');
    }
  };

  const handleExportBackup = async () => {
    const res = await adminFetch('/api/admin/backup/export');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ownverse-store-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const res = await adminFetch('/api/admin/backup/import', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      if (res.ok) {
        showNotice('success', 'Backup imported successfully.');
        setConfirmImportModal(false);
        setImportJsonText('');
        await fetchFullAdminState();
        onStoreUpdated?.();
      } else {
        showNotice('error', 'Failed to import backup JSON.');
      }
    } catch {
      showNotice('error', 'Invalid JSON format.');
    }
  };

  // --- Locked Screen (Secured — no password or hints exposed anywhere) ---
  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] bg-[#090708] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-500">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">
                  OwnVerse Admin Portal
                </h1>
                <span className="text-xs text-zinc-400">
                  Restricted Administrator Access
                </span>
              </div>
            </div>
            {onCloseAdmin && (
              <button
                type="button"
                onClick={onCloseAdmin}
                className="p-2 rounded-lg bg-[#181013] hover:bg-[#23151A] text-zinc-400 hover:text-white border border-[#2C181D] cursor-pointer"
                title="Back to Storefront"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleUnlockWithKey} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                Administrator Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={accessKeyInput}
                onChange={(e) => setAccessKeyInput(e.target.value)}
                placeholder="Enter your private admin password..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] focus:border-red-500 text-sm font-mono text-white outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-red-950/60"
            >
              {authLoading ? 'Authenticating...' : 'Unlock Admin Console'}
            </button>
          </form>

          {onGoogleSignIn && (
            <>
              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-[#2C181D]" />
                <span className="shrink mx-3 text-[11px] font-mono uppercase text-zinc-500">
                  OR
                </span>
                <div className="grow border-t border-[#2C181D]" />
              </div>

              <button
                type="button"
                onClick={onGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-xl bg-[#090708] hover:bg-[#181013] border border-[#2C181D] text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-red-400" />
                <span>
                  {userEmail ? `Signed in as ${userEmail}` : 'Sign In with Google Account'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = orderStatusFilter === 'ALL' || o.status === orderStatusFilter;
    const q = orderSearch.toLowerCase();
    const matchesSearch =
      !q ||
      o.invoiceId.toLowerCase().includes(q) ||
      o.minecraftUsername.toLowerCase().includes(q) ||
      o.discordUsername.toLowerCase().includes(q) ||
      o.paymentReference.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#090708] text-white flex flex-col">
      {/* Top Admin Header */}
      <header className="bg-[#120C0E] border-b border-[#2C181D] px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-500 font-extrabold font-mono">
            OV
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white">
              OwnVerse Store — Control Center
            </h1>
            <span className="text-[11px] font-mono text-red-400">
              PostgreSQL Connected • Real-Time Sync
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchFullAdminState()}
            className="px-3 py-1.5 rounded-lg bg-[#181013] hover:bg-[#24161B] text-xs font-semibold text-zinc-200 border border-[#2C181D] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin text-red-400' : ''}`}
            />
            <span>Refresh</span>
          </button>
          {onCloseAdmin && (
            <button
              type="button"
              onClick={onCloseAdmin}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-extrabold text-white cursor-pointer"
            >
              View Live Store
            </button>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg bg-[#181013] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-[#2C181D] cursor-pointer"
            title="Lock Admin Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Status Toast */}
      {statusBanner && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl text-xs font-bold flex items-center gap-2.5 ${
            statusBanner.type === 'success'
              ? 'bg-[#120C0E] border-red-500 text-red-400'
              : 'bg-[#120C0E] border-amber-500 text-amber-400'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto p-4 sm:p-6 gap-6">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-2.5 flex lg:flex-col gap-1 overflow-x-auto">
            {[
              { id: 'analytics', label: 'Analytics & Overview', icon: LayoutDashboard },
              { id: 'media', label: `Images & Media (${mediaAssets.length})`, icon: ImageIcon },
              { id: 'products', label: `Products (${products.length})`, icon: Package },
              { id: 'sections', label: `Sections (${sections.length})`, icon: Layers },
              { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingCart },
              { id: 'sales', label: `Sales (${sales.length})`, icon: Percent },
              { id: 'promos', label: `Promo Codes (${promoCodes.length})`, icon: Tag },
              {
                id: 'ads',
                label: `Store Ads (${
                  settings?.adsConfig?.enabled ? 'ON · 4 Spaces' : 'OFF'
                })`,
                icon: Megaphone,
              },
              { id: 'theme', label: 'Red Theme & Settings', icon: Palette },
              { id: 'payments', label: 'Payment Methods', icon: CreditCard },
              { id: 'policies', label: 'FAQ & Policies', icon: FileText },
              { id: 'backup', label: 'Password & Backups', icon: Database },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-red-600/15 text-red-400 border border-red-500/35'
                      : 'text-zinc-400 hover:text-white hover:bg-[#181013] border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active Panel Content */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* 1. ANALYTICS TAB */}
          {activeTab === 'analytics' && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-bold uppercase tracking-wider">Verified Revenue</span>
                    <DollarSign className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="text-xl font-mono font-extrabold text-white">
                    {formatUsdPkr(analytics.totalRevenue)}
                  </div>
                  <span className="text-[11px] text-red-400 mt-1 block">
                    Avg Order: {formatUsdPkr(analytics.averageOrderValue)}
                  </span>
                </div>

                <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-bold uppercase tracking-wider">Total Orders</span>
                    <ShoppingCart className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-white">
                    {analytics.totalOrders}
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    {analytics.completedCount + analytics.paidCount} Completed / Paid
                  </span>
                </div>

                <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-bold uppercase tracking-wider">Pending Verification</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-amber-400">
                    {analytics.pendingCount}
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    Awaiting admin confirmation
                  </span>
                </div>

                <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                    <span className="font-bold uppercase tracking-wider">Low Stock Alerts</span>
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-white">
                    {analytics.lowStockProducts.length}
                  </div>
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    Limited packages near threshold
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Top Selling Store Packages
                  </h3>
                  <div className="divide-y divide-[#2C181D]">
                    {analytics.popularProducts.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-4">No completed package sales yet.</p>
                    ) : (
                      analytics.popularProducts.map((pop) => (
                        <div
                          key={pop.id}
                          className="py-3 flex items-center justify-between text-xs sm:text-sm"
                        >
                          <div>
                            <span className="font-bold text-white">{pop.name}</span>
                            <span className="text-zinc-500 font-mono ml-2">
                              {pop.quantity} units sold
                            </span>
                          </div>
                          <span className="font-mono font-bold text-red-400">
                            {formatUsdPkr(pop.revenue)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Promo Code Usage & Low Stock
                  </h3>
                  <div className="space-y-2">
                    {analytics.promoUsage.map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#090708] border border-[#2C181D] flex items-center justify-between text-xs"
                      >
                        <span className="font-mono font-bold text-red-400">{p.code}</span>
                        <span className="text-zinc-300 font-mono">
                          {p.currentUses} / {p.maxTotalUses ?? '∞'} uses
                        </span>
                      </div>
                    ))}
                  </div>

                  {analytics.lowStockProducts.length > 0 && (
                    <div className="pt-3 border-t border-[#2C181D] space-y-2">
                      <span className="text-xs font-bold uppercase text-amber-400 block">
                        Low Stock Inventory
                      </span>
                      {analytics.lowStockProducts.map((lp) => (
                        <div
                          key={lp.id}
                          className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex justify-between text-xs"
                        >
                          <span className="text-white font-medium">{lp.name}</span>
                          <span className="font-mono font-bold text-amber-400">
                            {lp.stockQuantity} left
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. IMAGES & MEDIA TAB (Dedicated Image Replacer & Vault) */}
          {activeTab === 'media' && settings && (
            <AdminImageSettingsTab
              settingsForm={settings}
              setSettingsForm={setSettings}
              onSaveSettings={handleSaveStoreSettings}
              products={products}
              sections={sections}
              mediaAssets={mediaAssets}
              onUploadFile={(file) => handleUploadImageFile(file, 'product')}
              onQuickUpdateProductImages={handleQuickUpdateProductImages}
              onDeleteMediaAsset={handleDeleteMediaAsset}
              savingSettings={savingSettings}
            />
          )}

          {/* 3. ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-extrabold text-white">
                  Customer Orders & Status Verification
                </h2>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search invoice, player, TID..."
                      className="pl-9 pr-3.5 py-2 rounded-xl bg-[#090708] border border-[#2C181D] text-xs text-white outline-none focus:border-red-500"
                    />
                  </div>
                  <select
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#090708] border border-[#2C181D] text-xs text-white outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Processing">Processing</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2C181D] text-zinc-400 uppercase font-mono">
                      <th className="py-3 px-3">Invoice ID</th>
                      <th className="py-3 px-3">Player / Discord</th>
                      <th className="py-3 px-3">Items</th>
                      <th className="py-3 px-3">Total</th>
                      <th className="py-3 px-3">Method & Ref</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C181D]">
                    {filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-[#181013]">
                        <td className="py-3.5 px-3 font-mono font-bold text-red-400">
                          {ord.invoiceId}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-white font-mono">
                            {ord.minecraftUsername}
                          </div>
                          <div className="text-zinc-500">{ord.discordUsername}</div>
                        </td>
                        <td className="py-3.5 px-3 text-zinc-300">
                          {ord.items.map((i) => `${i.name} x${i.quantity}`).join(', ')}
                        </td>
                        <td className="py-3.5 px-3 font-mono font-bold text-white">
                          {formatUsdPkr(ord.finalTotal)}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-zinc-200 font-semibold">{ord.paymentMethod}</div>
                          <div className="font-mono text-zinc-500">{ord.paymentReference}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-1 rounded-md font-bold bg-[#090708] border border-[#2C181D] text-zinc-200">
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(ord);
                              setAdminOrderNotes(ord.adminNotes || '');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/30 font-bold cursor-pointer"
                          >
                            Inspect / Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Order Detail Modal */}
              {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
                  <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-[#2C181D] pb-3">
                      <div>
                        <span className="text-xs font-mono text-zinc-400 block">
                          Order Inspection
                        </span>
                        <h3 className="text-lg font-mono font-extrabold text-red-400">
                          {selectedOrder.invoiceId}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="p-1.5 rounded-lg bg-[#181013] text-zinc-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-[#090708] p-4 rounded-xl border border-[#2C181D]">
                      <div>
                        <span className="text-zinc-500 block">Minecraft Username</span>
                        <span className="font-mono font-bold text-white">
                          {selectedOrder.minecraftUsername}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Discord</span>
                        <span className="font-bold text-white">
                          {selectedOrder.discordUsername}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Payment Method</span>
                        <span className="font-bold text-red-400">
                          {selectedOrder.paymentMethod}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Transaction Reference</span>
                        <span className="font-mono text-zinc-200">
                          {selectedOrder.paymentReference}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Promo Code</span>
                        <span className="font-mono text-zinc-200">
                          {selectedOrder.promoCode || 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Final Total (USD / PKR)</span>
                        <span className="font-mono font-extrabold text-red-400">
                          {formatUsdPkr(selectedOrder.finalTotal)}
                        </span>
                      </div>
                    </div>

                    {selectedOrder.receiptImageUrl && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold uppercase text-zinc-400 block">
                          Uploaded Payment Receipt
                        </span>
                        <a
                          href={selectedOrder.receiptImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block"
                        >
                          <img
                            src={selectedOrder.receiptImageUrl}
                            alt="Receipt"
                            className="max-h-48 rounded-xl border border-[#2C181D] object-contain bg-[#090708]"
                          />
                        </a>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-400 mb-1.5">
                        Internal Admin Notes
                      </label>
                      <textarea
                        rows={2}
                        value={adminOrderNotes}
                        onChange={(e) => setAdminOrderNotes(e.target.value)}
                        placeholder="Verification notes..."
                        className="w-full px-3 py-2 rounded-xl bg-[#090708] border border-[#2C181D] text-xs text-white outline-none focus:border-red-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <span className="block text-xs font-bold uppercase text-zinc-400">
                        Update Order Status (Triggers Discord Webhook if Configured)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(['Pending', 'Paid', 'Processing', 'Completed', 'Cancelled'] as const).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={updatingOrderStatus}
                              onClick={() => handleUpdateOrderStatus(selectedOrder.id, st)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                                selectedOrder.status === st
                                  ? 'bg-red-600 text-white border-red-500'
                                  : 'bg-[#090708] text-zinc-300 border-[#2C181D] hover:border-red-500/50'
                              }`}
                            >
                              {st}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. PRODUCTS TAB */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold text-white">
                      Store Products & Stock Inventory
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Add, edit, or replace product images, kit previews, prices, stock, and Markdown descriptions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openProductEditor()}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Product</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      className="p-4 rounded-xl bg-[#090708] border border-[#2C181D] flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <SmartImage
                          src={prod.productImageUrl || prod.kitPreviewImageUrl || prod.customLogoUrl}
                          alt={prod.name}
                          fallbackTitle={prod.name}
                          fallbackEmoji={prod.emojiIcon}
                          className="w-16 h-16 rounded-xl bg-[#120C0E] border border-[#2C181D] shrink-0"
                          imgClassName="w-full h-full object-cover rounded-xl"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-zinc-500">
                              {prod.productCode}
                            </span>
                            {!prod.visible && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                Hidden
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-extrabold text-white truncate">
                            {prod.name}
                          </h3>
                          <div className="flex flex-wrap items-baseline gap-2 mt-1">
                            <span className="text-xs font-mono font-bold text-red-400">
                              {formatUsdPkr(prod.salePrice ?? prod.price)}
                            </span>
                            {prod.salePrice !== null && (
                              <span className="text-[11px] font-mono text-zinc-500 line-through">
                                {formatUsdPkr(prod.price)}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-400 block mt-1">
                            Stock:{' '}
                            {prod.stockType === 'unlimited'
                              ? 'Unlimited'
                              : `${prod.stockQuantity ?? 0} remaining`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#2C181D]">
                        <button
                          type="button"
                          onClick={() => openProductEditor(prod)}
                          className="px-3 py-1.5 rounded-lg bg-[#160E11] hover:bg-[#221519] text-xs font-bold text-white border border-[#2C181D] flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-red-400" />
                          <span>Edit / Images</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-1.5 rounded-lg bg-[#160E11] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-[#2C181D] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Editor Modal */}
              {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 overflow-y-auto">
                  <form
                    onSubmit={handleSaveProduct}
                    className="bg-[#120C0E] border border-[#2C181D] rounded-2xl max-w-4xl w-full p-6 space-y-6 my-auto max-h-[92vh] overflow-y-auto"
                  >
                    <div className="flex items-center justify-between border-b border-[#2C181D] pb-4">
                      <h3 className="text-lg font-extrabold text-white">
                        {editingProduct.id
                          ? `Edit Product: ${editingProduct.name}`
                          : 'Create New Product'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="p-1.5 rounded-lg bg-[#181013] text-zinc-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Product Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={editingProduct.name || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, name: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Product Code (ID)
                        </label>
                        <input
                          type="text"
                          required
                          value={editingProduct.productCode || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              productCode: e.target.value.toUpperCase(),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Section / Category
                        </label>
                        <select
                          value={editingProduct.sectionId || sections[0]?.id}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              sectionId: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        >
                          {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Base Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editingProduct.price ?? 0}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Sale Price ($ Optional)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingProduct.salePrice ?? ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              salePrice:
                                e.target.value === '' ? null : parseFloat(e.target.value),
                            })
                          }
                          placeholder="Leave empty for none"
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Stock Mode
                        </label>
                        <select
                          value={editingProduct.stockType || 'unlimited'}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              stockType: e.target.value as 'unlimited' | 'limited',
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        >
                          <option value="unlimited">Unlimited Stock</option>
                          <option value="limited">Limited Stock</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Stock Quantity
                        </label>
                        <input
                          type="number"
                          disabled={editingProduct.stockType !== 'limited'}
                          value={editingProduct.stockQuantity ?? ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              stockQuantity:
                                e.target.value === '' ? null : parseInt(e.target.value, 10),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white disabled:opacity-40"
                        />
                      </div>
                    </div>

                    {/* Dedicated Image Management Controls */}
                    <div className="space-y-3 pt-2 border-t border-[#2C181D]">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                        Product & Kit Images (Upload, Replace, Paste URL, or Remove)
                      </h4>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <ImageFieldControl
                          label="1. Main Card Image"
                          value={editingProduct.productImageUrl || ''}
                          onChange={(newUrl: string) =>
                            setEditingProduct({ ...editingProduct, productImageUrl: newUrl })
                          }
                          onUploadFile={(file) => handleUploadImageFile(file, 'product')}
                          mediaAssets={mediaAssets}
                          aspectClass="h-20 w-20"
                          fallbackEmoji={editingProduct.emojiIcon || '⚔️'}
                        />

                        <ImageFieldControl
                          label="2. Kit Preview Image"
                          value={editingProduct.kitPreviewImageUrl || ''}
                          onChange={(newUrl: string) =>
                            setEditingProduct({ ...editingProduct, kitPreviewImageUrl: newUrl })
                          }
                          onUploadFile={(file) => handleUploadImageFile(file, 'product')}
                          mediaAssets={mediaAssets}
                          aspectClass="h-20 w-28"
                          fallbackEmoji={editingProduct.emojiIcon || '🛡️'}
                        />

                        <ImageFieldControl
                          label="3. Custom Badge Icon"
                          value={editingProduct.customLogoUrl || ''}
                          onChange={(newUrl: string) =>
                            setEditingProduct({ ...editingProduct, customLogoUrl: newUrl })
                          }
                          onUploadFile={(file) => handleUploadImageFile(file, 'product')}
                          mediaAssets={mediaAssets}
                          aspectClass="h-16 w-16"
                          fallbackEmoji={editingProduct.emojiIcon || '👑'}
                        />
                      </div>
                    </div>

                    {/* Visual Badges & Colors */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Fallback Emoji
                        </label>
                        <input
                          type="text"
                          value={editingProduct.emojiIcon || '⚔️'}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, emojiIcon: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Rarity Tier
                        </label>
                        <input
                          type="text"
                          value={editingProduct.rarityTier || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, rarityTier: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Custom Badge
                        </label>
                        <input
                          type="text"
                          value={editingProduct.customBadge || ''}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, customBadge: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Card Accent Color
                        </label>
                        <input
                          type="color"
                          value={editingProduct.cardAccentColor || '#EF4444'}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              cardAccentColor: e.target.value,
                            })
                          }
                          className="w-full h-9 rounded-lg bg-[#090708] border border-[#2C181D] cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Button Color
                        </label>
                        <input
                          type="color"
                          value={editingProduct.buttonColor || '#DC2626'}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              buttonColor: e.target.value,
                            })
                          }
                          className="w-full h-9 rounded-lg bg-[#090708] border border-[#2C181D] cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Duration & Protection Highlights (Displayed in Product Detail Modal) */}
                    <div className="p-4 rounded-xl bg-[#090708] border border-red-500/30 space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                        Package Duration & Protection Badges (Shown in More Info Modal)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-zinc-300 mb-1">
                            Duration (e.g., Permanent (Lifetime), 30 Days, Season 2)
                          </label>
                          <input
                            type="text"
                            value={editingProduct.duration ?? 'Permanent (Lifetime)'}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                duration: e.target.value,
                              })
                            }
                            placeholder="Permanent (Lifetime)"
                            className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] focus:border-red-500 text-xs text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-300 mb-1">
                            Protection (e.g., Verified Delivery, Instant Auto-Claim)
                          </label>
                          <input
                            type="text"
                            value={editingProduct.protection ?? 'Verified Delivery'}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                protection: e.target.value,
                              })
                            }
                            placeholder="Verified Delivery"
                            className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] focus:border-red-500 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1">
                        Short Summary Description
                      </label>
                      <input
                        type="text"
                        required
                        value={editingProduct.shortDescription || ''}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            shortDescription: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                      />
                    </div>

                    {/* Live Markdown Editor */}
                    <MarkdownEditorWithPreview
                      label="Detailed Description (Safe Markdown with Live Preview)"
                      value={editingProduct.markdownDescription || ''}
                      onChange={(val) =>
                        setEditingProduct({
                          ...editingProduct,
                          markdownDescription: val,
                        })
                      }
                    />

                    {/* Structured Info Blocks */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          What You Get (One item per line)
                        </label>
                        <textarea
                          rows={3}
                          value={whatYouGetText}
                          onChange={(e) => setWhatYouGetText(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Commands & Perks (One per line)
                        </label>
                        <textarea
                          rows={3}
                          value={commandsText}
                          onChange={(e) => setCommandsText(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Requirements (One per line)
                        </label>
                        <textarea
                          rows={2}
                          value={requirementsText}
                          onChange={(e) => setRequirementsText(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Important Notes
                        </label>
                        <textarea
                          rows={2}
                          value={importantNotesText}
                          onChange={(e) => setImportantNotesText(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Delivery Information
                        </label>
                        <input
                          type="text"
                          value={editingProduct.deliveryInfo || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              deliveryInfo: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Package Terms
                        </label>
                        <input
                          type="text"
                          value={editingProduct.productTerms || ''}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              productTerms: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                      <div>
                        <label className="block text-xs font-bold text-zinc-300 mb-1">
                          Tags (comma separated)
                        </label>
                        <input
                          type="text"
                          value={tagsText}
                          onChange={(e) => setTagsText(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold text-zinc-200 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={Boolean(editingProduct.featured)}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              featured: e.target.checked,
                            })
                          }
                        />
                        <span>Feature on Storefront</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-bold text-zinc-200 cursor-pointer pt-4">
                        <input
                          type="checkbox"
                          checked={editingProduct.visible !== false}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              visible: e.target.checked,
                            })
                          }
                        />
                        <span>Visible on Public Store</span>
                      </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[#2C181D]">
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="px-4 py-2 rounded-xl bg-[#181013] text-xs font-bold text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-extrabold text-white cursor-pointer"
                      >
                        Save Product
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 5. SECTIONS TAB */}
          {activeTab === 'sections' && (
            <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    Store Sections & Categories
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Reorder, customize banners, hide/show, or add new product sections.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingSection({
                      name: '',
                      slug: '',
                      description: '',
                      icon: '👑',
                      accentColor: '#EF4444',
                      bannerUrl: '',
                      displayOrder: sections.length + 1,
                      visible: true,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Section</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {sections.map((sec, idx) => (
                  <div
                    key={sec.id}
                    className="p-4 rounded-xl bg-[#090708] border border-[#2C181D] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      {sec.bannerUrl ? (
                        <SmartImage
                          src={sec.bannerUrl}
                          alt={sec.name}
                          fallbackEmoji={sec.icon}
                          className="w-12 h-10 rounded-lg border border-[#2C181D] shrink-0"
                          imgClassName="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border"
                          style={{
                            backgroundColor: `${sec.accentColor}15`,
                            borderColor: `${sec.accentColor}40`,
                          }}
                        >
                          {sec.icon}
                        </span>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{sec.name}</h4>
                          <span className="text-[11px] font-mono text-zinc-500">/{sec.slug}</span>
                          {!sec.visible && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              Hidden
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">{sec.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, -1)}
                        className="p-1.5 rounded-lg bg-[#160E11] text-zinc-400 hover:text-white border border-[#2C181D] cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSection(idx, 1)}
                        className="p-1.5 rounded-lg bg-[#160E11] text-zinc-400 hover:text-white border border-[#2C181D] cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSection({ ...sec })}
                        className="px-3 py-1.5 rounded-lg bg-[#160E11] text-xs font-bold text-white border border-[#2C181D] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(sec.id)}
                        className="p-1.5 rounded-lg bg-[#160E11] text-zinc-400 hover:text-red-400 border border-[#2C181D] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {editingSection && (
                <form
                  onSubmit={handleSaveSection}
                  className="p-5 rounded-xl bg-[#090708] border border-red-500/40 space-y-4 mt-4"
                >
                  <h4 className="text-sm font-extrabold text-red-400">
                    {editingSection.id ? 'Edit Section' : 'New Section'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Section Name"
                      value={editingSection.name || ''}
                      onChange={(e) =>
                        setEditingSection({ ...editingSection, name: e.target.value })
                      }
                      className="px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="slug-name"
                      value={editingSection.slug || ''}
                      onChange={(e) =>
                        setEditingSection({ ...editingSection, slug: e.target.value })
                      }
                      className="px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs font-mono text-white"
                    />
                    <input
                      type="text"
                      placeholder="Emoji / Icon"
                      value={editingSection.icon || ''}
                      onChange={(e) =>
                        setEditingSection({ ...editingSection, icon: e.target.value })
                      }
                      className="px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                    />
                    <input
                      type="color"
                      value={editingSection.accentColor || '#EF4444'}
                      onChange={(e) =>
                        setEditingSection({ ...editingSection, accentColor: e.target.value })
                      }
                      className="w-full h-9 rounded-lg bg-[#120C0E] border border-[#2C181D]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Section short description"
                    value={editingSection.description || ''}
                    onChange={(e) =>
                      setEditingSection({ ...editingSection, description: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                  />

                  <ImageFieldControl
                    label="Section Banner Image (Optional)"
                    helpText="Upload, replace, or remove the banner image for this section."
                    value={editingSection.bannerUrl || ''}
                    onChange={(newUrl: string) =>
                      setEditingSection({ ...editingSection, bannerUrl: newUrl })
                    }
                    onUploadFile={(file) => handleUploadImageFile(file, 'section')}
                    mediaAssets={mediaAssets}
                    fallbackEmoji={editingSection.icon || '👑'}
                  />

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={editingSection.visible !== false}
                        onChange={(e) =>
                          setEditingSection({ ...editingSection, visible: e.target.checked })
                        }
                      />
                      <span>Visible on Storefront</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSection(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#181013] text-xs text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-red-600 text-xs font-bold text-white cursor-pointer"
                      >
                        Save Section
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 6. SALES TAB */}
          {activeTab === 'sales' && (
            <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Active Sales & Discounts</h2>
                  <p className="text-xs text-zinc-400">
                    Configure store-wide, section-specific, or product-specific discount events.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingSale({
                      title: '',
                      description: '',
                      discountType: 'percentage',
                      discountValue: 20,
                      targetScope: 'store',
                      targetSectionId: null,
                      targetProductId: null,
                      badgeText: 'LIMITED SALE',
                      showCountdown: true,
                      enabled: true,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Sale Event</span>
                </button>
              </div>

              <div className="space-y-3">
                {sales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 rounded-xl bg-[#090708] border border-[#2C181D] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-white">{sale.title}</span>
                        <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-xs font-mono font-bold">
                          {sale.discountType === 'percentage'
                            ? `${sale.discountValue}% OFF`
                            : `$${sale.discountValue} OFF`}
                        </span>
                        <span className="text-xs text-zinc-500 uppercase font-mono">
                          Scope: {sale.targetScope}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSale({ ...sale })}
                        className="px-3 py-1.5 rounded-lg bg-[#160E11] text-xs font-bold text-white border border-[#2C181D] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSale(sale.id)}
                        className="p-1.5 rounded-lg bg-[#160E11] text-zinc-400 hover:text-red-400 border border-[#2C181D] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {editingSale && (
                <form
                  onSubmit={handleSaveSale}
                  className="p-5 rounded-xl bg-[#090708] border border-red-500/40 space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Sale Campaign Title"
                      value={editingSale.title || ''}
                      onChange={(e) => setEditingSale({ ...editingSale, title: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                    />
                    <select
                      value={editingSale.discountType || 'percentage'}
                      onChange={(e) =>
                        setEditingSale({
                          ...editingSale,
                          discountType: e.target.value as 'percentage' | 'fixed',
                        })
                      }
                      className="px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Value"
                      value={editingSale.discountValue ?? 15}
                      onChange={(e) =>
                        setEditingSale({
                          ...editingSale,
                          discountValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs font-mono text-white"
                    />
                    <select
                      value={editingSale.targetScope || 'store'}
                      onChange={(e) =>
                        setEditingSale({
                          ...editingSale,
                          targetScope: e.target.value as 'store' | 'section' | 'product',
                        })
                      }
                      className="px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                    >
                      <option value="store">Entire Store</option>
                      <option value="section">Specific Section</option>
                      <option value="product">Specific Product</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={editingSale.enabled !== false}
                        onChange={(e) =>
                          setEditingSale({ ...editingSale, enabled: e.target.checked })
                        }
                      />
                      <span>Sale Enabled</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSale(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#181013] text-xs text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-red-600 text-xs font-bold text-white cursor-pointer"
                      >
                        Save Sale
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 7. PROMO CODES TAB */}
          {activeTab === 'promos' && (
            <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Promo & Creator Codes</h2>
                  <p className="text-xs text-zinc-400">
                    Manage checkout discount codes like MAK20, usage limits, and minimum cart rules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingPromo({
                      code: '',
                      description: '',
                      discountType: 'percentage',
                      discountValue: 20,
                      targetScope: 'store',
                      minOrderAmount: 0,
                      maxDiscountAmount: 50,
                      maxTotalUses: 500,
                      perCustomerLimit: 3,
                      stackWithSales: true,
                      enabled: true,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Promo Code</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {promoCodes.map((promo) => (
                  <div
                    key={promo.id}
                    className="p-4 rounded-xl bg-[#090708] border border-[#2C181D] flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-extrabold text-red-400">
                          {promo.code}
                        </span>
                        <span className="text-xs text-white font-bold">
                          {promo.discountType === 'percentage'
                            ? `${promo.discountValue}% OFF`
                            : `$${promo.discountValue} OFF`}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400 block mt-1">
                        Uses: {promo.currentUses} / {promo.maxTotalUses ?? '∞'} • Min Order: $
                        {promo.minOrderAmount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPromo({ ...promo })}
                        className="px-3 py-1.5 rounded-lg bg-[#160E11] text-xs font-bold text-white border border-[#2C181D] cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(promo.id)}
                        className="p-1.5 rounded-lg bg-[#160E11] text-zinc-400 hover:text-red-400 border border-[#2C181D] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {editingPromo && (
                <form
                  onSubmit={handleSavePromo}
                  className="p-5 rounded-xl bg-[#090708] border border-red-500/40 space-y-4"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Promo Code</label>
                      <input
                        type="text"
                        required
                        placeholder="MAK20"
                        value={editingPromo.code || ''}
                        onChange={(e) =>
                          setEditingPromo({
                            ...editingPromo,
                            code: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Type</label>
                      <select
                        value={editingPromo.discountType || 'percentage'}
                        onChange={(e) =>
                          setEditingPromo({
                            ...editingPromo,
                            discountType: e.target.value as 'percentage' | 'fixed',
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Value</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingPromo.discountValue ?? 20}
                        onChange={(e) =>
                          setEditingPromo({
                            ...editingPromo,
                            discountValue: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Min Order ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingPromo.minOrderAmount ?? 0}
                        onChange={(e) =>
                          setEditingPromo({
                            ...editingPromo,
                            minOrderAmount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={editingPromo.stackWithSales !== false}
                          onChange={(e) =>
                            setEditingPromo({
                              ...editingPromo,
                              stackWithSales: e.target.checked,
                            })
                          }
                        />
                        <span>Stack with Active Sales</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={editingPromo.enabled !== false}
                          onChange={(e) =>
                            setEditingPromo({ ...editingPromo, enabled: e.target.checked })
                          }
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPromo(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#181013] text-xs text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-red-600 text-xs font-bold text-white cursor-pointer"
                      >
                        Save Code
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 8. THEME & STORE SETTINGS TAB */}
          {activeTab === 'theme' && settings && (
            <form
              onSubmit={(e) => handleSaveStoreSettings(e)}
              className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-7"
            >
              <div className="flex items-center justify-between border-b border-[#2C181D] pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    Brand Images, Red Theme & Server Settings
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Customize your store logo, hero banner image, server status, promo bar, and dark red gaming theme.
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-lg shadow-red-950/50"
                >
                  Save All Settings
                </button>
              </div>

              {/* Store Logo, Browser Tab Icon & Hero Banner Image Replacement */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                  1. Store Logo, Browser Tab Icon (Favicon) & Hero Banner
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <ImageFieldControl
                    label="Store Brand Logo"
                    helpText="Displayed in the hero card and branding."
                    value={settings.logoUrl || ''}
                    onChange={(newUrl: string) => setSettings({ ...settings, logoUrl: newUrl })}
                    onUploadFile={(file) => handleUploadImageFile(file, 'branding')}
                    mediaAssets={mediaAssets}
                    aspectClass="w-16 h-16"
                    fallbackEmoji="🛡️"
                  />

                  <ImageFieldControl
                    label="Browser Tab Icon (Favicon)"
                    helpText="Icon shown in the browser tab bar. Defaults to your Minecraft title logo (/favicon.png)."
                    value={settings.faviconUrl || '/favicon.png'}
                    onChange={(newUrl: string) =>
                      setSettings({ ...settings, faviconUrl: newUrl || '/favicon.png' })
                    }
                    onUploadFile={(file) => handleUploadImageFile(file, 'branding')}
                    mediaAssets={mediaAssets}
                    aspectClass="w-16 h-16"
                    fallbackEmoji="🌐"
                  />

                  <ImageFieldControl
                    label="Hero Section Background Banner"
                    helpText="Displayed behind the homepage hero section."
                    value={settings.heroConfig?.bannerImage || ''}
                    onChange={(newUrl: string) =>
                      setSettings({
                        ...settings,
                        heroConfig: { ...settings.heroConfig, bannerImage: newUrl },
                      })
                    }
                    onUploadFile={(file) => handleUploadImageFile(file, 'branding')}
                    mediaAssets={mediaAssets}
                    aspectClass="w-28 h-16"
                    fallbackEmoji="🌋"
                  />
                </div>
              </div>

              {/* Server & Brand Identity */}
              <div className="space-y-4 pt-3 border-t border-[#2C181D]">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                  2. Hero Banner Text, Season Badge & Server Identity
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Hero Top Badge / Season Title (Kicker)
                    </label>
                    <input
                      type="text"
                      value={settings.heroConfig?.kicker || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          heroConfig: { ...settings.heroConfig, kicker: e.target.value },
                        })
                      }
                      placeholder="OwnVerse Network • Season 2"
                      className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Hero Main Headline
                    </label>
                    <input
                      type="text"
                      value={settings.heroConfig?.title || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          heroConfig: { ...settings.heroConfig, title: e.target.value },
                        })
                      }
                      placeholder="Forge Your Dominion Across the OwnVerse Realm"
                      className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Hero Subtitle Description
                    </label>
                    <textarea
                      rows={2}
                      value={settings.heroConfig?.subtitle || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          heroConfig: { ...settings.heroConfig, subtitle: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">Store Name</label>
                    <input
                      type="text"
                      value={settings.storeName}
                      onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">Server IP</label>
                    <input
                      type="text"
                      value={settings.serverIp}
                      onChange={(e) => setSettings({ ...settings, serverIp: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Discord Invite Link
                    </label>
                    <input
                      type="text"
                      value={settings.discordInviteUrl}
                      onChange={(e) =>
                        setSettings({ ...settings, discordInviteUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Theme Colors */}
              <div className="space-y-3 pt-3 border-t border-[#2C181D]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                    3. Theme Colors & Visuals
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        themeConfig: {
                          ...settings.themeConfig,
                          bgPrimary: '#090708',
                          bgSecondary: '#120C0E',
                          bgCard: '#181013',
                          accentPrimary: '#EF4444',
                          accentSecondary: '#F59E0B',
                          buttonColor: '#DC2626',
                          borderColor: '#2C1A1E',
                        },
                      })
                    }
                    className="px-3 py-1 rounded-lg bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-[11px] font-bold text-red-400 cursor-pointer"
                  >
                    Reset to Crimson Red Preset
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Primary Background</label>
                    <input
                      type="color"
                      value={settings.themeConfig.bgPrimary}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          themeConfig: { ...settings.themeConfig, bgPrimary: e.target.value },
                        })
                      }
                      className="w-full h-9 rounded-lg bg-[#090708] border border-[#2C181D] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Card Background</label>
                    <input
                      type="color"
                      value={settings.themeConfig.bgCard}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          themeConfig: { ...settings.themeConfig, bgCard: e.target.value },
                        })
                      }
                      className="w-full h-9 rounded-lg bg-[#090708] border border-[#2C181D] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Primary Accent</label>
                    <input
                      type="color"
                      value={settings.themeConfig.accentPrimary}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          themeConfig: {
                            ...settings.themeConfig,
                            accentPrimary: e.target.value,
                          },
                        })
                      }
                      className="w-full h-9 rounded-lg bg-[#090708] border border-[#2C181D] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Button Color</label>
                    <input
                      type="color"
                      value={settings.themeConfig.buttonColor}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          themeConfig: { ...settings.themeConfig, buttonColor: e.target.value },
                        })
                      }
                      className="w-full h-9 rounded-lg bg-[#090708] border border-[#2C181D] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Border Color</label>
                    <input
                      type="color"
                      value={settings.themeConfig.borderColor}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          themeConfig: { ...settings.themeConfig, borderColor: e.target.value },
                        })
                      }
                      className="w-full h-9 rounded-lg bg-[#090708] border border-[#2C181D] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Promo Banner */}
              <div className="space-y-3 pt-3 border-t border-[#2C181D]">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-red-400">
                  4. Homepage Promo Announcement Banner
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="Banner Title"
                    value={settings.promoBannerConfig.title}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        promoBannerConfig: {
                          ...settings.promoBannerConfig,
                          title: e.target.value,
                        },
                      })
                    }
                    className="px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Banner Message"
                    value={settings.promoBannerConfig.text}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        promoBannerConfig: {
                          ...settings.promoBannerConfig,
                          text: e.target.value,
                        },
                      })
                    }
                    className="px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Promo Code to Copy"
                    value={settings.promoBannerConfig.code}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        promoBannerConfig: {
                          ...settings.promoBannerConfig,
                          code: e.target.value.toUpperCase(),
                        },
                      })
                    }
                    className="px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                  />
                </div>
              </div>
            </form>
          )}

          {/* 8B. STORE ADS (4 SPACES) TAB */}
          {activeTab === 'ads' && settings && (
            <form
              onSubmit={(e) => handleSaveStoreSettings(e)}
              className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2C181D] pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-red-500" />
                    <span>Store Ad Banners & Placements (4 Customizable Spaces)</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Enable or disable ads across the entire store. When enabled, visitors see your custom ad banners and clicking any ad opens its target URL in a new browser tab. When disabled, every ad space in the store is completely hidden.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-lg shadow-red-950/50"
                >
                  {savingSettings ? 'Saving Ads...' : 'Save All Ad Spaces'}
                </button>
              </div>

              {/* Master Global Enable / Disable Switch */}
              <div
                className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  settings.adsConfig?.enabled
                    ? 'bg-red-500/10 border-red-500/40'
                    : 'bg-[#090708] border-[#2C181D]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        settings.adsConfig?.enabled ? 'bg-red-500' : 'bg-zinc-600'
                      }`}
                    />
                    <span className="text-sm font-extrabold text-white uppercase tracking-wide">
                      Master Store Ads Status:{' '}
                      <span
                        className={
                          settings.adsConfig?.enabled ? 'text-red-400' : 'text-zinc-400'
                        }
                      >
                        {settings.adsConfig?.enabled
                          ? 'ENABLED (Visible to All Store Visitors)'
                          : 'DISABLED (Every Ad Hidden in Store)'}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    {settings.adsConfig?.enabled
                      ? 'Store visitors can currently see all enabled ad spaces below. Clicking any ad banner opens its URL in a new tab.'
                      : 'All 4 ad spaces are currently hidden across the entire storefront. Toggle on to display your ads to visitors.'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={async () => {
                      const nextEnabled = !settings.adsConfig?.enabled;
                      const updatedAds = {
                        ...(settings.adsConfig || { slots: [] }),
                        enabled: nextEnabled,
                      };
                      const nextSettings = {
                        ...settings,
                        adsConfig: updatedAds,
                      };
                      setSettings(nextSettings);
                      setSavingSettings(true);
                      try {
                        const res = await adminFetch('/api/admin/settings', {
                          method: 'PUT',
                          body: JSON.stringify(nextSettings),
                        });
                        if (res.ok) {
                          showNotice(
                            'success',
                            nextEnabled
                              ? 'Store Ads ENABLED! Visitors now see your active ad banners.'
                              : 'Store Ads DISABLED! Every ad in the store is now hidden.'
                          );
                          await fetchFullAdminState(undefined, true);
                          onStoreUpdated?.();
                        }
                      } finally {
                        setSavingSettings(false);
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border transition-all cursor-pointer ${
                      settings.adsConfig?.enabled
                        ? 'bg-[#181013] hover:bg-red-950/50 text-red-300 border-red-500/40'
                        : 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-lg shadow-red-950/50'
                    }`}
                  >
                    {settings.adsConfig?.enabled
                      ? 'Disable & Hide All Store Ads'
                      : 'Enable Store Ads Now'}
                  </button>
                </div>
              </div>

              {/* 4 Customizable Store Ad Space Cards */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {(settings.adsConfig?.slots || []).map((slot, idx) => {
                  const updateSlot = (patch: Partial<typeof slot>) => {
                    const currentSlots = [...(settings.adsConfig?.slots || [])];
                    currentSlots[idx] = { ...slot, ...patch };
                    setSettings({
                      ...settings,
                      adsConfig: {
                        ...(settings.adsConfig || { enabled: true }),
                        slots: currentSlots,
                      },
                    });
                  };

                  return (
                    <div
                      key={slot.id || idx}
                      className={`p-5 rounded-xl bg-[#090708] border space-y-4 flex flex-col justify-between ${
                        slot.enabled && settings.adsConfig?.enabled
                          ? 'border-red-500/35'
                          : 'border-[#2C181D] opacity-80'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 border-b border-[#2C181D] pb-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 block">
                              Store Ad Slot #{slot.slotNumber}
                            </span>
                            <h3 className="text-sm font-extrabold text-white">
                              {slot.placementLabel}
                            </h3>
                          </div>

                          <label className="flex items-center gap-2 text-xs font-bold text-zinc-200 cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={Boolean(slot.enabled)}
                              onChange={(e) => updateSlot({ enabled: e.target.checked })}
                            />
                            <span>{slot.enabled ? 'Slot Active' : 'Slot Hidden'}</span>
                          </label>
                        </div>

                        {/* Ad Banner Image Upload / URL / Media Vault Picker */}
                        <ImageFieldControl
                          label={`Ad Space #${slot.slotNumber} Banner Image`}
                          helpText="Upload your custom ad banner image (recommended wide banner 1200x260 or 16:5) or paste an image URL."
                          value={slot.imageUrl || ''}
                          onChange={(newUrl: string) => updateSlot({ imageUrl: newUrl })}
                          onUploadFile={(file) =>
                            handleUploadImageFile(file, `ad_slot_${slot.slotNumber}`)
                          }
                          mediaAssets={mediaAssets}
                          aspectClass="w-32 h-16"
                          fallbackEmoji="📢"
                        />

                        {/* Target Click URL (Opens in New Tab) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-zinc-300">
                              Click Destination URL (Opens in New Tab) *
                            </label>
                            {slot.targetUrl && (
                              <a
                                href={
                                  slot.targetUrl.startsWith('http://') ||
                                  slot.targetUrl.startsWith('https://')
                                    ? slot.targetUrl
                                    : `https://${slot.targetUrl}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-mono text-red-400 hover:underline flex items-center gap-1"
                              >
                                <span>Test Link</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <input
                            type="text"
                            value={slot.targetUrl || ''}
                            onChange={(e) => updateSlot({ targetUrl: e.target.value })}
                            placeholder="https://discord.gg/ownverse or https://your-partner-link.com"
                            className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] focus:border-red-500 text-xs font-mono text-white outline-none"
                          />
                        </div>

                        {/* Ad Title, Badge & Subtitle */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                              Ad Headline / Title (Optional)
                            </label>
                            <input
                              type="text"
                              value={slot.title || ''}
                              onChange={(e) => updateSlot({ title: e.target.value })}
                              placeholder="e.g. Join the Official OwnVerse Discord"
                              className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] focus:border-red-500 text-xs text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                              Corner Badge Label
                            </label>
                            <input
                              type="text"
                              value={slot.badgeText || ''}
                              onChange={(e) => updateSlot({ badgeText: e.target.value })}
                              placeholder="SPONSORED"
                              className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] focus:border-red-500 text-xs font-mono text-white outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                            Ad Subtitle / Call-to-Action Caption (Optional)
                          </label>
                          <input
                            type="text"
                            value={slot.subtitle || ''}
                            onChange={(e) => updateSlot({ subtitle: e.target.value })}
                            placeholder="Short description shown under the banner..."
                            className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] focus:border-red-500 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </form>
          )}

          {/* 9. PAYMENTS TAB */}
          {activeTab === 'payments' && settings && (
            <form
              onSubmit={(e) => handleSaveStoreSettings(e)}
              className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2C181D] pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    Configurable Payment Methods (Account Number or QR Code)
                  </h2>
                  <p className="text-xs text-zinc-400">
                    For each payment method, choose whether to show an <strong className="text-zinc-200">Account Number</strong> or a <strong className="text-zinc-200">QR Code</strong> (or both), and manage your separate QR Code Payment methods.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const nextId = `qr_${Date.now().toString(36)}`;
                      setSettings({
                        ...settings,
                        paymentMethodsConfig: [
                          ...settings.paymentMethodsConfig,
                          {
                            id: nextId,
                            name: 'QR Code Payment',
                            enabled: true,
                            paymentType: 'qr',
                            accountTitle: 'OwnVerse QR Scan & Pay',
                            accountNumber: '',
                            qrCodeUrl: '',
                            instructions:
                              'Scan the QR code above using your mobile wallet or banking app, then enter your Transaction Reference ID below.',
                            requiresReceipt: true,
                            badgeText: 'Scan & Pay QR',
                            feePercent: 0,
                          },
                        ],
                      });
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-[#181013] hover:bg-[#23151A] border border-red-500/40 text-red-300 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-red-400" />
                    <span>Add Separate QR Method</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const nextId = `method_${Date.now().toString(36)}`;
                      setSettings({
                        ...settings,
                        paymentMethodsConfig: [
                          ...settings.paymentMethodsConfig,
                          {
                            id: nextId,
                            name: 'New Wallet / Bank',
                            enabled: true,
                            paymentType: 'number',
                            accountTitle: 'OwnVerse Digital Network',
                            accountNumber: '0300-0000000',
                            qrCodeUrl: '',
                            instructions:
                              'Transfer the exact order amount and enter your Transaction Reference ID below.',
                            requiresReceipt: false,
                            badgeText: 'Instant Transfer',
                            feePercent: 0,
                          },
                        ],
                      });
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-[#181013] hover:bg-[#23151A] border border-[#2C181D] text-zinc-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Add Number Method</span>
                  </button>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-lg shadow-red-950/50"
                  >
                    {savingSettings ? 'Saving...' : 'Save Payment Methods'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {settings.paymentMethodsConfig.map((pm, idx) => {
                  const mode = pm.paymentType || (pm.id === 'qr_payment' ? 'qr' : 'number');
                  return (
                    <div
                      key={pm.id || idx}
                      className="p-5 rounded-xl bg-[#090708] border border-[#2C181D] space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        {/* Header Row: Editable Name + Enabled + Delete */}
                        <div className="flex items-center justify-between gap-3 border-b border-[#2C181D] pb-3">
                          <div className="flex-1">
                            <label className="block text-[10px] font-mono uppercase text-zinc-500 mb-0.5">
                              Payment Method Name
                            </label>
                            <input
                              type="text"
                              value={pm.name}
                              onChange={(e) => {
                                const updated = [...settings.paymentMethodsConfig];
                                updated[idx] = { ...pm, name: e.target.value };
                                setSettings({ ...settings, paymentMethodsConfig: updated });
                              }}
                              placeholder="e.g. JazzCash, Easypaisa, QR Code Payment"
                              className="w-full px-3 py-1.5 rounded-lg bg-[#120C0E] border border-[#2C181D] focus:border-red-500 text-sm font-extrabold text-white outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-3 pt-3">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pm.enabled}
                                onChange={(e) => {
                                  const updated = [...settings.paymentMethodsConfig];
                                  updated[idx] = { ...pm, enabled: e.target.checked };
                                  setSettings({ ...settings, paymentMethodsConfig: updated });
                                }}
                              />
                              <span>Enabled</span>
                            </label>

                            {settings.paymentMethodsConfig.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = settings.paymentMethodsConfig.filter(
                                    (_, i) => i !== idx
                                  );
                                  setSettings({ ...settings, paymentMethodsConfig: updated });
                                }}
                                className="p-1.5 rounded-lg bg-[#160E11] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-[#2C181D] cursor-pointer"
                                title="Delete Payment Method"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2-Option Selector: Give Number vs Give QR Code (plus Both) */}
                        <div className="space-y-1.5">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-red-400">
                            Select Payment Option (Number or QR Code)
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...settings.paymentMethodsConfig];
                                updated[idx] = { ...pm, paymentType: 'number' };
                                setSettings({ ...settings, paymentMethodsConfig: updated });
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                                mode === 'number'
                                  ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/50'
                                  : 'bg-[#120C0E] text-zinc-400 border-[#2C181D] hover:text-white'
                              }`}
                            >
                              1. Give Number
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...settings.paymentMethodsConfig];
                                updated[idx] = { ...pm, paymentType: 'qr' };
                                setSettings({ ...settings, paymentMethodsConfig: updated });
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                                mode === 'qr'
                                  ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/50'
                                  : 'bg-[#120C0E] text-zinc-400 border-[#2C181D] hover:text-white'
                              }`}
                            >
                              2. Give QR Code
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...settings.paymentMethodsConfig];
                                updated[idx] = { ...pm, paymentType: 'both' };
                                setSettings({ ...settings, paymentMethodsConfig: updated });
                              }}
                              className={`py-2 px-3 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                                mode === 'both'
                                  ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/50'
                                  : 'bg-[#120C0E] text-zinc-400 border-[#2C181D] hover:text-white'
                              }`}
                            >
                              Both (Number + QR)
                            </button>
                          </div>
                        </div>

                        {/* Account Title & Badge */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                              Account Title / Merchant Name
                            </label>
                            <input
                              type="text"
                              placeholder="Account Title"
                              value={pm.accountTitle}
                              onChange={(e) => {
                                const updated = [...settings.paymentMethodsConfig];
                                updated[idx] = { ...pm, accountTitle: e.target.value };
                                setSettings({ ...settings, paymentMethodsConfig: updated });
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                              Subtitle / Badge Label
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Scan & Pay QR / Instant PK Wallet"
                              value={pm.badgeText || ''}
                              onChange={(e) => {
                                const updated = [...settings.paymentMethodsConfig];
                                updated[idx] = { ...pm, badgeText: e.target.value };
                                setSettings({ ...settings, paymentMethodsConfig: updated });
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                            />
                          </div>
                        </div>

                        {/* Conditional Field 1: Account Number (shown when 'number' or 'both') */}
                        {(mode === 'number' || mode === 'both') && (
                          <div>
                            <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                              Account Number / IBAN / Wallet Address
                            </label>
                            <input
                              type="text"
                              placeholder="0301-8492015 / IBAN / Wallet Address"
                              value={pm.accountNumber || ''}
                              onChange={(e) => {
                                const updated = [...settings.paymentMethodsConfig];
                                updated[idx] = { ...pm, accountNumber: e.target.value };
                                setSettings({ ...settings, paymentMethodsConfig: updated });
                              }}
                              className="w-full px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs font-mono text-white"
                            />
                          </div>
                        )}

                        {/* Conditional Field 2: QR Code Image Uploader (shown when 'qr' or 'both') */}
                        {(mode === 'qr' || mode === 'both') && (
                          <ImageFieldControl
                            label="QR Code Image (Upload or Select QR)"
                            helpText="Customers will scan this QR code during checkout."
                            value={pm.qrCodeUrl || ''}
                            onChange={(newUrl: string) => {
                              const updated = [...settings.paymentMethodsConfig];
                              updated[idx] = { ...pm, qrCodeUrl: newUrl };
                              setSettings({ ...settings, paymentMethodsConfig: updated });
                            }}
                            onUploadFile={(file) => handleUploadImageFile(file, 'qr_payment')}
                            mediaAssets={mediaAssets}
                            aspectClass="w-24 h-24"
                            fallbackEmoji="🏁"
                          />
                        )}

                        {/* Instructions & Require Receipt */}
                        <div>
                          <label className="block text-[11px] font-bold text-zinc-300 mb-1">
                            Customer Checkout Instructions
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Checkout instructions shown to the player..."
                            value={pm.instructions}
                            onChange={(e) => {
                              const updated = [...settings.paymentMethodsConfig];
                              updated[idx] = { ...pm, instructions: e.target.value };
                              setSettings({ ...settings, paymentMethodsConfig: updated });
                            }}
                            className="w-full px-3 py-1.5 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs text-white"
                          />
                        </div>

                        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(pm.requiresReceipt)}
                            onChange={(e) => {
                              const updated = [...settings.paymentMethodsConfig];
                              updated[idx] = { ...pm, requiresReceipt: e.target.checked };
                              setSettings({ ...settings, paymentMethodsConfig: updated });
                            }}
                          />
                          <span>Require customer to upload payment receipt screenshot</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </form>
          )}

          {/* 10. POLICIES & FAQ TAB */}
          {activeTab === 'policies' && settings && (
            <form
              onSubmit={(e) => handleSaveStoreSettings(e)}
              className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-[#2C181D] pb-4">
                <h2 className="text-lg font-extrabold text-white">
                  Store Policies, Terms & FAQ Management
                </h2>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                >
                  Save Policies & FAQ
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Terms & Conditions (Markdown)
                  </label>
                  <textarea
                    rows={5}
                    value={settings.policiesConfig.termsAndConditions}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        policiesConfig: {
                          ...settings.policiesConfig,
                          termsAndConditions: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Refund Policy (Markdown)
                  </label>
                  <textarea
                    rows={5}
                    value={settings.policiesConfig.refundPolicy}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        policiesConfig: {
                          ...settings.policiesConfig,
                          refundPolicy: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Delivery Policy (Markdown)
                  </label>
                  <textarea
                    rows={5}
                    value={settings.policiesConfig.deliveryPolicy}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        policiesConfig: {
                          ...settings.policiesConfig,
                          deliveryPolicy: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Privacy Policy (Markdown)
                  </label>
                  <textarea
                    rows={5}
                    value={settings.policiesConfig.privacyPolicy}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        policiesConfig: {
                          ...settings.policiesConfig,
                          privacyPolicy: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                  />
                </div>
              </div>
            </form>
          )}

          {/* 11. SECURITY & BACKUPS TAB */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Dedicated Admin Password Management Card */}
              <form
                onSubmit={handleUpdateAdminPassword}
                className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-500">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      Change Private Administrator Password
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Your password is encrypted with <code className="text-red-400">scrypt</code> in PostgreSQL and never shown on the login screen.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <input
                    type="password"
                    value={currentAdminPassword}
                    onChange={(e) => setCurrentAdminPassword(e.target.value)}
                    placeholder="Current Password (Optional)"
                    className="px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] focus:border-red-500 text-xs font-mono text-white outline-none"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="New Admin Password (min 6 chars)"
                    className="px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] focus:border-red-500 text-xs font-mono text-white outline-none"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    placeholder="Confirm New Admin Password"
                    className="px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] focus:border-red-500 text-xs font-mono text-white outline-none"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-extrabold uppercase tracking-wider text-white cursor-pointer shadow-lg shadow-red-950/50"
                  >
                    Update Admin Password
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Export Store Data & Standalone HTML
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Download a full JSON snapshot of your database or a single self-contained <code className="text-red-400">ownverse-store-standalone.html</code> file with all your current products, sections, and custom settings embedded.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="/api/store/export-html"
                      download="ownverse-store-standalone.html"
                      className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-red-950/50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Store (.HTML)</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="px-4 py-2.5 rounded-xl bg-[#181013] hover:bg-[#23151A] border border-[#2C181D] text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-red-400" />
                      <span>Export JSON Backup</span>
                    </button>
                  </div>
                </div>

                <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Import / Restore Store Data
                  </h3>
                  <textarea
                    rows={3}
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder="Paste exported backup JSON here..."
                    className="w-full px-3 py-2 rounded-xl bg-[#090708] border border-[#2C181D] text-xs font-mono text-white"
                  />
                  {confirmImportModal ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleImportBackup}
                        className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-extrabold cursor-pointer"
                      >
                        Confirm Overwrite & Import
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmImportModal(false)}
                        className="px-3 py-2 rounded-xl bg-[#181013] text-xs text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!importJsonText.trim()}
                      onClick={() => setConfirmImportModal(true)}
                      className="px-5 py-2.5 rounded-xl bg-[#181013] hover:bg-[#23151A] disabled:opacity-40 text-white text-xs font-extrabold uppercase tracking-wider border border-[#2C181D] flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 text-red-400" />
                      <span>Restore from JSON</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
