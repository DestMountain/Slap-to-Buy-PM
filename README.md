# Slap to buy PM

Slap to buy PM is a Mac desktop UI/UX prototype for a deliberately playful interaction: hit the desk, buy a Polymarket-style prediction.

The goal is to explore whether a physical gesture can make short-term prediction markets feel faster, more tactile, and more game-like. The app presents a phone-shaped window, cycles through prediction cards, and reacts to desk knocks through the MacBook IMU on supported Apple Silicon machines. If IMU access is unavailable, the prototype falls back to the Space key.

This project is inspired by [taigrr/spank](https://github.com/taigrr/spank), which demonstrates Apple Silicon motion sensor access from macOS.

## Prototype Status

This is currently a UI/UX prototype only.

It is not connected to Polymarket for real trading. It does not create Polymarket accounts, manage wallets, place live orders, deposit funds, withdraw funds, or settle real positions. Any buy action in the app is paper-mode behavior for interaction testing.

## Built With

- Electron
- Vite
- React
- TypeScript
- Go helper for Apple Silicon IMU tap detection

This prototype was created through Codex GPT-5.5 vibecoding.

## Usage

Install dependencies:

```bash
npm install
```

Build the IMU helper:

```bash
npm run build:tapd
```

Check local IMU readiness:

```bash
sudo -v
npm run check:tapd
```

Start the Electron prototype:

```bash
npm run dev
```

For browser-only UI iteration:

```bash
npm run dev:renderer
```

The browser preview uses mocked IPC and does not test native IMU behavior.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Electron prototype. |
| `npm run dev:renderer` | Start the browser-only UI preview. |
| `npm run build:tapd` | Build and test the Go IMU helper. |
| `npm run check:tapd` | Check platform, helper binary, and sudo cache. |
| `npm run repair:electron` | Repair the Electron download if installation stalls. |
| `npm run typecheck` | Run TypeScript validation. |
| `npm test` | Run unit tests. |
| `npm run build` | Typecheck and build production output. |

## Safety Notes

- Do not send real funds to this app.
- Do not put private keys or API credentials into this project.
- The current prototype is paper-mode only.
- IMU access requires `sudo` because the helper reads Apple Silicon sensor data through elevated macOS IOKit access.

## Commercial Use

Unauthorized commercial use, resale, paid deployment, or productization of this project is not permitted. Commercial use requires explicit written authorization from the project owner.

## Testing

Full testing instructions are in [docs/TESTING.md](docs/TESTING.md).

Recommended local checks:

```bash
npm run typecheck
npm test
npm run build:tapd
npm run build
```

## References

- [taigrr/spank](https://github.com/taigrr/spank)
