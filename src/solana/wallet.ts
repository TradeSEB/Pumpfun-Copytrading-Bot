import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

export function parsePrivateKey(raw: string): Keypair {
  const text = raw.trim();
  if (text.startsWith("[")) {
    const values = JSON.parse(text) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(values));
  }
  const bytes = bs58.decode(text);
  return Keypair.fromSecretKey(bytes);
}
