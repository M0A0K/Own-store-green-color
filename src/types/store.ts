export interface ThemeConfig {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  textPrimary: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  buttonColor: string;
  borderColor: string;
  cardRadius: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  spacingScale: 'compact' | 'comfortable' | 'spacious';
}

export interface HeroConfig {
  kicker: string;
  title: string;
  subtitle: string;
  bannerImage: string;
  primaryCtaText: string;
  secondaryCtaText: string;
  showServerStatus: boolean;
  showFeaturedHighlight: boolean;
}

export interface PromoBannerConfig {
  enabled: boolean;
  title: string;
  text: string;
  code: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  buttonText: string;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  enabled: boolean;
  accountTitle: string;
  accountNumber: string;
  instructions: string;
  requiresReceipt: boolean;
  badgeText: string;
  feePercent: number;
}

export interface PoliciesConfig {
  termsAndConditions: string;
  privacyPolicy: string;
  refundPolicy: string;
  deliveryPolicy: string;
  supportInformation: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  visible: boolean;
}

export interface CustomInfoBlock {
  title: string;
  content: string;
}

export interface StoreSettings {
  id: number;
  storeName: string;
  storeTagline: string;
  logoUrl: string;
  faviconUrl: string;
  serverIp: string;
  serverPort: number;
  serverStatusMode: string;
  manualServerOnline: boolean;
  manualPlayersOnline: number;
  manualPlayersMax: number;
  discordInviteUrl: string;
  supportEmail: string;
  supportDiscord: string;
  supportHours: string;
  currencyCode: string;
  currencySymbol: string;
  themeConfig: ThemeConfig;
  heroConfig: HeroConfig;
  promoBannerConfig: PromoBannerConfig;
  paymentMethodsConfig: PaymentMethodConfig[];
  policiesConfig: PoliciesConfig;
  faqItems: FaqItem[];
}

export interface StoreSection {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  accentColor: string;
  bannerUrl: string | null;
  displayOrder: number;
  visible: boolean;
}

export interface StoreProduct {
  id: number;
  productCode: string;
  slug: string;
  sectionId: number | null;
  name: string;
  price: number;
  salePrice: number | null;
  emojiIcon: string;
  customLogoUrl: string | null;
  productImageUrl: string;
  kitPreviewImageUrl: string;
  shortDescription: string;
  markdownDescription: string;
  rarityTier: string;
  customBadge: string | null;
  badgeColor: string;
  cardAccentColor: string;
  buttonColor: string;
  tags: string[];
  featured: boolean;
  visible: boolean;
  displayOrder: number;
  stockType: 'unlimited' | 'limited';
  stockQuantity: number | null;
  lowStockThreshold: number;
  totalSold: number;
  whatYouGet: string[];
  requirements: string[];
  commandsPerks: string[];
  duration: string;
  deliveryInfo: string;
  importantNotes: string;
  productTerms: string;
  customInfoBlocks: CustomInfoBlock[];
  createdAt?: string;
  updatedAt?: string;
  // Computed by backend pricing engine
  originalPrice: number;
  effectivePrice: number;
  discountAmount: number;
  discountPercent: number;
  isOnSale: boolean;
  appliedSaleBadge: string | null;
  appliedSaleId: number | null;
  appliedSaleEndDate: string | null;
  isOutOfStock: boolean;
  isLowStock: boolean;
}

export interface StoreSale {
  id: number;
  title: string;
  description: string;
  badgeText: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetScope: 'store' | 'section' | 'product';
  targetSectionId: number | null;
  targetProductId: number | null;
  startDate: string | null;
  endDate: string | null;
  showCountdown: boolean;
  enabled: boolean;
}

export interface StorePromoCode {
  id: number;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  targetScope: 'store' | 'section' | 'product';
  targetSectionId: number | null;
  targetProductId: number | null;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  maxTotalUses: number | null;
  currentUses: number;
  perCustomerLimit: number;
  stackWithSales: boolean;
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
}

export interface OrderLineItem {
  productId: number;
  productCode: string;
  slug: string;
  name: string;
  sectionName: string;
  quantity: number;
  unitOriginalPrice: number;
  unitFinalPrice: number;
  unitDiscount: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTotal: number;
  imageUrl: string;
}

export interface StoreOrder {
  id: number;
  invoiceId: string;
  minecraftUsername: string;
  discordUsername: string;
  items: OrderLineItem[];
  subtotalOriginal: number;
  saleDiscountTotal: number;
  promoCode: string | null;
  promoDiscountTotal: number;
  finalTotal: number;
  paymentMethod: string;
  paymentReference: string;
  paymentReferenceMasked?: string;
  receiptImageUrl: string | null;
  customerNotes: string | null;
  adminNotes: string | null;
  status: 'Pending' | 'Paid' | 'Processing' | 'Completed' | 'Cancelled';
  discordNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerStatus {
  online: boolean;
  ip: string;
  port: number;
  playersOnline: number;
  playersMax: number;
  version: string;
  motd: string;
  source: 'live_api' | 'configured_fallback' | 'manual';
  lastUpdated: string;
}

export interface CartEvaluation {
  items: OrderLineItem[];
  subtotalOriginal: number;
  subtotalAfterSales: number;
  saleDiscountTotal: number;
  promoCodeApplied: string | null;
  promoCodeDescription: string | null;
  promoDiscountTotal: number;
  promoError: string | null;
  finalTotal: number;
  stockErrors: string[];
}

export interface StoreAnalytics {
  rangeDays: number;
  totalRevenue: number;
  totalOrders: number;
  completedCount: number;
  pendingCount: number;
  processingCount: number;
  paidCount: number;
  cancelledCount: number;
  totalItemsSold: number;
  averageOrderValue: number;
  popularProducts: {
    id: number;
    name: string;
    productCode: string;
    quantity: number;
    revenue: number;
  }[];
  lowStockProducts: {
    id: number;
    productCode: string;
    name: string;
    stockQuantity: number;
    lowStockThreshold: number;
  }[];
  promoUsage: {
    id: number;
    code: string;
    currentUses: number;
    maxTotalUses: number | null;
    discountType: string;
    discountValue: number;
    enabled: boolean;
  }[];
}
