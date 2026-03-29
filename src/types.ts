export type TradeSide = "buy" | "sell";

export interface TradeEvent {
  side: TradeSide;
  wallet: string;
  signature: string;
  mint: string;
  tokenDeltaUi: number;
  solDelta: number;
}

export interface Position {
  mint: string;
  tokenAmountUi: number;
  totalCostSol: number;
}

export interface BotConfig {
  rpcHttpUrl: string;
  rpcWsUrl: string;
  privateKey: string;
  targetWallets: string[];
  autoSell: boolean;
  buyRatio: number;
  minBuySol: number;
  maxBuySol: number;
  takeProfitPct: number;
  stopLossPct: number;
  slippageBps: number;
  priorityFeeLamports: number;
  priceCheckIntervalMs: number;
}
