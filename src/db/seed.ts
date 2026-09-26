import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  storeSettings,
  sections,
  products,
  sales,
  promoCodes,
  orders,
  ThemeConfig,
  HeroConfig,
  PromoBannerConfig,
  PaymentMethodConfig,
  PoliciesConfig,
  FaqItem,
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
    accountNumber: '0482-0104920152 (IBAN: PK88MEZN0004829104920152)',
    instructions:
      'Initiate an IBFT / Wire Transfer to our Meezan Bank account. Include your Minecraft username in the transfer remarks and enter the STAN/Reference number.',
    requiresReceipt: true,
    badgeText: 'IBFT / Wire',
    feePercent: 0,
  },
  {
    id: 'crypto',
    name: 'Crypto',
    enabled: true,
    accountTitle: 'USDT (TRC20 / Arbitrum / Polygon)',
    accountNumber: '0x9F8c4E2a7B19D30482A901fE82C741b8D9E24A10',
    instructions:
      'Send the exact USD equivalent in USDT or USDC on Arbitrum, Polygon, or BNB Chain. Paste the blockchain Transaction Hash (TxID) in the Payment Reference field.',
    requiresReceipt: false,
    badgeText: 'Global On-Chain',
    feePercent: 0,
  },
  {
    id: 'card',
    name: 'Card',
    enabled: true,
    accountTitle: 'OwnVerse Global Checkout Reference',
    accountNumber: 'Stripe / Visa / Mastercard Authorization',
    instructions:
      'Complete payment via our card payment link or international virtual terminal and enter your 8-character Card Authorization / Receipt Reference code.',
    requiresReceipt: false,
    badgeText: 'Visa / Mastercard',
    feePercent: 0,
  },
];

export const DEFAULT_POLICIES: PoliciesConfig = {
  termsAndConditions: `### 1. Acceptance of Network Store Terms
By purchasing any digital package from **OwnVerse Store**, you acknowledge that you are at least 18 years of age or have explicit parental/guardian authorization. All items are virtual digital licenses usable strictly within the **OwnVerse Minecraft Network** (\`play.ownverse.mc\`).

### 2. Minecraft EULA Compliance & Affiliation
OwnVerse Network is an independent community server and is **not affiliated with, endorsed by, or associated with Mojang Studios or Microsoft Corporation**. Minecraft is a registered trademark of Mojang Synergies AB.

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

let seedInProgress: Promise<void> | null = null;
let hasSeededThisProcess = false;

export async function ensureStoreSeeded(): Promise<void> {
  if (hasSeededThisProcess) return;
  if (seedInProgress) return seedInProgress;

  seedInProgress = (async () => {
    try {
      const existingSettings = await db.select().from(storeSettings).limit(1);
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
      console.error('Failed to seed store database:', error);
      throw new Error('Failed to initialize default store data.', { cause: error });
    } finally {
      seedInProgress = null;
    }
  })();

  return seedInProgress;
}
