import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSnapshot,
  BalanceSnapshot,
  OrderReceipt,
  PositionSnapshot,
  PredictionCard,
  SensorStatus,
  SettlementNotice,
  TapBuyRequest,
  TapEvent
} from "@shared/types";

type Unsubscribe = () => void;

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
}

const api = {
  app: {
    snapshot: (): Promise<AppSnapshot> => ipcRenderer.invoke("app:snapshot")
  },
  markets: {
    list: (): Promise<PredictionCard[]> => ipcRenderer.invoke("markets:list"),
    setCurrent: (marketId: string | null): void => {
      ipcRenderer.send("markets:setCurrent", marketId);
    },
    subscribePrices: (callback: (cards: PredictionCard[]) => void): Unsubscribe =>
      subscribe("markets:update", callback)
  },
  orders: {
    tapBuyYes: (request: TapBuyRequest): Promise<OrderReceipt> =>
      ipcRenderer.invoke("orders:tapBuyYes", request),
    history: (): Promise<OrderReceipt[]> => ipcRenderer.invoke("orders:history"),
    onUpdate: (callback: (order: OrderReceipt) => void): Unsubscribe =>
      subscribe("orders:update", callback)
  },
  balance: {
    get: (): Promise<BalanceSnapshot> => ipcRenderer.invoke("balance:get"),
    onUpdate: (callback: (balance: BalanceSnapshot) => void): Unsubscribe =>
      subscribe("balance:update", callback)
  },
  positions: {
    get: (): Promise<PositionSnapshot[]> => ipcRenderer.invoke("positions:get")
  },
  sensor: {
    status: (): Promise<SensorStatus> => ipcRenderer.invoke("sensor:status"),
    onStatus: (callback: (status: SensorStatus) => void): Unsubscribe =>
      subscribe("sensor:status", callback),
    onEvent: (callback: (event: TapEvent) => void): Unsubscribe =>
      subscribe("sensor:events", callback)
  },
  settlements: {
    list: (): Promise<SettlementNotice[]> => ipcRenderer.invoke("settlements:list"),
    subscribe: (callback: (notice: SettlementNotice) => void): Unsubscribe =>
      subscribe("settlements:subscribe", callback)
  }
};

contextBridge.exposeInMainWorld("spank", api);

export type SpankApi = typeof api;
