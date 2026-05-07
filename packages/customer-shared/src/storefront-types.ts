// Re-export StorefrontConfig type from @goldsmith/shared (A5 has shipped).
// Consumers import the Zod validator from @goldsmith/shared; this package
// only re-exports the inferred type for use in API response/request typing.
export type { StorefrontConfig } from '@goldsmith/shared';

export interface HomeSectionPayload {
  sectionKey: string;
  titleHi:    string;
  titleEn?:   string;
  items:      unknown[];
}
