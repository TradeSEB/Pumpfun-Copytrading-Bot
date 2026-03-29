import { ParsedTransactionWithMeta } from "@solana/web3.js";
import { TradeEvent } from "../types";

interface TokenDelta {
  mint: string;
  deltaUi: number;
}

function getSolDelta(tx: ParsedTransactionWithMeta, wallet: string): number {
  const accountKeys = tx.transaction.message.accountKeys.map((k) =>
    typeof k === "string" ? k : k.pubkey.toBase58()
  );
  const idx = accountKeys.indexOf(wallet);
  if (idx < 0 || !tx.meta) {
    return 0;
  }
  const preLamports = tx.meta.preBalances[idx] ?? 0;
  const postLamports = tx.meta.postBalances[idx] ?? 0;
  const feeSol = (tx.meta.fee ?? 0) / 1_000_000_000;
  return (postLamports - preLamports) / 1_000_000_000 + feeSol;
}

function extractTokenDeltas(tx: ParsedTransactionWithMeta, wallet: string): TokenDelta[] {
  if (!tx.meta) {
    return [];
  }

  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];
  const byMint = new Map<string, { pre: number; post: number }>();

  for (const entry of pre) {
    if (entry.owner !== wallet) {
      continue;
    }
    const mint = entry.mint;
    const value = Number(entry.uiTokenAmount.uiAmountString ?? "0");
    const existing = byMint.get(mint) ?? { pre: 0, post: 0 };
    existing.pre += value;
    byMint.set(mint, existing);
  }

  for (const entry of post) {
    if (entry.owner !== wallet) {
      continue;
    }
    const mint = entry.mint;
    const value = Number(entry.uiTokenAmount.uiAmountString ?? "0");
    const existing = byMint.get(mint) ?? { pre: 0, post: 0 };
    existing.post += value;
    byMint.set(mint, existing);
  }

  const result: TokenDelta[] = [];
  byMint.forEach((amounts, mint) => {
    const delta = amounts.post - amounts.pre;
    if (Math.abs(delta) > 0) {
      result.push({ mint, deltaUi: delta });
    }
  });

  return result;
}

export function parseTradeEvent(
  tx: ParsedTransactionWithMeta,
  signature: string,
  wallet: string
): TradeEvent | null {
  const tokenDeltas = extractTokenDeltas(tx, wallet);
  if (tokenDeltas.length === 0) {
    return null;
  }

  const primary = tokenDeltas.sort((a, b) => Math.abs(b.deltaUi) - Math.abs(a.deltaUi))[0];
  const solDelta = getSolDelta(tx, wallet);

  if (primary.deltaUi > 0 && solDelta < 0) {
    return {
      side: "buy",
      wallet,
      signature,
      mint: primary.mint,
      tokenDeltaUi: primary.deltaUi,
      solDelta
    };
  }

  if (primary.deltaUi < 0) {
    return {
      side: "sell",
      wallet,
      signature,
      mint: primary.mint,
      tokenDeltaUi: primary.deltaUi,
      solDelta
    };
  }

  return null;
}
