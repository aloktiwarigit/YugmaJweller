export interface PurityRates {
  GOLD_24K: { perGramPaise: bigint; fetchedAt: Date };
  GOLD_22K: { perGramPaise: bigint; fetchedAt: Date };
  GOLD_20K: { perGramPaise: bigint; fetchedAt: Date };
  GOLD_18K: { perGramPaise: bigint; fetchedAt: Date };
  GOLD_14K: { perGramPaise: bigint; fetchedAt: Date };
  SILVER_999: { perGramPaise: bigint; fetchedAt: Date };
  SILVER_925: { perGramPaise: bigint; fetchedAt: Date };
}

export interface RatesPort {
  getRatesByPurity(): Promise<PurityRates>;
  getName(): string; // 'ibja' | 'metalsdev'
}
