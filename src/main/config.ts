export interface AppConfig {
  gammaHost: string;
  minStakeUsd: number;
  tapdPath: string | null;

  // CLOB
  clobApiHost: string;
  clobWsHost: string;
  polygonRpc: string;
  chainId: number;

  // Contracts
  usdcContract: string;
  ctfExchange: string;
  collateralContract: string;

  // Builder
  builderKey: string | null;
  builderSecret: string | null;
  builderPassphrase: string | null;

  // Wallet
  privateKey: string | null;
}

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function envNumber(name: string, fallback: number): number {
  const value = env(name);
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  return {
    gammaHost: env("POLYMARKET_GAMMA_HOST") ?? "https://gamma-api.polymarket.com",
    minStakeUsd: envNumber("SPANK_MIN_STAKE_USD", 1),
    tapdPath: env("SPANK_TAPD_PATH"),
    clobApiHost: "https://clob.polymarket.com",
    clobWsHost: "wss://clob-polymarket.vercel.app/ws",
    polygonRpc: env("POLYGON_RPC") ?? "https://polygon-rpc.com",
    chainId: 137,
    usdcContract: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    ctfExchange: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8fB7F",
    collateralContract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    builderKey: env("POLYMARKET_BUILDER_API_KEY"),
    builderSecret: env("POLYMARKET_BUILDER_SECRET"),
    builderPassphrase: env("POLYMARKET_BUILDER_PASSPHRASE"),
    privateKey: env("POLYMARKET_PRIVATE_KEY"),
  };
}
