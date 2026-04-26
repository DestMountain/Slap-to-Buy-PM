import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "@main/config";
import { loadConfig } from "@main/config";
import type { MarketService } from "@main/markets";
import { JsonStore } from "@main/store";
import { TradingService } from "@main/trading";
import type { PredictionCard } from "@shared/types";

const market: PredictionCard = {
  id: "m1",
  title: "BTC up in 5 minutes?",
  icon: null,
  yesTokenId: "yes1",
  yesPrice: 0.5,
  endDateIso: new Date(Date.now() + 5 * 60_000).toISOString(),
  liquidity: 10_000,
  volume24hr: 50_000,
  orderMinSize: 1,
  acceptingOrders: true,
  source: "mock"
};

describe("TradingService", () => {
  it("fills paper buys and debits the minimum stake", async () => {
    const dir = mkdtempSync(join(tmpdir(), "spank-prediction-"));
    try {
      const config: AppConfig = { ...loadConfig(), minStakeUsd: 1 };
      const store = new JsonStore(join(dir, "state.json"));
      const markets = {
        getMarket: async () => market
      } as unknown as MarketService;
      const trading = new TradingService(config, store, markets);

      const receipt = await trading.tapBuyYes({ marketId: market.id, source: "keyboard" });

      expect(receipt.status).toBe("filled");
      expect(receipt.shares).toBe(2);
      expect(store.paperUsd).toBe(249);
      expect(store.positions()[0].marketId).toBe(market.id);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects paper buys when balance is too low", async () => {
    const dir = mkdtempSync(join(tmpdir(), "spank-prediction-"));
    try {
      const config: AppConfig = { ...loadConfig(), minStakeUsd: 300 };
      const store = new JsonStore(join(dir, "state.json"));
      const markets = {
        getMarket: async () => market
      } as unknown as MarketService;
      const trading = new TradingService(config, store, markets);

      const receipt = await trading.tapBuyYes({ marketId: market.id, source: "keyboard" });

      expect(receipt.status).toBe("rejected");
      expect(receipt.reason).toContain("balance");
      expect(store.paperUsd).toBe(250);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
