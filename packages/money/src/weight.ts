import Decimal from 'decimal.js';

export class Weight {
  private constructor(private readonly _val: Decimal) {}

  static from(str: string): Weight {
    let d: Decimal;
    try {
      d = new Decimal(str);
    } catch {
      throw new RangeError('invalid weight: must be a positive finite number');
    }
    if (d.isNaN() || !d.isFinite() || d.lte(0)) {
      throw new RangeError('invalid weight: must be a positive finite number');
    }
    return new Weight(d);
  }

  static fromDecimal(d: Decimal): Weight {
    if (d.lte(0)) throw new RangeError('invalid weight: must be a positive finite number');
    return new Weight(d);
  }

  add(other: Weight): Weight {
    return new Weight(this._val.plus(other._val));
  }

  multiply(factor: Decimal | number): Decimal {
    return this._val.times(factor);
  }

  toFixed4(): string {
    return this._val.toFixed(4);
  }

  toGrams(): string {
    return `${this._val.toFixed(4)} g`;
  }
}
