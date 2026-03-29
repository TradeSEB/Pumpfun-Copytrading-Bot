import { Position } from "../types";

export class PositionManager {
  private readonly positions = new Map<string, Position>();

  recordBuy(mint: string, tokenAmountUi: number, costSol: number): void {
    const current = this.positions.get(mint);
    if (!current) {
      this.positions.set(mint, { mint, tokenAmountUi, totalCostSol: costSol });
      return;
    }
    current.tokenAmountUi += tokenAmountUi;
    current.totalCostSol += costSol;
    this.positions.set(mint, current);
  }

  remove(mint: string): void {
    this.positions.delete(mint);
  }

  get(mint: string): Position | undefined {
    return this.positions.get(mint);
  }

  all(): Position[] {
    return [...this.positions.values()];
  }
}
