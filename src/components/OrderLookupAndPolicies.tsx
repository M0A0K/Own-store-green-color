import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Mail,
  MessageSquare,
  FileText,
  Shield,
} from 'lucide-react';
import { StoreSettings, StoreOrder, FaqItem } from '../types/store.ts';
import { SafeMarkdown } from './SafeMarkdown.tsx';

interface OrderLookupSectionProps {
  currencySymbol?: string;
  initialInvoiceId?: string;
  initialUsername?: string;
}

export const OrderLookupSection: React.FC<OrderLookupSectionProps> = ({
  currencySymbol = '$',
  initialInvoiceId = '',
  initialUsername = '',
}) => {
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId || '');
  const [username, setUsername] = useState(initialUsername || '');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [foundOrder, setFoundOrder] = useState<Partial<StoreOrder> | null>(null);

  useEffect(() => {
    if (initialInvoiceId) setInvoiceId(initialInvoiceId);
    if (initialUsername) setUsername(initialUsername);
  }, [initialInvoiceId, initialUsername]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceId.trim() || !username.trim()) {
      setLookupError('Please enter both your Invoice ID and Minecraft/Discord Username.');
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setFoundOrder(null);

    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoiceId.trim(),
          username: username.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || 'Could not find matching order.');
      } else {
        setFoundOrder(data.order);
      }
    } catch {
      setLookupError('Network error while looking up your order.');
    } finally {
      setLookupLoading(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Completed':
      case 'Paid':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'Processing':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'Cancelled':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      default:
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
  };

  return (
    <section id="order-lookup" className="max-w-7xl mx-auto px-4 sm:px-8 py-12 scroll-mt-24">
      <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 sm:p-8 lg:p-10 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono uppercase tracking-wider">
              <Search className="w-3.5 h-3.5" />
              Live Order Tracker
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Track Your Store Order
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Enter your unique Invoice ID (e.g.,{' '}
              <code className="text-red-400 font-mono">OV-2026-XXXXXX</code>) and the Minecraft or Discord Username used during checkout to view real-time verification and delivery status.
            </p>

            <form onSubmit={handleLookup} className="space-y-3.5 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Invoice / Order ID
                </label>
                <input
                  type="text"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value.toUpperCase())}
                  placeholder="OV-2026-849102"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] focus:border-red-500 text-sm font-mono text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                  Minecraft or Discord Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your In-Game Name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090708] border border-[#2C181D] focus:border-red-500 text-sm text-white outline-none"
                />
              </div>
              {lookupError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {lookupError}
                </p>
              )}
              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full py-3 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 shadow-lg shadow-red-950/50"
              >
                {lookupLoading ? 'Searching Order...' : 'Check Order Status'}
              </button>
            </form>
          </div>

          {/* Right Column: Order Result */}
          <div className="lg:col-span-7">
            {foundOrder ? (
              <div className="bg-[#090708] border border-[#2C181D] rounded-xl p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#2C181D]">
                  <div>
                    <span className="text-xs font-mono uppercase text-zinc-500 block">
                      Invoice Reference
                    </span>
                    <span className="text-lg font-mono font-extrabold text-red-400">
                      {foundOrder.invoiceId}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider border ${getStatusBadge(
                      foundOrder.status
                    )}`}
                  >
                    {foundOrder.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Player</span>
                    <span className="text-white font-bold font-mono mt-0.5 block">
                      {foundOrder.minecraftUsername}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Payment Method</span>
                    <span className="text-zinc-200 font-semibold mt-0.5 block">
                      {foundOrder.paymentMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Order Date</span>
                    <span className="text-zinc-200 mt-0.5 block">
                      {foundOrder.createdAt
                        ? new Date(foundOrder.createdAt).toLocaleString()
                        : 'Just now'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">
                    Purchased Packages
                  </span>
                  <div className="divide-y divide-[#2C181D] border border-[#2C181D] rounded-lg bg-[#120C0E]">
                    {(foundOrder.items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 flex items-center justify-between text-xs sm:text-sm"
                      >
                        <div>
                          <span className="font-bold text-white">{item.name}</span>
                          <span className="text-zinc-400 font-mono ml-2">x{item.quantity}</span>
                        </div>
                        <span className="font-mono font-semibold text-red-400">
                          {currencySymbol}
                          {item.lineTotal.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#2C181D] text-sm">
                  <span className="text-zinc-400 font-medium">Total Paid</span>
                  <span className="text-lg font-mono font-extrabold text-white">
                    {currencySymbol}
                    {Number(foundOrder.finalTotal || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[260px] rounded-xl bg-[#090708] border border-dashed border-[#2C181D] p-6 flex flex-col items-center justify-center text-center">
                <Clock className="w-10 h-10 text-zinc-600 mb-3" />
                <h3 className="text-sm font-bold text-zinc-300">
                  No Order Selected Yet
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  Enter your Invoice ID and Minecraft username on the left to inspect your live order status and item breakdown.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

interface FaqSupportPoliciesViewProps {
  settings: StoreSettings;
  activeSubPage: 'faq' | 'support' | 'terms' | 'privacy' | 'refund' | 'delivery';
  onChangeSubPage: (sub: 'faq' | 'support' | 'terms' | 'privacy' | 'refund' | 'delivery') => void;
}

export const FaqSupportPoliciesView: React.FC<FaqSupportPoliciesViewProps> = ({
  settings,
  activeSubPage,
  onChangeSubPage,
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const visibleFaqs = (settings.faqItems || []).filter((f) => f.visible !== false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-12">
      {/* Sub-Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2C181D] pb-4">
        {[
          { id: 'faq', label: 'FAQ & Knowledge Base' },
          { id: 'support', label: '24/7 Support Desk' },
          { id: 'terms', label: 'Terms & Conditions' },
          { id: 'refund', label: 'Refund Policy' },
          { id: 'delivery', label: 'Delivery Policy' },
          { id: 'privacy', label: 'Privacy Policy' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              onChangeSubPage(
                tab.id as 'faq' | 'support' | 'terms' | 'privacy' | 'refund' | 'delivery'
              )
            }
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
              activeSubPage === tab.id
                ? 'bg-red-500/15 text-red-400 border-red-500/40'
                : 'bg-[#120C0E] text-zinc-400 border-[#2C181D] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* FAQ & Support Section */}
      {(activeSubPage === 'faq' || activeSubPage === 'support') && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5" />
              Knowledge Base
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>

            <div className="space-y-3 pt-2">
              {visibleFaqs.map((faq: FaqItem, idx: number) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={faq.id || idx}
                    className="rounded-xl bg-[#120C0E] border border-[#2C181D] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-[#181013] transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-bold text-white">{faq.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${
                          isOpen ? 'rotate-180 text-red-400' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 text-sm text-zinc-300 leading-relaxed border-t border-[#2C181D]/60 pt-3">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Support Card */}
          <div className="lg:col-span-5">
            <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 sm:p-7 space-y-5 h-full flex flex-col justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-mono uppercase tracking-wider">
                  <MessageSquare className="w-3.5 h-3.5" />
                  24/7 Player Support
                </div>
                <h3 className="text-2xl font-extrabold text-white">
                  Need Assistance With an Order?
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Our staff team is ready to help with payment verification, rank upgrades, or missing package deliveries. Keep your Invoice ID handy for priority support.
                </p>

                <div className="space-y-3 pt-2">
                  <a
                    href={settings.discordInviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 rounded-xl bg-[#090708] hover:bg-[#181013] border border-[#2C181D] hover:border-red-500/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white group-hover:text-red-400 transition-colors block">
                          Official Discord Support
                        </span>
                        <span className="text-xs text-zinc-400">
                          Open a #billing-support ticket
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-red-400">Join &rarr;</span>
                  </a>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#090708] border border-[#2C181D]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">
                          Billing Support Email
                        </span>
                        <span className="text-xs font-mono text-zinc-300">
                          {settings.supportEmail}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#090708] border border-[#2C181D] flex items-center gap-3 text-xs text-zinc-400">
                <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
                <span>
                  {settings.supportHours || 'Average billing ticket response time: Under 15 minutes.'}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Store Policies & Terms Section */}
      {(activeSubPage === 'terms' ||
        activeSubPage === 'privacy' ||
        activeSubPage === 'refund' ||
        activeSubPage === 'delivery') && (
        <section className="space-y-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#181013] border border-[#2C181D] text-zinc-300 text-xs font-mono uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5 text-red-400" />
              Legal & Store Policies
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {activeSubPage === 'terms' && 'Terms & Conditions'}
              {activeSubPage === 'refund' && 'Refund & Chargeback Policy'}
              {activeSubPage === 'delivery' && 'In-Game Package Delivery Policy'}
              {activeSubPage === 'privacy' && 'Customer Data & Privacy Policy'}
            </h2>
          </div>

          <div className="bg-[#120C0E] border border-[#2C181D] rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-red-400 mb-4 pb-3 border-b border-[#2C181D]">
              <FileText className="w-4 h-4" />
              <span>
                {activeSubPage === 'terms' && 'Official Store Terms & Conditions'}
                {activeSubPage === 'refund' && 'Refund & Chargeback Policy'}
                {activeSubPage === 'delivery' && 'In-Game Package Delivery Policy'}
                {activeSubPage === 'privacy' && 'Customer Data & Privacy Protection'}
              </span>
            </div>
            <SafeMarkdown
              content={
                activeSubPage === 'terms'
                  ? settings.policiesConfig?.termsAndConditions || ''
                  : activeSubPage === 'refund'
                  ? settings.policiesConfig?.refundPolicy || ''
                  : activeSubPage === 'delivery'
                  ? settings.policiesConfig?.deliveryPolicy || ''
                  : settings.policiesConfig?.privacyPolicy || ''
              }
            />
          </div>
        </section>
      )}
    </div>
  );
};

export const OrderLookupAndPolicies: React.FC<{
  settings: StoreSettings;
  initialInvoiceId?: string;
}> = ({ settings, initialInvoiceId }) => {
  const [subPage, setSubPage] = useState<
    'faq' | 'support' | 'terms' | 'privacy' | 'refund' | 'delivery'
  >('faq');

  return (
    <div>
      <OrderLookupSection
        currencySymbol={settings.currencySymbol}
        initialInvoiceId={initialInvoiceId}
      />
      <FaqSupportPoliciesView
        settings={settings}
        activeSubPage={subPage}
        onChangeSubPage={setSubPage}
      />
    </div>
  );
};
