import { GST_METAL_RATE_BP, GST_MAKING_RATE_BP } from './rates';

export interface GstSplit {
  metalGstPaise:  bigint;
  makingGstPaise: bigint;
  totalGstPaise:  bigint;
}

/**
 * Pure function — no side effects, no DB, no network.
 * Floors at each GST component (integer division = floor for positive bigints).
 * Customer is never overcharged due to rounding direction (PRD NFR-C2).
 */
export function applyGstSplit(params: {
  goldValuePaise:    bigint;
  makingChargePaise: bigint;
}): GstSplit {
  const metalGstPaise  = (params.goldValuePaise    * BigInt(GST_METAL_RATE_BP))  / 10000n;
  const makingGstPaise = (params.makingChargePaise * BigInt(GST_MAKING_RATE_BP)) / 10000n;
  return {
    metalGstPaise,
    makingGstPaise,
    totalGstPaise: metalGstPaise + makingGstPaise,
  };
}
