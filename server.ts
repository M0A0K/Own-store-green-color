import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import {
  getPublicStoreBootstrap,
  getAdminFullState,
  evaluateCartAndPricing,
  createOrderAtomic,
  updateOrderStatusAndNotes,
  markOrderDiscordNotified,
  lookupCustomerOrder,
  getStoreAnalytics,
  saveMediaAsset,
  getMediaAssetById,
  exportStoreBackupData,
  promoteUserToAdmin,
} from './src/db/repository.ts';
import {
  verifyAdminUnlockCredential,
  updateStoreSettingsData,
  upsertSectionData,
  reorderSectionsData,
  deleteSectionData,
  upsertProductData,
  deleteProductData,
  deleteMediaAssetData,
  upsertSaleData,
  deleteSaleData,
  upsertPromoCodeData,
  deletePromoCodeData,
  importStoreBackupData,
} from './src/db/adminRepository.ts';
import {
  optionalAuth,
  requireAdmin,
  createAdminSessionToken,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  sendNewOrderDiscordWebhook,
  sendOrderStatusUpdateDiscordWebhook,
} from './src/services/discord.ts';
import { fetchMinecraftServerStatus } from './src/services/minecraftStatus.ts';
import { generateStandaloneStoreHtml } from './src/lib/standaloneHtmlGenerator.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security & body parsing middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '6mb' }));

// Simple per-IP rate limiter for API routes
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || record.resetAt < now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count += 1;
    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
    }
    return next();
  };
}

// Serve static assets with caching
app.use(
  '/src/assets',
  express.static(path.join(__dirname, 'src', 'assets'), {
    maxAge: '7d',
  })
);

// Health Check Endpoint (Railway & Cloud Run ready)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'OwnVerse Store API',
    timestamp: new Date().toISOString(),
  });
});

// SEO: robots.txt
app.get('/robots.txt', (req: Request, res: Response) => {
  const host = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${host}/sitemap.xml\n`
  );
});

// SEO: Dynamic sitemap.xml
app.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const host = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(
      /\/$/,
      ''
    );
    const store = await getPublicStoreBootstrap();
    const staticPaths = [
      '/',
      '/order-lookup',
      '/faq',
      '/support',
      '/terms',
      '/privacy',
      '/refund-policy',
      '/delivery-policy',
    ];

    const urls = [
      ...staticPaths.map(
        (p) =>
          `<url><loc>${host}${p}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`
      ),
      ...store.sections.map(
        (s: any) =>
          `<url><loc>${host}/section/${encodeURIComponent(s.slug)}</loc><changefreq>daily</changefreq><priority>0.85</priority></url>`
      ),
      ...store.products.map(
        (p: any) =>
          `<url><loc>${host}/product/${encodeURIComponent(p.slug)}</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  } catch {
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>');
  }
});

// Serve PostgreSQL-persisted media assets with in-memory caching & immutable HTTP headers
app.get('/api/media/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).send('Invalid media ID');
    }
    const asset = await getMediaAssetById(id);
    if (!asset || !asset.dataUri) {
      return res.status(404).send('Media asset not found');
    }

    const matches = asset.dataUri.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (!matches) {
      return res.redirect(asset.dataUri);
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buffer);
  } catch (error) {
    console.error('Failed to serve media asset:', error);
    return res.status(500).send('Failed to load media');
  }
});

// Upload image / receipt (Admin or Customer Checkout Receipt)
app.post(
  '/api/media/upload',
  rateLimit(35, 60_000),
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { filename, dataUri, category } = req.body || {};
      if (!dataUri || typeof dataUri !== 'string') {
        return res.status(400).json({ error: 'Image payload is required.' });
      }

      const matches = dataUri.match(
        /^data:(image\/(?:png|jpeg|jpg|webp|gif|svg\+xml));base64,(.+)$/
      );
      if (!matches) {
        return res.status(400).json({
          error: 'Invalid image format. Allowed formats: PNG, JPEG, WEBP, GIF, SVG.',
        });
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const sizeBytes = Math.ceil((base64Data.length * 3) / 4);

      if (sizeBytes > 4 * 1024 * 1024) {
        return res.status(400).json({
          error: 'Image exceeds the 4MB maximum file size limit.',
        });
      }

      const safeFilename = String(filename || 'upload.png')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 80);

      const saved = await saveMediaAsset({
        filename: safeFilename,
        mimeType,
        sizeBytes,
        dataUri,
        category: String(category || 'product').slice(0, 32),
      });

      return res.json({
        id: saved.id,
        url: saved.url,
        filename: saved.filename,
        sizeBytes: saved.sizeBytes,
      });
    } catch (error: any) {
      console.error('Media upload failed:', error);
      return res.status(500).json({ error: error.message || 'Image upload failed.' });
    }
  }
);

// Public Storefront Bootstrap Data
app.get('/api/store', async (_req: Request, res: Response) => {
  try {
    const data = await getPublicStoreBootstrap();
    res.json(data);
  } catch (error: any) {
    console.error('Failed to fetch store bootstrap:', error);
    res.status(500).json({ error: error.message || 'Failed to load store data.' });
  }
});

// Live Minecraft Server Status API
app.get('/api/server-status', async (_req: Request, res: Response) => {
  try {
    const store = await getPublicStoreBootstrap();
    const { settings } = store;
    const status = await fetchMinecraftServerStatus({
      serverIp: settings.serverIp,
      serverPort: settings.serverPort,
      mode: settings.serverStatusMode,
      manualOnline: settings.manualServerOnline,
      manualPlayersOnline: settings.manualPlayersOnline,
      manualPlayersMax: settings.manualPlayersMax,
    });
    res.json(status);
  } catch (error: any) {
    console.error('Failed to fetch Minecraft server status:', error);
    res.status(500).json({ error: 'Unable to check server status right now.' });
  }
});

// Current User Profile & Session Check
app.get('/api/auth/me', optionalAuth, async (req: AuthRequest, res: Response) => {
  res.json({
    authenticated: Boolean(req.dbUser || req.isAdminToken),
    user: req.dbUser || null,
    isAdmin: Boolean(req.dbUser?.role === 'admin' || req.isAdminToken),
  });
});

// Admin Access Password Unlock / Elevation
app.post(
  '/api/auth/admin-unlock',
  rateLimit(15, 60_000),
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { accessKey } = req.body || {};
      if (!accessKey || typeof accessKey !== 'string') {
        return res.status(400).json({ error: 'Admin Password is required.' });
      }

      const valid = await verifyAdminUnlockCredential(accessKey);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid Admin Password.' });
      }

      if (req.dbUser) {
        await promoteUserToAdmin(req.dbUser.uid);
      }

      const adminToken = createAdminSessionToken(req.dbUser?.email || 'admin@ownverse.mc');
      return res.json({
        success: true,
        adminToken,
        message: 'Administrator session unlocked.',
      });
    } catch (error: any) {
      console.error('Admin unlock error:', error);
      return res.status(500).json({ error: error.message || 'Failed to unlock admin access.' });
    }
  }
);

// Evaluate Cart & Promo Code on Backend
app.post(
  '/api/cart/evaluate',
  rateLimit(60, 60_000),
  async (req: Request, res: Response) => {
    try {
      const { items, promoCode, minecraftUsername } = req.body || {};
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Cart items array is required.' });
      }
      const evaluation = await evaluateCartAndPricing(items, promoCode, minecraftUsername);
      return res.json(evaluation);
    } catch (error: any) {
      console.error('Cart evaluation failed:', error);
      return res.status(500).json({ error: error.message || 'Failed to evaluate cart.' });
    }
  }
);

// Atomic Order Checkout & Discord Webhook Dispatch
app.post(
  '/api/orders/checkout',
  rateLimit(12, 60_000),
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        idempotencyKey,
        minecraftUsername,
        discordUsername,
        items,
        promoCode,
        paymentMethod,
        paymentReference,
        receiptImageUrl,
        customerNotes,
      } = req.body || {};

      const cleanMc = String(minecraftUsername || '').trim();
      const cleanDiscord = String(discordUsername || '').trim();
      const cleanMethod = String(paymentMethod || '').trim();
      const cleanRef = String(paymentReference || '').trim();

      if (
        !cleanMc ||
        cleanMc.length < 2 ||
        cleanMc.length > 32 ||
        !/^[.a-zA-Z0-9_]+$/.test(cleanMc)
      ) {
        return res.status(400).json({
          error:
            'Please enter a valid Minecraft username (2–32 characters, letters, numbers, underscores, or Bedrock dot prefix).',
        });
      }

      if (!cleanDiscord || cleanDiscord.length < 2 || cleanDiscord.length > 48) {
        return res.status(400).json({
          error: 'Please enter a valid Discord username (2–48 characters).',
        });
      }

      if (!cleanMethod) {
        return res.status(400).json({ error: 'Please select a valid payment method.' });
      }

      if (!cleanRef || cleanRef.length < 3 || cleanRef.length > 120) {
        return res.status(400).json({
          error: 'Please provide your Payment Reference / Transaction ID (minimum 3 characters).',
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Your cart cannot be empty.' });
      }

      const createdOrder = await createOrderAtomic({
        idempotencyKey: idempotencyKey ? String(idempotencyKey).slice(0, 80) : undefined,
        userUid: req.dbUser?.uid || null,
        minecraftUsername: cleanMc,
        discordUsername: cleanDiscord,
        items,
        promoCode: promoCode ? String(promoCode).trim() : null,
        paymentMethod: cleanMethod,
        paymentReference: cleanRef,
        receiptImageUrl: receiptImageUrl ? String(receiptImageUrl) : null,
        customerNotes: customerNotes ? String(customerNotes).slice(0, 500) : null,
      });

      const store = await getPublicStoreBootstrap();
      const currencySymbol = store.settings.currencySymbol || '$';

      // Non-blocking Discord webhook notification
      sendNewOrderDiscordWebhook(createdOrder, currencySymbol)
        .then((sent) => {
          if (sent) {
            markOrderDiscordNotified(createdOrder.id);
          }
        })
        .catch((err) => console.error('Background Discord notification error:', err));

      return res.status(201).json({
        order: createdOrder,
      });
    } catch (error: any) {
      console.error('Order checkout failed:', error);
      return res.status(400).json({
        error: error.message || 'Unable to process order. Please review your details.',
      });
    }
  }
);

// Public Customer Order Lookup (Protected by Invoice ID + Username Verification)
app.post(
  '/api/orders/lookup',
  rateLimit(20, 60_000),
  async (req: Request, res: Response) => {
    try {
      const { invoiceId, username } = req.body || {};
      if (!invoiceId || !username) {
        return res.status(400).json({
          error:
            'Both Invoice ID (e.g. OV-2026-849102) and your Minecraft or Discord username are required.',
        });
      }

      const found = await lookupCustomerOrder(String(invoiceId), String(username));
      if (!found) {
        return res.status(404).json({
          error:
            'No matching order found. Verify that your Invoice ID and Minecraft/Discord username match your checkout details.',
        });
      }

      return res.json({ order: found });
    } catch (error: any) {
      console.error('Order lookup error:', error);
      return res.status(500).json({ error: error.message || 'Failed to look up order.' });
    }
  }
);

// ============================================================================
// ADMIN API ROUTES (Protected by requireAdmin)
// ============================================================================

app.get('/api/admin/state', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const rangeDays = Number(req.query.days) || 30;
    const [state, analytics] = await Promise.all([
      getAdminFullState(),
      getStoreAnalytics(rangeDays),
    ]);
    res.json({ ...state, analytics });
  } catch (error: any) {
    console.error('Failed to load admin state:', error);
    res.status(500).json({ error: error.message || 'Failed to load admin dashboard.' });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const updated = await updateStoreSettingsData(req.body || {});
    res.json({ settings: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update settings.' });
  }
});

app.post('/api/admin/password', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res
        .status(400)
        .json({ error: 'New admin password must be at least 6 characters long.' });
    }
    if (currentPassword) {
      const valid = await verifyAdminUnlockCredential(String(currentPassword));
      if (!valid) {
        return res.status(401).json({ error: 'Current admin password is incorrect.' });
      }
    }
    await updateStoreSettingsData({ newAdminPassword: newPassword.trim() });
    return res.json({ success: true, message: 'Admin password updated in PostgreSQL.' });
  } catch (error: any) {
    return res
      .status(400)
      .json({ error: error.message || 'Failed to update admin password.' });
  }
});

app.delete('/api/admin/media/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await deleteMediaAssetData(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete media asset.' });
  }
});

app.post('/api/admin/sections', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const section = await upsertSectionData(req.body || {});
    res.json({ section });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to save section.' });
  }
});

app.put('/api/admin/sections/reorder', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required.' });
    }
    await reorderSectionsData(orderedIds);
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to reorder sections.' });
  }
});

app.delete('/api/admin/sections/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await deleteSectionData(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete section.' });
  }
});

app.post('/api/admin/products', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const product = await upsertProductData(req.body || {});
    res.json({ product });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to save product.' });
  }
});

app.delete('/api/admin/products/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await deleteProductData(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete product.' });
  }
});

app.post('/api/admin/sales', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const sale = await upsertSaleData(req.body || {});
    res.json({ sale });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to save sale.' });
  }
});

app.delete('/api/admin/sales/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await deleteSaleData(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete sale.' });
  }
});

app.post('/api/admin/promo-codes', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const promoCode = await upsertPromoCodeData(req.body || {});
    res.json({ promoCode });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to save promo code.' });
  }
});

app.delete('/api/admin/promo-codes/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await deletePromoCodeData(Number(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete promo code.' });
  }
});

app.put('/api/admin/orders/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const { status, adminNotes } = req.body || {};
    const validStatuses = ['Pending', 'Paid', 'Processing', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status.' });
    }

    const { updatedOrder, previousStatus } = await updateOrderStatusAndNotes(
      orderId,
      status,
      adminNotes
    );

    if (previousStatus !== status) {
      const store = await getPublicStoreBootstrap();
      const currencySymbol = store.settings.currencySymbol || '$';
      sendOrderStatusUpdateDiscordWebhook(updatedOrder, previousStatus, currencySymbol).catch(
        (err) => console.error('Discord status update webhook error:', err)
      );
    }

    return res.json({ order: updatedOrder });
  } catch (error: any) {
    return res.status(400).json({ error: error.message || 'Failed to update order.' });
  }
});

app.get('/api/admin/backup/export', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const backup = await exportStoreBackupData();
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to export backup.' });
  }
});

app.post('/api/admin/backup/import', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await importStoreBackupData(req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to import backup.' });
  }
});

app.get('/api/store/export-html', async (_req: Request, res: Response) => {
  try {
    const storeData = await getPublicStoreBootstrap();
    const html = generateStandaloneStoreHtml(storeData);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ownverse-store-standalone.html"'
    );
    res.send(html);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate HTML export.' });
  }
});

async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const isProdEnv =
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);

  if (isProdEnv && fs.existsSync(distIndexPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OwnVerse Store server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
