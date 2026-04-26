import type { AppConfig } from "@main/config";
import type { PredictionCard } from "@shared/types";

interface GammaMarket {
  id?: string | number;
  question?: string;
  title?: string;
  active?: boolean;
  closed?: boolean;
  enableOrderBook?: boolean;
  acceptingOrders?: boolean;
  endDateIso?: string;
  endDate?: string;
  volume24hr?: string | number;
  volume24hrClob?: string | number;
  liquidityNum?: string | number;
  liquidity?: string | number;
  icon?: string;
  image?: string;
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
  orderMinSize?: string | number;
  orderPriceMinTickSize?: string | number;
}

const mockCards: PredictionCard[] = [
  {
    id: "mock-btc-5m",
    title: "Bitcoin up in the next 5 minutes?",
    icon: null,
    yesTokenId: "mock-btc-yes",
    yesPrice: 0.53,
    endDateIso: new Date(Date.now() + 5 * 60_000).toISOString(),
    liquidity: 24000,
    volume24hr: 180000,
    orderMinSize: 1,
    acceptingOrders: true,
    source: "mock"
  },
  {
    id: "mock-eth-15m",
    title: "Ethereum above the current tick in 15 minutes?",
    icon: null,
    yesTokenId: "mock-eth-yes",
    yesPrice: 0.47,
    endDateIso: new Date(Date.now() + 15 * 60_000).toISOString(),
    liquidity: 19000,
    volume24hr: 99000,
    orderMinSize: 1,
    acceptingOrders: true,
    source: "mock"
  },
  {
    id: "mock-sol-1h",
    title: "SOL closes green this hour?",
    icon: null,
    yesTokenId: "mock-sol-yes",
    yesPrice: 0.61,
    endDateIso: new Date(Date.now() + 60 * 60_000).toISOString(),
    liquidity: 14000,
    volume24hr: 76000,
    orderMinSize: 1,
    acceptingOrders: true,
    source: "mock"
  }
];

export class MarketService {
  private cache: { cards: PredictionCard[]; fetchedAt: number } | null = null;

  constructor(private readonly config: AppConfig) {}

  async listMarkets(): Promise<PredictionCard[]> {
    if (this.cache && Date.now() - this.cache.fetchedAt < 20_000) {
      return this.cache.cards;
    }

    const cards = await this.fetchGammaMarkets().catch(() => mockCards);
    const ranked = rankPredictionCards(cards).slice(0, 20);
    const result = ranked.length > 0 ? ranked : mockCards;
    this.cache = { cards: result, fetchedAt: Date.now() };
    return result;
  }

  async getMarket(marketId: string): Promise<PredictionCard | null> {
    const markets = await this.listMarkets();
    return markets.find((market) => market.id === marketId) ?? null;
  }

  private async fetchGammaMarkets(): Promise<PredictionCard[]> {
    const url = new URL("/markets", this.config.gammaHost);
    url.searchParams.set("closed", "false");
    url.searchParams.set("limit", "80");
    url.searchParams.set("order", "volume24hr");
    url.searchParams.set("ascending", "false");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Gamma API returned ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      const rows = Array.isArray(payload) ? payload : [];
      return rows
        .map((row) => toPredictionCard(row as GammaMarket))
        .filter((card): card is PredictionCard => Boolean(card));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function rankPredictionCards(cards: PredictionCard[]): PredictionCard[] {
  const now = Date.now();

  return [...cards].sort((a, b) => {
    return scoreCard(b, now) - scoreCard(a, now);
  });
}

function scoreCard(card: PredictionCard, now: number): number {
  const end = card.endDateIso ? Date.parse(card.endDateIso) : Number.POSITIVE_INFINITY;
  const msToEnd = Number.isFinite(end) ? Math.max(0, end - now) : Number.POSITIVE_INFINITY;
  const hoursToEnd = msToEnd / 3_600_000;
  const shortTermBoost = hoursToEnd <= 1 ? 450_000 : hoursToEnd <= 24 ? 250_000 : 0;
  const acceptingBoost = card.acceptingOrders ? 1_000_000 : 0;
  const liquidityScore = Math.min(card.liquidity, 100_000) * 0.8;
  const volumeScore = Math.min(card.volume24hr, 500_000) * 0.35;
  const priceQuality = card.yesPrice > 0.03 && card.yesPrice < 0.97 ? 80_000 : 0;

  return acceptingBoost + shortTermBoost + liquidityScore + volumeScore + priceQuality;
}

function toPredictionCard(market: GammaMarket): PredictionCard | null {
  const id = market.id == null ? null : String(market.id);
  const title = market.question ?? market.title ?? null;
  const outcomes = parseArray(market.outcomes);
  const outcomePrices = parseArray(market.outcomePrices);
  const tokenIds = parseArray(market.clobTokenIds);
  const yesIndex = findYesIndex(outcomes);
  const yesTokenId = tokenIds[yesIndex] == null ? null : String(tokenIds[yesIndex]);
  const yesPrice = toNumber(outcomePrices[yesIndex], NaN);

  if (!id || !title || !yesTokenId || !Number.isFinite(yesPrice)) {
    return null;
  }

  return {
    id,
    title,
    icon: market.icon ?? market.image ?? null,
    yesTokenId,
    yesPrice: clamp(yesPrice, 0.01, 0.99),
    endDateIso: market.endDateIso ?? market.endDate ?? null,
    liquidity: toNumber(market.liquidityNum ?? market.liquidity, 0),
    volume24hr: toNumber(market.volume24hrClob ?? market.volume24hr, 0),
    orderMinSize: Math.max(1, toNumber(market.orderMinSize, 1)),
    acceptingOrders:
      market.acceptingOrders !== false &&
      market.closed !== true &&
      market.active !== false &&
      market.enableOrderBook !== false,
    source: "gamma"
  };
}

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function findYesIndex(outcomes: unknown[]): number {
  const index = outcomes.findIndex(
    (outcome) => typeof outcome === "string" && outcome.toLowerCase() === "yes"
  );
  return index >= 0 ? index : 0;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
