import { GST_METAL_RATE_BP, GST_MAKING_RATE_BP } from './rates';

export type GstTreatment = 'CGST_SGST' | 'IGST';

export interface B2BGstBreakdown {
  treatment: GstTreatment;
  cgstMetalPaise?: bigint;
  sgstMetalPaise?: bigint;
  cgstMakingPaise?: bigint;
  sgstMakingPaise?: bigint;
  igstMetalPaise?: bigint;
  igstMakingPaise?: bigint;
  totalGstPaise: bigint;
}

export function determineGstTreatment(
  sellerStateCode: string,
  buyerStateCode: string,
): GstTreatment {
  return sellerStateCode === buyerStateCode ? 'CGST_SGST' : 'IGST';
}

export function applyB2BGstTreatment(params: {
  goldValuePaise: bigint;
  makingChargePaise: bigint;
  treatment: GstTreatment;
}): B2BGstBreakdown {
  const metalGstPaise =
    (params.goldValuePaise * BigInt(GST_METAL_RATE_BP)) / 10000n;
  const makingGstPaise =
    (params.makingChargePaise * BigInt(GST_MAKING_RATE_BP)) / 10000n;
  const totalGstPaise = metalGstPaise + makingGstPaise;

  if (params.treatment === 'CGST_SGST') {
    const cgstMetalPaise = metalGstPaise / 2n;
    const sgstMetalPaise = metalGstPaise - cgstMetalPaise;
    const cgstMakingPaise = makingGstPaise / 2n;
    const sgstMakingPaise = makingGstPaise - cgstMakingPaise;

    return {
      treatment: 'CGST_SGST',
      cgstMetalPaise,
      sgstMetalPaise,
      cgstMakingPaise,
      sgstMakingPaise,
      totalGstPaise,
    };
  }

  return {
    treatment: 'IGST',
    igstMetalPaise: metalGstPaise,
    igstMakingPaise: makingGstPaise,
    totalGstPaise,
  };
}
