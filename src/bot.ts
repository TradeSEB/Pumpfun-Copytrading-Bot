import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BotConfig, TradeEvent } from "./types";
import { logger } from "./logger";
import { parsePrivateKey } from "./solana/wallet";
import { WalletStreamService } from "./services/wallet-stream";
import { TraderService } from "./services/trader";
import { PositionManager } from "./services/position-manager";

export class PumpfunCopytradingBot {
  private readonly connection: Connection;
  private readonly trader: TraderService;
  private readonly positions = new PositionManager();
  private readonly walletStream: WalletStreamService;
  private priceChecker?: NodeJS.Timeout;

  constructor(private readonly config: BotConfig) {
    const owner = parsePrivateKey(config.privateKey);
    this.connection = new Connection(config.rpcHttpUrl, {
      commitment: "confirmed",
      wsEndpoint: config.rpcWsUrl
    });
    this.trader = new TraderService(
      this.connection,
      owner,
      config.slippageBps,
      config.priorityFeeLamports
    );
    this.walletStream = new WalletStreamService(
      this.connection,
      config.targetWallets,
      async (event) => this.handleTradeEvent(event)
    );
  }

  start(): void {
    logger.info(`Starting bot. AutoSell=${this.config.autoSell}`);
    this.walletStream.start();

    if (this.config.autoSell) {
      this.priceChecker = setInterval(() => {
        this.checkAutoSell().catch((error) => logger.error("Auto-sell check failed", error));
      }, this.config.priceCheckIntervalMs);
    }
  }

  stop(): void {
    this.walletStream.stop();
    if (this.priceChecker) {
      clearInterval(this.priceChecker);
      this.priceChecker = undefined;
    }
  }

  private async handleTradeEvent(event: TradeEvent): Promise<void> {
    logger.info(`Target ${event.wallet} ${event.side} ${event.mint} sig=${event.signature}`);

    if (event.side === "buy") {
      await this.handleTargetBuy(event);
      return;
    }

    if (!this.config.autoSell) {
      await this.handleTargetSell(event);
    }
  }

  private async handleTargetBuy(event: TradeEvent): Promise<void> {
    const targetSpentSol = Math.abs(event.solDelta);
    const proposed = targetSpentSol * this.config.buyRatio;
    const buySol = Math.max(this.config.minBuySol, Math.min(this.config.maxBuySol, proposed));

    const walletBalanceLamports = await this.connection.getBalance(this.trader.getOwnerPublicKey());
    const walletBalanceSol = walletBalanceLamports / LAMPORTS_PER_SOL;
    if (walletBalanceSol < buySol) {
      logger.warn(`Insufficient SOL balance. Need ${buySol.toFixed(4)} SOL, have ${walletBalanceSol.toFixed(4)}`);
      return;
    }

    await this.trader.buyToken(event.mint, buySol);
    const estimatedTokenReceived = Math.abs(event.tokenDeltaUi) * this.config.buyRatio;
    this.positions.recordBuy(event.mint, estimatedTokenReceived, buySol);
    logger.info(`Copied BUY ${event.mint} with ${buySol.toFixed(4)} SOL`);
  }

  private async handleTargetSell(event: TradeEvent): Promise<void> {
    const existing = this.positions.get(event.mint);
    if (!existing) {
      return;
    }
    await this.trader.sellAllToken(event.mint);
    this.positions.remove(event.mint);
    logger.info(`Mirrored SELL for ${event.mint} (AUTO_SELL=false)`);
  }

  private async checkAutoSell(): Promise<void> {
    const allPositions = this.positions.all();
    for (const position of allPositions) {
      const currentValueSol = await this.trader.quoteSellValueInSol(position.mint);
      if (currentValueSol <= 0) {
        continue;
      }

      const pnlPct = ((currentValueSol - position.totalCostSol) / position.totalCostSol) * 100;
      if (pnlPct >= this.config.takeProfitPct) {
        logger.info(
          `Take-profit hit on ${position.mint}. pnl=${pnlPct.toFixed(2)}% >= ${this.config.takeProfitPct}%`
        );
        await this.trader.sellAllToken(position.mint);
        this.positions.remove(position.mint);
        continue;
      }

      if (pnlPct <= -this.config.stopLossPct) {
        logger.info(
          `Stop-loss hit on ${position.mint}. pnl=${pnlPct.toFixed(2)}% <= -${this.config.stopLossPct}%`
        );
        await this.trader.sellAllToken(position.mint);
        this.positions.remove(position.mint);
      }
    }
  }
}
