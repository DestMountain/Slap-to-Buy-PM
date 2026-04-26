# Testing Guide

This project has three test levels:

1. Local safety checks: typecheck, unit tests, build.
2. App smoke tests: browser preview, Electron dev, Electron production preview.
3. IMU smoke test: verify desk knocks trigger paper buys.

Do not skip levels. Current testing is paper-only.

## 1. Local Safety Checks

Run these after every code change:

```bash
npm run repair:electron
npm run check:tapd
npm run typecheck
npm test
npm run build
```

Expected result:

- Electron resolves to `node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`.
- `npm run typecheck` exits 0.
- `npm test` exits 0.
- `npm run build` exits 0 and writes `out/`.

If Electron fails to install or hangs:

```bash
npm run repair:electron
node -e "console.log(require('electron'))"
node_modules/electron/dist/Electron.app/Contents/MacOS/Electron --version
```

The version should match `package.json`.

## 2. Browser UI Smoke Test

Use this when you only need UI behavior and do not need native Electron IPC.

```bash
npm run dev:renderer
```

Open `http://127.0.0.1:5173`.

Checklist:

- A phone-shaped app appears.
- A prediction card is visible.
- The progress bar drains over 8 seconds.
- Cards rotate automatically.
- Dragging left/right skips the card.
- Space buys in paper mode.
- Paper balance decreases by the market minimum.
- A settlement toast appears after the mocked delay.

Stop the server with `Ctrl+C`.

## 3. Electron Dev Smoke Test

```bash
npm run dev
```

Checklist:

- Electron opens a visible app window.
- The app does not crash if `tapd` is missing.
- Sensor status shows keyboard fallback unless `tapd` is built and sudo is available.
- Space buys only while the Electron window is focused.
- Orders appear in the activity list.
- There is no Live tab, wallet panel, deposit flow, or withdrawal flow in this MVP.

Stop with `Ctrl+C`, or close the Electron window.

## 4. Electron Production Preview

```bash
npm run preview
```

Checklist:

- Production output builds.
- Electron opens from `out/`.
- The app renders the same core UI.
- Keyboard fallback and paper trading still work.

## 5. IMU Test

Prerequisites:

- Apple Silicon Mac with accessible IMU.
- Go installed.
- `sudo` access.

Build and test helper:

```bash
npm run check:tapd
npm run build:tapd
sudo -v
npm run check:tapd
npm run dev
```

Manual equivalent:

```bash
cd tapd
go test ./...
go build -o tapd ./cmd/tapd
cd ..
sudo -v
npm run dev
```

Checklist:

- `npm run check:tapd` reports `tapd` present and `sudo cached`.
- If supported, sensor badge changes to IMU.
- A desk knock triggers a paper buy.
- Repeated knocks do not crash the app.
- If IMU is unsupported or sudo fails, the app falls back to keyboard.

If the app shows `tapd missing`, the helper was never built. If it shows `sudo needed`, run `sudo -v` in the same terminal before starting Electron. If it still falls back after both are fixed, that Mac model likely does not expose the Bosch BMI286 IMU through the same AppleSPUHIDDevice path.

## 6. Real-Money Testing

Do not test real money in the current build.

The wallet/funding/live-order path has been removed from this MVP. Polymarket real-money trading should only be reintroduced after wallet UX, explicit confirmation, geoblock state, balance display, order review, and withdrawal are implemented and tested.

## Current Limits

- Current app testing is paper-only.
- Wallets, deposits, live balance, live order review, and withdrawal are intentionally out of scope for this MVP.
- Market settlement toasts are UX feedback in paper mode.
