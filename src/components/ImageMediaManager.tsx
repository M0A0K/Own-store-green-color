import React, { useState } from 'react';
import {
  Upload,
  Trash2,
  Image as ImageIcon,
  Check,
  Copy,
  RefreshCw,
  FolderOpen,
  X,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { SmartImage } from './SmartImage.tsx';
import { StoreProduct, StoreSection, StoreSettings } from '../types/store.ts';

export interface MediaAssetItem {
  id: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  category?: string;
  createdAt: string;
}

interface ImageFieldControlProps {
  label: string;
  value: string;
  onChange: (newUrl: string) => void;
  onUploadFile: (file: File) => Promise<string | null>;
  mediaAssets?: MediaAssetItem[];
  placeholder?: string;
  helpText?: string;
  aspectClass?: string;
  fallbackEmoji?: string;
}

export const ImageFieldControl: React.FC<ImageFieldControlProps> = ({
  label,
  value,
  onChange,
  onUploadFile,
  mediaAssets = [],
  placeholder = 'https://... or /api/media/...',
  helpText,
  aspectClass = 'h-28 w-28',
  fallbackEmoji = '⚔️',
}) => {
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await onUploadFile(file);
      if (url) {
        onChange(url);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-3.5 rounded-lg bg-[#090708] border border-zinc-800/90 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300">
          {label}
        </label>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 transition-colors"
            title="Remove current image"
          >
            <Trash2 className="w-3 h-3" />
            Remove Image
          </button>
        ) : (
          <span className="text-[10px] font-mono text-zinc-500 uppercase">No Custom Image Set</span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5">
        <div
          className={`${aspectClass} rounded-lg overflow-hidden border border-zinc-800 bg-[#120C0E] shrink-0 relative group`}
        >
          <SmartImage
            src={value}
            alt={label}
            fallbackTitle={label}
            fallbackEmoji={fallbackEmoji}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 w-full space-y-2">
          <div className="relative">
            <LinkIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-[#120C0E] border border-zinc-800 text-xs text-white font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold cursor-pointer transition-colors inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Uploading...' : value ? 'Replace File' : 'Upload File'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handleFileSelect}
              />
            </label>

            {mediaAssets.length > 0 && (
              <button
                type="button"
                onClick={() => setPickerOpen(!pickerOpen)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5 text-red-400" />
                <span>{pickerOpen ? 'Close Vault' : 'Choose from Uploaded'}</span>
              </button>
            )}
          </div>

          {helpText && <p className="text-[11px] text-zinc-500 leading-relaxed">{helpText}</p>}
        </div>
      </div>

      {pickerOpen && mediaAssets.length > 0 && (
        <div className="pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Select Uploaded Image ({mediaAssets.length})
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-40 overflow-y-auto p-1">
            {mediaAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => {
                  onChange(asset.url);
                  setPickerOpen(false);
                }}
                className={`group relative aspect-square rounded-md overflow-hidden border transition-all ${
                  value === asset.url
                    ? 'border-red-500 ring-2 ring-red-500/30'
                    : 'border-zinc-800 hover:border-zinc-600'
                }`}
                title={asset.filename}
              >
                <img
                  src={asset.url}
                  alt={asset.filename}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface AdminImageSettingsTabProps {
  settingsForm: StoreSettings;
  setSettingsForm: React.Dispatch<React.SetStateAction<StoreSettings | null>>;
  onSaveSettings: () => Promise<void>;
  products: StoreProduct[];
  sections: StoreSection[];
  mediaAssets: MediaAssetItem[];
  onUploadFile: (file: File) => Promise<string | null>;
  onQuickUpdateProductImages: (
    product: StoreProduct,
    updates: {
      productImageUrl: string;
      kitPreviewImageUrl: string;
      customLogoUrl: string;
    }
  ) => Promise<void>;
  onDeleteMediaAsset: (id: number) => Promise<void>;
  savingSettings: boolean;
}

export const AdminImageSettingsTab: React.FC<AdminImageSettingsTabProps> = ({
  settingsForm,
  setSettingsForm,
  onSaveSettings,
  products,
  mediaAssets,
  onUploadFile,
  onQuickUpdateProductImages,
  onDeleteMediaAsset,
  savingSettings,
}) => {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [savingProductId, setSavingProductId] = useState<number | null>(null);
  const [uploadingVault, setUploadingVault] = useState(false);
  const [productEdits, setProductEdits] = useState<
    Record<
      number,
      {
        productImageUrl: string;
        kitPreviewImageUrl: string;
        customLogoUrl: string;
      }
    >
  >({});

  const getProductDraft = (p: StoreProduct) => {
    return (
      productEdits[p.id] || {
        productImageUrl: p.productImageUrl || '',
        kitPreviewImageUrl: p.kitPreviewImageUrl || '',
        customLogoUrl: p.customLogoUrl || '',
      }
    );
  };

  const updateProductDraft = (
    p: StoreProduct,
    field: 'productImageUrl' | 'kitPreviewImageUrl' | 'customLogoUrl',
    val: string
  ) => {
    const current = getProductDraft(p);
    setProductEdits((prev) => ({
      ...prev,
      [p.id]: {
        ...current,
        [field]: val,
      },
    }));
  };

  const handleSaveProductRow = async (p: StoreProduct) => {
    const draft = getProductDraft(p);
    setSavingProductId(p.id);
    try {
      await onQuickUpdateProductImages(p, draft);
    } finally {
      setSavingProductId(null);
    }
  };

  const handleDirectVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVault(true);
    try {
      await onUploadFile(file);
    } finally {
      setUploadingVault(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Storefront Branding & Hero Images */}
      <div className="p-6 rounded-xl bg-[#140D10] border border-zinc-800/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-red-500" />
              Store Branding & Hero Banner Images
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload your own Store Logo or Hero Background image, paste an external image link, or remove existing images anytime.
            </p>
          </div>
          <button
            type="button"
            onClick={onSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider transition-colors shrink-0"
          >
            {savingSettings ? 'Saving...' : 'Save Branding Images'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ImageFieldControl
            label="Store Logo Image"
            value={settingsForm.logoUrl || ''}
            onChange={(newUrl) =>
              setSettingsForm((prev) => (prev ? { ...prev, logoUrl: newUrl } : prev))
            }
            onUploadFile={onUploadFile}
            mediaAssets={mediaAssets}
            aspectClass="h-24 w-24"
            fallbackEmoji="👑"
            helpText="Displayed in the top navigation bar and footer. Leave empty to use the crimson geometric emblem."
          />

          <ImageFieldControl
            label="Hero Banner Background Image"
            value={settingsForm.heroConfig.bannerImage || ''}
            onChange={(newUrl) =>
              setSettingsForm((prev) =>
                prev
                  ? {
                      ...prev,
                      heroConfig: { ...prev.heroConfig, bannerImage: newUrl },
                    }
                  : prev
              )
            }
            onUploadFile={onUploadFile}
            mediaAssets={mediaAssets}
            aspectClass="h-24 w-40"
            fallbackEmoji="🌋"
            helpText="Displayed behind the homepage hero header. Leave empty for a clean, high-FPS dark crimson gradient."
          />
        </div>
      </div>

      {/* Section 2: Quick Product Image Replacer */}
      <div className="p-6 rounded-xl bg-[#140D10] border border-zinc-800/90 space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            Product Images Manager ({products.length} Products)
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Add, replace, or clear the Card Image, Kit Preview Image, and Custom Badge Icon for any product directly from one screen.
          </p>
        </div>

        <div className="space-y-3">
          {products.map((product) => {
            const draft = getProductDraft(product);
            const isDirty =
              draft.productImageUrl !== (product.productImageUrl || '') ||
              draft.kitPreviewImageUrl !== (product.kitPreviewImageUrl || '') ||
              draft.customLogoUrl !== (product.customLogoUrl || '');

            return (
              <div
                key={product.id}
                className="p-4 rounded-xl bg-[#090708] border border-zinc-800/90 flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/70 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{product.emojiIcon || '⚔️'}</span>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{product.name}</h4>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {product.productCode} • {settingsForm.currencySymbol}
                        {product.price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(draft.productImageUrl || draft.kitPreviewImageUrl || draft.customLogoUrl) && (
                      <button
                        type="button"
                        onClick={() =>
                          setProductEdits((prev) => ({
                            ...prev,
                            [product.id]: {
                              productImageUrl: '',
                              kitPreviewImageUrl: '',
                              customLogoUrl: '',
                            },
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-800 text-xs font-semibold transition-colors"
                      >
                        Clear All 3
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSaveProductRow(product)}
                      disabled={savingProductId === product.id || !isDirty}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all ${
                        isDirty
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-default'
                      }`}
                    >
                      {savingProductId === product.id
                        ? 'Saving...'
                        : isDirty
                        ? 'Save Changes'
                        : 'Saved'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {/* Main Product Card Image */}
                  <ImageFieldControl
                    label="1. Card Image"
                    value={draft.productImageUrl}
                    onChange={(val) => updateProductDraft(product, 'productImageUrl', val)}
                    onUploadFile={onUploadFile}
                    mediaAssets={mediaAssets}
                    aspectClass="h-20 w-20"
                    fallbackEmoji={product.emojiIcon || '⚔️'}
                  />

                  {/* Kit / Item Preview Image */}
                  <ImageFieldControl
                    label="2. Kit / Modal Preview"
                    value={draft.kitPreviewImageUrl}
                    onChange={(val) => updateProductDraft(product, 'kitPreviewImageUrl', val)}
                    onUploadFile={onUploadFile}
                    mediaAssets={mediaAssets}
                    aspectClass="h-20 w-28"
                    fallbackEmoji={product.emojiIcon || '📦'}
                  />

                  {/* Custom Corner Emblem / Logo */}
                  <ImageFieldControl
                    label="3. Corner Badge Icon"
                    value={draft.customLogoUrl}
                    onChange={(val) => updateProductDraft(product, 'customLogoUrl', val)}
                    onUploadFile={onUploadFile}
                    mediaAssets={mediaAssets}
                    aspectClass="h-16 w-16"
                    fallbackEmoji={product.emojiIcon || '🛡️'}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Uploaded Media Vault */}
      <div className="p-6 rounded-xl bg-[#140D10] border border-zinc-800/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-red-500" />
              Uploaded Media Vault ({mediaAssets.length} Files)
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Images uploaded here are automatically compressed for fast loading and stored permanently in PostgreSQL.
            </p>
          </div>

          <label className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer transition-colors inline-flex items-center gap-2 shrink-0">
            <Upload className="w-4 h-4" />
            <span>{uploadingVault ? 'Uploading...' : 'Upload New Image'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingVault}
              onChange={handleDirectVaultUpload}
            />
          </label>
        </div>

        {mediaAssets.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#090708] border border-zinc-800/80 text-center text-zinc-500 text-sm">
            No custom images uploaded yet. Click "Upload New Image" above or upload directly inside any product or branding field.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {mediaAssets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-xl bg-[#090708] border border-zinc-800 overflow-hidden flex flex-col group"
              >
                <div className="aspect-square bg-[#120C0E] relative overflow-hidden">
                  <img
                    src={asset.url}
                    alt={asset.filename}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2.5 flex flex-col gap-2">
                  <div className="truncate text-[11px] font-semibold text-zinc-300" title={asset.filename}>
                    {asset.filename}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(asset.url);
                        setCopiedId(asset.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="flex-1 py-1 px-2 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-bold inline-flex items-center justify-center gap-1 border border-zinc-800"
                    >
                      {copiedId === asset.id ? (
                        <>
                          <Check className="w-3 h-3 text-red-400" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy URL
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMediaAsset(asset.id)}
                      className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20"
                      title="Delete image from database"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
