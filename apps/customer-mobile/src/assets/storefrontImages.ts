import type { ImageSourcePropType } from 'react-native';
import {
  banglesUri,
  braceletsUri,
  earringsUri,
  mangalsutraUri,
  necklacesUri,
  pendantsUri,
  ringsUri,
  silverUri,
  storefrontFallbackUri,
  storefrontHeroUri,
} from './storefrontImageData';

function dataImage(uri: string): ImageSourcePropType {
  return { uri };
}

export const storefrontHeroImage = dataImage(storefrontHeroUri);
export const storefrontFallbackImage = dataImage(storefrontFallbackUri);

export const categoryTileImages: Record<string, ImageSourcePropType> = {
  rings:       dataImage(ringsUri),
  earrings:    dataImage(earringsUri),
  pendants:    dataImage(pendantsUri),
  bangles:     dataImage(banglesUri),
  necklaces:   dataImage(necklacesUri),
  mangalsutra: dataImage(mangalsutraUri),
  bracelets:   dataImage(braceletsUri),
  silver:      dataImage(silverUri),
};

export function catalogImageUriForHint(hint: string | null): string {
  const normalized = hint?.toLocaleLowerCase('hi-IN') ?? '';
  if (/\bring|rings\b|अंगूठी/.test(normalized)) return ringsUri;
  if (/\bearring|earrings\b|झुमक|कान/.test(normalized)) return earringsUri;
  if (/\bpendant|pendants\b|लॉकेट|पेंडेंट/.test(normalized)) return pendantsUri;
  if (/\bbangle|bangles\b|कंगन|चूड़ी|चूड़ी/.test(normalized)) return banglesUri;
  if (/\bnecklace|necklaces\b|हार|नेकलेस/.test(normalized)) return necklacesUri;
  if (/\bmangalsutra\b|मंगलसूत्र/.test(normalized)) return mangalsutraUri;
  if (/\bbracelet|bracelets\b|ब्रेसलेट/.test(normalized)) return braceletsUri;
  if (/\bsilver\b|चांदी|चाँदी/.test(normalized)) return silverUri;
  return storefrontFallbackUri;
}

const CATEGORY_IMAGE_RULES: Array<{ image: ImageSourcePropType; terms: string[] }> = [
  { image: categoryTileImages['rings']!, terms: ['ring', 'rings', 'अंगूठी'] },
  { image: categoryTileImages['earrings']!, terms: ['earring', 'earrings', 'झुमक', 'कान'] },
  { image: categoryTileImages['pendants']!, terms: ['pendant', 'pendants', 'लॉकेट', 'पेंडेंट'] },
  { image: categoryTileImages['bangles']!, terms: ['bangle', 'bangles', 'कंगन', 'चूड़ी', 'चूड़ी'] },
  { image: categoryTileImages['necklaces']!, terms: ['necklace', 'necklaces', 'हार', 'नेकलेस'] },
  { image: categoryTileImages['mangalsutra']!, terms: ['mangalsutra', 'मंगलसूत्र'] },
  { image: categoryTileImages['bracelets']!, terms: ['bracelet', 'bracelets', 'ब्रेसलेट'] },
  { image: categoryTileImages['silver']!, terms: ['silver', 'चांदी', 'चाँदी'] },
];

export function imageForCategoryName(categoryName: string | null): ImageSourcePropType {
  const normalized = categoryName?.toLocaleLowerCase('hi-IN') ?? '';
  const match = CATEGORY_IMAGE_RULES.find((rule) =>
    rule.terms.some((term) => normalized.includes(term.toLocaleLowerCase('hi-IN'))),
  );
  return match?.image ?? storefrontFallbackImage;
}
