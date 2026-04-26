export interface AppConfig {
  gammaHost: string;
  minStakeUsd: number;
  tapdPath: string | null;
}

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function envNumber(name: string, fallback: number): number {
  const value = env(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  return {
    gammaHost: env("POLYMARKET_GAMMA_HOST") ?? "https://gamma-api.polymarket.com",
    minStakeUsd: envNumber("SPANK_MIN_STAKE_USD", 1),
    tapdPath: env("SPANK_TAPD_PATH")
  };
}
