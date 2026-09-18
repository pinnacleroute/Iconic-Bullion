import type { BullionProduct, MarketSnapshot } from "./mockData";

export const TROY_OUNCE_GRAMS = 31.1;

export function getGoldPricePerGram(market: MarketSnapshot) {
  return market.audPerOz / TROY_OUNCE_GRAMS;
}

export function calculateProductBullionPrice(product: BullionProduct, market: MarketSnapshot) {
  const gramPrice = getGoldPricePerGram(market);
  const priceAfterMargin = gramPrice * (1 + product.marginPercent / 100);
  return priceAfterMargin * product.weightGrams;
}

export function calculateBuyBackPrice(product: BullionProduct, market: MarketSnapshot) {
  const gramPrice = getGoldPricePerGram(market);
  return gramPrice * product.weightGrams * 0.972;
}

export function calculateCartLockedPrice(
  lines: Array<{ product: BullionProduct; quantity: number; lockedPrice: number }>,
  deliveryFee: number
) {
  const subtotal = lines.reduce((sum, line) => sum + line.lockedPrice * line.quantity, 0);
  return {
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee
  };
}

export function formatAUD(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatUSD(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.max(seconds % 60, 0).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}
