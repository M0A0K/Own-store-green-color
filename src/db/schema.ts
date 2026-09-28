import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

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
  paymentType?: 'number' | 'qr' | 'both';
  accountTitle: string;
  accountNumber: string;
  qrCodeUrl?: string;
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

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('customer'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const storeSettings = pgTable('store_settings', {
  id: serial('id').primaryKey(),
  storeName: text('store_name').notNull().default('OwnVerse Store'),
  storeTagline: text('store_tagline').notNull().default('Official Minecraft Network Storefront'),
  logoUrl: text('logo_url').notNull(),
  faviconUrl: text('favicon_url').notNull().default('/favicon.png'),
  serverIp: text('server_ip').notNull().default('mc.ownverse.net'),
  serverPort: integer('server_port').notNull().default(25565),
  serverStatusMode: text('server_status_mode').notNull().default('live_with_fallback'),
  manualServerOnline: boolean('manual_server_online').notNull().default(true),
  manualPlayersOnline: integer('manual_players_online').notNull().default(184),
  manualPlayersMax: integer('manual_players_max').notNull().default(500),
  discordInviteUrl: text('discord_invite_url').notNull().default('https://discord.gg/ownverse'),
  supportEmail: text('support_email').notNull().default('support@ownverse.mc'),
  supportDiscord: text('support_discord').notNull().default('discord.gg/ownverse'),
  supportHours: text('support_hours')
    .notNull()
    .default('24/7 Automated Delivery · Live Ticket Support 09:00–23:00 UTC'),
  currencyCode: text('currency_code').notNull().default('USD'),
  currencySymbol: text('currency_symbol').notNull().default('$'),
  themeConfig: jsonb('theme_config').$type<ThemeConfig>().notNull(),
  heroConfig: jsonb('hero_config').$type<HeroConfig>().notNull(),
  promoBannerConfig: jsonb('promo_banner_config').$type<PromoBannerConfig>().notNull(),
  paymentMethodsConfig: jsonb('payment_methods_config').$type<PaymentMethodConfig[]>().notNull(),
  policiesConfig: jsonb('policies_config').$type<PoliciesConfig>().notNull(),
  faqItems: jsonb('faq_items').$type<FaqItem[]>().notNull(),
  adminPasswordHash: text('admin_password_hash'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sections = pgTable('sections', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull().default('Sword'),
  accentColor: text('accent_color').notNull().default('#10B981'),
  bannerUrl: text('banner_url'),
  displayOrder: integer('display_order').notNull().default(0),
  visible: boolean('visible').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  productCode: text('product_code').notNull().unique(),
  slug: text('slug').notNull().unique(),
  sectionId: integer('section_id').references(() => sections.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  price: doublePrecision('price').notNull(),
  salePrice: doublePrecision('sale_price'),
  emojiIcon: text('emoji_icon').notNull().default('⚔️'),
  customLogoUrl: text('custom_logo_url'),
  productImageUrl: text('product_image_url').notNull(),
  kitPreviewImageUrl: text('kit_preview_image_url').notNull(),
  shortDescription: text('short_description').notNull(),
  markdownDescription: text('markdown_description').notNull(),
  rarityTier: text('rarity_tier').notNull().default('Legendary'),
  customBadge: text('custom_badge'),
  badgeColor: text('badge_color').notNull().default('#10B981'),
  cardAccentColor: text('card_accent_color').notNull().default('#10B981'),
  buttonColor: text('button_color').notNull().default('#10B981'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  featured: boolean('featured').notNull().default(false),
  visible: boolean('visible').notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
  stockType: text('stock_type').notNull().default('unlimited'),
  stockQuantity: integer('stock_quantity'),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  totalSold: integer('total_sold').notNull().default(0),
  whatYouGet: jsonb('what_you_get').$type<string[]>().notNull().default([]),
  requirements: jsonb('requirements').$type<string[]>().notNull().default([]),
  commandsPerks: jsonb('commands_perks').$type<string[]>().notNull().default([]),
  duration: text('duration').notNull().default('Permanent (Lifetime)'),
  protection: text('protection').notNull().default('Verified Delivery'),
  deliveryInfo: text('delivery_info')
    .notNull()
    .default('Instant automated in-game delivery within 1–5 minutes of payment verification.'),
  importantNotes: text('important_notes')
    .notNull()
    .default('Ensure your Minecraft username is entered accurately (case-sensitive).'),
  productTerms: text('product_terms')
    .notNull()
    .default('Subject to OwnVerse Network Terms of Service and Fair Play Policy.'),
  customInfoBlocks: jsonb('custom_info_blocks').$type<CustomInfoBlock[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  badgeText: text('badge_text').notNull().default('SALE'),
  discountType: text('discount_type').notNull().default('percentage'),
  discountValue: doublePrecision('discount_value').notNull(),
  targetScope: text('target_scope').notNull().default('store'),
  targetSectionId: integer('target_section_id'),
  targetProductId: integer('target_product_id'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  showCountdown: boolean('show_countdown').notNull().default(true),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const promoCodes = pgTable('promo_codes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  discountType: text('discount_type').notNull().default('percentage'),
  discountValue: doublePrecision('discount_value').notNull(),
  targetScope: text('target_scope').notNull().default('store'),
  targetSectionId: integer('target_section_id'),
  targetProductId: integer('target_product_id'),
  minOrderAmount: doublePrecision('min_order_amount').notNull().default(0),
  maxDiscountAmount: doublePrecision('max_discount_amount'),
  maxTotalUses: integer('max_total_uses'),
  currentUses: integer('current_uses').notNull().default(0),
  perCustomerLimit: integer('per_customer_limit').notNull().default(3),
  stackWithSales: boolean('stack_with_sales').notNull().default(true),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  invoiceId: text('invoice_id').notNull().unique(),
  idempotencyKey: text('idempotency_key').unique(),
  userUid: text('user_uid'),
  minecraftUsername: text('minecraft_username').notNull(),
  discordUsername: text('discord_username').notNull(),
  items: jsonb('items').$type<OrderLineItem[]>().notNull(),
  subtotalOriginal: doublePrecision('subtotal_original').notNull(),
  saleDiscountTotal: doublePrecision('sale_discount_total').notNull().default(0),
  promoCode: text('promo_code'),
  promoDiscountTotal: doublePrecision('promo_discount_total').notNull().default(0),
  finalTotal: doublePrecision('final_total').notNull(),
  paymentMethod: text('payment_method').notNull(),
  paymentReference: text('payment_reference').notNull(),
  receiptImageUrl: text('receipt_image_url'),
  customerNotes: text('customer_notes'),
  adminNotes: text('admin_notes'),
  status: text('status').notNull().default('Pending'),
  stockDeducted: boolean('stock_deducted').notNull().default(true),
  discordNotified: boolean('discord_notified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  url: text('url').notNull(),
  dataUri: text('data_uri').notNull(),
  category: text('category').notNull().default('product'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const sectionsRelations = relations(sections, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  section: one(sections, {
    fields: [products.sectionId],
    references: [sections.id],
  }),
}));
