import { describe, expect, it } from "vitest";
import { rankPredictionCards } from "@main/markets";
import type { PredictionCard } from "@shared/types";

function card(overrides: Partial<PredictionCard>): PredictionCard {
  return {
    id: "base",
    title: "Base market",
    icon: null,
    yesTokenId: "yes",
    yesPrice: 0.5,
    endDateIso: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString(),
    liquidity: 1_000,
    volume24hr: 1_000,
    orderMinSize: 1,
    acceptingOrders: true,
    source: "gamma",
    ...overrides
  };
}

describe("rankPredictionCards", () => {
  it("prefers active liquid short-term markets", () => {
    const ranked = rankPredictionCards([
      card({ id: "closed", acceptingOrders: false, volume24hr: 500_000 }),
      card({
        id: "short",
        endDateIso: new Date(Date.now() + 30 * 60_000).toISOString(),
        liquidity: 25_000,
        volume24hr: 100_000
      }),
      card({
        id: "long",
        endDateIso: new Date(Date.now() + 10 * 24 * 60 * 60_000).toISOString(),
        liquidity: 10_000,
        volume24hr: 100_000
      })
    ]);

    expect(ranked[0].id).toBe("short");
    expect(ranked.at(-1)?.id).toBe("closed");
  });
});
