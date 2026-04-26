export interface CtrDocument {
  shopGstin:      string;
  shopName:       string;
  customerName:   string;
  customerPhone:  string;
  customerPan:    string | null;
  monthStr:       string; // 'YYYY-MM'
  totalCashPaise: bigint;
  transactions:   Array<{
    date:          string; // 'YYYY-MM-DD'
    amountPaise:   bigint;
    invoiceNumber: string;
  }>;
  generatedAt:    Date;
}

export function buildCtrDocument(params: {
  shop:         { gstin: string; name: string };
  customer:     { name: string; phone: string; panDecrypted: string | null };
  monthStr:     string;
  transactions: Array<{ date: string; amountPaise: bigint; invoiceNumber: string }>;
}): CtrDocument {
  const total = params.transactions.reduce((s, t) => s + t.amountPaise, 0n);
  return {
    shopGstin:      params.shop.gstin,
    shopName:       params.shop.name,
    customerName:   params.customer.name,
    customerPhone:  params.customer.phone,
    customerPan:    params.customer.panDecrypted,
    monthStr:       params.monthStr,
    totalCashPaise: total,
    transactions:   params.transactions,
    generatedAt:    new Date(),
  };
}

export function renderCtrText(doc: CtrDocument): string {
  const paise2Rs = (p: bigint): string => `Rs ${(Number(p) / 100).toFixed(2)}`;

  const txLines = doc.transactions
    .map(t => `  ${t.date}  ${t.invoiceNumber.padEnd(20)}  ${paise2Rs(t.amountPaise)}`)
    .join('\n');

  return [
    '='.repeat(60),
    'CASH TRANSACTION REPORT (CTR) — FIU-IND FORMAT',
    '='.repeat(60),
    '',
    `Shop Name:    ${doc.shopName}`,
    `Shop GSTIN:   ${doc.shopGstin}`,
    '',
    `Customer:     ${doc.customerName}`,
    `Phone:        ${doc.customerPhone}`,
    `PAN:          ${doc.customerPan ?? 'Not on file'}`,
    '',
    `Report Month: ${doc.monthStr}`,
    `Generated:    ${doc.generatedAt.toISOString()}`,
    '',
    '-'.repeat(60),
    'TRANSACTIONS',
    '-'.repeat(60),
    '  Date        Invoice Number           Amount',
    txLines || '  (no transactions)',
    '-'.repeat(60),
    `Total Cash:   ${paise2Rs(doc.totalCashPaise)}`,
    '',
    '='.repeat(60),
    'FILING INSTRUCTIONS',
    '='.repeat(60),
    'Submit this report to FIU-IND via their reporting portal.',
    'Retain a copy for 5 years per PMLA rules.',
    'Threshold: Rs 10,00,000 cumulative cash per customer per month.',
    '='.repeat(60),
  ].join('\n');
}
