import { marketSnapshot, type MarketSnapshot } from "./mockData";

export type MarketRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "5Y" | "MAX";

export type HistoricalGoldPoint = {
  timestamp: string;
  label: string;
  time: string;
  audPrice: number;
  usdPrice: number;
};

export type MarketPriceStats = {
  currentAud: number;
  currentUsd: number;
  changeAud: number;
  changeUsd: number;
  changePercent: number;
  dayHighAud: number;
  dayLowAud: number;
  previousCloseAud: number;
  lastUpdated: string;
  status: "available" | "stale" | "unavailable";
};

type MarketIntervalUnit = "hour" | "day" | "week" | "month" | "quarter" | "year";

const ranges: Record<MarketRange, { count: number; unit: MarketIntervalUnit; drift: number; wave: number }> = {
  "1D": { count: 24, unit: "hour", drift: 1.8, wave: 14 },
  "1W": { count: 7, unit: "day", drift: 9.5, wave: 28 },
  "1M": { count: 30, unit: "day", drift: 5.4, wave: 42 },
  "3M": { count: 13, unit: "week", drift: 18, wave: 55 },
  "6M": { count: 26, unit: "week", drift: 11, wave: 68 },
  "1Y": { count: 12, unit: "month", drift: 32, wave: 82 },
  "5Y": { count: 20, unit: "quarter", drift: 52, wave: 130 },
  MAX: { count: 24, unit: "year", drift: 64, wave: 160 }
};

function getPointDate(index: number, count: number, unit: MarketIntervalUnit) {
  const date = new Date("2026-09-19T10:35:00+10:00");
  const offset = count - index - 1;

  if (unit === "hour") date.setHours(date.getHours() - offset);
  if (unit === "day") date.setDate(date.getDate() - offset);
  if (unit === "week") date.setDate(date.getDate() - offset * 7);
  if (unit === "month") date.setMonth(date.getMonth() - offset);
  if (unit === "quarter") date.setMonth(date.getMonth() - offset * 3);
  if (unit === "year") date.setFullYear(date.getFullYear() - offset);

  return date;
}

function formatPointLabel(date: Date, unit: MarketIntervalUnit) {
  if (unit === "hour") {
    return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  }

  if (unit === "year") {
    return date.toLocaleDateString("en-AU", { year: "numeric" });
  }

  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function createHistoricalSeries(range: MarketRange): HistoricalGoldPoint[] {
  const config = ranges[range];
  const base = marketSnapshot.audPerOz - config.count * config.drift;
  const exchangeRate = marketSnapshot.usdPerOz / marketSnapshot.audPerOz;

  return Array.from({ length: config.count }, (_, index) => {
    const date = getPointDate(index, config.count, config.unit);
    const wave = Math.sin(index / 2.7) * config.wave;
    const smallerWave = Math.cos(index / 4.1) * (config.wave / 3);
    const audPrice = Math.round((base + index * config.drift + wave + smallerWave) * 100) / 100;
    const usdPrice = Math.round(audPrice * exchangeRate * 100) / 100;
    const label = formatPointLabel(date, config.unit);

    return {
      timestamp: date.toISOString(),
      label,
      time: date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }),
      audPrice,
      usdPrice
    };
  });
}

export const marketRanges = Object.keys(ranges) as MarketRange[];

export const historicalGoldByRange: Record<MarketRange, HistoricalGoldPoint[]> = marketRanges.reduce(
  (series, range) => ({ ...series, [range]: createHistoricalSeries(range) }),
  {} as Record<MarketRange, HistoricalGoldPoint[]>
);

export const marketPriceService = {
  getCurrentGoldPrice(market: MarketSnapshot): MarketPriceStats {
    const points = historicalGoldByRange["1D"];
    const previous = points.at(-2)?.audPrice ?? market.audPerOz - 21.4;
    const changeAud = Math.round((market.audPerOz - previous) * 100) / 100;
    const changeUsd = Math.round(changeAud * (market.usdPerOz / market.audPerOz) * 100) / 100;

    return {
      currentAud: market.audPerOz,
      currentUsd: market.usdPerOz,
      changeAud,
      changeUsd,
      changePercent: Math.round((changeAud / previous) * 10000) / 100,
      dayHighAud: Math.max(...points.map((point) => point.audPrice), market.audPerOz),
      dayLowAud: Math.min(...points.map((point) => point.audPrice), market.audPerOz),
      previousCloseAud: previous,
      lastUpdated: market.lastUpdated,
      status: market.marketOpen ? "available" : "unavailable"
    };
  },

  getHistoricalGoldPrices(range: MarketRange) {
    return historicalGoldByRange[range];
  }
};
