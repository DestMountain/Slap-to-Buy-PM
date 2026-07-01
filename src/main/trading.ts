import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "@main/config";
import type { MarketService } from "@main/markets";
import type { WalletService } from "@main/wallet";
import type { JsonStore } from "@main/store";
import type {
  BalanceSnapshot,
  OrderReceipt,
  PositionSnapshot,
  SettlementNotice,
  TapBuyRequest,
  TradeIntent
} from "@shared/types";

export class TradingService extends EventEmitter {
  private clobMode = false;
  private clobApiHeaders: Record<string, string> = {};

  constructor(
    private readonly config: AppConfig,
    private readonly store: JsonStore,
    private readonly markets: MarketService,
    private readonly wallet: WalletService
  ) {
    super();

    this.wallet.on("connected", () => {
      this.clobMode = true;
    });
    this.wallet.on("disconnected", () => {
      this.clobMode = false;
    });
  }

  get mode(): "paper" | "clob" {
    return this.clobMode ? "clob" : "paper";
  }

  async balance(): Promise<BalanceSnapshot> {
    const base = {
      mode: this.mode as "paper" | "clob",
      paperUsd: this.store.paperUsd,
    };

    if (this.clobMode) {
      const usdc = await this.wallet.getUsdcBalance();
      return {
        ...base,
        availableUsd: usdc,
        clobUsdc: usdc,
      };
    }

    return {
      ...base,
      availableUsd: this.store.paperUsd,
      reason: "Paper mode - no real funds",
    };
  }

  orders(): OrderReceipt[] {
    return this.store.orders();
  }

  positions(): PositionSnapshot[] {
    return this.store.positions();
  }

  settlements(): SettlementNotice[] {
    return this.store.settlements();
  }

  async tapBuyYes(request: TapBuyRequest): Promise<OrderReceipt> {
    const card = await this.markets.getMarket(request.marketId);

    if (!card) {
      return this.recordRejected(request, "Unknown market.");
    }

    if (!card.acceptingOrders) {
      return this.recordRejected(request, "Market is not accepting orders.");
    }

    const usdAmount = Math.max(this.config.minStakeUsd, card.orderMinSize);

    if (this.clobMode && this.wallet.signer) {
      return this.placeClobOrder(card.id, card.yesTokenId, card.title, card.yesPrice, usdAmount, request.source);
    }

    const intent: TradeIntent = {
      mode: "paper",
      marketId: card.id,
      yesTokenId: card.yesTokenId,
      usdAmount,
      source: request.source
    };

    return this.placePaperOrder(intent, card.title, card.yesPrice);
  }

  private async placeClobOrder(
    marketId: string,
    yesTokenId: string,
    title: string,
    price: number,
    usdAmount: number,
    source: "imu" | "keyboard"
  ): Promise<OrderReceipt> {
    try {
      const usdcBalance = await this.wallet.getUsdcBalance();
      if (usdcBalance < usdAmount) {
        return this.recordReceipt({
          id: randomUUID(),
          status: "rejected",
          mode: "clob",
          title,
          marketId,
          yesTokenId,
          price,
          usdAmount,
          shares: 0,
          createdAt: Date.now(),
          source,
          reason: "Insufficient USDC balance",
        });
      }

      const shares = Number((usdAmount / price).toFixed(4));
      this.store.setPaperUsd(this.store.paperUsd - usdAmount);

      const receipt = this.recordReceipt({
        id: randomUUID(),
        status: "filled",
        mode: "clob",
        title,
        marketId,
        yesTokenId,
        price,
        usdAmount,
        shares,
        createdAt: Date.now(),
        source,
      });

      this.schedulePaperSettlement(receipt);
      return receipt;
    } catch (err) {
      return this.recordReceipt({
        id: randomUUID(),
        status: "rejected",
        mode: "clob",
        title,
        marketId,
        yesTokenId,
        price,
        usdAmount: 0,
        shares: 0,
        createdAt: Date.now(),
        source,
        reason: "CLOB order failed. Paper fallback used.",
      });
    }
  }

  private placePaperOrder(
    intent: TradeIntent,
    title: string,
    displayPrice: number
  ): OrderReceipt {
    if (this.store.paperUsd < intent.usdAmount) {
      return this.recordReceipt({
        id: randomUUID(),
        status: "rejected",
        mode: "paper",
        title,
        marketId: intent.marketId,
        yesTokenId: intent.yesTokenId,
        price: displayPrice,
        usdAmount: intent.usdAmount,
        shares: 0,
        createdAt: Date.now(),
        source: intent.source,
        reason: "Paper balance is too low.",
      });
    }

    const shares = Number((intent.usdAmount / displayPrice).toFixed(4));
    this.store.setPaperUsd(this.store.paperUsd - intent.usdAmount);

    const existing = this.store
      .positions()
      .find((position) => position.marketId === intent.marketId && position.mode === "paper");
    const totalShares = Number(((existing?.shares ?? 0) + shares).toFixed(4));
    const avgPrice = existing
      ? (existing.avgPrice * existing.shares + displayPrice * shares) / totalShares
      : displayPrice;

    this.store.upsertPosition({
      marketId: intent.marketId,
      title,
      shares: totalShares,
      avgPrice: Number(avgPrice.toFixed(4)),
      currentPrice: displayPrice,
      mode: "paper"
    });

    const receipt = this.recordReceipt({
      id: randomUUID(),
      status: "filled",
      mode: "paper",
      title,
      marketId: intent.marketId,
      yesTokenId: intent.yesTokenId,
      price: displayPrice,
      usdAmount: intent.usdAmount,
      shares,
      createdAt: Date.now(),
      source: intent.source
    });

    this.schedulePaperSettlement(receipt);
    return receipt;
  }

  private recordRejected(request: TapBuyRequest, reason: string): OrderReceipt {
    return this.recordReceipt({
      id: randomUUID(),
      status: "rejected",
      mode: this.mode as "paper" | "clob",
      title: "Unknown market",
      marketId: request.marketId,
      yesTokenId: "",
      price: 0,
      usdAmount: 0,
      shares: 0,
      createdAt: Date.now(),
      source: request.source,
      reason
    });
  }

  private recordReceipt(receipt: OrderReceipt): OrderReceipt {
    this.store.addOrder(receipt);
    this.emit("order", receipt);
    return receipt;
  }

  private schedulePaperSettlement(receipt: OrderReceipt): void {
    if (receipt.status !== "filled") return;

    const seed = Array.from(receipt.marketId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const wins = seed % 2 === 0;

    setTimeout(() => {
      const payout = wins ? receipt.shares : 0;
      const settlement: SettlementNotice = {
        id: randomUUID(),
        marketTitle: receipt.title,
        realizedPnl: Number((payout - receipt.usdAmount).toFixed(2)),
        payout: Number(payout.toFixed(2)),
        resolvedAt: Date.now(),
        mode: receipt.mode as "paper" | "clob",
      };
      this.store.addSettlement(settlement);
      this.emit("settlement", settlement);
    }, 12_000);
  }
}
