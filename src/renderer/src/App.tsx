import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  CheckCircle2,
  Flame,
  Radio,
  ShieldAlert,
  TimerReset,
  Zap
} from "lucide-react";
import type {
  AppSnapshot,
  OrderReceipt,
  PredictionCard,
  SensorSource,
  SensorStatus,
  SettlementNotice
} from "@shared/types";

const cardDurationMs = 8_000;

type AppToastKind = "success" | "error" | "info";

interface AppToast {
  id: string;
  kind: AppToastKind;
  title: string;
  detail: string;
}

export default function App(): ReactElement {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [cards, setCards] = useState<PredictionCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cycleKey, setCycleKey] = useState(0);
  const [orders, setOrders] = useState<OrderReceipt[]>([]);
  const [toasts, setToasts] = useState<AppToast[]>([]);
  const [dragX, setDragX] = useState(0);
  const [tapBurst, setTapBurst] = useState(false);
  const [busy, setBusy] = useState(false);

  const dragStart = useRef<number | null>(null);
  const currentCardRef = useRef<PredictionCard | null>(null);
  const busyRef = useRef(false);
  const seenOrderIds = useRef<Set<string>>(new Set());

  const currentCard = cards[currentIndex] ?? null;
  currentCardRef.current = currentCard;
  busyRef.current = busy;

  const pushToast = useCallback((toast: Omit<AppToast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((value) => [{ id, ...toast }, ...value].slice(0, 4));
    window.setTimeout(() => {
      setToasts((value) => value.filter((item) => item.id !== id));
    }, 5_400);
  }, []);

  const applyOrder = useCallback((order: OrderReceipt, notify = true) => {
    const isNew = !seenOrderIds.current.has(order.id);
    seenOrderIds.current.add(order.id);
    setOrders((value) => [order, ...value.filter((item) => item.id !== order.id)].slice(0, 6));
    if (notify && isNew) {
      pushToast(orderToToast(order));
    }
  }, [pushToast]);

  const refreshTradingState = useCallback(async (notify = true) => {
    const [history, balance] = await Promise.all([
      window.spank.orders.history(),
      window.spank.balance.get()
    ]);
    const nextOrders = history.slice(0, 6);
    const freshOrders = nextOrders.filter((order) => !seenOrderIds.current.has(order.id));

    nextOrders.forEach((order) => seenOrderIds.current.add(order.id));
    setOrders(nextOrders);
    setSnapshot((value) => (value ? { ...value, balance } : value));

    if (notify) {
      freshOrders.reverse().forEach((order) => pushToast(orderToToast(order)));
    }
  }, [pushToast]);

  useEffect(() => {
    let cancelled = false;

    async function boot(): Promise<void> {
      const [nextSnapshot, nextCards, history] = await Promise.all([
        window.spank.app.snapshot(),
        window.spank.markets.list(),
        window.spank.orders.history()
      ]);

      if (!cancelled) {
        history.forEach((order) => seenOrderIds.current.add(order.id));
        setSnapshot(nextSnapshot);
        setCards(nextCards);
        setOrders(history.slice(0, 6));
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribers = [
      window.spank.markets.subscribePrices((nextCards) => {
        setCards(nextCards);
        setCurrentIndex((index) => Math.min(index, Math.max(0, nextCards.length - 1)));
      }),
      window.spank.sensor.onStatus((sensor) => {
        setSnapshot((value) => (value ? { ...value, sensor } : value));
      }),
      window.spank.orders.onUpdate((order) => {
        applyOrder(order);
      }),
      window.spank.balance.onUpdate((balance) => {
        setSnapshot((value) => (value ? { ...value, balance } : value));
      }),
      window.spank.settlements.subscribe((notice) => {
        pushToast(settlementToToast(notice));
      })
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [applyOrder, pushToast]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshTradingState(true);
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [refreshTradingState]);

  useEffect(() => {
    window.spank.markets.setCurrent(currentCard?.id ?? null);
  }, [currentCard?.id]);

  const pulseTap = useCallback(() => {
    setTapBurst(true);
    window.setTimeout(() => setTapBurst(false), 520);
  }, []);

  const buyCurrent = useCallback(async (source: SensorSource) => {
    const card = currentCardRef.current;
    if (!card || busyRef.current) {
      return;
    }

    setBusy(true);
    pulseTap();

    try {
      const order = await window.spank.orders.tapBuyYes({ marketId: card.id, source });
      setOrders((value) => [order, ...value.filter((item) => item.id !== order.id)].slice(0, 6));
      const balance = await window.spank.balance.get();
      setSnapshot((value) => (value ? { ...value, balance } : value));
    } finally {
      setBusy(false);
    }
  }, [pulseTap]);

  useEffect(() => {
    return window.spank.sensor.onEvent((event) => {
      if (event.source === "imu") {
        pulseTap();
        window.setTimeout(() => void refreshTradingState(true), 160);
      }
    });
  }, [pulseTap, refreshTradingState]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code !== "Space" || !snapshot?.sensor.keyboardFallback) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      void buyCurrent("keyboard");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [buyCurrent, snapshot?.sensor.keyboardFallback]);

  const skipCard = useCallback((direction = 1) => {
    setDragX(0);
    setCurrentIndex((index) => {
      if (cards.length === 0) {
        return 0;
      }
      return (index + direction + cards.length) % cards.length;
    });
    setCycleKey((value) => value + 1);
  }, [cards.length]);

  useEffect(() => {
    if (cards.length <= 1) {
      return;
    }

    const timeout = window.setTimeout(() => skipCard(1), cardDurationMs);
    return () => window.clearTimeout(timeout);
  }, [cards.length, currentIndex, cycleKey, skipCard]);

  const dragStyle = useMemo(
    () => ({
      transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)`,
      opacity: Math.max(0.55, 1 - Math.abs(dragX) / 340)
    }),
    [dragX]
  );

  const balance = snapshot?.balance;
  const sensor = snapshot?.sensor;

  return (
    <main className="shell">
      <section className="phone" aria-label="Spank Prediction">
        <div className="topBar">
          <div className="brandMark">
            <Zap size={18} strokeWidth={2.6} />
          </div>
          <div className="balancePill" title={balance?.reason ?? "Balance"}>
            <BadgeDollarSign size={16} />
            <span>{formatUsd(balance?.availableUsd ?? 0)}</span>
          </div>
        </div>

        <ToastStack toasts={toasts} />

        <div className="sensorLine">
          <SensorBadge sensor={sensor} />
          <span title={sensor?.message}>{sensorLineText(sensor)}</span>
        </div>

        <section className={`stage ${tapBurst ? "tapBurst" : ""}`}>
          {currentCard ? (
            <article
              className="marketCard"
              style={dragStyle}
              onPointerDown={(event) => {
                dragStart.current = event.clientX;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (dragStart.current != null) {
                  setDragX(event.clientX - dragStart.current);
                }
              }}
              onPointerUp={(event) => {
                if (Math.abs(dragX) > 86) {
                  skipCard(dragX > 0 ? 1 : -1);
                } else {
                  setDragX(0);
                }
                dragStart.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
            >
              <div className="timerRail" aria-hidden="true">
                <span key={cycleKey} />
              </div>
              <div className="cardHeader">
                <MarketLogo card={currentCard} />
                <div>
                  <p className="eyebrow">{currentCard.source === "gamma" ? "Polymarket" : "Paper feed"}</p>
                  <p className="marketMeta">
                    <TimerReset size={14} />
                    {formatEnd(currentCard.endDateIso)}
                  </p>
                </div>
              </div>
              <h1>{currentCard.title}</h1>
              <div className="priceRow">
                <div>
                  <span className="priceLabel">YES</span>
                  <strong>{formatPrice(currentCard.yesPrice)}</strong>
                </div>
                <div className="heat">
                  <Flame size={18} />
                  <span>{compact(currentCard.volume24hr)}</span>
                </div>
              </div>
              <button
                className="buyButton"
                type="button"
                disabled={busy}
                onClick={() => void buyCurrent(sensor?.source ?? "keyboard")}
              >
                {busy ? "Buying" : `Buy ${formatUsd(currentCard.orderMinSize)}`}
                <ArrowUpRight size={18} />
              </button>
            </article>
          ) : (
            <div className="emptyCard">
              <Radio size={30} />
              <p>Loading markets</p>
            </div>
          )}
        </section>

        <section className="activity">
          {orders.length === 0 ? (
            <div className="quietState">
              <ShieldAlert size={18} />
              <span>Paper mode active. Knock or Space to buy.</span>
            </div>
          ) : (
            orders.slice(0, 3).map((order) => <OrderLine key={order.id} order={order} />)
          )}
        </section>
      </section>
    </main>
  );
}

function SensorBadge({ sensor }: { sensor?: SensorStatus }): ReactElement {
  const ready = sensor?.code === "imu-ready";
  return (
    <span className={`sensorBadge ${ready ? "ready" : "fallback"}`}>
      <Radio size={14} />
      {ready ? "IMU" : "Keyboard"}
    </span>
  );
}

function ToastStack({ toasts }: { toasts: AppToast[] }): ReactElement | null {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toastStack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast, index) => (
        <GooeyToast key={toast.id} toast={toast} index={index} total={toasts.length} />
      ))}
    </div>
  );
}

function GooeyToast({
  toast,
  index,
  total
}: {
  toast: AppToast;
  index: number;
  total: number;
}): ReactElement {
  const visibleIndex = Math.min(index, 2);
  const hidden = index > 2;

  return (
    <div
      className={`gooeyToast ${toast.kind} ${hidden ? "hidden" : ""}`}
      style={{
        transform: `translateY(${visibleIndex * 12}px) scale(${1 - visibleIndex * 0.045})`,
        zIndex: total - index
      }}
    >
      <div className="gooeyToastBlob" />
      <div className="gooeyToastContent">
        <span className="gooeyToastIcon">
          {toast.kind === "success" ? <CheckCircle2 size={16} /> : <Bell size={16} />}
        </span>
        <div>
          <strong>{toast.title}</strong>
          <small>{toast.detail}</small>
        </div>
      </div>
    </div>
  );
}

function MarketLogo({ card }: { card: PredictionCard }): ReactElement {
  if (card.icon) {
    return <img className="marketLogo" src={card.icon} alt="" />;
  }

  return <div className="marketLogo fallbackLogo">{card.title.slice(0, 1).toUpperCase()}</div>;
}

function settlementToToast(notice: SettlementNotice): Omit<AppToast, "id"> {
  const positive = notice.realizedPnl >= 0;
  return {
    kind: positive ? "success" : "error",
    title: `${positive ? "Settled +" : "Settled "}${formatUsd(notice.realizedPnl)}`,
    detail: notice.marketTitle
  };
}

function orderToToast(order: OrderReceipt): Omit<AppToast, "id"> {
  if (order.status === "rejected") {
    return {
      kind: "error",
      title: "Order rejected",
      detail: order.reason ?? order.title
    };
  }

  return {
    kind: "info",
    title: `${order.status === "filled" ? "Filled" : "Sent"} ${formatUsd(order.usdAmount)}`,
    detail: order.title
  };
}

function OrderLine({ order }: { order: OrderReceipt }): ReactElement {
  return (
    <div className={`orderLine ${order.status}`}>
      <div>
        <strong>{order.status.toUpperCase()}</strong>
        <span>{order.title}</span>
      </div>
      <p>{order.reason ?? `${formatUsd(order.usdAmount)} @ ${formatPrice(order.price)}`}</p>
    </div>
  );
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0
  }).format(value);
}

function formatPrice(value: number): string {
  return `${Math.round(value * 100)}¢`;
}

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatEnd(value: string | null): string {
  if (!value) {
    return "Open";
  }

  const end = Date.parse(value);
  if (!Number.isFinite(end)) {
    return "Open";
  }

  const minutes = Math.max(0, Math.round((end - Date.now()) / 60_000));
  if (minutes < 60) {
    return `${minutes}m`;
  }

  if (minutes < 1_440) {
    return `${Math.round(minutes / 60)}h`;
  }

  return `${Math.round(minutes / 1_440)}d`;
}

function sensorShortReason(sensor?: SensorStatus): string {
  if (!sensor) {
    return "Checking input";
  }

  if (sensor.code === "helper-missing") {
    return "tapd missing";
  }

  if (sensor.code === "permission-denied") {
    return "sudo needed";
  }

  if (sensor.code === "unsupported") {
    return "Space fallback";
  }

  return "Space to buy";
}

function sensorLineText(sensor?: SensorStatus): string {
  if (!sensor) {
    return "Checking input";
  }

  if (sensor.keyboardFallback) {
    return sensorShortReason(sensor);
  }

  if (sensor.tapCount && sensor.tapCount > 0) {
    return `Tap ${sensor.tapCount} detected`;
  }

  return "Knock to buy";
}
