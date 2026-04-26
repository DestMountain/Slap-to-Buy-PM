# Spank Prediction

Mac desktop prototype for tap-to-buy Polymarket prediction cards.

The app shows a phone-shaped window, cycles prediction cards every 8 seconds, and buys the current YES outcome when the Mac detects a desk knock. If the IMU helper is unavailable, the app falls back to Space while the window is focused.

## Status

- Electron + Vite + React desktop app.
- Polymarket Gamma market loading with mock fallback.
- Paper trading by default.
- No wallet, deposit, withdrawal, or live order path in the current MVP.
- Real-money trading is not part of this build.
- `tapd` Go helper source is included for Apple Silicon IMU tap events.
- Browser-only preview is available for UI work without Electron.

## Quick Start

```bash
npm install
npm run repair:electron
npm run check:tapd
npm run build:tapd
npm run typecheck
npm test
npm run build
npm run dev
```

If you only want UI iteration:

```bash
npm run dev:renderer
```

That starts a browser preview with mocked IPC and paper-mode data.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Electron with the Vite renderer dev server. |
| `npm run preview` | Build and start Electron from production output. |
| `npm run dev:renderer` | Browser-only mock preview for UI work. |
| `npm run build:tapd` | Build the Apple Silicon IMU helper. Requires Go. |
| `npm run check:tapd` | Check platform, helper binary, and sudo cache. |
| `npm run repair:electron` | Download, verify, and unpack Electron when npm install stalls. |
| `npm run typecheck` | TypeScript validation. |
| `npm test` | Vitest unit tests. |
| `npm run build` | Typecheck and production build. |

## Environment

Paper mode needs no secrets. A `.env.local` file is ignored by git, but it is not loaded automatically; source it before running Electron if you change local settings.

```bash
cp .env.example .env.local
# edit .env.local
set -a
source .env.local
set +a
npm run dev
```

Important variables:

```bash
SPANK_MIN_STAKE_USD=1
```

Do not put private keys in this project. There is no wallet flow in this MVP.

## IMU Helper

Install Go, then build `tapd`:

```bash
npm run check:tapd
cd tapd
go test ./...
go build -o tapd ./cmd/tapd
cd ..
sudo -v
npm run dev
```

Equivalent shortcut:

```bash
npm run build:tapd
sudo -v
npm run dev
```

If `tapd/tapd` is missing, unsupported, or denied by sudo, the app uses Space as the buy trigger while focused. The sensor line in the app will show `tapd missing`, `sudo needed`, or `Keyboard` so the failure mode is visible.

## Testing

Full testing instructions are in [docs/TESTING.md](docs/TESTING.md).

Current testing is paper-only. Do not send real funds to this app.

## References

- [Polymarket API](https://docs.polymarket.com/api-reference)
- [taigrr/spank](https://github.com/taigrr/spank)
