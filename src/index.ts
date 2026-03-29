import { loadConfig } from "./config";
import { PumpfunCopytradingBot } from "./bot";
import { logger } from "./logger";

async function main(): Promise<void> {
  const config = loadConfig();
  const bot = new PumpfunCopytradingBot(config);

  bot.start();

  process.on("SIGINT", () => {
    logger.warn("Received SIGINT. Shutting down...");
    bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.warn("Received SIGTERM. Shutting down...");
    bot.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error("Fatal error while starting bot", error);
  process.exit(1);
});
