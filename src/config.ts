import dotenv from "dotenv";
import { BotConfig } from "./types";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function asNumber(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return defaultValue;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number in env var: ${name}`);
  }
  return parsed;
}

function asBoolean(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw || raw.trim().length === 0) {
    return defaultValue;
  }
  return raw.trim().toLowerCase() === "true";
}

export function loadConfig(): BotConfig {
  const walletsRaw = required("TARGET_WALLETS");
  const targetWallets = walletsRaw
    .split(",")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  if (targetWallets.length === 0) {
    throw new Error("TARGET_WALLETS must include at least one wallet");
  }

  return {
    rpcHttpUrl: required("RPC_HTTP_URL"),
    rpcWsUrl: required("RPC_WS_URL"),
    privateKey: required("PRIVATE_KEY"),
    targetWallets,
    autoSell: asBoolean("AUTO_SELL", true),
    buyRatio: asNumber("BUY_RATIO", 1),
    minBuySol: asNumber("MIN_BUY_SOL", 0.01),
    maxBuySol: asNumber("MAX_BUY_SOL", 0.2),
    takeProfitPct: asNumber("TAKE_PROFIT_PCT", 25),
    stopLossPct: asNumber("STOP_LOSS_PCT", 12),
    slippageBps: Math.floor(asNumber("SLIPPAGE_BPS", 500)),
    priorityFeeLamports: Math.floor(asNumber("PRIORITY_FEE_LAMPORTS", 50_000)),
    priceCheckIntervalMs: Math.floor(asNumber("PRICE_CHECK_INTERVAL_MS", 7000))
  };
}
