// semgrep: goldsmith-no-float-on-weight-or-price should flag all lines below

// parseFloat usage on weight/price
const weight = parseFloat('10.5');

// Math.round on a monetary value
const rounded = Math.round(1234567);

// Number multiplication (arithmetic, not display)
const goldValue = Number('10.5') * 684200;
