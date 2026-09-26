import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  storeSettings,
  sections,
  products,
  sales,
  promoCodes,
  mediaAssets,
} from './schema.ts';
import { hashPassword, verifyPassword } from '../middleware/auth.ts';
import { ensureStoreSeeded } from './seed.ts';
import { invalidateStoreCache, invalidateMediaCache } from './repository.ts';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function verifyAdminUnlockCredential(accessKey: string): Promise<boolean> {
  try {
    await ensureStoreSeeded();
    const trimmed = accessKey.trim();
    if (!trimmed) return false;

    const rows = await db.select().from(storeSettings).limit(1);
    const settings = rows[0];

    // Primary check: verify against scrypt-hashed password in PostgreSQL
    if (settings?.adminPasswordHash) {
      if (verifyPassword(trimmed, settings.adminPasswordHash)) {
        return true;
      }
    }

    // Optional explicit environment override if configured by server operator
    if (process.env.ADMIN_ACCESS_KEY && trimmed === process.env.ADMIN_ACCESS_KEY.trim()) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Database query failed in verifyAdminUnlockCredential:', error);
    throw new Error('Failed to verify admin credentials.', { cause: error });
  }
}

export async function updateStoreSettingsData(payload: Record<string, any>) {
  try {
    await ensureStoreSeeded();
    const rows = await db.select().from(storeSettings).limit(1);
    const current = rows[0];
    if (!current) throw new Error('Store settings row missing.');

    const updateFields: Partial<typeof storeSettings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof payload.storeName === 'string') updateFields.storeName = payload.storeName.trim();
    if (typeof payload.storeTagline === 'string') updateFields.storeTagline = payload.storeTagline.trim();
    if (typeof payload.logoUrl === 'string') updateFields.logoUrl = payload.logoUrl.trim();
    if (typeof payload.faviconUrl === 'string') updateFields.faviconUrl = payload.faviconUrl.trim();
    if (typeof payload.serverIp === 'string') updateFields.serverIp = payload.serverIp.trim();
    if (payload.serverPort !== undefined) updateFields.serverPort = Number(payload.serverPort) || 25565;
    if (typeof payload.serverStatusMode === 'string') updateFields.serverStatusMode = payload.serverStatusMode;
    if (typeof payload.manualServerOnline === 'boolean') updateFields.manualServerOnline = payload.manualServerOnline;
    if (payload.manualPlayersOnline !== undefined) updateFields.manualPlayersOnline = Number(payload.manualPlayersOnline) || 0;
    if (payload.manualPlayersMax !== undefined) updateFields.manualPlayersMax = Number(payload.manualPlayersMax) || 500;
    if (typeof payload.discordInviteUrl === 'string') updateFields.discordInviteUrl = payload.discordInviteUrl.trim();
    if (typeof payload.supportEmail === 'string') updateFields.supportEmail = payload.supportEmail.trim();
    if (typeof payload.supportDiscord === 'string') updateFields.supportDiscord = payload.supportDiscord.trim();
    if (typeof payload.supportHours === 'string') updateFields.supportHours = payload.supportHours.trim();
    if (typeof payload.currencyCode === 'string') updateFields.currencyCode = payload.currencyCode.trim();
    if (typeof payload.currencySymbol === 'string') updateFields.currencySymbol = payload.currencySymbol.trim();
    if (payload.themeConfig && typeof payload.themeConfig === 'object') {
      updateFields.themeConfig = { ...current.themeConfig, ...payload.themeConfig };
    }
    if (payload.heroConfig && typeof payload.heroConfig === 'object') {
      updateFields.heroConfig = { ...current.heroConfig, ...payload.heroConfig };
    }
    if (payload.promoBannerConfig && typeof payload.promoBannerConfig === 'object') {
      updateFields.promoBannerConfig = { ...current.promoBannerConfig, ...payload.promoBannerConfig };
    }
    if (Array.isArray(payload.paymentMethodsConfig)) {
      updateFields.paymentMethodsConfig = payload.paymentMethodsConfig;
    }
    if (payload.policiesConfig && typeof payload.policiesConfig === 'object') {
      updateFields.policiesConfig = { ...current.policiesConfig, ...payload.policiesConfig };
    }
    if (Array.isArray(payload.faqItems)) {
      updateFields.faqItems = payload.faqItems;
    }
    if (typeof payload.newAdminPassword === 'string' && payload.newAdminPassword.trim().length >= 6) {
      updateFields.adminPasswordHash = hashPassword(payload.newAdminPassword.trim());
    }

    const updated = await db
      .update(storeSettings)
      .set(updateFields)
      .where(eq(storeSettings.id, current.id))
      .returning();

    invalidateStoreCache();
    const { adminPasswordHash: _h, ...safe } = updated[0];
    return safe;
  } catch (error) {
    console.error('Database query failed in updateStoreSettingsData:', error);
    throw new Error('Failed to update store settings.', { cause: error });
  }
}

export async function upsertSectionData(payload: Record<string, any>) {
  try {
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('Section name is required.');
    const slug = slugify(payload.slug || name) || `section-${Date.now()}`;

    const values = {
      name,
      slug,
      description: String(payload.description || '').trim(),
      icon: String(payload.icon || 'Crown').trim(),
      accentColor: String(payload.accentColor || '#EF4444').trim(),
      bannerUrl: payload.bannerUrl ? String(payload.bannerUrl).trim() : null,
      displayOrder: Number(payload.displayOrder) || 0,
      visible: payload.visible !== undefined ? Boolean(payload.visible) : true,
      updatedAt: new Date(),
    };

    let result;
    if (payload.id) {
      const updated = await db
        .update(sections)
        .set(values)
        .where(eq(sections.id, Number(payload.id)))
        .returning();
      result = updated[0];
    } else {
      const inserted = await db
        .insert(sections)
        .values(values)
        .returning();
      result = inserted[0];
    }
    invalidateStoreCache();
    return result;
  } catch (error: any) {
    console.error('Database query failed in upsertSectionData:', error);
    throw new Error(error.message || 'Failed to save section.', { cause: error });
  }
}

export async function reorderSectionsData(orderedIds: number[]) {
  try {
    await db.transaction(async (tx) => {
      for (let idx = 0; idx < orderedIds.length; idx++) {
        await tx
          .update(sections)
          .set({ displayOrder: idx + 1, updatedAt: new Date() })
          .where(eq(sections.id, Number(orderedIds[idx])));
      }
    });
    invalidateStoreCache();
    return true;
  } catch (error) {
    console.error('Database query failed in reorderSectionsData:', error);
    throw new Error('Failed to reorder sections.', { cause: error });
  }
}

export async function deleteSectionData(id: number) {
  try {
    await db.delete(sections).where(eq(sections.id, id));
    invalidateStoreCache();
    return true;
  } catch (error) {
    console.error('Database query failed in deleteSectionData:', error);
    throw new Error('Failed to delete section.', { cause: error });
  }
}

export async function upsertProductData(payload: Record<string, any>) {
  try {
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('Product name is required.');

    const productCode =
      String(payload.productCode || '').trim().toUpperCase() ||
      `OV-ITEM-${Math.floor(1000 + Math.random() * 9000)}`;
    const slug = slugify(payload.slug || name) || `item-${Date.now()}`;

    const price = Math.max(0, Number(payload.price) || 0);
    const salePrice =
      payload.salePrice !== null &&
      payload.salePrice !== undefined &&
      payload.salePrice !== '' &&
      Number(payload.salePrice) >= 0
        ? Number(payload.salePrice)
        : null;

    const stockType = payload.stockType === 'limited' ? 'limited' : 'unlimited';
    const stockQuantity =
      stockType === 'limited'
        ? Math.max(0, Math.floor(Number(payload.stockQuantity) || 0))
        : null;

    const cleanProductImage = String(payload.productImageUrl ?? '').trim();
    const cleanKitPreviewImage = String(
      payload.kitPreviewImageUrl !== undefined
        ? payload.kitPreviewImageUrl
        : cleanProductImage
    ).trim();

    const values = {
      productCode,
      slug,
      sectionId: payload.sectionId ? Number(payload.sectionId) : null,
      name,
      price,
      salePrice,
      emojiIcon: String(payload.emojiIcon || '⚔️').trim(),
      customLogoUrl:
        payload.customLogoUrl && String(payload.customLogoUrl).trim()
          ? String(payload.customLogoUrl).trim()
          : null,
      productImageUrl: cleanProductImage,
      kitPreviewImageUrl: cleanKitPreviewImage,
      shortDescription: String(payload.shortDescription || '').trim(),
      markdownDescription: String(payload.markdownDescription || '').trim(),
      rarityTier: String(payload.rarityTier || 'Legendary').trim(),
      customBadge: payload.customBadge ? String(payload.customBadge).trim() : null,
      badgeColor: String(payload.badgeColor || '#DC2626').trim(),
      cardAccentColor: String(payload.cardAccentColor || '#EF4444').trim(),
      buttonColor: String(payload.buttonColor || '#DC2626').trim(),
      tags: Array.isArray(payload.tags)
        ? payload.tags.map((t: any) => String(t).trim()).filter(Boolean)
        : [],
      featured: Boolean(payload.featured),
      visible: payload.visible !== undefined ? Boolean(payload.visible) : true,
      displayOrder: Number(payload.displayOrder) || 0,
      stockType,
      stockQuantity,
      lowStockThreshold: Math.max(1, Number(payload.lowStockThreshold) || 5),
      whatYouGet: Array.isArray(payload.whatYouGet)
        ? payload.whatYouGet.map((s: any) => String(s).trim()).filter(Boolean)
        : [],
      requirements: Array.isArray(payload.requirements)
        ? payload.requirements.map((s: any) => String(s).trim()).filter(Boolean)
        : [],
      commandsPerks: Array.isArray(payload.commandsPerks)
        ? payload.commandsPerks.map((s: any) => String(s).trim()).filter(Boolean)
        : [],
      duration: String(payload.duration || 'Permanent').trim(),
      deliveryInfo: String(payload.deliveryInfo || 'Instant automated delivery.').trim(),
      importantNotes: String(payload.importantNotes || '').trim(),
      productTerms: String(payload.productTerms || '').trim(),
      customInfoBlocks: Array.isArray(payload.customInfoBlocks)
        ? payload.customInfoBlocks
        : [],
      updatedAt: new Date(),
    };

    let result;
    if (payload.id) {
      const updated = await db
        .update(products)
        .set(values)
        .where(eq(products.id, Number(payload.id)))
        .returning();
      result = updated[0];
    } else {
      const inserted = await db
        .insert(products)
        .values(values)
        .returning();
      result = inserted[0];
    }
    invalidateStoreCache();
    return result;
  } catch (error: any) {
    console.error('Database query failed in upsertProductData:', error);
    throw new Error(error.message || 'Failed to save product.', { cause: error });
  }
}

export async function deleteProductData(id: number) {
  try {
    await db.delete(products).where(eq(products.id, id));
    invalidateStoreCache();
    return true;
  } catch (error) {
    console.error('Database query failed in deleteProductData:', error);
    throw new Error('Failed to delete product.', { cause: error });
  }
}

export async function deleteMediaAssetData(id: number) {
  try {
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
    invalidateMediaCache(id);
    invalidateStoreCache();
    return true;
  } catch (error) {
    console.error('Database query failed in deleteMediaAssetData:', error);
    throw new Error('Failed to delete media asset.', { cause: error });
  }
}

export async function upsertSaleData(payload: Record<string, any>) {
  try {
    const title = String(payload.title || '').trim();
    if (!title) throw new Error('Sale title is required.');

    const values = {
      title,
      description: String(payload.description || '').trim(),
      badgeText: String(payload.badgeText || 'SALE').trim(),
      discountType: payload.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: Math.max(0, Number(payload.discountValue) || 0),
      targetScope:
        payload.targetScope === 'section' || payload.targetScope === 'product'
          ? payload.targetScope
          : 'store',
      targetSectionId: payload.targetSectionId ? Number(payload.targetSectionId) : null,
      targetProductId: payload.targetProductId ? Number(payload.targetProductId) : null,
      startDate: payload.startDate ? new Date(payload.startDate) : null,
      endDate: payload.endDate ? new Date(payload.endDate) : null,
      showCountdown: payload.showCountdown !== undefined ? Boolean(payload.showCountdown) : true,
      enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : true,
    };

    let result;
    if (payload.id) {
      const updated = await db
        .update(sales)
        .set(values)
        .where(eq(sales.id, Number(payload.id)))
        .returning();
      result = updated[0];
    } else {
      const inserted = await db
        .insert(sales)
        .values(values)
        .returning();
      result = inserted[0];
    }
    invalidateStoreCache();
    return result;
  } catch (error: any) {
    console.error('Database query failed in upsertSaleData:', error);
    throw new Error(error.message || 'Failed to save sale campaign.', { cause: error });
  }
}

export async function deleteSaleData(id: number) {
  try {
    await db.delete(sales).where(eq(sales.id, id));
    invalidateStoreCache();
    return true;
  } catch (error) {
    console.error('Database query failed in deleteSaleData:', error);
    throw new Error('Failed to delete sale campaign.', { cause: error });
  }
}

export async function upsertPromoCodeData(payload: Record<string, any>) {
  try {
    const code = String(payload.code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    if (!code) throw new Error('Valid alphanumeric promo code is required.');

    const values = {
      code,
      description: String(payload.description || '').trim(),
      discountType: payload.discountType === 'fixed' ? 'fixed' : 'percentage',
      discountValue: Math.max(0, Number(payload.discountValue) || 0),
      targetScope:
        payload.targetScope === 'section' || payload.targetScope === 'product'
          ? payload.targetScope
          : 'store',
      targetSectionId: payload.targetSectionId ? Number(payload.targetSectionId) : null,
      targetProductId: payload.targetProductId ? Number(payload.targetProductId) : null,
      minOrderAmount: Math.max(0, Number(payload.minOrderAmount) || 0),
      maxDiscountAmount:
        payload.maxDiscountAmount !== null &&
        payload.maxDiscountAmount !== undefined &&
        payload.maxDiscountAmount !== '' &&
        Number(payload.maxDiscountAmount) > 0
          ? Number(payload.maxDiscountAmount)
          : null,
      maxTotalUses:
        payload.maxTotalUses !== null &&
        payload.maxTotalUses !== undefined &&
        payload.maxTotalUses !== '' &&
        Number(payload.maxTotalUses) > 0
          ? Math.floor(Number(payload.maxTotalUses))
          : null,
      perCustomerLimit: Math.max(1, Math.floor(Number(payload.perCustomerLimit) || 1)),
      stackWithSales:
        payload.stackWithSales !== undefined ? Boolean(payload.stackWithSales) : true,
      startDate: payload.startDate ? new Date(payload.startDate) : null,
      endDate: payload.endDate ? new Date(payload.endDate) : null,
      enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : true,
    };

    let result;
    if (payload.id) {
      const updated = await db
        .update(promoCodes)
        .set(values)
        .where(eq(promoCodes.id, Number(payload.id)))
        .returning();
      result = updated[0];
    } else {
      const inserted = await db
        .insert(promoCodes)
        .values(values)
        .returning();
      result = inserted[0];
    }
    invalidateStoreCache();
    return result;
  } catch (error: any) {
    console.error('Database query failed in upsertPromoCodeData:', error);
    throw new Error(error.message || 'Failed to save promo code.', { cause: error });
  }
}

export async function deletePromoCodeData(id: number) {
  try {
    await db.delete(promoCodes).where(eq(promoCodes.id, id));
    invalidateStoreCache();
    return true;
  } catch (error) {
    console.error('Database query failed in deletePromoCodeData:', error);
    throw new Error('Failed to delete promo code.', { cause: error });
  }
}

export async function importStoreBackupData(backupPayload: any) {
  try {
    if (!backupPayload || !backupPayload.data) {
      throw new Error('Invalid backup file format.');
    }

    const { data } = backupPayload;

    await db.transaction(async (tx) => {
      if (Array.isArray(data.storeSettings) && data.storeSettings.length > 0) {
        const currentSettings = await tx.select().from(storeSettings).limit(1);
        const imported = data.storeSettings[0];
        if (currentSettings.length > 0) {
          await tx
            .update(storeSettings)
            .set({
              storeName: imported.storeName || 'OwnVerse Store',
              storeTagline: imported.storeTagline || 'Official Minecraft Network Storefront',
              logoUrl: imported.logoUrl ?? '',
              serverIp: imported.serverIp || 'play.ownverse.mc',
              discordInviteUrl: imported.discordInviteUrl || 'https://discord.gg/ownverse',
              themeConfig: imported.themeConfig,
              heroConfig: imported.heroConfig,
              promoBannerConfig: imported.promoBannerConfig,
              paymentMethodsConfig: imported.paymentMethodsConfig,
              policiesConfig: imported.policiesConfig,
              faqItems: imported.faqItems,
              updatedAt: new Date(),
            })
            .where(eq(storeSettings.id, currentSettings[0].id));
        }
      }

      if (Array.isArray(data.promoCodes)) {
        for (const promo of data.promoCodes) {
          if (!promo.code) continue;
          await tx
            .insert(promoCodes)
            .values({
              code: String(promo.code).toUpperCase(),
              description: promo.description || '',
              discountType: promo.discountType || 'percentage',
              discountValue: Number(promo.discountValue) || 0,
              targetScope: promo.targetScope || 'store',
              minOrderAmount: Number(promo.minOrderAmount) || 0,
              perCustomerLimit: Number(promo.perCustomerLimit) || 1,
              stackWithSales: Boolean(promo.stackWithSales),
              enabled: Boolean(promo.enabled),
            })
            .onConflictDoNothing();
        }
      }
    });

    invalidateStoreCache();
    return true;
  } catch (error: any) {
    console.error('Database query failed in importStoreBackupData:', error);
    throw new Error(error.message || 'Failed to import store backup.', { cause: error });
  }
}
