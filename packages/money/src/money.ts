export class MoneyInPaise {
  private constructor(private readonly _paise: bigint) {}

  static from(paise: bigint): MoneyInPaise {
    return new MoneyInPaise(paise);
  }

  add(other: MoneyInPaise): MoneyInPaise {
    return new MoneyInPaise(this._paise + other._paise);
  }

  subtract(other: MoneyInPaise): MoneyInPaise {
    return new MoneyInPaise(this._paise - other._paise);
  }

  toRupees(): string {
    const fmt = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
    return fmt.format(Number(this._paise) / 100);
  }

  toNumber(): number {
    return Number(this._paise);
  }
}
