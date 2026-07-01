# Slap-to-Buy-PM 改造方案

## 架构

```
┌─ Renderer (React) ────────────────────┐
│  App.tsx   ← 已有，加 WalletButton等    │
│  Wallet UI ← 新增 (RainbowKit)         │
└────────────┬──────────────────────────┘
             │ IPC (preload bridge)
┌────────────▼──────────────────────────┐
│  Main Process (Electron)               │
│                                        │
│  markets.ts   ← 改造：加 trending 排序  │
│  trading.ts   ← 改造：加 CLOB 下单     │
│  wallet.ts    ← 新增：钱包/签名器管理   │
│  config.ts    ← 加 CLOB / Builder 配置 │
│  store.ts     ← 已有                    │
└────────────────────────────────────────┘
```

## 改动清单

### 1. 数据层 — MarketService（改 markets.ts）
- Gamma API 已能获取约 80 个市场
- 加 trending 排序：volume24hr + 新创建时间 + 价格合理度
- `source: "gamma"` 标记真实数据 ✓

### 2. 交易层 — TradingService（改 trading.ts）
- 新增 `mode: "clob"` 交易模式
- CLOB 下单：用 `@polymarket/clob-client` 或 `@polymarket/order-utils`
- 签名：用 `POLYMARKET_PRIVATE_KEY` + `ethers` Wallet
- 保留 paper 模式兜底
- Builder API 若支持交易则作为备选

### 3. 钱包 — WalletService（新增 wallet.ts）
- 管理 ethers Wallet (从 POLYMARKET_PRIVATE_KEY)
- 查询 USDC 余额
- approve USDC → CTF 兑换
- 提供签名器给 CLOB SDK

### 4. 前端 — UI 调整（改 App.tsx）
- 加钱包连接状态指示
- 加模式切换开关 (paper / real)
- 加余额显示 (real USDC + paper)

### 5. 配置（改 config.ts）
- 加 CLOB API 地址
- 加 Builder API 地址 + key
- 加 Polygon RPC
- 加合约地址

## 包依赖新增
- `ethers` — 钱包和签名
- `@polymarket/clob-client` — CLOB 交易
- `@rainbow-me/rainbowkit` + `wagmi` + `viem` — 钱包 UI

## 环境变量（.env.example）
```
POLYMARKET_PRIVATE_KEY=
POLYMARKET_BUILDER_API_KEY=
POLYMARKET_BUILDER_SECRET=
POLYMARKET_BUILDER_PASSPHRASE=
POLYGON_RPC_URL=
```

## 测试策略
- 保持 `mode: "paper"` 为默认
- `mode: "clob"` 需手动开启
- mock 模式下用模拟 USDC 余额
- CLOB 下单实际签名但不上链（dry-run）
