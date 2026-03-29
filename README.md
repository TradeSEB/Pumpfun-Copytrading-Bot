# Pump.fun Copytrading Bot (Solana)

TypeScript copytrading bot that:

- Streams target wallet activity from Solana RPC logs.
- Detects target wallet buy/sell activity from transaction balance deltas.
- Copies buys (same token mint) on your wallet.
- Supports two sell modes:
  - `AUTO_SELL=true`: ignore target sells and use your own TP/SL logic.
  - `AUTO_SELL=false`: mirror target sells (sell when target sells).

> This project is educational software. Use at your own risk. Trading is risky.

## Features

- Real-time wallet streaming (`onLogs`) for one or many target wallets.
- Heuristic trade parser from parsed transaction metadata.
- Jupiter-based swap execution (SOL <-> token).
- Position tracking for copied buys.
- Configurable risk controls:
  - max buy size
  - copy ratio multiplier
  - take profit %
  - stop loss %
  - max slippage

## Quick Start

### 1) Install

```bash
npm install
```

### 2) Configure

Copy env template:

```bash
copy .env.example .env
```

Fill required values in `.env`.

### 3) Run

Dev:

```bash
npm run dev
```

Build + run:

```bash
npm run build
npm start
```

## Environment Variables

See `.env.example` for full list.

Required:

- `RPC_HTTP_URL`: Solana HTTP RPC endpoint.
- `RPC_WS_URL`: Solana WebSocket endpoint.
- `PRIVATE_KEY`: your wallet private key (`[1,2,...]` JSON array or base58).
- `TARGET_WALLETS`: comma-separated wallet addresses to copy.

Key trading options:

- `AUTO_SELL`: `true` (TP/SL mode) or `false` (mirror target sell mode).
- `BUY_RATIO`: copied buy size multiplier vs detected target SOL spend.
- `MAX_BUY_SOL`: hard cap for each copied buy.
- `MIN_BUY_SOL`: minimum buy threshold.
- `TAKE_PROFIT_PCT`: used when `AUTO_SELL=true`.
- `STOP_LOSS_PCT`: used when `AUTO_SELL=true`.
- `SLIPPAGE_BPS`: swap slippage.

## How It Works

1. Bot subscribes to logs for each target wallet.
2. For each confirmed signature, it fetches parsed transaction details.
3. It computes target wallet token + SOL delta:
   - SOL down + token up => buy event.
   - token down (+ usually SOL up) => sell event.
4. On buy event:
   - Bot sizes buy using `BUY_RATIO` and min/max limits.
   - Executes SOL -> token swap on Jupiter.
   - Tracks position for future sell logic.
5. On sell event:
   - If `AUTO_SELL=false`, bot sells tracked token position immediately.
   - If `AUTO_SELL=true`, ignore target sell and rely on TP/SL checker.
6. TP/SL checker runs periodically and sells positions when thresholds hit.

## Notes & Limitations

- Trade detection is heuristic and may produce false positives/negatives on complex transactions.
- Pump.fun routing/liquidity ultimately depends on aggregator coverage and market state.
- Fast-moving pairs can fail due to slippage or no route.
- For production use, add:
  - persistent storage
  - retries/backoff
  - richer tx classification
  - priority fee tuning

## Project Structure

```
src/
  config.ts
  index.ts
  bot.ts
  logger.ts
  types.ts
  solana/
    wallet.ts
  services/
    wallet-stream.ts
    tx-parser.ts
    trader.ts
    position-manager.ts
```
