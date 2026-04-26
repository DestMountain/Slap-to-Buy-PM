import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import { loadConfig } from "@main/config";
import { MarketService } from "@main/markets";
import { SensorService } from "@main/sensor";
import { JsonStore } from "@main/store";
import { TradingService } from "@main/trading";
import type { TapBuyRequest } from "@shared/types";

let mainWindow: BrowserWindow | null = null;
let marketTimer: NodeJS.Timeout | null = null;
let currentMarketId: string | null = null;

const config = loadConfig();

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 430,
    height: 820,
    minWidth: 390,
    minHeight: 720,
    title: "Spank Prediction",
    backgroundColor: "#fff5e8",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const currentUrl = window.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

app.whenReady().then(async () => {
  const store = new JsonStore(join(app.getPath("userData"), "state.json"));
  const markets = new MarketService(config);
  const trading = new TradingService(config, store, markets);
  const sensor = new SensorService(config);

  mainWindow = createWindow();
  registerIpc({ markets, trading, sensor });
  wireEvents({ markets, trading, sensor });

  sensor.start();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (marketTimer) {
    clearInterval(marketTimer);
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpc(input: {
  markets: MarketService;
  trading: TradingService;
  sensor: SensorService;
}): void {
  const { markets, trading, sensor } = input;

  ipcMain.handle("app:snapshot", async () => ({
    balance: await trading.balance(),
    sensor: sensor.status()
  }));

  ipcMain.handle("markets:list", () => markets.listMarkets());
  ipcMain.on("markets:setCurrent", (_event, marketId: unknown) => {
    currentMarketId = typeof marketId === "string" && marketId.length > 0 ? marketId : null;
  });

  ipcMain.handle("orders:tapBuyYes", (_event, request: TapBuyRequest) =>
    trading.tapBuyYes(request)
  );
  ipcMain.handle("orders:history", () => trading.orders());

  ipcMain.handle("balance:get", () => trading.balance());
  ipcMain.handle("positions:get", () => trading.positions());
  ipcMain.handle("settlements:list", () => trading.settlements());
  ipcMain.handle("sensor:status", () => sensor.status());
}

function wireEvents(input: {
  markets: MarketService;
  trading: TradingService;
  sensor: SensorService;
}): void {
  const { markets, trading, sensor } = input;

  sensor.on("status", (status) => {
    mainWindow?.webContents.send("sensor:status", status);
  });

  sensor.on("tap", (event) => {
    console.info(
      `[sensor] tap source=${event.source} magnitude=${event.magnitude ?? "n/a"} sensor=${event.sensorId ?? "n/a"}`
    );
    mainWindow?.webContents.send("sensor:events", event);
    void placeImuBuy(markets, trading);
  });

  trading.on("order", (order) => {
    void publishOrderUpdate(trading, order, "event");
  });

  trading.on("settlement", (settlement) => {
    mainWindow?.webContents.send("settlements:subscribe", settlement);
    void trading.balance().then((balance) => {
      mainWindow?.webContents.send("balance:update", balance);
    });
  });

  marketTimer = setInterval(() => {
    void markets.listMarkets().then((cards) => {
      mainWindow?.webContents.send("markets:update", cards);
    });
  }, 20_000);
}

async function placeImuBuy(markets: MarketService, trading: TradingService): Promise<void> {
  let marketId = currentMarketId;

  if (!marketId) {
    const [firstMarket] = await markets.listMarkets();
    marketId = firstMarket?.id ?? null;
    currentMarketId = marketId;
  }

  if (!marketId) {
    console.info("[orders] skipped imu buy: no current market");
    return;
  }

  const order = await trading.tapBuyYes({ marketId, source: "imu" });
  console.info(`[orders] imu ${order.status} ${order.title} amount=${order.usdAmount}`);
  await publishOrderUpdate(trading, order, "imu-direct");
}

async function publishOrderUpdate(
  trading: TradingService,
  order: Awaited<ReturnType<TradingService["tapBuyYes"]>>,
  source: string
): Promise<void> {
  const sentOrder = sendToRenderer("orders:update", order);
  const balance = await trading.balance();
  const sentBalance = sendToRenderer("balance:update", balance);
  console.info(
    `[ui] ${source} order=${order.id} sentOrder=${sentOrder ? "yes" : "no"} sentBalance=${sentBalance ? "yes" : "no"}`
  );
}

function sendToRenderer(channel: string, payload: unknown): boolean {
  const webContents = mainWindow?.webContents;
  if (!webContents || webContents.isDestroyed()) {
    return false;
  }

  webContents.send(channel, payload);
  return true;
}
