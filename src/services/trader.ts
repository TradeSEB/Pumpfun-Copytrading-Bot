import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  VersionedTransaction
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { logger } from "../logger";

const WSOL_MINT = "So11111111111111111111111111111111111111112";

interface QuoteResponse {
  outAmount: string;
  [key: string]: unknown;
}

interface SwapResponse {
  swapTransaction: string;
}

export class TraderService {
  constructor(
    private readonly connection: Connection,
    private readonly owner: Keypair,
    private readonly slippageBps: number,
    private readonly priorityFeeLamports: number
  ) {}

  getOwnerPublicKey(): PublicKey {
    return this.owner.publicKey;
  }

  async buyToken(mint: string, spendSol: number): Promise<{ tokenAmountUi: number }> {
    const lamports = Math.floor(spendSol * LAMPORTS_PER_SOL);
    const quote = await this.getQuote(WSOL_MINT, mint, lamports);
    const sig = await this.executeSwap(quote);
    const outRaw = Number(quote.outAmount);
    logger.info(`BUY executed for ${mint} amountRaw=${quote.outAmount} sig=${sig}`);
    return { tokenAmountUi: outRaw };
  }

  async sellAllToken(mint: string): Promise<void> {
    const ownerPubkey = this.owner.publicKey;
    const ata = getAssociatedTokenAddressSync(new PublicKey(mint), ownerPubkey);
    const tokenBalance = await this.connection.getTokenAccountBalance(ata).catch(() => null);
    const amountRaw = Number(tokenBalance?.value.amount ?? 0);
    if (amountRaw <= 0) {
      logger.warn(`No token balance to sell for mint ${mint}`);
      return;
    }

    const quote = await this.getQuote(mint, WSOL_MINT, amountRaw);
    const sig = await this.executeSwap(quote);
    logger.info(`SELL executed for ${mint} amountRaw=${amountRaw} sig=${sig}`);
  }

  async quoteSellValueInSol(mint: string): Promise<number> {
    const ownerPubkey = this.owner.publicKey;
    const ata = getAssociatedTokenAddressSync(new PublicKey(mint), ownerPubkey);
    const tokenBalance = await this.connection.getTokenAccountBalance(ata).catch(() => null);
    const amountRaw = Number(tokenBalance?.value.amount ?? 0);
    if (amountRaw <= 0) {
      return 0;
    }

    const quote = await this.getQuote(mint, WSOL_MINT, amountRaw);
    return Number(quote.outAmount) / LAMPORTS_PER_SOL;
  }

  private async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number
  ): Promise<QuoteResponse> {
    const url = new URL("https://quote-api.jup.ag/v6/quote");
    url.searchParams.set("inputMint", inputMint);
    url.searchParams.set("outputMint", outputMint);
    url.searchParams.set("amount", String(amount));
    url.searchParams.set("slippageBps", String(this.slippageBps));

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Quote failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as QuoteResponse;
  }

  private async executeSwap(quoteResponse: QuoteResponse): Promise<string> {
    const response = await fetch("https://quote-api.jup.ag/v6/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey: this.owner.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: this.priorityFeeLamports
      })
    });

    if (!response.ok) {
      throw new Error(`Swap request failed: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as SwapResponse;
    const serialized = Buffer.from(json.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(serialized);
    tx.sign([this.owner]);

    const signature = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 2
    });
    await this.connection.confirmTransaction(signature, "confirmed");
    return signature;
  }
}
