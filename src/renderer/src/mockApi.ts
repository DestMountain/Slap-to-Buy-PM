import type { SpankApi } from "../../preload";
import type {
  BalanceSnapshot,
  OrderReceipt,
  PredictionCard,
  SensorStatus,
  SettlementNotice
} from "@shared/types";

const markets: PredictionCard[] = [
  {
    id: "preview-btc",
    title: "Bitcoin up in the next 5 minutes?",
    icon: null,
    yesTokenId: "preview-btc-yes",
    yesPrice: 0.54,
    endDateIso: new Date(Date.now() + 5 * 60_000).toISOString(),
    liquidity: 44_000,
    volume24hr: 820_000,
    orderMinSize: 1,
    acceptingOrders: true,
    source: "mock"
  },
  {
    id: "preview-eth",
    title: "Ethereum closes green in 15 minutes?",
    icon: null,
    yesTokenId: "preview-eth-yes",
    yesPrice: 0.48,
    endDateIso: new Date(Date.now() + 15 * 60_000).toISOString(),
    liquidity: 28_000,
    volume24hr: 310_000,
    orderMinSize: 1,
    acceptingOrders: true,
    source: "mock"
  }
];

export function installMockApi(): void {
  let paperUsd = 250;
  const orders: OrderReceipt[] = [];
  const orderListeners = new Set<(order: OrderReceipt) => void>();
  const balanceListeners = new Set<(balance: BalanceSnapshot) => void>();
  const settlementListeners = new Set<(notice: SettlementNotice) => void>();

  const sensor: SensorStatus = {
    code: "keyboard-fallback",
    source: "keyboard",
    keyboardFallback: true,
    message: "Browser preview uses keyboard fallback."
  };

  const balance = (): BalanceSnapshot => ({
    mode: "paper",
    availableUsd: paperUsd,
    paperUsd,
    reason: "Browser preview is paper mode only."
  });

  const notifyBalance = (): void => {
    const next = balance();
    balanceListeners.forEach((listener) => listener(next));
  };

  const api: SpankApi = {
    app: {
      snapshot: async () => ({
        balance: balance(),
        sensor
      })
    },
    markets: {
      list: async () => markets,
      setCurrent: () => undefined,
      subscribePrices: () => () => undefined
    },
    orders: {
      tapBuyYes: async ({ marketId, source }) => {
        const market = markets.find((item) => item.id === marketId) ?? markets[0];
        const receipt: OrderReceipt = {
          id: crypto.randomUUID(),
          status: paperUsd >= market.orderMinSize ? "filled" : "rejected",
          mode: "paper",
          title: market.title,
          marketId: market.id,
          yesTokenId: market.yesTokenId,
          price: market.yesPrice,
          usdAmount: market.orderMinSize,
          shares: Number((market.orderMinSize / market.yesPrice).toFixed(4)),
          createdAt: Date.now(),
          source,
          reason: paperUsd >= market.orderMinSize ? undefined : "Paper balance is too low."
        };

        if (receipt.status === "filled") {
          paperUsd = Number((paperUsd - market.orderMinSize).toFixed(2));
        }

        orders.unshift(receipt);
        orderListeners.forEach((listener) => listener(receipt));
        notifyBalance();

        window.setTimeout(() => {
          const notice: SettlementNotice = {
            id: crypto.randomUUID(),
            marketTitle: market.title,
            realizedPnl: 0.82,
            payout: 1.82,
            resolvedAt: Date.now(),
            mode: "paper"
          };
          settlementListeners.forEach((listener) => listener(notice));
        }, 4_000);

        return receipt;
      },
      history: async () => orders,
      onUpdate: (callback) => {
        orderListeners.add(callback);
        return () => orderListeners.delete(callback);
      }
    },
    balance: {
      get: async () => balance(),
      onUpdate: (callback) => {
        balanceListeners.add(callback);
        return () => balanceListeners.delete(callback);
      }
    },
    positions: {
      get: async () => []
    },
    sensor: {
      status: async () => sensor,
      onStatus: () => () => undefined,
      onEvent: () => () => undefined
    },
    settlements: {
      list: async () => [],
      subscribe: (callback) => {
        settlementListeners.add(callback);
        return () => settlementListeners.delete(callback);
      }
    }
  };

  window.spank = api;
}
