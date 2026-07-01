# Slap to Buy PM

Slap to Buy PM is a Mac desktop app for Polymarket: hit your desk (or press Space), instantly buy trending prediction positions.

The app presents a phone-shaped window, cycles through prediction cards, and reacts to desk knocks through the MacBook IMU on supported Apple Silicon machines. If IMU access is unavailable, it falls back to the Space key.

Inspired by [taigrr/spank](https://github.com/taigrr/spank).

## Features

- **Real Polymarket data** — fetches trending markets from Gamma API
- **Two trading modes:**
  - **Paper mode** (default) — $250 virtual USD for testing
  - **CLOB mode** — connects to your Polymarket wallet for real trading
- **Wallet integration** — auto-connects via `POLYMARKET_PRIVATE_KEY`, shows USDC balance
- **IMU tap detection** — hit your desk on Apple Silicon Macs
- **Keyboard fallback** — press Space on any Mac

## Prerequisites

- macOS (Apple Silicon recommended for IMU)
- Node.js 18+
- Go (for building the IMU helper)

## Setup

```bash
# Install dependencies
npm install

# Build the IMU helper
npm run build:tapd

# Configure environment
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable | Required | Description |
|---|---|---|
| `POLYMARKET_PRIVATE_KEY` | For CLOB mode | Your Polygon wallet private key |
| `POLYMARKET_BUILDER_API_KEY | For Builder API | Polymarket Builder API key |
| `POLYMARKET_BUILDER_SECRET` | For Builder API | Polymarket Builder API secret |
| `POLYMARKET_BUILDER_PASSPHRASE` | For Builder API | Polymarket Builder API passphrase |
| `SPANK_MIN_STAKE_USD` | No | Minimum stake per trade (default: 1) |
| `POLYGON_RPC` | No | Custom Polygon RPC endpoint |

## Running

```bash
npm run dev
```

For browser-only UI iteration (no IMU):
```bash
npm run dev:renderer
```

## Safety Notes

- **Paper mode is the default.** The app will NOT spend real money unless your wallet is connected and you have USDC balance.
- Keep your `.env` file private. Never commit it.
- CLOB mode activates automatically when a valid `POLYMARKET_PRIVATE_KEY` is detected.
- Do not send real funds until you've verified the app works in paper mode.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Electron prototype |
| `npm run dev:renderer` | Start browser-only UI preview |
| `npm run build:tapd` | Build and test the Go IMU helper |
| `npm test` | Run unit tests |
| `npm run typecheck` | Run TypeScript validation |
| `npm run build` | Typecheck and build production output |

## Architecture

```
Renderer (React) ← IPC → Main Process
                            ├── MarketService (Gamma API)
                            ├── WalletService (ethers + Polygon)
                            ├── TradingService (paper / CLOB)
                            ├── SensorService (IMU / keyboard)
                            └── JsonStore (state persistence)
```

## References

- [Polymarket CLOB API](https://docs.polymarket.com/api/rest)
- [Gamma API](https://docs.polymarket.com/api/gamma)
- [taigrr/spank](https://github.com/taigrr/spank)
