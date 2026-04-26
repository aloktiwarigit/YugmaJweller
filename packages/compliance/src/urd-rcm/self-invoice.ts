// Platform-controlled RCM rate. Never user-configurable (PRD NFR-C2).
export const RCM_RATE_BP = 300 as const; // 3% in basis points

export interface UrdSelfInvoiceParams {
  shopName:        string;
  shopGstin:       string;
  customerName:    string;
  customerPhone:   string | null;
  metalType:       string;
  purity:          string;
  weightG:         string;
  agreedRatePaise: bigint;
  invoiceDate:     Date;
  invoiceNumber:   string;
}

export interface UrdSelfInvoiceResult {
  goldValuePaise:     bigint;
  rcmGstPaise:        bigint;
  netToCustomerPaise: bigint;
  selfInvoiceText:    string;
}

function pad2(n: number): string { return n.toString().padStart(2, '0'); }
function formatDate(d: Date): string {
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}
function formatPaise(paise: bigint): string {
  const rupees = Number(paise) / 100;
  return `₹${rupees.toLocaleString('hi-IN', { minimumFractionDigits: 2 })}`;
}
function formatWeight(weightG: string): string {
  const parts = weightG.trim().split('.');
  return `${parts[0] ?? '0'}.${((parts[1] ?? '').padEnd(4, '0')).slice(0, 4)}`;
}

function parseWeightUnits(weightG: string): bigint {
  const trimmed = weightG.trim();
  if (!trimmed || !/^-?\d+(\.\d*)?$/.test(trimmed)) {
    throw new RangeError('invalid weight: must be a positive finite number');
  }
  const parts = trimmed.split('.');
  const intStr = parts[0] ?? '0';
  const fracStr = ((parts[1] ?? '').padEnd(4, '0')).slice(0, 4);
  const units = BigInt(intStr) * 10000n + BigInt(fracStr);
  if (units <= 0n) throw new RangeError('invalid weight: must be a positive finite number');
  return units;
}

export function buildUrdSelfInvoice(params: UrdSelfInvoiceParams): UrdSelfInvoiceResult {
  const weightUnits = parseWeightUnits(params.weightG);
  const goldValuePaise = (weightUnits * params.agreedRatePaise) / 10000n;
  const rcmGstPaise = (goldValuePaise * BigInt(RCM_RATE_BP)) / 10000n;
  const netToCustomerPaise = goldValuePaise - rcmGstPaise;
  const selfInvoiceText = renderSelfInvoice({ ...params, goldValuePaise, rcmGstPaise, netToCustomerPaise });
  return { goldValuePaise, rcmGstPaise, netToCustomerPaise, selfInvoiceText };
}

interface RenderParams extends UrdSelfInvoiceParams {
  goldValuePaise:     bigint;
  rcmGstPaise:        bigint;
  netToCustomerPaise: bigint;
}

function renderSelfInvoice(p: RenderParams): string {
  const sep = '─'.repeat(60);
  const phone = p.customerPhone ? `  Phone: ${p.customerPhone}` : '';
  return [
    sep, 'SELF INVOICE UNDER REVERSE CHARGE',
    'Section 9(4) CGST Act, 2017 / Section 5(4) IGST Act, 2017', sep,
    `Invoice No : ${p.invoiceNumber}`, `Date       : ${formatDate(p.invoiceDate)}`, '',
    'BUYER (Jeweller — liable for RCM GST):',
    `  Name  : ${p.shopName}`, `  GSTIN : ${p.shopGstin}`, '',
    'SELLER (Unregistered Dealer / Customer):',
    `  Name  : ${p.customerName}${phone}`, '  Status: Unregistered under GST', '',
    sep, 'PURCHASE DETAILS', sep,
    `  Metal     : ${p.metalType}`, `  Purity    : ${p.purity}`,
    `  Weight    : ${formatWeight(p.weightG)} g`, `  Rate      : ${formatPaise(p.agreedRatePaise)} / g`, '',
    `  Gold Value             : ${formatPaise(p.goldValuePaise)}`,
    `  RCM GST @ 3% (payable) : ${formatPaise(p.rcmGstPaise)}`,
    `  Net Payable to Customer: ${formatPaise(p.netToCustomerPaise)}`,
    sep, 'DECLARATION',
    'GST under Reverse Charge Mechanism is payable by the buyer',
    '(jeweller) as per Section 9(4) of the CGST Act, 2017.',
    'The seller (customer) is an unregistered dealer.', sep,
  ].join('\n');
}