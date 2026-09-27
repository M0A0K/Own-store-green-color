import type { OrderLineItem } from '../db/schema.ts';
import { formatUsdPkr } from '../lib/currency.ts';

export interface DiscordOrderPayload {
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
  status: string;
  createdAt: Date | string | null;
}

const STATUS_COLORS: Record<string, number> = {
  Pending: 0xf59e0b,
  Paid: 0x3b82f6,
  Processing: 0x8b5cf6,
  Completed: 0xef4444,
  Cancelled: 0x71717a,
};

export async function sendNewOrderDiscordWebhook(
  order: DiscordOrderPayload,
  currencySymbol = '$'
): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return false;
  }

  try {
    const itemsFormatted = order.items
      .map(
        (item) =>
          `• **${item.quantity}x ${item.name}** (\`${item.productCode}\`) — **${formatUsdPkr(item.lineTotal, currencySymbol)}** *(Orig: ${formatUsdPkr(item.unitOriginalPrice, currencySymbol)} ea)*`
      )
      .join('\n');

    const timestampIso =
      order.createdAt instanceof Date
        ? order.createdAt.toISOString()
        : new Date(order.createdAt || Date.now()).toISOString();

    const embed = {
      title: `🛒 New OwnVerse Store Order — ${order.invoiceId}`,
      description: `A new order has been placed on **OwnVerse Store** and is awaiting verification.`,
      color: STATUS_COLORS[order.status] ?? 0xef4444,
      fields: [
        {
          name: 'Invoice / Order ID',
          value: `\`${order.invoiceId}\``,
          inline: true,
        },
        {
          name: 'Current Status',
          value: `**${order.status}**`,
          inline: true,
        },
        {
          name: 'Payment Method',
          value: `${order.paymentMethod} (\`${order.paymentReference}\`)`,
          inline: true,
        },
        {
          name: 'Minecraft Username',
          value: `\`${order.minecraftUsername}\``,
          inline: true,
        },
        {
          name: 'Discord Username',
          value: `\`${order.discordUsername}\``,
          inline: true,
        },
        {
          name: 'Order Date / Time',
          value: timestampIso,
          inline: true,
        },
        {
          name: 'Purchased Items (USD / PKR)',
          value: itemsFormatted || 'No items listed',
          inline: false,
        },
        {
          name: 'Original Subtotal',
          value: formatUsdPkr(order.subtotalOriginal, currencySymbol),
          inline: true,
        },
        {
          name: 'Sale Discounts',
          value: formatUsdPkr(-Math.abs(order.saleDiscountTotal), currencySymbol),
          inline: true,
        },
        {
          name: 'Promo Code & Discount',
          value: order.promoCode
            ? `\`${order.promoCode}\` (${formatUsdPkr(-Math.abs(order.promoDiscountTotal), currencySymbol)})`
            : `None (${formatUsdPkr(0, currencySymbol)})`,
          inline: true,
        },
        {
          name: 'Final Total Paid (USD / PKR)',
          value: `**${formatUsdPkr(order.finalTotal, currencySymbol)}**`,
          inline: false,
        },
      ],
      footer: {
        text: 'OwnVerse Store • Automated Order Telemetry (1 USD = 277 PKR)',
      },
      timestamp: timestampIso,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'OwnVerse Store Bot',
        embeds: [embed],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Discord webhook notification failed:', error);
    return false;
  }
}

export async function sendOrderStatusUpdateDiscordWebhook(
  order: DiscordOrderPayload,
  previousStatus: string,
  currencySymbol = '$'
): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return false;
  }

  try {
    const embed = {
      title: `🔄 Order Status Updated — ${order.invoiceId}`,
      description: `Order **${order.invoiceId}** for player \`${order.minecraftUsername}\` has been updated by an administrator.`,
      color: STATUS_COLORS[order.status] ?? 0xef4444,
      fields: [
        {
          name: 'Invoice ID',
          value: `\`${order.invoiceId}\``,
          inline: true,
        },
        {
          name: 'Previous Status',
          value: previousStatus,
          inline: true,
        },
        {
          name: 'New Status',
          value: `**${order.status}**`,
          inline: true,
        },
        {
          name: 'Minecraft Username',
          value: `\`${order.minecraftUsername}\``,
          inline: true,
        },
        {
          name: 'Discord Username',
          value: `\`${order.discordUsername}\``,
          inline: true,
        },
        {
          name: 'Final Total (USD / PKR)',
          value: `**${formatUsdPkr(order.finalTotal, currencySymbol)}** (${order.paymentMethod})`,
          inline: true,
        },
      ],
      footer: {
        text: 'OwnVerse Store • Order Status Audit Log (1 USD = 277 PKR)',
      },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'OwnVerse Store Bot',
        embeds: [embed],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Discord status webhook notification failed:', error);
    return false;
  }
}
