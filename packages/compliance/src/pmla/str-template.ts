export interface StrInput {
  shopId:                    string;
  shopName:                  string;
  shopAddress:               string;
  shopGstin:                 string;
  reportingOfficerName:      string;
  suspiciousTransactionDate: Date;
  transactionAmountPaise:    bigint;
  transactionNature:         string;
  customerName:              string;
  customerAddress:           string;
  customerPan?:              string;
  basisOfSuspicion:          string;
  actionsTaken:              string;
  reportDate:                Date;
}

export interface StrDocument {
  shopId:                    string;
  shopName:                  string;
  shopAddress:               string;
  shopGstin:                 string;
  reportingOfficerName:      string;
  suspiciousTransactionDate: Date;
  transactionAmountPaise:    bigint;
  transactionNature:         string;
  customerName:              string;
  customerAddress:           string;
  customerPan:               string | null;
  basisOfSuspicion:          string;
  actionsTaken:              string;
  reportDate:                Date;
  generatedAt:               Date;
}

export function buildStrDocument(input: StrInput): StrDocument {
  return {
    shopId:                    input.shopId,
    shopName:                  input.shopName,
    shopAddress:               input.shopAddress,
    shopGstin:                 input.shopGstin,
    reportingOfficerName:      input.reportingOfficerName,
    suspiciousTransactionDate: input.suspiciousTransactionDate,
    transactionAmountPaise:    input.transactionAmountPaise,
    transactionNature:         input.transactionNature,
    customerName:              input.customerName,
    customerAddress:           input.customerAddress,
    customerPan:               input.customerPan ?? null,
    basisOfSuspicion:          input.basisOfSuspicion,
    actionsTaken:              input.actionsTaken,
    reportDate:                input.reportDate,
    generatedAt:               new Date(),
  };
}

export function renderStrText(doc: StrDocument): string {
  const paise2Rs = (p: bigint): string => `Rs ${(Number(p) / 100).toFixed(2)}`;
  const fmtDate  = (d: Date):   string => d.toISOString().slice(0, 10);

  return [
    '='.repeat(60),
    'SUSPICIOUS TRANSACTION REPORT (STR) — FIU-IND FORMAT',
    '='.repeat(60),
    '',
    'SECTION A: REPORTING ENTITY',
    '-'.repeat(60),
    `Shop Name:          ${doc.shopName}`,
    `Shop GSTIN:         ${doc.shopGstin}`,
    `Shop Address:       ${doc.shopAddress}`,
    `Reporting Officer:  ${doc.reportingOfficerName}`,
    `Report Date:        ${fmtDate(doc.reportDate)}`,
    '',
    'SECTION B: SUSPICIOUS TRANSACTION',
    '-'.repeat(60),
    `Transaction Date:   ${fmtDate(doc.suspiciousTransactionDate)}`,
    `Amount:             ${paise2Rs(doc.transactionAmountPaise)}`,
    `Nature:             ${doc.transactionNature}`,
    '',
    'SECTION C: CUSTOMER DETAILS',
    '-'.repeat(60),
    `Customer Name:      ${doc.customerName}`,
    `Customer Address:   ${doc.customerAddress}`,
    `PAN:                ${doc.customerPan ?? 'Not on file'}`,
    '',
    'SECTION D: BASIS OF SUSPICION',
    '-'.repeat(60),
    doc.basisOfSuspicion,
    '',
    'SECTION E: ACTIONS TAKEN',
    '-'.repeat(60),
    doc.actionsTaken,
    '',
    `Generated:          ${doc.generatedAt.toISOString()}`,
    '',
    '='.repeat(60),
    'FILING INSTRUCTIONS',
    '='.repeat(60),
    'Submit this report to FIU-IND within 7 working days of',
    'identifying the suspicious transaction.',
    'File via FIU-IND reporting portal: https://fiuindia.gov.in',
    'Retain a copy for 5 years per PMLA rules.',
    'No minimum threshold — file for ALL suspicious transactions.',
    '='.repeat(60),
  ].join('\n');
}
