export class OutputBudgetTracker {
  private readonly limit: number;
  private used: number = 0;

  constructor(limit: number) {
    this.limit = limit;
  }

  record(tokens: number): void {
    this.used = Math.min(this.limit, this.used + tokens);
  }

  remaining(): number {
    return Math.max(0, this.limit - this.used);
  }

  ratio(): number {
    if (this.limit === 0) return 0;
    return this.used / this.limit;
  }

  reset(): void {
    this.used = 0;
  }
}

export function checkBudgetLow(tracker: OutputBudgetTracker, threshold: number): boolean {
  return tracker.ratio() >= 1 - threshold;
}
