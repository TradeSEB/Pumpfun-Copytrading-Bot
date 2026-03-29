import { Connection, Logs, PublicKey } from "@solana/web3.js";
import { logger } from "../logger";
import { parseTradeEvent } from "./tx-parser";
import { TradeEvent } from "../types";

type TradeEventHandler = (event: TradeEvent) => Promise<void>;

export class WalletStreamService {
  private readonly processedSignatures = new Set<string>();
  private readonly subscriptions: number[] = [];

  constructor(
    private readonly connection: Connection,
    private readonly targetWallets: string[],
    private readonly onTradeEvent: TradeEventHandler
  ) {}

  start(): void {
    for (const wallet of this.targetWallets) {
      const pubkey = new PublicKey(wallet);
      const subId = this.connection.onLogs(
        pubkey,
        async (logs: Logs) => {
          const signature = logs.signature;
          if (!signature || this.processedSignatures.has(signature)) {
            return;
          }

          this.processedSignatures.add(signature);

          try {
            const tx = await this.connection.getParsedTransaction(signature, {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed"
            });
            if (!tx) {
              return;
            }

            const parsed = parseTradeEvent(tx, signature, wallet);
            if (!parsed) {
              return;
            }

            await this.onTradeEvent(parsed);
          } catch (error) {
            logger.warn(`Failed to parse tx ${signature}`, error);
          }
        },
        "confirmed"
      );

      this.subscriptions.push(subId);
      logger.info(`Subscribed logs for target wallet ${wallet}`);
    }
  }

  stop(): void {
    for (const id of this.subscriptions) {
      this.connection
        .removeOnLogsListener(id)
        .catch((error) => logger.warn(`Failed to remove subscription ${id}`, error));
    }
    this.subscriptions.length = 0;
  }
}
