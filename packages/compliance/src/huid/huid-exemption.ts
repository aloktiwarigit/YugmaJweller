export enum HuidExemptionCategory {
  None            = 'none',
  KundanPolkiJadau = 'kundan_polki_jadau',
  Under2g         = 'under_2g',
}

export function isHuidExempt(cat: HuidExemptionCategory): boolean {
  return cat !== HuidExemptionCategory.None;
}
