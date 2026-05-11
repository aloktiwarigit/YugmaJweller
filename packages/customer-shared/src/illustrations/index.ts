// Inline SVG strings — viewBox 800×1000 (4:5 portrait), cream #F5EDDD bg,
// aged-gold #B58A3C line work. Zero file-system dependency at runtime:
// mobile consumes raw SVG markup; web imports .svg files via bundler (?react).

export const RING_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><ellipse cx="400" cy="580" rx="175" ry="68" fill="none" stroke="#B58A3C" stroke-width="26"/><path d="M225 580 C225 375 575 375 575 580" fill="none" stroke="#B58A3C" stroke-width="26"/><polygon points="400,340 366,378 400,416 434,378" fill="none" stroke="#B58A3C" stroke-width="20" stroke-linejoin="round"/></svg>';

export const EARRING_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><circle cx="400" cy="240" r="32" fill="none" stroke="#B58A3C" stroke-width="22"/><path d="M400 272 C400 272 280 480 280 630 Q280 780 400 820 Q520 780 520 630 C520 480 400 272 400 272Z" fill="none" stroke="#B58A3C" stroke-width="22"/></svg>';

export const PENDANT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><path d="M320 160 Q400 140 480 160" fill="none" stroke="#B58A3C" stroke-width="20"/><line x1="400" y1="140" x2="400" y2="310" stroke="#B58A3C" stroke-width="18"/><polygon points="400,310 306,540 400,770 494,540" fill="none" stroke="#B58A3C" stroke-width="22" stroke-linejoin="round"/></svg>';

export const BANGLE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><circle cx="400" cy="500" r="220" fill="none" stroke="#B58A3C" stroke-width="36"/></svg>';

export const NECKLACE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><path d="M160 180 Q180 500 400 640 Q620 500 640 180" fill="none" stroke="#B58A3C" stroke-width="22"/><polygon points="400,640 366,682 400,724 434,682" fill="none" stroke="#B58A3C" stroke-width="20" stroke-linejoin="round"/></svg>';

export const SILVER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="#F5EDDD"/><rect x="220" y="380" width="360" height="240" rx="28" fill="none" stroke="#B58A3C" stroke-width="24"/><line x1="220" y1="452" x2="580" y2="452" stroke="#B58A3C" stroke-width="16"/><line x1="220" y1="548" x2="580" y2="548" stroke="#B58A3C" stroke-width="16"/></svg>';

const CATEGORY_MAP: Array<[pattern: string, svg: string]> = [
  ['earring',  EARRING_SVG ],  // must precede 'ring' — "earrings" contains "ring"
  ['jhumk',    EARRING_SVG ],  // jhumka / jhumke
  ['ring',     RING_SVG    ],
  ['pendant',  PENDANT_SVG ],
  ['bangle',   BANGLE_SVG  ],
  ['chudi',    BANGLE_SVG  ],
  ['necklace', NECKLACE_SVG],
  ['haar',     NECKLACE_SVG],
  ['silver',   SILVER_SVG  ],
  ['chandi',   SILVER_SVG  ],
];

export function categoryToFallbackSvg(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  for (const [pattern, svg] of CATEGORY_MAP) {
    if (lower.includes(pattern)) return svg;
  }
  return SILVER_SVG;
}
