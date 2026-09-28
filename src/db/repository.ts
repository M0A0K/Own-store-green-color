import { eq, asc, desc } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  storeSettings,
  sections,
  products,
  sales,
  promoCodes,
  orders,
  mediaAssets,
  type OrderLineItem,
} from './schema.ts';
import {
  ensureStoreSeeded,
  isMemoryFallbackActive,
  memoryStore,
  persistStoreStateToDisk,
  ensureAdsConfigNormalized,
  ensurePaymentMethodsHaveQrSupport,
} from './seed.ts';

function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// ============================================================================
// High-Speed In-Memory Storefront & Media Asset Caches
// ============================================================================
let storeBootstrapCache: {
  data: any;
  expiresAt: number;
} | null = null;

const mediaAssetCache = new Map<number, typeof mediaAssets.$inferSelect>();

export function invalidateStoreCache(): void {
  storeBootstrapCache = null;
  void persistStoreStateToDisk();
}

export function invalidateMediaCache(id?: number): void {
  if (id !== undefined) {
    mediaAssetCache.delete(id);
  } else {
    mediaAssetCache.clear();
  }
  void persistStoreStateToDisk();
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName: string | null = null
) {
  try {
    await ensureStoreSeeded();
    const adminEmail = (process.env.ADMIN_EMAIL || 'makkhera1@gmail.com').toLowerCase();
    const isAdminEmail = email.toLowerCase() === adminEmail;

    if (isMemoryFallbackActive()) {
      let existing = memoryStore.users.find((u) => u.uid === uid);
      if (existing) {
        existing.email = email;
        existing.displayName = displayName;
        if (isAdminEmail) existing.role = 'admin';
        return existing;
      }
      const created = {
        id: memoryStore.users.length + 1,
        uid,
        email,
        displayName,
        role: isAdminEmail ? 'admin' : 'customer',
        createdAt: new Date(),
      };
      memoryStore.users.push(created);
      return created;
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        role: isAdminEmail ? 'admin' : 'customer',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
          ...(isAdminEmail ? { role: 'admin' } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export async function promoteUserToAdmin(uid: string) {
  try {
    await ensureStoreSeeded();
    if (isMemoryFallbackActive()) {
      const user = memoryStore.users.find((u) => u.uid === uid);
      if (user) {
        user.role = 'admin';
        return user;
      }
      return null;
    }

    const updated = await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.uid, uid))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in promoteUserToAdmin:', error);
    throw new Error('Failed to update user role.', { cause: error });
  }
}

export function isSaleCurrentlyActive(
  sale: typeof sales.$inferSelect,
  now = new Date()
): boolean {
  if (!sale.enabled) return false;
  if (sale.startDate && new Date(sale.startDate) > now) return false;
  if (sale.endDate && new Date(sale.endDate) < now) return false;
  return true;
}

export function computeEffectiveProductPricing(
  product: typeof products.$inferSelect,
  activeSales: (typeof sales.$inferSelect)[]
) {
  const originalPrice = roundCurrency(Number(product.price) || 0);
  let bestFinalPrice = originalPrice;
  let appliedSaleBadge: string | null = null;
  let appliedSaleId: number | null = null;
  let appliedSaleEndDate: string | null = null;

  if (
    product.salePrice !== null &&
    product.salePrice !== undefined &&
    Number(product.salePrice) >= 0 &&
    Number(product.salePrice) < originalPrice
  ) {
    bestFinalPrice = roundCurrency(Number(product.salePrice));
    const pct = Math.round(((originalPrice - bestFinalPrice) / originalPrice) * 100);
    appliedSaleBadge = `${pct}% OFF`;
  }

  for (const sale of activeSales) {
    const matchesStore = sale.targetScope === 'store';
    const matchesSection =
      sale.targetScope === 'section' && sale.targetSectionId === product.sectionId;
    const matchesProduct =
      sale.targetScope === 'product' && sale.targetProductId === product.id;

    if (!matchesStore && !matchesSection && !matchesProduct) continue;

    let candidatePrice = originalPrice;
    if (sale.discountType === 'percentage') {
      const pct = Math.min(95, Math.max(0, Number(sale.discountValue) || 0));
      candidatePrice = roundCurrency(originalPrice * (1 - pct / 100));
    } else {
      candidatePrice = roundCurrency(
        Math.max(0, originalPrice - (Number(sale.discountValue) || 0))
      );
    }

    if (candidatePrice < bestFinalPrice) {
      bestFinalPrice = candidatePrice;
      appliedSaleBadge = sale.badgeText || `${sale.discountValue}% OFF`;
      appliedSaleId = sale.id;
      appliedSaleEndDate = sale.endDate ? new Date(sale.endDate).toISOString() : null;
    }
  }

  const discountAmount = roundCurrency(Math.max(0, originalPrice - bestFinalPrice));
  const discountPercent =
    originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;

  const isOutOfStock =
    product.stockType === 'limited' && (product.stockQuantity ?? 0) <= 0;
  const isLowStock =
    product.stockType === 'limited' &&
    (product.stockQuantity ?? 0) > 0 &&
    (product.stockQuantity ?? 0) <= product.lowStockThreshold;

  return {
    ...product,
    originalPrice,
    effectivePrice: bestFinalPrice,
    discountAmount,
    discountPercent,
    isOnSale: discountAmount > 0,
    appliedSaleBadge,
    appliedSaleId,
    appliedSaleEndDate,
    isOutOfStock,
    isLowStock,
  };
}

export async function getPublicStoreBootstrap() {
  try {
    if (storeBootstrapCache && storeBootstrapCache.expiresAt > Date.now()) {
      return storeBootstrapCache.data;
    }

    await ensureStoreSeeded();

    let settings: any;
    let allSections: any[];
    let allProducts: any[];
    let allSales: any[];

    if (isMemoryFallbackActive()) {
      settings = memoryStore.settings;
      allSections = [...memoryStore.sections].sort(
        (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.id - b.id
      );
      allProducts = [...memoryStore.products].sort(
        (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.id - b.id
      );
      allSales = [...memoryStore.sales].sort((a, b) => b.id - a.id);
    } else {
      const [settingsRows, secRows, prodRows, saleRows] = await Promise.all([
        db.select().from(storeSettings).limit(1),
        db.select().from(sections).orderBy(asc(sections.displayOrder), asc(sections.id)),
        db.select().from(products).orderBy(asc(products.displayOrder), asc(products.id)),
        db.select().from(sales).orderBy(desc(sales.id)),
      ]);
      settings = settingsRows[0];
      allSections = secRows;
      allProducts = prodRows;
      allSales = saleRows;
    }

    const now = new Date();
    const activeSales = allSales.filter((s) => isSaleCurrentlyActive(s, now));

    const visibleSections = allSections.filter((s) => s.visible);
    const visibleSectionIds = new Set(visibleSections.map((s) => s.id));

    const enrichedProducts = allProducts
      .filter((p) => p.visible && (!p.sectionId || visibleSectionIds.has(p.sectionId)))
      .map((p) => computeEffectiveProductPricing(p, activeSales));

    const { adminPasswordHash: _ignored, ...safeSettings } = settings;
    const normalizedSettings = {
      ...safeSettings,
      paymentMethodsConfig: ensurePaymentMethodsHaveQrSupport(
        safeSettings.paymentMethodsConfig
      ),
      adsConfig: ensureAdsConfigNormalized(safeSettings.adsConfig),
    };

    const payload = {
      settings: normalizedSettings,
      sections: visibleSections,
      products: enrichedProducts,
      activeSales,
    };

    storeBootstrapCache = {
      data: payload,
      expiresAt: Date.now() + 20_000,
    };

    return payload;
  } catch (error) {
    console.error('Database query failed in getPublicStoreBootstrap:', error);
    throw new Error('Failed to load storefront data. Please try again shortly.', {
      cause: error,
    });
  }
}

export async function getAdminFullState() {
  try {
    await ensureStoreSeeded();

    let settingsRow: any;
    let allSections: any[];
    let allProducts: any[];
    let allSales: any[];
    let allPromoCodes: any[];
    let allOrders: any[];
    let allMediaMeta: any[];

    if (isMemoryFallbackActive()) {
      settingsRow = memoryStore.settings;
      allSections = [...memoryStore.sections].sort(
        (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.id - b.id
      );
      allProducts = [...memoryStore.products].sort(
        (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.id - b.id
      );
      allSales = [...memoryStore.sales].sort((a, b) => b.id - a.id);
      allPromoCodes = [...memoryStore.promoCodes].sort((a, b) => b.id - a.id);
      allOrders = [...memoryStore.orders].sort((a, b) => b.id - a.id);
      allMediaMeta = memoryStore.mediaAssets.map(
        ({ dataUri: _d, ...meta }: any) => meta
      );
    } else {
      const [
        settingsRows,
        secRows,
        prodRows,
        saleRows,
        promoRows,
        orderRows,
        mediaRows,
      ] = await Promise.all([
        db.select().from(storeSettings).limit(1),
        db.select().from(sections).orderBy(asc(sections.displayOrder), asc(sections.id)),
        db.select().from(products).orderBy(asc(products.displayOrder), asc(products.id)),
        db.select().from(sales).orderBy(desc(sales.id)),
        db.select().from(promoCodes).orderBy(desc(promoCodes.id)),
        db.select().from(orders).orderBy(desc(orders.createdAt), desc(orders.id)),
        db
          .select({
            id: mediaAssets.id,
            filename: mediaAssets.filename,
            mimeType: mediaAssets.mimeType,
            sizeBytes: mediaAssets.sizeBytes,
            url: mediaAssets.url,
            category: mediaAssets.category,
            createdAt: mediaAssets.createdAt,
          })
          .from(mediaAssets)
          .orderBy(desc(mediaAssets.createdAt)),
      ]);
      settingsRow = settingsRows[0];
      allSections = secRows;
      allProducts = prodRows;
      allSales = saleRows;
      allPromoCodes = promoRows;
      allOrders = orderRows;
      allMediaMeta = mediaRows;
    }

    const now = new Date();
    const activeSales = allSales.filter((s) => isSaleCurrentlyActive(s, now));
    const enrichedProducts = allProducts.map((p) =>
      computeEffectiveProductPricing(p, activeSales)
    );

    const { adminPasswordHash: _ignored, ...safeSettings } = settingsRow;
    const normalizedSettings = {
      ...safeSettings,
      paymentMethodsConfig: ensurePaymentMethodsHaveQrSupport(
        safeSettings.paymentMethodsConfig
      ),
      adsConfig: ensureAdsConfigNormalized(safeSettings.adsConfig),
    };

    return {
      settings: normalizedSettings,
      sections: allSections,
      products: enrichedProducts,
      sales: allSales,
      promoCodes: allPromoCodes,
      orders: allOrders,
      mediaAssets: allMediaMeta,
      discordWebhookConfigured: Boolean(
        process.env.DISCORD_WEBHOOK_URL &&
          process.env.DISCORD_WEBHOOK_URL.startsWith('https://')
      ),
    };
  } catch (error) {
    console.error('Database query failed in getAdminFullState:', error);
    throw new Error('Failed to load admin console state.', { cause: error });
  }
}

export interface CartCalculationRequestItem {
  productId: number;
  quantity: number;
}

export interface ValidatedCartResult {
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

export async function evaluateCartAndPricing(
  requestedItems: CartCalculationRequestItem[],
  promoCodeInput?: string | null,
  minecraftUsername?: string | null
): Promise<ValidatedCartResult> {
  try {
    await ensureStoreSeeded();

    const normalizedCode = (promoCodeInput || '').trim().toUpperCase();

    let allSections: any[];
    let allProducts: any[];
    let allSales: any[];
    let allPromoCodes: any[];

    if (isMemoryFallbackActive()) {
      allSections = memoryStore.sections;
      allProducts = memoryStore.products;
      allSales = memoryStore.sales;
      allPromoCodes = normalizedCode ? memoryStore.promoCodes : [];
    } else {
      [allSections, allProducts, allSales, allPromoCodes] = await Promise.all([
        db.select().from(sections),
        db.select().from(products),
        db.select().from(sales),
        normalizedCode ? db.select().from(promoCodes) : Promise.resolve([]),
      ]);
    }

    const now = new Date();
    const activeSales = allSales.filter((s) => isSaleCurrentlyActive(s, now));
    const sectionNameMap = new Map(allSections.map((s) => [s.id, s.name]));
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    const lineItems: OrderLineItem[] = [];
    const stockErrors: string[] = [];
    let subtotalOriginal = 0;
    let subtotalAfterSales = 0;
    let saleDiscountTotal = 0;

    for (const reqItem of requestedItems) {
      const qty = Math.max(0, Math.floor(Number(reqItem.quantity) || 0));
      if (qty <= 0) continue;

      const product = productMap.get(Number(reqItem.productId));
      if (!product || !product.visible) {
        stockErrors.push(`Selected product #${reqItem.productId} is no longer available.`);
        continue;
      }

      if (product.stockType === 'limited') {
        const available = product.stockQuantity ?? 0;
        if (available <= 0) {
          stockErrors.push(`"${product.name}" is currently Out of Stock.`);
        } else if (qty > available) {
          stockErrors.push(
            `Only ${available} unit(s) of "${product.name}" remain in stock (requested ${qty}).`
          );
        }
      }

      const priced = computeEffectiveProductPricing(product, activeSales);
      const unitOriginalPrice = priced.originalPrice;
      const unitFinalPrice = priced.effectivePrice;
      const unitDiscount = priced.discountAmount;

      const lineSubtotal = roundCurrency(unitOriginalPrice * qty);
      const lineTotal = roundCurrency(unitFinalPrice * qty);
      const lineDiscount = roundCurrency(lineSubtotal - lineTotal);

      subtotalOriginal = roundCurrency(subtotalOriginal + lineSubtotal);
      subtotalAfterSales = roundCurrency(subtotalAfterSales + lineTotal);
      saleDiscountTotal = roundCurrency(saleDiscountTotal + lineDiscount);

      lineItems.push({
        productId: product.id,
        productCode: product.productCode,
        slug: product.slug,
        name: product.name,
        sectionName: product.sectionId
          ? sectionNameMap.get(product.sectionId) || 'General'
          : 'General',
        quantity: qty,
        unitOriginalPrice,
        unitFinalPrice,
        unitDiscount,
        lineSubtotal,
        lineDiscount,
        lineTotal,
        imageUrl: product.productImageUrl,
      });
    }

    let promoCodeApplied: string | null = null;
    let promoCodeDescription: string | null = null;
    let promoDiscountTotal = 0;
    let promoError: string | null = null;

    if (normalizedCode && lineItems.length > 0) {
      const matchedPromo = allPromoCodes.find(
        (c) => c.code.toUpperCase() === normalizedCode
      );

      if (!matchedPromo) {
        promoError = `Promo code "${normalizedCode}" was not found.`;
      } else if (!matchedPromo.enabled) {
        promoError = `Promo code "${normalizedCode}" is currently disabled.`;
      } else if (matchedPromo.startDate && new Date(matchedPromo.startDate) > now) {
        promoError = `Promo code "${normalizedCode}" is not active yet.`;
      } else if (matchedPromo.endDate && new Date(matchedPromo.endDate) < now) {
        promoError = `Promo code "${normalizedCode}" has expired.`;
      } else if (
        matchedPromo.maxTotalUses !== null &&
        matchedPromo.maxTotalUses !== undefined &&
        matchedPromo.currentUses >= matchedPromo.maxTotalUses
      ) {
        promoError = `Promo code "${normalizedCode}" has reached its maximum usage limit.`;
      } else if (subtotalAfterSales < matchedPromo.minOrderAmount) {
        promoError = `Promo code "${normalizedCode}" requires a minimum order of $${matchedPromo.minOrderAmount.toFixed(2)}.`;
      } else {
        if (minecraftUsername && minecraftUsername.trim()) {
          const cleanMc = minecraftUsername.trim().toLowerCase();
          let promoOrders: { status: string; minecraftUsername: string }[] = [];
          if (isMemoryFallbackActive()) {
            promoOrders = memoryStore.orders.filter(
              (o) => o.promoCode === matchedPromo.code
            );
          } else {
            promoOrders = await db
              .select({
                status: orders.status,
                minecraftUsername: orders.minecraftUsername,
              })
              .from(orders)
              .where(eq(orders.promoCode, matchedPromo.code));
          }

          const customerUses = promoOrders.filter(
            (o) =>
              o.status !== 'Cancelled' &&
              o.minecraftUsername.toLowerCase() === cleanMc
          ).length;

          if (customerUses >= matchedPromo.perCustomerLimit) {
            promoError = `Player "${minecraftUsername.trim()}" has already reached the limit (${matchedPromo.perCustomerLimit}x) for code "${normalizedCode}".`;
          }
        }

        if (!promoError) {
          let eligibleBase = 0;
          for (const item of lineItems) {
            const prod = productMap.get(item.productId)!;
            const matchesScope =
              matchedPromo.targetScope === 'store' ||
              (matchedPromo.targetScope === 'section' &&
                matchedPromo.targetSectionId === prod.sectionId) ||
              (matchedPromo.targetScope === 'product' &&
                matchedPromo.targetProductId === prod.id);

            if (!matchesScope) continue;

            if (!matchedPromo.stackWithSales && item.lineDiscount > 0) {
              continue;
            }

            eligibleBase = roundCurrency(eligibleBase + item.lineTotal);
          }

          if (eligibleBase <= 0) {
            promoError = !matchedPromo.stackWithSales
              ? `Promo code "${normalizedCode}" cannot be stacked with items already on sale.`
              : `No items in your cart match the category/product target for "${normalizedCode}".`;
          } else {
            let rawDiscount = 0;
            if (matchedPromo.discountType === 'percentage') {
              const pct = Math.min(100, Math.max(0, Number(matchedPromo.discountValue) || 0));
              rawDiscount = roundCurrency(eligibleBase * (pct / 100));
            } else {
              rawDiscount = roundCurrency(
                Math.min(eligibleBase, Math.max(0, Number(matchedPromo.discountValue) || 0))
              );
            }

            if (
              matchedPromo.maxDiscountAmount !== null &&
              matchedPromo.maxDiscountAmount !== undefined &&
              matchedPromo.maxDiscountAmount > 0
            ) {
              rawDiscount = Math.min(rawDiscount, roundCurrency(matchedPromo.maxDiscountAmount));
            }

            promoDiscountTotal = roundCurrency(Math.min(eligibleBase, rawDiscount));
            promoCodeApplied = matchedPromo.code.toUpperCase();
            promoCodeDescription = matchedPromo.description;
          }
        }
      }
    }

    const finalTotal = roundCurrency(Math.max(0, subtotalAfterSales - promoDiscountTotal));

    return {
      items: lineItems,
      subtotalOriginal,
      subtotalAfterSales,
      saleDiscountTotal,
      promoCodeApplied,
      promoCodeDescription,
      promoDiscountTotal,
      promoError,
      finalTotal,
      stockErrors,
    };
  } catch (error) {
    console.error('Database query failed in evaluateCartAndPricing:', error);
    throw new Error('Failed to calculate cart pricing.', { cause: error });
  }
}

export interface CreateOrderInput {
  idempotencyKey?: string;
  userUid?: string | null;
  minecraftUsername: string;
  discordUsername: string;
  items: CartCalculationRequestItem[];
  promoCode?: string | null;
  paymentMethod: string;
  paymentReference: string;
  receiptImageUrl?: string | null;
  customerNotes?: string | null;
}

export async function createOrderAtomic(input: CreateOrderInput) {
  try {
    await ensureStoreSeeded();

    if (input.idempotencyKey) {
      if (isMemoryFallbackActive()) {
        const found = memoryStore.orders.find(
          (o) => o.idempotencyKey === input.idempotencyKey
        );
        if (found) return found;
      } else {
        const existing = await db
          .select()
          .from(orders)
          .where(eq(orders.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (existing.length > 0) {
          return existing[0];
        }
      }
    }

    const evaluation = await evaluateCartAndPricing(
      input.items,
      input.promoCode,
      input.minecraftUsername
    );

    if (evaluation.items.length === 0) {
      throw new Error('Your cart is empty.');
    }

    if (evaluation.stockErrors.length > 0) {
      throw new Error(evaluation.stockErrors[0]);
    }

    if (input.promoCode && input.promoCode.trim() && evaluation.promoError) {
      throw new Error(evaluation.promoError);
    }

    if (isMemoryFallbackActive()) {
      for (const item of evaluation.items) {
        const prod = memoryStore.products.find((p) => p.id === item.productId);
        if (prod) {
          if (prod.stockType === 'limited') {
            prod.stockQuantity = Math.max(0, (prod.stockQuantity ?? 0) - item.quantity);
          }
          prod.totalSold = (prod.totalSold || 0) + item.quantity;
        }
      }
      if (evaluation.promoCodeApplied) {
        const promo = memoryStore.promoCodes.find(
          (c) => c.code === evaluation.promoCodeApplied
        );
        if (promo) promo.currentUses = (promo.currentUses || 0) + 1;
      }
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const invoiceId = `OV-2026-${randomDigits}`;
      const newOrder = {
        id: memoryStore.orders.length + 1,
        invoiceId,
        idempotencyKey: input.idempotencyKey || `${invoiceId}-${Date.now()}`,
        userUid: input.userUid || null,
        minecraftUsername: input.minecraftUsername.trim(),
        discordUsername: input.discordUsername.trim(),
        items: evaluation.items,
        subtotalOriginal: evaluation.subtotalOriginal,
        saleDiscountTotal: evaluation.saleDiscountTotal,
        promoCode: evaluation.promoCodeApplied,
        promoDiscountTotal: evaluation.promoDiscountTotal,
        finalTotal: evaluation.finalTotal,
        paymentMethod: input.paymentMethod.trim(),
        paymentReference: input.paymentReference.trim(),
        receiptImageUrl: input.receiptImageUrl || null,
        customerNotes: input.customerNotes?.trim() || null,
        adminNotes: null,
        status: 'Pending',
        stockDeducted: true,
        discordNotified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.orders.unshift(newOrder);
      invalidateStoreCache();
      return newOrder;
    }

    const createdOrder = await db.transaction(async (tx) => {
      for (const item of evaluation.items) {
        const currentRows = await tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        const currentProduct = currentRows[0];
        if (!currentProduct || !currentProduct.visible) {
          throw new Error(`Product "${item.name}" is no longer available.`);
        }

        if (currentProduct.stockType === 'limited') {
          const currentStock = currentProduct.stockQuantity ?? 0;
          if (currentStock < item.quantity) {
            throw new Error(
              `Insufficient stock for "${item.name}". Only ${currentStock} left.`
            );
          }

          await tx
            .update(products)
            .set({
              stockQuantity: currentStock - item.quantity,
              totalSold: (currentProduct.totalSold || 0) + item.quantity,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));
        } else {
          await tx
            .update(products)
            .set({
              totalSold: (currentProduct.totalSold || 0) + item.quantity,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId));
        }
      }

      if (evaluation.promoCodeApplied) {
        const promoRows = await tx
          .select()
          .from(promoCodes)
          .where(eq(promoCodes.code, evaluation.promoCodeApplied))
          .limit(1);

        const promo = promoRows[0];
        if (promo) {
          if (
            promo.maxTotalUses !== null &&
            promo.maxTotalUses !== undefined &&
            promo.currentUses >= promo.maxTotalUses
          ) {
            throw new Error(`Promo code "${promo.code}" just reached its usage limit.`);
          }
          await tx
            .update(promoCodes)
            .set({ currentUses: promo.currentUses + 1 })
            .where(eq(promoCodes.id, promo.id));
        }
      }

      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const invoiceId = `OV-2026-${randomDigits}`;

      const inserted = await tx
        .insert(orders)
        .values({
          invoiceId,
          idempotencyKey: input.idempotencyKey || `${invoiceId}-${Date.now()}`,
          userUid: input.userUid || null,
          minecraftUsername: input.minecraftUsername.trim(),
          discordUsername: input.discordUsername.trim(),
          items: evaluation.items,
          subtotalOriginal: evaluation.subtotalOriginal,
          saleDiscountTotal: evaluation.saleDiscountTotal,
          promoCode: evaluation.promoCodeApplied,
          promoDiscountTotal: evaluation.promoDiscountTotal,
          finalTotal: evaluation.finalTotal,
          paymentMethod: input.paymentMethod.trim(),
          paymentReference: input.paymentReference.trim(),
          receiptImageUrl: input.receiptImageUrl || null,
          customerNotes: input.customerNotes?.trim() || null,
          adminNotes: null,
          status: 'Pending',
          stockDeducted: true,
          discordNotified: false,
        })
        .returning();

      return inserted[0];
    });

    invalidateStoreCache();
    return createdOrder;
  } catch (error: any) {
    console.error('Atomic checkout transaction error:', error);
    throw new Error(error.message || 'Checkout failed. Please verify your cart and try again.', {
      cause: error,
    });
  }
}

export async function updateOrderStatusAndNotes(
  orderId: number,
  newStatus: string,
  adminNotes?: string
) {
  try {
    await ensureStoreSeeded();
    if (isMemoryFallbackActive()) {
      const existing = memoryStore.orders.find((o) => o.id === orderId);
      if (!existing) throw new Error('Order not found.');
      const previousStatus = existing.status;
      existing.status = newStatus;
      if (adminNotes !== undefined) existing.adminNotes = adminNotes;
      existing.updatedAt = new Date();
      invalidateStoreCache();
      return { updatedOrder: existing, previousStatus };
    }

    const result = await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      const existing = existingRows[0];
      if (!existing) {
        throw new Error('Order not found.');
      }

      const previousStatus = existing.status;
      let stockDeducted = existing.stockDeducted;

      if (newStatus === 'Cancelled' && existing.stockDeducted) {
        for (const item of existing.items) {
          const prodRows = await tx
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);
          const prod = prodRows[0];
          if (prod) {
            await tx
              .update(products)
              .set({
                stockQuantity:
                  prod.stockType === 'limited'
                    ? (prod.stockQuantity ?? 0) + item.quantity
                    : prod.stockQuantity,
                totalSold: Math.max(0, (prod.totalSold || 0) - item.quantity),
                updatedAt: new Date(),
              })
              .where(eq(products.id, prod.id));
          }
        }
        stockDeducted = false;
      } else if (newStatus !== 'Cancelled' && !existing.stockDeducted) {
        for (const item of existing.items) {
          const prodRows = await tx
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .limit(1);
          const prod = prodRows[0];
          if (prod) {
            await tx
              .update(products)
              .set({
                stockQuantity:
                  prod.stockType === 'limited'
                    ? Math.max(0, (prod.stockQuantity ?? 0) - item.quantity)
                    : prod.stockQuantity,
                totalSold: (prod.totalSold || 0) + item.quantity,
                updatedAt: new Date(),
              })
              .where(eq(products.id, prod.id));
          }
        }
        stockDeducted = true;
      }

      const updatedRows = await tx
        .update(orders)
        .set({
          status: newStatus,
          adminNotes: adminNotes !== undefined ? adminNotes : existing.adminNotes,
          stockDeducted,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      return { updatedOrder: updatedRows[0], previousStatus };
    });

    invalidateStoreCache();
    return result;
  } catch (error: any) {
    console.error('Database query failed in updateOrderStatusAndNotes:', error);
    throw new Error(error.message || 'Failed to update order status.', { cause: error });
  }
}

export async function markOrderDiscordNotified(orderId: number) {
  try {
    await ensureStoreSeeded();
    if (isMemoryFallbackActive()) {
      const found = memoryStore.orders.find((o) => o.id === orderId);
      if (found) found.discordNotified = true;
      return;
    }
    await db
      .update(orders)
      .set({ discordNotified: true })
      .where(eq(orders.id, orderId));
  } catch (error) {
    console.error('Failed to mark order discordNotified:', error);
  }
}

export async function lookupCustomerOrder(invoiceId: string, usernameVerify: string) {
  try {
    await ensureStoreSeeded();
    const cleanInvoice = invoiceId.trim().toUpperCase();
    const cleanUser = usernameVerify.trim().toLowerCase();

    let order: any;
    if (isMemoryFallbackActive()) {
      order = memoryStore.orders.find(
        (o) => String(o.invoiceId).toUpperCase() === cleanInvoice
      );
    } else {
      const rows = await db
        .select()
        .from(orders)
        .where(eq(orders.invoiceId, cleanInvoice))
        .limit(1);
      order = rows[0];
    }

    if (!order) return null;

    const matchesMinecraft = order.minecraftUsername.toLowerCase() === cleanUser;
    const matchesDiscord = order.discordUsername.toLowerCase() === cleanUser;

    if (!matchesMinecraft && !matchesDiscord) {
      return null;
    }

    const maskedRef =
      order.paymentReference.length > 4
        ? `${'*'.repeat(Math.max(2, order.paymentReference.length - 4))}${order.paymentReference.slice(-4)}`
        : '****';

    return {
      invoiceId: order.invoiceId,
      minecraftUsername: order.minecraftUsername,
      discordUsername: order.discordUsername,
      items: order.items,
      subtotalOriginal: order.subtotalOriginal,
      saleDiscountTotal: order.saleDiscountTotal,
      promoCode: order.promoCode,
      promoDiscountTotal: order.promoDiscountTotal,
      finalTotal: order.finalTotal,
      paymentMethod: order.paymentMethod,
      paymentReferenceMasked: maskedRef,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  } catch (error) {
    console.error('Database query failed in lookupCustomerOrder:', error);
    throw new Error('Order lookup failed. Please try again.', { cause: error });
  }
}

export async function getStoreAnalytics(days = 30) {
  try {
    await ensureStoreSeeded();

    let allOrders: any[];
    let allProducts: any[];
    let allPromos: any[];

    if (isMemoryFallbackActive()) {
      allOrders = memoryStore.orders;
      allProducts = memoryStore.products;
      allPromos = memoryStore.promoCodes;
    } else {
      [allOrders, allProducts, allPromos] = await Promise.all([
        db.select().from(orders).orderBy(desc(orders.createdAt)),
        db.select().from(products),
        db.select().from(promoCodes),
      ]);
    }

    const cutoff =
      days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : new Date(0);

    const filteredOrders = allOrders.filter(
      (o) => !o.createdAt || new Date(o.createdAt) >= cutoff
    );

    let totalRevenue = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let paidCount = 0;
    let cancelledCount = 0;
    let totalItemsSold = 0;

    const productSalesMap = new Map<
      number,
      { id: number; name: string; productCode: string; quantity: number; revenue: number }
    >();

    for (const o of filteredOrders) {
      if (o.status === 'Completed') completedCount++;
      else if (o.status === 'Pending') pendingCount++;
      else if (o.status === 'Processing') processingCount++;
      else if (o.status === 'Paid') paidCount++;
      else if (o.status === 'Cancelled') cancelledCount++;

      if (o.status !== 'Cancelled') {
        totalRevenue = roundCurrency(totalRevenue + Number(o.finalTotal || 0));
        for (const item of o.items) {
          totalItemsSold += item.quantity;
          const prev = productSalesMap.get(item.productId) || {
            id: item.productId,
            name: item.name,
            productCode: item.productCode,
            quantity: 0,
            revenue: 0,
          };
          prev.quantity += item.quantity;
          prev.revenue = roundCurrency(prev.revenue + item.lineTotal);
          productSalesMap.set(item.productId, prev);
        }
      }
    }

    const popularProducts = Array.from(productSalesMap.values()).sort(
      (a, b) => b.quantity - a.quantity || b.revenue - a.revenue
    );

    const lowStockProducts = allProducts
      .filter(
        (p) =>
          p.stockType === 'limited' && (p.stockQuantity ?? 0) <= p.lowStockThreshold
      )
      .map((p) => ({
        id: p.id,
        productCode: p.productCode,
        name: p.name,
        stockQuantity: p.stockQuantity ?? 0,
        lowStockThreshold: p.lowStockThreshold,
      }));

    const promoUsage = allPromos.map((p) => ({
      id: p.id,
      code: p.code,
      currentUses: p.currentUses,
      maxTotalUses: p.maxTotalUses,
      discountType: p.discountType,
      discountValue: p.discountValue,
      enabled: p.enabled,
    }));

    return {
      rangeDays: days,
      totalRevenue,
      totalOrders: filteredOrders.length,
      completedCount,
      pendingCount,
      processingCount,
      paidCount,
      cancelledCount,
      totalItemsSold,
      averageOrderValue:
        filteredOrders.length - cancelledCount > 0
          ? roundCurrency(totalRevenue / (filteredOrders.length - cancelledCount))
          : 0,
      popularProducts,
      lowStockProducts,
      promoUsage,
    };
  } catch (error) {
    console.error('Database query failed in getStoreAnalytics:', error);
    throw new Error('Failed to compute store analytics.', { cause: error });
  }
}

export async function saveMediaAsset(payload: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataUri: string;
  category: string;
}) {
  try {
    await ensureStoreSeeded();
    if (isMemoryFallbackActive()) {
      const maxId = memoryStore.mediaAssets.reduce(
        (max: number, m: any) => Math.max(max, Number(m.id) || 0),
        0
      );
      const id = maxId + 1;
      const item = {
        id,
        filename: payload.filename,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        url: `/api/media/${id}`,
        dataUri: payload.dataUri,
        category: payload.category,
        createdAt: new Date(),
      };
      memoryStore.mediaAssets.unshift(item);
      mediaAssetCache.set(id, item);
      await persistStoreStateToDisk();
      return item;
    }

    const inserted = await db
      .insert(mediaAssets)
      .values({
        filename: payload.filename,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        url: '/api/media/pending',
        dataUri: payload.dataUri,
        category: payload.category,
      })
      .returning();

    const row = inserted[0];
    const cleanUrl = `/api/media/${row.id}`;
    const updated = await db
      .update(mediaAssets)
      .set({ url: cleanUrl })
      .where(eq(mediaAssets.id, row.id))
      .returning();

    if (mediaAssetCache.size > 40) {
      const oldestKey = mediaAssetCache.keys().next().value;
      if (oldestKey !== undefined) mediaAssetCache.delete(oldestKey);
    }
    mediaAssetCache.set(updated[0].id, updated[0]);
    await persistStoreStateToDisk();

    return updated[0];
  } catch (error) {
    console.error('Database query failed in saveMediaAsset:', error);
    throw new Error('Failed to store uploaded image in PostgreSQL.', { cause: error });
  }
}

export async function getMediaAssetById(id: number) {
  try {
    const cached = mediaAssetCache.get(id);
    if (cached) return cached;

    await ensureStoreSeeded();
    if (isMemoryFallbackActive()) {
      return memoryStore.mediaAssets.find((m) => m.id === id) || null;
    }

    const rows = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, id))
      .limit(1);

    const row = rows[0] || null;
    if (row) {
      if (mediaAssetCache.size > 40) {
        const oldestKey = mediaAssetCache.keys().next().value;
        if (oldestKey !== undefined) mediaAssetCache.delete(oldestKey);
      }
      mediaAssetCache.set(id, row);
    }
    return row;
  } catch (error) {
    console.error('Database query failed in getMediaAssetById:', error);
    throw new Error('Failed to retrieve media asset.', { cause: error });
  }
}

export async function exportStoreBackupData() {
  try {
    await ensureStoreSeeded();
    if (isMemoryFallbackActive()) {
      const { adminPasswordHash: _h, ...safeSettings } = memoryStore.settings;
      return {
        exportedAt: new Date().toISOString(),
        version: '2.0.0',
        store: 'OwnVerse Store',
        data: {
          storeSettings: [safeSettings],
          sections: memoryStore.sections,
          products: memoryStore.products,
          sales: memoryStore.sales,
          promoCodes: memoryStore.promoCodes,
          orders: memoryStore.orders,
          mediaAssets: memoryStore.mediaAssets,
        },
      };
    }

    const [
      settingsRows,
      allSections,
      allProducts,
      allSales,
      allPromos,
      allOrders,
      allMedia,
    ] = await Promise.all([
      db.select().from(storeSettings),
      db.select().from(sections).orderBy(asc(sections.id)),
      db.select().from(products).orderBy(asc(products.id)),
      db.select().from(sales).orderBy(asc(sales.id)),
      db.select().from(promoCodes).orderBy(asc(promoCodes.id)),
      db.select().from(orders).orderBy(asc(orders.id)),
      db.select().from(mediaAssets).orderBy(asc(mediaAssets.id)),
    ]);

    const safeSettings = settingsRows.map(({ adminPasswordHash: _h, ...rest }) => rest);

    return {
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      store: 'OwnVerse Store',
      data: {
        storeSettings: safeSettings,
        sections: allSections,
        products: allProducts,
        sales: allSales,
        promoCodes: allPromos,
        orders: allOrders,
        mediaAssets: allMedia,
      },
    };
  } catch (error) {
    console.error('Database query failed in exportStoreBackupData:', error);
    throw new Error('Failed to export store backup.', { cause: error });
  }
}
