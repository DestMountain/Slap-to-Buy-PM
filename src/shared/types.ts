export type TradingMode = "paper";

export type SensorSource = "imu" | "keyboard";

export type SensorStatusCode =
  | "starting"
  | "imu-ready"
  | "keyboard-fallback"
  | "unsupported"
  | "permission-denied"
  | "helper-missing"
  | "error";

export interface SensorStatus {
  code: SensorStatusCode;
  source: SensorSource;
  keyboardFallback: boolean;
  message: string;
  detail?: string;
  tapCount?: number;
  lastTapAt?: number;
  lastMagnitude?: number;
}

export interface PredictionCard {
  id: string;
  title: string;
  icon: string | null;
  yesTokenId: string;
  yesPrice: number;
  endDateIso: string | null;
  liquidity: number;
  volume24hr: number;
  orderMinSize: number;
  acceptingOrders: boolean;
  source: "gamma" | "mock";
}

export interface TapEvent {
  source: SensorSource;
  timestamp: number;
  magnitude?: number;
  sensorId?: string;
}

export interface TradeIntent {
  mode: TradingMode;
  marketId: string;
  yesTokenId: string;
  usdAmount: number;
  source: SensorSource;
}

export type OrderStatus = "accepted" | "rejected" | "pending" | "filled";

export interface OrderReceipt {
  id: string;
  status: OrderStatus;
  mode: TradingMode;
  title: string;
  marketId: string;
  yesTokenId: string;
  price: number;
  usdAmount: number;
  shares: number;
  createdAt: number;
  source: SensorSource;
  reason?: string;
}

export interface BalanceSnapshot {
  mode: TradingMode;
  availableUsd: number;
  paperUsd: number;
  reason?: string;
}

export interface SettlementNotice {
  id: string;
  marketTitle: string;
  realizedPnl: number;
  payout: number;
  resolvedAt: number;
  mode: TradingMode;
}

export interface PositionSnapshot {
  marketId: string;
  title: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  mode: TradingMode;
}

export interface AppSnapshot {
  balance: BalanceSnapshot;
  sensor: SensorStatus;
}

export interface TapBuyRequest {
  marketId: string;
  source: SensorSource;
}
