import Decimal from 'decimal.js';

// Correct: use Decimal.js for weight/price arithmetic
const weight = new Decimal('10.5000');
const rate = 684_200n;

// Correct: BigInt arithmetic for paise calculations
const goldValuePaise = BigInt(
  weight.mul(new Decimal(rate.toString()))
    .toDecimalPlaces(0, Decimal.ROUND_FLOOR)
    .toString()
);

// Correct: Number() only for display string generation, not stored or used in arithmetic
const displayStr = (Number(goldValuePaise) / 100).toLocaleString('hi-IN', { minimumFractionDigits: 2 });
void displayStr;
