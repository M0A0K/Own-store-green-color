export const USD_TO_PKR_RATE = 277;

export function toPkrAmount(usdAmount: number): number {
  const numeric = Number(usdAmount) || 0;
  return Math.round(numeric * USD_TO_PKR_RATE);
}

export function formatPkrOnly(usdAmount: number): string {
  return `${toPkrAmount(usdAmount)}pkr`;
}

/**
 * Formats any USD amount in the unified dual USD/PKR format:
 * e.g. $1.00 / 277pkr
 */
export function formatUsdPkr(usdAmount: number, currencySymbol = '$'): string {
  const numeric = Number(usdAmount) || 0;
  const absVal = Math.abs(numeric);
  const pkr = Math.round(absVal * USD_TO_PKR_RATE);
  const prefix = numeric < 0 ? '-' : '';
  return `${prefix}${currencySymbol}${absVal.toFixed(2)} / ${prefix}${pkr}pkr`;
}
