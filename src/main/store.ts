import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  OrderReceipt,
  PositionSnapshot,
  SettlementNotice
} from "@shared/types";

interface PersistedState {
  version: 1;
  paperUsd: number;
  orders: OrderReceipt[];
  positions: PositionSnapshot[];
  settlements: SettlementNotice[];
}

const defaultState: PersistedState = {
  version: 1,
  paperUsd: 250,
  orders: [],
  positions: [],
  settlements: []
};

export class JsonStore {
  private state: PersistedState;

  constructor(private readonly filePath: string) {
    this.state = this.load();
  }

  snapshot(): PersistedState {
    return structuredClone(this.state);
  }

  get paperUsd(): number {
    return this.state.paperUsd;
  }

  setPaperUsd(value: number): void {
    this.state.paperUsd = Math.max(0, Number(value.toFixed(2)));
    this.save();
  }

  addOrder(order: OrderReceipt): void {
    this.state.orders = [order, ...this.state.orders].slice(0, 100);
    this.save();
  }

  orders(): OrderReceipt[] {
    return [...this.state.orders];
  }

  upsertPosition(position: PositionSnapshot): void {
    const index = this.state.positions.findIndex(
      (existing) =>
        existing.marketId === position.marketId && existing.mode === position.mode
    );

    if (index >= 0) {
      this.state.positions[index] = position;
    } else {
      this.state.positions.unshift(position);
    }

    this.save();
  }

  positions(): PositionSnapshot[] {
    return [...this.state.positions];
  }

  addSettlement(settlement: SettlementNotice): void {
    this.state.settlements = [settlement, ...this.state.settlements].slice(0, 30);
    this.save();
  }

  settlements(): SettlementNotice[] {
    return [...this.state.settlements];
  }

  private load(): PersistedState {
    try {
      if (!existsSync(this.filePath)) {
        return structuredClone(defaultState);
      }

      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<PersistedState>;
      return {
        ...defaultState,
        ...parsed,
        version: 1,
        paperUsd:
          typeof parsed.paperUsd === "number" && Number.isFinite(parsed.paperUsd)
            ? parsed.paperUsd
            : defaultState.paperUsd
      };
    } catch {
      return structuredClone(defaultState);
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
  }
}
