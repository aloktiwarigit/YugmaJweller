// Platform-controlled GST constants. Never accept from user input. Never configurable by shopkeeper.
// Changing these values requires an ADR amendment (PRD NFR-C2).
export const GST_METAL_RATE_BP  = 300 as const;  // 3% expressed in basis points
export const GST_MAKING_RATE_BP = 500 as const;  // 5% expressed in basis points
