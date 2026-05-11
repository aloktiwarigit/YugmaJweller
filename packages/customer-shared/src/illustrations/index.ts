// Inline SVG strings — viewBox 160×200 (4:5 portrait), cream #F5EDDD bg,
// aged-gold #B58A3C silhouette stroke (2px) with fill="none".
// No `?raw` imports — these strings are portable across Next.js, Metro, Jest,
// and Node without any bundler magic. Consumers stringify into data: URIs.

export const RING_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200"><rect width="160" height="200" fill="#F5EDDD"/><ellipse cx="80" cy="120" rx="32" ry="14" fill="none" stroke="#B58A3C" stroke-width="2"/><path d="M48 120 C48 78 112 78 112 120" fill="none" stroke="#B58A3C" stroke-width="2"/><polygon points="80,70 73,79 80,88 87,79" fill="none" stroke="#B58A3C" stroke-width="2" stroke-linejoin="round"/></svg>';

export const EARRING_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200"><rect width="160" height="200" fill="#F5EDDD"/><circle cx="80" cy="50" r="6" fill="none" stroke="#B58A3C" stroke-width="2"/><path d="M80 56 C80 56 56 96 56 126 Q56 156 80 164 Q104 156 104 126 C104 96 80 56 80 56Z" fill="none" stroke="#B58A3C" stroke-width="2"/></svg>';

export const PENDANT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200"><rect width="160" height="200" fill="#F5EDDD"/><path d="M64 32 Q80 28 96 32" fill="none" stroke="#B58A3C" stroke-width="2"/><line x1="80" y1="28" x2="80" y2="62" stroke="#B58A3C" stroke-width="2"/><polygon points="80,62 61,108 80,154 99,108" fill="none" stroke="#B58A3C" stroke-width="2" stroke-linejoin="round"/></svg>';

export const BANGLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200"><rect width="160" height="200" fill="#F5EDDD"/><circle cx="80" cy="100" r="44" fill="none" stroke="#B58A3C" stroke-width="2"/><circle cx="80" cy="100" r="36" fill="none" stroke="#B58A3C" stroke-width="2"/></svg>';

export const NECKLACE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200"><rect width="160" height="200" fill="#F5EDDD"/><path d="M32 36 Q36 100 80 128 Q124 100 128 36" fill="none" stroke="#B58A3C" stroke-width="2"/><polygon points="80,128 73,138 80,148 87,138" fill="none" stroke="#B58A3C" stroke-width="2" stroke-linejoin="round"/></svg>';

export const SILVER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200"><rect width="160" height="200" fill="#F5EDDD"/><rect x="44" y="76" width="72" height="48" rx="6" fill="none" stroke="#B58A3C" stroke-width="2"/><line x1="44" y1="90" x2="116" y2="90" stroke="#B58A3C" stroke-width="2"/><line x1="44" y1="110" x2="116" y2="110" stroke="#B58A3C" stroke-width="2"/></svg>';

// Order matters: 'earring' must precede 'ring' because "earrings" contains "ring".
const CATEGORY_MAP: Array<[pattern: string, svg: string]> = [
  ['earring',  EARRING_SVG ],
  ['jhumk',    EARRING_SVG ],  // jhumka / jhumke
  ['बाली',     EARRING_SVG ],  // Hindi: earring
  ['ring',     RING_SVG    ],
  ['अंगूठी',   RING_SVG    ],  // Hindi: ring
  ['pendant',  PENDANT_SVG ],
  ['पेंडेंट',  PENDANT_SVG ],
  ['लॉकेट',    PENDANT_SVG ],
  ['bangle',   BANGLE_SVG  ],
  ['chudi',    BANGLE_SVG  ],
  ['चूड़',     BANGLE_SVG  ],  // चूड़ी / चूड़ियाँ
  ['कंगन',     BANGLE_SVG  ],
  ['necklace', NECKLACE_SVG],
  ['haar',     NECKLACE_SVG],
  ['हार',      NECKLACE_SVG],
  ['मंगलसूत्र', NECKLACE_SVG],
  ['silver',   SILVER_SVG  ],
  ['chandi',   SILVER_SVG  ],
  ['चाँदी',    SILVER_SVG  ],
  ['चांदी',    SILVER_SVG  ],
];

/**
 * Map a category name (Hindi or English) to its fallback SVG string.
 * Returns SILVER_SVG when no pattern matches — a neutral, recognisable fallback.
 */
export function categoryToFallbackSvg(category: string | null | undefined): string {
  if (!category) return SILVER_SVG;
  const lower = category.toLowerCase();
  for (const [pattern, svg] of CATEGORY_MAP) {
    if (lower.includes(pattern.toLowerCase())) return svg;
  }
  return SILVER_SVG;
}
