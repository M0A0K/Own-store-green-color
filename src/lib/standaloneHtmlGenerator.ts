export function generateStandaloneStoreHtml(storeData: {
  settings: any;
  sections: any[];
  products: any[];
  activeSales?: any[];
}): string {
  const safeJson = JSON.stringify(storeData).replace(/<\//g, '<\\/');
  const storeName = storeData.settings?.storeName || 'OwnVerse Store';
  const tagline =
    storeData.settings?.storeTagline || 'Official Minecraft Network Storefront';

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${storeName} — ${tagline}</title>
  <meta name="description" content="${
    storeData.settings?.heroConfig?.subtitle ||
    'Equip lifetime network ranks, enchanted Netherite combat loadouts, and mythic vault keys.'
  }" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            display: ['Syne', 'sans-serif'],
            sans: ['Plus Jakarta Sans', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          }
        }
      }
    };
  </script>
  <style>
    :root {
      --bg-primary: #090708;
      --bg-secondary: #120C0E;
      --bg-card: #181013;
      --border-color: #2C181D;
      --accent-red: #EF4444;
      --btn-red: #DC2626;
    }
    body {
      background-color: var(--bg-primary);
      color: #FAF5F6;
      font-family: 'Plus Jakarta Sans', sans-serif;
      margin: 0;
      overflow-x: hidden;
    }
    .font-display { font-family: 'Syne', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #090708; }
    ::-webkit-scrollbar-thumb { background: #2C181D; border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: #EF4444; }
  </style>
</head>
<body class="min-h-screen flex flex-col bg-[#090708] text-[#FAF5F6] selection:bg-red-500/30 selection:text-red-200">

  <!-- Promo Banner -->
  <div id="promo-banner" class="w-full px-4 py-2.5 text-xs font-medium flex flex-wrap items-center justify-center gap-3 border-b border-[#2C181D] bg-[#1F090D] text-[#FFE4E6]">
    <span id="promo-badge" class="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] bg-red-500 text-black">Season IV Launch Offer</span>
    <span id="promo-text" class="text-center">Use promo code MAK20 to get 20% OFF across all eligible ranks, kits, and crate bundles</span>
    <button onclick="applyPromoBannerCode()" id="promo-btn" class="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white font-mono font-semibold transition cursor-pointer">Apply Code MAK20</button>
  </div>

  <!-- Top Navigation Bar -->
  <header class="sticky top-0 z-40 h-16 px-4 sm:px-8 bg-[#090708]/95 border-b border-[#2C181D] flex items-center justify-between">
    <a href="#" onclick="switchView('store'); return false;" id="nav-store-name" class="font-display text-lg sm:text-xl font-bold tracking-tight text-white">OwnVerse Store</a>

    <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300">
      <button onclick="switchView('store')" id="tab-store" class="hover:text-white transition cursor-pointer text-red-400 font-semibold">Catalog</button>
      <button onclick="switchView('lookup')" id="tab-lookup" class="hover:text-white transition cursor-pointer">Order Lookup</button>
      <button onclick="switchView('faq')" id="tab-faq" class="hover:text-white transition cursor-pointer">FAQ</button>
      <button onclick="switchView('support')" id="tab-support" class="hover:text-white transition cursor-pointer">Support & Policies</button>
    </nav>

    <div class="flex items-center gap-2.5">
      <button onclick="copyServerIp()" class="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181013] border border-[#2C181D] hover:border-red-500/40 text-xs font-mono text-zinc-200 cursor-pointer">
        <span class="w-2 h-2 rounded-full bg-red-500"></span>
        <span id="header-server-ip">play.ownverse.mc</span>
      </button>
      <button onclick="toggleCart(true)" class="px-4 py-2 rounded-lg bg-[#DC2626] hover:bg-red-500 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer shadow-md shadow-red-950/50">
        <span>Cart (<span id="cart-count" class="font-mono">0</span>)</span>
      </button>
    </div>
  </header>

  <!-- Main Content Container -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 space-y-10">

    <!-- STORE VIEW -->
    <div id="view-store" class="space-y-10">
      <!-- Hero Banner -->
      <section class="relative rounded-2xl overflow-hidden border border-[#2C181D] bg-[#120C0E] p-6 sm:p-10 lg:p-12">
        <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div class="lg:col-span-7 space-y-5">
            <div id="hero-kicker" class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-400">
              OwnVerse Network · Season IV: Crimson Citadel
            </div>
            <h1 id="hero-title" class="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.08]">
              Forge Your Dominion Across the OwnVerse Realm
            </h1>
            <p id="hero-subtitle" class="text-sm sm:text-base text-zinc-300 max-w-2xl leading-relaxed">
              Equip lifetime network ranks, enchanted Netherite combat loadouts, and mythic vault keys. Instant in-game delivery backed by atomic inventory verification.
            </p>
            <div class="flex flex-wrap items-center gap-3 pt-1">
              <a href="#catalog-grid" class="px-6 py-3 rounded-xl bg-[#DC2626] hover:bg-red-500 text-white font-bold text-sm transition shadow-lg shadow-red-950/60">
                Explore Store Catalog
              </a>
              <button onclick="copyServerIp()" class="px-4 py-3 rounded-xl bg-[#181013] hover:bg-[#241519] border border-[#2C181D] text-xs font-mono text-zinc-200 flex items-center gap-2 cursor-pointer">
                <span>IP: <strong id="hero-ip" class="text-red-400">play.ownverse.mc</strong></span>
                <span id="copy-ip-label" class="text-[11px] text-zinc-400">(Click to Copy)</span>
              </button>
            </div>
          </div>

          <!-- Featured Spotlight Card -->
          <div id="hero-spotlight" class="lg:col-span-5"></div>
        </div>
      </section>

      <!-- Category & Search Controls -->
      <section id="catalog-grid" class="space-y-5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#120C0E] p-4 rounded-xl border border-[#2C181D]">
          <div id="section-tabs" class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0"></div>
          <div class="flex items-center gap-2.5">
            <input
              id="search-input"
              type="text"
              oninput="renderProducts()"
              placeholder="Search ranks, kits, crates..."
              class="w-full sm:w-60 px-3.5 py-2 rounded-lg bg-[#090708] border border-[#2C181D] focus:border-red-500 text-xs text-white outline-none"
            />
            <select
              id="sort-select"
              onchange="renderProducts()"
              class="px-3 py-2 rounded-lg bg-[#090708] border border-[#2C181D] text-xs text-zinc-200 outline-none"
            >
              <option value="featured">Featured First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A–Z</option>
            </select>
          </div>
        </div>

        <!-- Product Grid -->
        <div id="products-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
      </section>
    </div>

    <!-- ORDER LOOKUP VIEW -->
    <div id="view-lookup" class="hidden max-w-2xl mx-auto space-y-6">
      <div class="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 sm:p-8 space-y-5">
        <h2 class="font-display text-2xl font-extrabold text-white">Order Lookup & Verification</h2>
        <p class="text-xs text-zinc-400">Enter your Invoice ID (e.g., OV-2026-XXXXXX) and Minecraft Username to inspect your order receipt.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input id="lookup-invoice" type="text" placeholder="Invoice ID (OV-2026-...)" class="px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] text-xs font-mono text-white outline-none" />
          <input id="lookup-mc" type="text" placeholder="Minecraft Username" class="px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] text-xs text-white outline-none" />
        </div>
        <button onclick="lookupLocalOrder()" class="w-full py-3 rounded-xl bg-[#DC2626] hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer">
          Search Order Status
        </button>
        <div id="lookup-result" class="pt-2"></div>
      </div>
    </div>

    <!-- FAQ VIEW -->
    <div id="view-faq" class="hidden max-w-3xl mx-auto space-y-6">
      <div class="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 sm:p-8 space-y-5">
        <h2 class="font-display text-2xl font-extrabold text-white">Frequently Asked Questions</h2>
        <div id="faq-container" class="space-y-3"></div>
      </div>
    </div>

    <!-- SUPPORT & POLICIES VIEW -->
    <div id="view-support" class="hidden max-w-4xl mx-auto space-y-6">
      <div class="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 sm:p-8 space-y-6">
        <h2 class="font-display text-2xl font-extrabold text-white">Support & Store Policies</h2>
        <div id="policies-container" class="space-y-6 text-xs text-zinc-300 leading-relaxed"></div>
      </div>
    </div>

  </main>

  <!-- Product Detail Modal ("More Info") -->
  <div id="product-modal" class="fixed inset-0 z-50 hidden bg-black/80 flex items-center justify-center p-4">
    <div class="bg-[#120C0E] border border-[#2C181D] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
      <div class="flex items-start justify-between gap-4 border-b border-[#2C181D] pb-4">
        <div>
          <span id="modal-badge" class="text-[11px] font-bold uppercase tracking-wider text-red-400"></span>
          <h3 id="modal-title" class="font-display text-2xl font-extrabold text-white mt-0.5"></h3>
        </div>
        <button onclick="closeProductModal()" class="px-3 py-1.5 rounded-lg bg-[#181013] border border-[#2C181D] text-xs text-zinc-300 hover:text-white cursor-pointer">✕ Close</button>
      </div>
      <div id="modal-body" class="space-y-5 text-sm text-zinc-300"></div>
    </div>
  </div>

  <!-- Cart & Checkout Drawer -->
  <div id="cart-drawer" class="fixed inset-0 z-50 hidden bg-black/80 flex justify-end">
    <div class="bg-[#120C0E] border-l border-[#2C181D] w-full max-w-md h-full flex flex-col justify-between p-6 overflow-y-auto">
      <div class="space-y-5">
        <div class="flex items-center justify-between border-b border-[#2C181D] pb-4">
          <h3 class="font-display text-xl font-extrabold text-white">Your Store Cart</h3>
          <button onclick="toggleCart(false)" class="px-3 py-1 rounded-lg bg-[#181013] border border-[#2C181D] text-xs text-zinc-300 cursor-pointer">✕</button>
        </div>

        <div id="cart-items" class="space-y-3"></div>

        <!-- Promo Code Box -->
        <div class="p-3.5 rounded-xl bg-[#090708] border border-[#2C181D] space-y-2">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">Promo / Creator Code</label>
          <div class="flex gap-2">
            <input id="cart-promo-input" type="text" placeholder="Try MAK20" class="flex-1 px-3 py-2 rounded-lg bg-[#120C0E] border border-[#2C181D] text-xs font-mono uppercase text-white outline-none" />
            <button onclick="applyPromoFromInput()" class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer">Apply</button>
          </div>
          <div id="cart-promo-msg" class="text-[11px] text-red-400"></div>
        </div>

        <!-- Checkout Player Info -->
        <div id="checkout-form" class="space-y-3 pt-2 border-t border-[#2C181D]">
          <h4 class="text-xs font-extrabold uppercase tracking-wider text-red-400">Player & Payment Verification</h4>
          <input id="chk-mc" type="text" placeholder="Minecraft Username (Required)" class="w-full px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] text-xs text-white outline-none" />
          <input id="chk-discord" type="text" placeholder="Discord Username (Required)" class="w-full px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] text-xs text-white outline-none" />
          <select id="chk-method" onchange="renderPaymentInstructions()" class="w-full px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] text-xs text-white outline-none"></select>
          <div id="chk-method-info" class="p-3 rounded-xl bg-[#090708] border border-[#2C181D] text-xs text-zinc-300 space-y-1"></div>
          <input id="chk-ref" type="text" placeholder="Transaction ID / Payment Reference (Required)" class="w-full px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] text-xs font-mono text-white outline-none" />
        </div>
      </div>

      <div class="space-y-3 pt-4 border-t border-[#2C181D] mt-6">
        <div class="flex justify-between text-xs text-zinc-400">
          <span>Subtotal</span>
          <span id="cart-subtotal" class="font-mono">$0.00</span>
        </div>
        <div class="flex justify-between text-xs text-red-400">
          <span>Promo Discount</span>
          <span id="cart-discount" class="font-mono">-$0.00</span>
        </div>
        <div class="flex justify-between text-base font-extrabold text-white">
          <span>Final Total</span>
          <span id="cart-total" class="font-mono text-red-400">$0.00</span>
        </div>
        <button onclick="submitStandaloneOrder()" class="w-full py-3.5 rounded-xl bg-[#DC2626] hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-lg shadow-red-950/60">
          Complete Order & Generate Invoice
        </button>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="border-t border-[#2C181D] bg-[#090708] py-8 px-4 sm:px-8 mt-16">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
      <div>
        <strong id="footer-store-name" class="text-white">OwnVerse Store</strong> · Not affiliated with Mojang Studios or Microsoft Corporation.
      </div>
      <div class="flex flex-wrap gap-4">
        <button onclick="switchView('lookup')" class="hover:text-white cursor-pointer">Order Lookup</button>
        <button onclick="switchView('faq')" class="hover:text-white cursor-pointer">FAQ</button>
        <button onclick="switchView('support')" class="hover:text-white cursor-pointer">Terms & Policies</button>
      </div>
    </div>
  </footer>

  <!-- Embedded Store Data & Interactive Engine -->
  <script>
    const STORE_DATA = ${safeJson};
    let activeSectionId = 'all';
    let cart = [];
    let appliedPromo = '';
    let localOrders = [];

    function formatPrice(val) {
      const sym = (STORE_DATA.settings && STORE_DATA.settings.currencySymbol) || '$';
      return sym + Number(val || 0).toFixed(2);
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function initStore() {
      const s = STORE_DATA.settings || {};
      document.getElementById('nav-store-name').textContent = s.storeName || 'OwnVerse Store';
      document.getElementById('footer-store-name').textContent = s.storeName || 'OwnVerse Store';
      document.getElementById('header-server-ip').textContent = s.serverIp || 'play.ownverse.mc';
      document.getElementById('hero-ip').textContent = s.serverIp || 'play.ownverse.mc';

      if (s.heroConfig) {
        document.getElementById('hero-kicker').textContent = s.heroConfig.kicker || '';
        document.getElementById('hero-title').textContent = s.heroConfig.title || '';
        document.getElementById('hero-subtitle').textContent = s.heroConfig.subtitle || '';
      }

      if (s.promoBannerConfig && s.promoBannerConfig.enabled) {
        document.getElementById('promo-badge').textContent = s.promoBannerConfig.title || 'Offer';
        document.getElementById('promo-text').textContent = s.promoBannerConfig.text || '';
        document.getElementById('promo-btn').textContent = s.promoBannerConfig.buttonText || ('Apply ' + s.promoBannerConfig.code);
      } else {
        document.getElementById('promo-banner').style.display = 'none';
      }

      renderSpotlight();
      renderSectionTabs();
      renderProducts();
      renderFaqAndPolicies();
      initPaymentMethods();
      updateCartUI();
    }

    function renderSpotlight() {
      const container = document.getElementById('hero-spotlight');
      const featured = (STORE_DATA.products || []).find(p => p.featured) || (STORE_DATA.products || [])[0];
      if (!featured) {
        container.innerHTML = '';
        return;
      }
      const price = featured.finalPrice !== undefined ? featured.finalPrice : featured.price;
      container.innerHTML = \`
        <div class="rounded-2xl bg-[#181013] border border-red-500/30 p-5 space-y-4 shadow-xl">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/40 text-red-400 text-[11px] font-bold uppercase">\${escapeHtml(featured.badgeText || 'Featured Package')}</span>
            <span class="font-mono text-lg font-extrabold text-white">\${formatPrice(price)}</span>
          </div>
          \${featured.productImageUrl ? \`<img src="\${escapeHtml(featured.productImageUrl)}" alt="\${escapeHtml(featured.name)}" class="w-full h-40 object-cover rounded-xl border border-[#2C181D]" />\` : ''}
          <div>
            <h3 class="font-display text-xl font-extrabold text-white">\${escapeHtml(featured.name)}</h3>
            <p class="text-xs text-zinc-400 mt-1 line-clamp-2">\${escapeHtml(featured.shortDescription)}</p>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <button onclick="openProductModal(\${featured.id})" class="py-2.5 rounded-xl bg-[#120C0E] hover:bg-[#221418] border border-[#2C181D] text-xs font-bold text-zinc-200 cursor-pointer">More Info</button>
            <button onclick="addToCart(\${featured.id})" class="py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-500 text-xs font-bold text-white cursor-pointer">Buy Now</button>
          </div>
        </div>
      \`;
    }

    function renderSectionTabs() {
      const tabsEl = document.getElementById('section-tabs');
      const sections = (STORE_DATA.sections || []).filter(s => s.visible !== false);
      let html = \`<button onclick="selectSection('all')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer \${activeSectionId === 'all' ? 'bg-red-600 text-white' : 'bg-[#090708] text-zinc-400 hover:text-white border border-[#2C181D]'}">All Packages</button>\`;
      for (const sec of sections) {
        const active = String(activeSectionId) === String(sec.id);
        html += \`<button onclick="selectSection(\${sec.id})" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer \${active ? 'bg-red-600 text-white' : 'bg-[#090708] text-zinc-400 hover:text-white border border-[#2C181D]'}">\${escapeHtml(sec.name)}</button>\`;
      }
      tabsEl.innerHTML = html;
    }

    function selectSection(id) {
      activeSectionId = id;
      renderSectionTabs();
      renderProducts();
    }

    function renderProducts() {
      const container = document.getElementById('products-container');
      const q = (document.getElementById('search-input').value || '').toLowerCase().trim();
      const sort = document.getElementById('sort-select').value;

      let list = (STORE_DATA.products || []).filter(p => p.visible !== false);
      if (activeSectionId !== 'all') {
        list = list.filter(p => String(p.sectionId) === String(activeSectionId));
      }
      if (q) {
        list = list.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.shortDescription || '').toLowerCase().includes(q)
        );
      }

      list.sort((a, b) => {
        const pa = a.finalPrice !== undefined ? a.finalPrice : a.price;
        const pb = b.finalPrice !== undefined ? b.finalPrice : b.price;
        if (sort === 'price-asc') return pa - pb;
        if (sort === 'price-desc') return pb - pa;
        if (sort === 'name-asc') return (a.name || '').localeCompare(b.name || '');
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      });

      if (list.length === 0) {
        container.innerHTML = '<div class="col-span-full p-12 text-center text-zinc-400 text-sm bg-[#120C0E] rounded-2xl border border-[#2C181D]">No packages match your current filter.</div>';
        return;
      }

      container.innerHTML = list.map(p => {
        const price = p.finalPrice !== undefined ? p.finalPrice : p.price;
        const orig = p.originalPrice !== undefined ? p.originalPrice : p.price;
        const hasDiscount = orig > price;

        return \`
          <article class="rounded-xl bg-[#181013] border border-[#2C181D] hover:border-red-500/40 transition flex flex-col justify-between overflow-hidden shadow-lg">
            <div>
              \${p.productImageUrl ? \`
                <div class="h-44 w-full bg-[#090708] border-b border-[#2C181D] overflow-hidden relative">
                  <img src="\${escapeHtml(p.productImageUrl)}" alt="\${escapeHtml(p.name)}" class="w-full h-full object-cover" loading="lazy" />
                </div>
              \` : \`
                <div class="h-36 w-full bg-gradient-to-br from-[#230B10] via-[#14090C] to-[#090708] border-b border-[#2C181D] flex items-center justify-center p-4">
                  <span class="font-display text-lg font-extrabold text-red-400/90 text-center">\${escapeHtml(p.name)}</span>
                </div>
              \`}
              <div class="p-5 space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-red-400">\${escapeHtml(p.badgeText || p.deliveryTimeLabel || 'Instant Delivery')}</span>
                  <div class="text-right font-mono">
                    \${hasDiscount ? \`<span class="text-xs text-zinc-500 line-through mr-1.5">\${formatPrice(orig)}</span>\` : ''}
                    <span class="text-base font-extrabold text-white">\${formatPrice(price)}</span>
                  </div>
                </div>
                <h3 class="font-display text-lg font-bold text-white">\${escapeHtml(p.name)}</h3>
                <p class="text-xs text-zinc-400 leading-relaxed line-clamp-2">\${escapeHtml(p.shortDescription)}</p>
              </div>
            </div>
            <div class="p-5 pt-0 grid grid-cols-2 gap-2.5">
              <button onclick="openProductModal(\${p.id})" class="py-2.5 px-3 rounded-lg bg-[#120C0E] hover:bg-[#231419] border border-[#2C181D] text-xs font-bold text-zinc-200 cursor-pointer">More Info</button>
              <button onclick="addToCart(\${p.id})" class="py-2.5 px-3 rounded-lg bg-[#DC2626] hover:bg-red-500 text-xs font-bold text-white cursor-pointer">Add to Cart</button>
            </div>
          </article>
        \`;
      }).join('');
    }

    function openProductModal(id) {
      const p = (STORE_DATA.products || []).find(item => item.id === id);
      if (!p) return;
      const price = p.finalPrice !== undefined ? p.finalPrice : p.price;
      document.getElementById('modal-badge').textContent = (p.badgeText || 'OwnVerse Package') + ' · ' + formatPrice(price);
      document.getElementById('modal-title').textContent = p.name;

      const perks = (p.whatYouGet || []).map(item => \`<li class="flex items-start gap-2"><span class="text-red-400">✓</span><span>\${escapeHtml(item.label || item)}</span></li>\`).join('');
      const reqs = (p.requirements || []).map(r => \`<li>• \${escapeHtml(r)}</li>\`).join('');

      document.getElementById('modal-body').innerHTML = \`
        \${p.productImageUrl ? \`<img src="\${escapeHtml(p.productImageUrl)}" class="w-full max-h-60 object-cover rounded-xl border border-[#2C181D]" />\` : ''}
        <p class="text-zinc-200 leading-relaxed whitespace-pre-line">\${escapeHtml(p.fullDescription || p.shortDescription)}</p>
        \${perks ? \`
          <div class="p-4 rounded-xl bg-[#090708] border border-[#2C181D] space-y-2">
            <h4 class="text-xs font-extrabold uppercase tracking-wider text-red-400">What You Receive</h4>
            <ul class="space-y-1.5 text-xs text-zinc-300">\${perks}</ul>
          </div>
        \` : ''}
        \${reqs ? \`
          <div class="p-4 rounded-xl bg-[#090708] border border-[#2C181D] space-y-2">
            <h4 class="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Requirements</h4>
            <ul class="space-y-1 text-xs text-zinc-400">\${reqs}</ul>
          </div>
        \` : ''}
        <div class="pt-2 flex justify-end gap-3">
          <button onclick="addToCart(\${p.id}); closeProductModal();" class="px-6 py-3 rounded-xl bg-[#DC2626] hover:bg-red-500 text-xs font-extrabold uppercase tracking-wider text-white cursor-pointer">Add to Cart · \${formatPrice(price)}</button>
        </div>
      \`;
      document.getElementById('product-modal').classList.remove('hidden');
    }

    function closeProductModal() {
      document.getElementById('product-modal').classList.add('hidden');
    }

    function addToCart(productId) {
      const existing = cart.find(i => i.productId === productId);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({ productId, quantity: 1 });
      }
      updateCartUI();
      toggleCart(true);
    }

    function changeQty(productId, delta) {
      const idx = cart.findIndex(i => i.productId === productId);
      if (idx === -1) return;
      cart[idx].quantity += delta;
      if (cart[idx].quantity <= 0) cart.splice(idx, 1);
      updateCartUI();
    }

    function applyPromoBannerCode() {
      const code = (STORE_DATA.settings?.promoBannerConfig?.code || 'MAK20').toUpperCase();
      appliedPromo = code;
      document.getElementById('cart-promo-input').value = code;
      updateCartUI();
      toggleCart(true);
    }

    function applyPromoFromInput() {
      const val = (document.getElementById('cart-promo-input').value || '').trim().toUpperCase();
      appliedPromo = val;
      updateCartUI();
    }

    function updateCartUI() {
      const count = cart.reduce((acc, i) => acc + i.quantity, 0);
      document.getElementById('cart-count').textContent = count;

      const itemsEl = document.getElementById('cart-items');
      if (cart.length === 0) {
        itemsEl.innerHTML = '<div class="p-6 text-center text-xs text-zinc-500 bg-[#090708] rounded-xl border border-[#2C181D]">Your cart is currently empty.</div>';
      } else {
        itemsEl.innerHTML = cart.map(item => {
          const p = (STORE_DATA.products || []).find(x => x.id === item.productId);
          if (!p) return '';
          const unit = p.finalPrice !== undefined ? p.finalPrice : p.price;
          return \`
            <div class="p-3 rounded-xl bg-[#090708] border border-[#2C181D] flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-white">\${escapeHtml(p.name)}</div>
                <div class="text-[11px] font-mono text-red-400">\${formatPrice(unit)} each</div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="changeQty(\${p.id}, -1)" class="w-6 h-6 rounded bg-[#181013] text-xs font-bold text-zinc-300 cursor-pointer">-</button>
                <span class="text-xs font-mono w-5 text-center">\${item.quantity}</span>
                <button onclick="changeQty(\${p.id}, 1)" class="w-6 h-6 rounded bg-[#181013] text-xs font-bold text-zinc-300 cursor-pointer">+</button>
              </div>
            </div>
          \`;
        }).join('');
      }

      let subtotal = 0;
      for (const item of cart) {
        const p = (STORE_DATA.products || []).find(x => x.id === item.productId);
        if (p) {
          const unit = p.finalPrice !== undefined ? p.finalPrice : p.price;
          subtotal += unit * item.quantity;
        }
      }

      let discount = 0;
      const msgEl = document.getElementById('cart-promo-msg');
      const bannerCode = (STORE_DATA.settings?.promoBannerConfig?.code || 'MAK20').toUpperCase();
      if (appliedPromo === bannerCode || appliedPromo === 'MAK20') {
        discount = subtotal * 0.20;
        msgEl.textContent = '✓ Promo code ' + appliedPromo + ' active (20% OFF)';
      } else if (appliedPromo) {
        msgEl.textContent = 'Invalid or expired promo code.';
      } else {
        msgEl.textContent = '';
      }

      const finalTotal = Math.max(0, subtotal - discount);
      document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
      document.getElementById('cart-discount').textContent = '-' + formatPrice(discount);
      document.getElementById('cart-total').textContent = formatPrice(finalTotal);
    }

    function toggleCart(open) {
      const el = document.getElementById('cart-drawer');
      if (open) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }

    function initPaymentMethods() {
      const select = document.getElementById('chk-method');
      const methods = (STORE_DATA.settings?.paymentMethodsConfig || []).filter(m => m.enabled !== false);
      select.innerHTML = methods.map(m => \`<option value="\${escapeHtml(m.id)}">\${escapeHtml(m.name)}</option>\`).join('');
      renderPaymentInstructions();
    }

    function renderPaymentInstructions() {
      const id = document.getElementById('chk-method').value;
      const methods = STORE_DATA.settings?.paymentMethodsConfig || [];
      const m = methods.find(x => x.id === id) || methods[0];
      const infoEl = document.getElementById('chk-method-info');
      if (!m) {
        infoEl.innerHTML = '';
        return;
      }
      infoEl.innerHTML = \`
        <div class="font-bold text-white">\${escapeHtml(m.name)} — \${escapeHtml(m.accountTitle)}</div>
        <div class="font-mono text-red-400 select-all">Account / Wallet: \${escapeHtml(m.accountNumber)}</div>
        <div class="text-zinc-400 text-[11px] pt-1">\${escapeHtml(m.instructions)}</div>
      \`;
    }

    function submitStandaloneOrder() {
      if (cart.length === 0) return;
      const mc = (document.getElementById('chk-mc').value || '').trim();
      const discord = (document.getElementById('chk-discord').value || '').trim();
      const ref = (document.getElementById('chk-ref').value || '').trim();
      const method = document.getElementById('chk-method').value;

      if (!mc || !discord || !ref) {
        alert('Please fill in your Minecraft Username, Discord Username, and Payment Reference ID.');
        return;
      }

      const invoiceId = 'OV-2026-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const totalText = document.getElementById('cart-total').textContent;

      const orderRecord = {
        invoiceId,
        minecraftUsername: mc,
        discordUsername: discord,
        paymentMethod: method,
        paymentReference: ref,
        total: totalText,
        status: 'Pending Verification',
        createdAt: new Date().toLocaleString()
      };
      localOrders.unshift(orderRecord);
      cart = [];
      updateCartUI();
      toggleCart(false);

      switchView('lookup');
      document.getElementById('lookup-invoice').value = invoiceId;
      document.getElementById('lookup-mc').value = mc;
      lookupLocalOrder();
    }

    function lookupLocalOrder() {
      const inv = (document.getElementById('lookup-invoice').value || '').trim().toUpperCase();
      const resEl = document.getElementById('lookup-result');
      const found = localOrders.find(o => o.invoiceId.toUpperCase() === inv);
      if (!found) {
        resEl.innerHTML = '<div class="p-4 rounded-xl bg-[#090708] border border-red-500/30 text-xs text-red-300">No local order found matching that Invoice ID in this browser session.</div>';
        return;
      }
      resEl.innerHTML = \`
        <div class="p-5 rounded-xl bg-[#090708] border border-red-500/40 space-y-2 text-xs">
          <div class="flex justify-between font-mono"><span class="text-zinc-400">Invoice ID:</span><strong class="text-red-400">\${escapeHtml(found.invoiceId)}</strong></div>
          <div class="flex justify-between"><span class="text-zinc-400">Minecraft Player:</span><strong class="text-white">\${escapeHtml(found.minecraftUsername)}</strong></div>
          <div class="flex justify-between"><span class="text-zinc-400">Total Paid:</span><strong class="font-mono text-white">\${escapeHtml(found.total)}</strong></div>
          <div class="flex justify-between"><span class="text-zinc-400">Status:</span><span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">\${escapeHtml(found.status)}</span></div>
        </div>
      \`;
    }

    function renderFaqAndPolicies() {
      const faqEl = document.getElementById('faq-container');
      const faqs = STORE_DATA.settings?.faqItems || [];
      faqEl.innerHTML = faqs.map(f => \`
        <div class="p-4 rounded-xl bg-[#090708] border border-[#2C181D] space-y-1.5">
          <h4 class="text-sm font-bold text-white">\${escapeHtml(f.question)}</h4>
          <p class="text-xs text-zinc-400 leading-relaxed">\${escapeHtml(f.answer)}</p>
        </div>
      \`).join('');

      const pol = STORE_DATA.settings?.policiesConfig || {};
      document.getElementById('policies-container').innerHTML = \`
        <div class="p-4 rounded-xl bg-[#090708] border border-[#2C181D] space-y-2">
          <h3 class="text-sm font-bold text-red-400">Terms & Conditions</h3>
          <div class="whitespace-pre-line">\${escapeHtml(pol.termsAndConditions)}</div>
        </div>
        <div class="p-4 rounded-xl bg-[#090708] border border-[#2C181D] space-y-2">
          <h3 class="text-sm font-bold text-red-400">Refund & Delivery Policy</h3>
          <div class="whitespace-pre-line">\${escapeHtml(pol.refundPolicy + '\\n\\n' + pol.deliveryPolicy)}</div>
        </div>
      \`;
    }

    function switchView(view) {
      ['store', 'lookup', 'faq', 'support'].forEach(v => {
        document.getElementById('view-' + v).classList.toggle('hidden', v !== view);
        const tab = document.getElementById('tab-' + v);
        if (tab) {
          tab.className = v === view
            ? 'hover:text-white transition cursor-pointer text-red-400 font-semibold'
            : 'hover:text-white transition cursor-pointer';
        }
      });
    }

    function copyServerIp() {
      const ip = STORE_DATA.settings?.serverIp || 'play.ownverse.mc';
      navigator.clipboard?.writeText(ip);
      const lbl = document.getElementById('copy-ip-label');
      if (lbl) {
        lbl.textContent = '(✓ Copied!)';
        setTimeout(() => { lbl.textContent = '(Click to Copy)'; }, 2000);
      }
    }

    window.addEventListener('DOMContentLoaded', initStore);
  </script>
</body>
</html>`;
}
