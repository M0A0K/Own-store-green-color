import { eq } from 'drizzle-orm';
import { db, pool, hasDatabaseConfig } from './index.ts';
import {
  storeSettings,
  sections,
  products,
  sales,
  promoCodes,
  type ThemeConfig,
  type HeroConfig,
  type PromoBannerConfig,
  type PaymentMethodConfig,
  type PoliciesConfig,
  type FaqItem,
} from './schema.ts';
import { hashPassword } from '../middleware/auth.ts';

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  bgPrimary: '#090708',
  bgSecondary: '#120C0E',
  bgCard: '#181013',
  textPrimary: '#FAF5F6',
  textMuted: '#A8999D',
  accentPrimary: '#EF4444',
  accentSecondary: '#F59E0B',
  buttonColor: '#DC2626',
  borderColor: '#2C1A1E',
  cardRadius: '12px',
  fontDisplay: 'Syne',
  fontBody: 'Plus Jakarta Sans',
  fontMono: 'JetBrains Mono',
  spacingScale: 'comfortable',
};

export const DEFAULT_HERO_CONFIG: HeroConfig = {
  kicker: 'OwnVerse Network · Season IV: Crimson Citadel',
  title: 'Forge Your Dominion Across the OwnVerse Realm',
  subtitle:
    'Equip lifetime network ranks, enchanted Netherite combat loadouts, and mythic vault keys. Instant in-game delivery backed by atomic inventory verification.',
  bannerImage: '',
  primaryCtaText: 'Explore Store Catalog',
  secondaryCtaText: 'Track Existing Order',
  showServerStatus: true,
  showFeaturedHighlight: true,
};

export const DEFAULT_PROMO_BANNER: PromoBannerConfig = {
  enabled: true,
  title: 'Season IV Launch Offer',
  text: 'Use promo code MAK20 to get 20% OFF across all eligible ranks, kits, and crate bundles',
  code: 'MAK20',
  bgColor: '#1F090D',
  textColor: '#FFE4E6',
  accentColor: '#EF4444',
  buttonText: 'Apply Code MAK20',
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: 'jazzcash',
    name: 'JazzCash',
    enabled: true,
    accountTitle: 'OwnVerse Digital Network',
    accountNumber: '0301-8492015',
    instructions:
      'Send the exact order total via JazzCash mobile app or *786#. Enter your 11-digit TID / Transaction Reference ID below and attach your receipt screenshot for rapid verification.',
    requiresReceipt: false,
    badgeText: 'Instant PK Wallet',
    feePercent: 0,
  },
  {
    id: 'easypaisa',
    name: 'Easypaisa',
    enabled: true,
    accountTitle: 'OwnVerse Digital Network',
    accountNumber: '0345-8492015',
    instructions:
      'Transfer the final amount to our verified Easypaisa merchant wallet. Copy the 11-digit Trx ID from your SMS/app confirmation and paste it in the Payment Reference field.',
    requiresReceipt: false,
    badgeText: 'Zero Fee Wallet',
    feePercent: 0,
  },
  {
    id: 'raast',
    name: 'Raast',
    enabled: true,
    accountTitle: 'OwnVerse Interactive Pvt',
    accountNumber: 'PK88MEZN0004829104920152',
    instructions:
      'Use any Pakistani banking app with Raast Instant Payment enabled. Enter our Raast ID / IBAN and provide the Raast Reference Number.',
    requiresReceipt: false,
    badgeText: 'State Bank Instant',
    feePercent: 0,
  },
  {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    enabled: true,
    accountTitle: 'OwnVerse Interactive (Meezan Bank)',
    accountNumber: '0482-0104920152',
    instructions:
      'Complete an IBFT transfer to Meezan Bank Account 0482-0104920152. Provide the STAN / Reference Number and upload your transfer receipt.',
    requiresReceipt: true,
    badgeText: 'Direct Bank IBFT',
    feePercent: 0,
  },
  {
    id: 'crypto',
    name: 'Crypto (USDT TRC20 / BEP20)',
    enabled: true,
    accountTitle: 'USDT Treasury Vault',
    accountNumber: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
    instructions:
      'Send exact USD equivalent in USDT via TRC20 (Tron) or BEP20 (BSC: 0x8F49e2B5a91C4D7201598A2c8F1b9a32D1049201). Paste your Transaction Hash (TxID) in the reference box.',
    requiresReceipt: false,
    badgeText: 'Global Zero Border',
    feePercent: 0,
  },
  {
    id: 'card',
    name: 'Debit / Credit Card',
    enabled: true,
    accountTitle: 'OwnVerse Global Billing Desk',
    accountNumber: 'pay.ownverse.mc/card-checkout',
    instructions:
      'Complete your 3D-Secure Visa / Mastercard payment via our billing link or Discord ticket checkout, then enter the 8-character Stripe/Gateway Receipt Code.',
    requiresReceipt: false,
    badgeText: 'Visa & Mastercard',
    feePercent: 0,
  },
];

export const DEFAULT_POLICIES: PoliciesConfig = {
  termsAndConditions: `### 1. Acceptance of Network Store Terms
By completing a purchase on **OwnVerse Store**, you acknowledge that you are at least 18 years old or have explicit parental/guardian authorization to complete this transaction.

### 2. Independent Server Disclaimer
OwnVerse Store and the OwnVerse Minecraft Network are **not affiliated with, endorsed by, or associated with Mojang Studios or Microsoft Corporation**. Minecraft is a registered trademark of Mojang Synergies AB.

### 3. Account Responsibility & Fair Play
Ranks, kits, and perks do not exempt players from network rules. In-game punishments (mutes, suspensions, or bans for cheating/exploits) do not entitle accounts to store credit transfers or refunds.`,
  privacyPolicy: `### 1. Data We Collect
We collect only the essential operational fields required to fulfill your in-game order:
- **Minecraft Username** (Java or Bedrock gamertag for automated RCON package delivery)
- **Discord Username** (for order notifications and ticket verification)
- **Payment Reference & Optional Receipt** (for fraud prevention and accounting reconciliation)

### 2. Data Security & Retention
All order records are stored in encrypted PostgreSQL instances with strict access control. We never sell or share player identities with third-party advertisers.`,
  refundPolicy: `### 1. Digital Goods Finality
Because OwnVerse Store packages grant immediate digital entitlements, ranks, and consumable crate keys inside the game server, **all verified sales are final and non-refundable** once delivered.

### 2. Exceptions & Mistaken Usernames
If you entered a misspelled Minecraft username during checkout and the package has not yet been claimed in-game, open a support ticket on our Discord within **24 hours** with your Invoice ID (\`OV-2026-XXXXXX\`) and our administrators will transfer the package to your correct username.`,
  deliveryPolicy: `### 1. Automated & Verified Delivery Pipeline
- **Automated Wallet & Card Orders**: Processed within **1 to 5 minutes** upon payment reference confirmation.
- **Manual Bank / Receipt Verification**: Verified by our billing team within **15 to 45 minutes** during active hours.

### 2. Receiving Your Items In-Game
Make sure you are logged into \`play.ownverse.mc\` with sufficient inventory space, or use \`/claim\` in any hub or survival realm to retrieve queued kit containers.`,
  supportInformation: `### Need Assistance With an Order?
Our billing specialists and automated delivery monitors operate around the clock.

- **Discord Support Desk**: Join \`discord.gg/ownverse\` and open a **#billing-support** ticket with your Invoice ID.
- **Direct Billing Email**: \`support@ownverse.mc\`
- **Order Lookup**: Use the **Order Lookup** tab in the top navigation bar anytime to inspect live verification status.`,
};

export const DEFAULT_FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'How quickly will I receive my rank or kit after checkout?',
    answer:
      'Orders are queued immediately upon checkout with your unique Invoice ID (e.g., OV-2026-XXXXXX). Once payment reference verification completes (typically 1–10 minutes), our server dispatches your commands directly to your Minecraft username.',
    category: 'Delivery',
    sortOrder: 1,
    visible: true,
  },
  {
    id: 'faq-2',
    question: 'Can I use promo code MAK20 on items that are already on sale?',
    answer:
      'Yes! Our flagship promo code MAK20 is configured with sale stacking enabled, giving you an extra 20% discount on top of active store-wide or section sales.',
    category: 'Discounts',
    sortOrder: 2,
    visible: true,
  },
  {
    id: 'faq-3',
    question: 'Does OwnVerse support both Minecraft Java and Bedrock players?',
    answer:
      'Yes. Java Edition players should enter their standard case-sensitive username. Bedrock Edition players connecting via Geyser should include their prefix (for example, .PlayerName) exactly as it appears in-game tab list.',
    category: 'Compatibility',
    sortOrder: 3,
    visible: true,
  },
  {
    id: 'faq-4',
    question: 'What payment methods are accepted in Pakistan and internationally?',
    answer:
      'We natively support JazzCash, Easypaisa, Raast, and Pakistani Bank Transfers (IBFT) for local players, alongside USDT/USDC Crypto and Visa/Mastercard for international players.',
    category: 'Payments',
    sortOrder: 4,
    visible: true,
  },
  {
    id: 'faq-5',
    question: 'What happens if a limited-stock bundle sells out while it is in my cart?',
    answer:
      'Our PostgreSQL backend uses atomic database transactions during checkout. If another player claims the final unit first, checkout will safely notify you before any order is finalized so overselling never occurs.',
    category: 'Stock & Security',
    sortOrder: 5,
    visible: true,
  },
];

// ============================================================================
// In-Memory Fallback Store (Used ONLY on external hosts when no DB is attached)
// ============================================================================
let memoryModeActive = false;

export function isMemoryFallbackActive(): boolean {
  return memoryModeActive;
}

export const memoryStore: {
  users: any[];
  settings: any;
  sections: any[];
  products: any[];
  sales: any[];
  promoCodes: any[];
  orders: any[];
  mediaAssets: any[];
} = {
  users: [],
  settings: null,
  sections: [],
  products: [],
  sales: [],
  promoCodes: [],
  orders: [],
  mediaAssets: [],
};

function initMemoryStoreDefaults() {
  if (memoryStore.settings) return;
  const defaultAdminKey = process.env.ADMIN_ACCESS_KEY || 'OWNVERSE-ADMIN-2026';
  const hashedAdminKey = hashPassword(defaultAdminKey);
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
  const yesterday = new Date(now.getTime() - 1000 * 60 * 60 * 24);

  memoryStore.settings = {
    id: 1,
    storeName: 'OwnVerse Store',
    storeTagline: 'Official Minecraft Network Storefront',
    logoUrl: '',
    faviconUrl: '/favicon.svg',
    serverIp: process.env.MINECRAFT_SERVER_IP || 'play.ownverse.mc',
    serverPort: 25565,
    serverStatusMode: 'live_with_fallback',
    manualServerOnline: true,
    manualPlayersOnline: 214,
    manualPlayersMax: 500,
    discordInviteUrl: 'https://discord.gg/ownverse',
    supportEmail: 'support@ownverse.mc',
    supportDiscord: 'discord.gg/ownverse',
    supportHours: '24/7 Automated Delivery · Live Ticket Support 09:00–23:00 UTC',
    currencyCode: 'USD',
    currencySymbol: '$',
    themeConfig: DEFAULT_THEME_CONFIG,
    heroConfig: DEFAULT_HERO_CONFIG,
    promoBannerConfig: DEFAULT_PROMO_BANNER,
    paymentMethodsConfig: DEFAULT_PAYMENT_METHODS,
    policiesConfig: DEFAULT_POLICIES,
    faqItems: DEFAULT_FAQS,
    adminPasswordHash: hashedAdminKey,
    updatedAt: now,
  };

  memoryStore.sections = [
    {
      id: 1,
      slug: 'ranks',
      name: 'Server Ranks',
      description:
        'Lifetime network ranks granting priority realm queue, flight access, extra auction slots, and prestigious chat prefixes.',
      icon: 'Crown',
      accentColor: '#EF4444',
      bannerUrl: null,
      displayOrder: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 2,
      slug: 'combat-kits',
      name: 'Combat & Raid Kits',
      description:
        'Battle-ready Netherite armor sets, custom rune weapons, golden apple vaults, and obsidian siege supplies.',
      icon: 'Swords',
      accentColor: '#DC2626',
      bannerUrl: null,
      displayOrder: 2,
      visible: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 3,
      slug: 'crate-keys',
      name: 'Mythic Crate Keys',
      description:
        'High-tier vault keys redeemable at the Citadel Spawn for seasonal artifacts, custom enchants, and rare mounts.',
      icon: 'KeyRound',
      accentColor: '#F59E0B',
      bannerUrl: null,
      displayOrder: 3,
      visible: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 4,
      slug: 'cosmetics-perks',
      name: 'Cosmetics & Boosters',
      description:
        'Network-wide XP multipliers, crimson particle auras, custom kill broadcasts, and private vault expansions.',
      icon: 'Sparkles',
      accentColor: '#EF4444',
      bannerUrl: null,
      displayOrder: 4,
      visible: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  memoryStore.products = [
    {
      id: 1,
      productCode: 'OV-RANK-VIP',
      slug: 'vip-rank',
      sectionId: 1,
      name: 'Vip',
      price: 19.99,
      salePrice: 14.99,
      emojiIcon: '👑',
      customLogoUrl: null,
      productImageUrl: '',
      kitPreviewImageUrl: '',
      shortDescription:
        'Lifetime VIP network rank with /fly in claims, 6 player vaults, VIP Kit, and crimson prefix.',
      markdownDescription:
        '## VIP Network Rank\nUnlock permanent privileges across Survival, Skyblock, and Factions realms on **OwnVerse**.',
      rarityTier: 'Legendary',
      customBadge: 'POPULAR',
      badgeColor: '#EF4444',
      cardAccentColor: '#EF4444',
      buttonColor: '#DC2626',
      tags: ['rank', 'vip', 'lifetime', 'featured'],
      featured: true,
      visible: true,
      displayOrder: 1,
      stockType: 'unlimited',
      stockQuantity: null,
      lowStockThreshold: 5,
      totalSold: 12,
      whatYouGet: [
        'Permanent [VIP] Prefix in Tab & Chat',
        'Full VIP Kit (/kit vip)',
        '6 Private Cloud Vaults (/pv 1–6)',
      ],
      requirements: ['Valid Minecraft Java or Bedrock account'],
      commandsPerks: ['/fly (Within claims)', '/craft, /enderchest, /hat'],
      duration: 'Permanent (Lifetime)',
      deliveryInfo: 'Automated RCON dispatch within 1–5 minutes of verification.',
      importantNotes: 'Ensure your Minecraft username is entered accurately.',
      productTerms: 'Subject to OwnVerse Network Terms of Service.',
      customInfoBlocks: [],
      createdAt: now,
      updatedAt: now,
    },
  ];

  memoryStore.sales = [
    {
      id: 1,
      title: 'Season IV Citadel Launch Sale',
      description: '15% OFF Store-Wide celebration discount on all packages!',
      badgeText: '15% OFF EVENT',
      discountType: 'percentage',
      discountValue: 15,
      targetScope: 'store',
      targetSectionId: null,
      targetProductId: null,
      startDate: yesterday,
      endDate: nextMonth,
      showCountdown: true,
      enabled: true,
      createdAt: now,
    },
  ];

  memoryStore.promoCodes = [
    {
      id: 1,
      code: 'MAK20',
      description: '20% OFF Flagship Store Promo Code (Stackable with active sales)',
      discountType: 'percentage',
      discountValue: 20,
      targetScope: 'store',
      targetSectionId: null,
      targetProductId: null,
      minOrderAmount: 5,
      maxDiscountAmount: 100,
      maxTotalUses: 500,
      currentUses: 18,
      perCustomerLimit: 5,
      stackWithSales: true,
      startDate: yesterday,
      endDate: nextMonth,
      enabled: true,
      createdAt: now,
    },
  ];
}

async function ensurePostgresTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      display_name TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS store_settings (
      id SERIAL PRIMARY KEY,
      store_name TEXT NOT NULL DEFAULT 'OwnVerse Store',
      store_tagline TEXT NOT NULL DEFAULT 'Official Minecraft Network Storefront',
      logo_url TEXT NOT NULL,
      favicon_url TEXT NOT NULL DEFAULT '/favicon.svg',
      server_ip TEXT NOT NULL DEFAULT 'play.ownverse.mc',
      server_port INTEGER NOT NULL DEFAULT 25565,
      server_status_mode TEXT NOT NULL DEFAULT 'live_with_fallback',
      manual_server_online BOOLEAN NOT NULL DEFAULT true,
      manual_players_online INTEGER NOT NULL DEFAULT 184,
      manual_players_max INTEGER NOT NULL DEFAULT 500,
      discord_invite_url TEXT NOT NULL DEFAULT 'https://discord.gg/ownverse',
      support_email TEXT NOT NULL DEFAULT 'support@ownverse.mc',
      support_discord TEXT NOT NULL DEFAULT 'discord.gg/ownverse',
      support_hours TEXT NOT NULL DEFAULT '24/7 Automated Delivery',
      currency_code TEXT NOT NULL DEFAULT 'USD',
      currency_symbol TEXT NOT NULL DEFAULT '$',
      theme_config JSONB NOT NULL,
      hero_config JSONB NOT NULL,
      promo_banner_config JSONB NOT NULL,
      payment_methods_config JSONB NOT NULL,
      policies_config JSONB NOT NULL,
      faq_items JSONB NOT NULL,
      admin_password_hash TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Sword',
      accent_color TEXT NOT NULL DEFAULT '#EF4444',
      banner_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      visible BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      product_code TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      sale_price DOUBLE PRECISION,
      emoji_icon TEXT NOT NULL DEFAULT '⚔️',
      custom_logo_url TEXT,
      product_image_url TEXT NOT NULL,
      kit_preview_image_url TEXT NOT NULL,
      short_description TEXT NOT NULL,
      markdown_description TEXT NOT NULL,
      rarity_tier TEXT NOT NULL DEFAULT 'Legendary',
      custom_badge TEXT,
      badge_color TEXT NOT NULL DEFAULT '#EF4444',
      card_accent_color TEXT NOT NULL DEFAULT '#EF4444',
      button_color TEXT NOT NULL DEFAULT '#DC2626',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      featured BOOLEAN NOT NULL DEFAULT false,
      visible BOOLEAN NOT NULL DEFAULT true,
      display_order INTEGER NOT NULL DEFAULT 0,
      stock_type TEXT NOT NULL DEFAULT 'unlimited',
      stock_quantity INTEGER,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      total_sold INTEGER NOT NULL DEFAULT 0,
      what_you_get JSONB NOT NULL DEFAULT '[]'::jsonb,
      requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
      commands_perks JSONB NOT NULL DEFAULT '[]'::jsonb,
      duration TEXT NOT NULL DEFAULT 'Permanent',
      delivery_info TEXT NOT NULL DEFAULT 'Instant automated in-game delivery.',
      important_notes TEXT NOT NULL DEFAULT '',
      product_terms TEXT NOT NULL DEFAULT '',
      custom_info_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      badge_text TEXT NOT NULL DEFAULT 'SALE',
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value DOUBLE PRECISION NOT NULL,
      target_scope TEXT NOT NULL DEFAULT 'store',
      target_section_id INTEGER,
      target_product_id INTEGER,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      show_countdown BOOLEAN NOT NULL DEFAULT true,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS promo_codes (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      discount_type TEXT NOT NULL DEFAULT 'percentage',
      discount_value DOUBLE PRECISION NOT NULL,
      target_scope TEXT NOT NULL DEFAULT 'store',
      target_section_id INTEGER,
      target_product_id INTEGER,
      min_order_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      max_discount_amount DOUBLE PRECISION,
      max_total_uses INTEGER,
      current_uses INTEGER NOT NULL DEFAULT 0,
      per_customer_limit INTEGER NOT NULL DEFAULT 3,
      stack_with_sales BOOLEAN NOT NULL DEFAULT true,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      invoice_id TEXT NOT NULL UNIQUE,
      idempotency_key TEXT UNIQUE,
      user_uid TEXT,
      minecraft_username TEXT NOT NULL,
      discord_username TEXT NOT NULL,
      items JSONB NOT NULL,
      subtotal_original DOUBLE PRECISION NOT NULL,
      sale_discount_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      promo_code TEXT,
      promo_discount_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      final_total DOUBLE PRECISION NOT NULL,
      payment_method TEXT NOT NULL,
      payment_reference TEXT NOT NULL,
      receipt_image_url TEXT,
      customer_notes TEXT,
      admin_notes TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      stock_deducted BOOLEAN NOT NULL DEFAULT true,
      discord_notified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS media_assets (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      url TEXT NOT NULL,
      data_uri TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'product',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

let seedInProgress: Promise<void> | null = null;
let hasSeededThisProcess = false;

export async function ensureStoreSeeded(): Promise<void> {
  if (hasSeededThisProcess) return;
  if (seedInProgress) return seedInProgress;

  seedInProgress = (async () => {
    if (!hasDatabaseConfig()) {
      initMemoryStoreDefaults();
      memoryModeActive = true;
      hasSeededThisProcess = true;
      seedInProgress = null;
      return;
    }

    try {
      let existingSettings: (typeof storeSettings.$inferSelect)[] = [];
      try {
        existingSettings = await db.select().from(storeSettings).limit(1);
      } catch (err: any) {
        if (err?.code === '42P01') {
          await ensurePostgresTablesExist();
          existingSettings = await db.select().from(storeSettings).limit(1);
        } else {
          throw err;
        }
      }

      if (existingSettings.length > 0) {
        const current = existingSettings[0];
        const needsRedThemeMigration =
          current.themeConfig?.accentPrimary === '#10B981' ||
          current.themeConfig?.buttonColor === '#10B981' ||
          current.logoUrl?.startsWith('/src/assets/') ||
          current.heroConfig?.bannerImage?.startsWith('/src/assets/');

        if (needsRedThemeMigration) {
          await db.update(storeSettings).set({
            logoUrl: current.logoUrl?.startsWith('/src/assets/') ? '' : current.logoUrl,
            themeConfig: DEFAULT_THEME_CONFIG,
            heroConfig: {
              ...current.heroConfig,
              bannerImage: current.heroConfig?.bannerImage?.startsWith('/src/assets/')
                ? ''
                : current.heroConfig?.bannerImage || '',
            },
            promoBannerConfig: {
              ...current.promoBannerConfig,
              bgColor: '#1F090D',
              textColor: '#FFE4E6',
              accentColor: '#EF4444',
            },
          });

          const allProds = await db.select().from(products);
          for (const p of allProds) {
            const cleanProdImg = p.productImageUrl?.startsWith('/src/assets/')
              ? ''
              : p.productImageUrl;
            const cleanKitImg = p.kitPreviewImageUrl?.startsWith('/src/assets/')
              ? ''
              : p.kitPreviewImageUrl;
            const cleanLogoImg = p.customLogoUrl?.startsWith('/src/assets/')
              ? null
              : p.customLogoUrl;

            await db
              .update(products)
              .set({
                productImageUrl: cleanProdImg,
                kitPreviewImageUrl: cleanKitImg,
                customLogoUrl: cleanLogoImg,
                badgeColor: p.badgeColor === '#10B981' ? '#EF4444' : p.badgeColor,
                cardAccentColor: p.cardAccentColor === '#10B981' ? '#EF4444' : p.cardAccentColor,
                buttonColor: p.buttonColor === '#10B981' ? '#DC2626' : p.buttonColor,
              })
              .where(eq(products.id, p.id));
          }
        }

        hasSeededThisProcess = true;
        return;
      }

      const defaultAdminKey = process.env.ADMIN_ACCESS_KEY || 'OWNVERSE-ADMIN-2026';
      const hashedAdminKey = hashPassword(defaultAdminKey);

      await db.insert(storeSettings).values({
        storeName: 'OwnVerse Store',
        storeTagline: 'Official Minecraft Network Storefront',
        logoUrl: '',
        faviconUrl: '/favicon.svg',
        serverIp: process.env.MINECRAFT_SERVER_IP || 'play.ownverse.mc',
        serverPort: 25565,
        serverStatusMode: 'live_with_fallback',
        manualServerOnline: true,
        manualPlayersOnline: 214,
        manualPlayersMax: 500,
        discordInviteUrl: 'https://discord.gg/ownverse',
        supportEmail: 'support@ownverse.mc',
        supportDiscord: 'discord.gg/ownverse',
        supportHours: '24/7 Automated Delivery · Live Ticket Support 09:00–23:00 UTC',
        currencyCode: 'USD',
        currencySymbol: '$',
        themeConfig: DEFAULT_THEME_CONFIG,
        heroConfig: DEFAULT_HERO_CONFIG,
        promoBannerConfig: DEFAULT_PROMO_BANNER,
        paymentMethodsConfig: DEFAULT_PAYMENT_METHODS,
        policiesConfig: DEFAULT_POLICIES,
        faqItems: DEFAULT_FAQS,
        adminPasswordHash: hashedAdminKey,
      });

      const insertedSections = await db
        .insert(sections)
        .values([
          {
            slug: 'ranks',
            name: 'Server Ranks',
            description:
              'Lifetime network ranks granting priority realm queue, flight access, extra auction slots, and prestigious chat prefixes.',
            icon: 'Crown',
            accentColor: '#EF4444',
            bannerUrl: null,
            displayOrder: 1,
            visible: true,
          },
          {
            slug: 'combat-kits',
            name: 'Combat & Raid Kits',
            description:
              'Battle-ready Netherite armor sets, custom rune weapons, golden apple vaults, and obsidian siege supplies.',
            icon: 'Swords',
            accentColor: '#DC2626',
            bannerUrl: null,
            displayOrder: 2,
            visible: true,
          },
          {
            slug: 'crate-keys',
            name: 'Mythic Crate Keys',
            description:
              'High-tier vault keys redeemable at the Citadel Spawn for seasonal artifacts, custom enchants, and rare mounts.',
            icon: 'KeyRound',
            accentColor: '#F59E0B',
            bannerUrl: null,
            displayOrder: 3,
            visible: true,
          },
          {
            slug: 'cosmetics-perks',
            name: 'Cosmetics & Boosters',
            description:
              'Network-wide XP multipliers, crimson particle auras, custom kill broadcasts, and private vault expansions.',
            icon: 'Sparkles',
            accentColor: '#EF4444',
            bannerUrl: null,
            displayOrder: 4,
            visible: true,
          },
        ])
        .returning();

      const sectionMap = new Map(insertedSections.map((s) => [s.slug, s.id]));

      await db
        .insert(products)
        .values([
          {
            productCode: 'OV-RANK-VIP',
            slug: 'vip-rank',
            sectionId: sectionMap.get('ranks')!,
            name: 'Vip',
            price: 19.99,
            salePrice: 14.99,
            emojiIcon: '👑',
            customLogoUrl: null,
            productImageUrl: '',
            kitPreviewImageUrl: '',
            shortDescription:
              'Lifetime VIP network rank with /fly in claims, 6 player vaults, VIP Kit, and crimson prefix.',
            markdownDescription: `## VIP Network Rank
Unlock permanent privileges across Survival, Skyblock, and Factions realms on **OwnVerse**.`,
            rarityTier: 'Legendary',
            customBadge: 'POPULAR',
            badgeColor: '#EF4444',
            cardAccentColor: '#EF4444',
            buttonColor: '#DC2626',
            tags: ['rank', 'vip', 'lifetime', 'featured'],
            featured: true,
            visible: true,
            displayOrder: 1,
            stockType: 'unlimited',
            stockQuantity: null,
            lowStockThreshold: 5,
            totalSold: 12,
            whatYouGet: [
              'Permanent [VIP] Prefix in Tab & Chat',
              'Full VIP Kit (/kit vip)',
              '6 Private Cloud Vaults (/pv 1–6)',
            ],
            requirements: ['Valid Minecraft Java or Bedrock account'],
            commandsPerks: ['/fly (Within claims)', '/craft, /enderchest, /hat'],
            duration: 'Permanent (Lifetime)',
            deliveryInfo: 'Automated RCON dispatch within 1–5 minutes of verification.',
            importantNotes: 'Ensure your Minecraft username is entered accurately.',
            productTerms: 'Subject to OwnVerse Network Terms of Service.',
            customInfoBlocks: [],
          },
        ])
        .returning();

      const now = new Date();
      const nextMonth = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
      const yesterday = new Date(now.getTime() - 1000 * 60 * 60 * 24);

      await db.insert(sales).values([
        {
          title: 'Season IV Citadel Launch Sale',
          description: '15% OFF Store-Wide celebration discount on all packages!',
          badgeText: '15% OFF EVENT',
          discountType: 'percentage',
          discountValue: 15,
          targetScope: 'store',
          targetSectionId: null,
          targetProductId: null,
          startDate: yesterday,
          endDate: nextMonth,
          showCountdown: true,
          enabled: true,
        },
      ]);

      await db.insert(promoCodes).values([
        {
          code: 'MAK20',
          description: '20% OFF Flagship Store Promo Code (Stackable with active sales)',
          discountType: 'percentage',
          discountValue: 20,
          targetScope: 'store',
          targetSectionId: null,
          targetProductId: null,
          minOrderAmount: 5,
          maxDiscountAmount: 100,
          maxTotalUses: 500,
          currentUses: 18,
          perCustomerLimit: 5,
          stackWithSales: true,
          startDate: yesterday,
          endDate: nextMonth,
          enabled: true,
        },
      ]);

      hasSeededThisProcess = true;
    } catch (error) {
      console.warn(
        'PostgreSQL unreachable or unconfigured; activating resilient in-memory store fallback:',
        error
      );
      initMemoryStoreDefaults();
      memoryModeActive = true;
      hasSeededThisProcess = true;
    } finally {
      seedInProgress = null;
    }
  })();

  return seedInProgress;
}
