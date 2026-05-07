// Hindi-first storefront navigation data.
// Shared between customer-web (mega-menu + mobile drawer) and customer-mobile
// (StorefrontDrawer accordion).
// NO brand strings -- all copy is tenant-neutral.

export interface NavItem {
  key:     string;
  labelHi: string;
  labelEn: string;
  href:    string;
}

export interface MegaMenuLink {
  labelHi: string;
  labelEn?: string;
  href:    string;
}

export interface MegaMenuPanel {
  popular:     MegaMenuLink[];
  style:       MegaMenuLink[];
  metalPurity: MegaMenuLink[];
  priceBand:   MegaMenuLink[];
  occasion:    MegaMenuLink[];
}

export const STOREFRONT_BROWSE_NAV: NavItem[] = [
  { key: 'gold',        labelHi: 'सोना',    labelEn: 'Gold',        href: '/products?metal=GOLD'         },
  { key: 'diamond',     labelHi: 'हीरा',    labelEn: 'Diamond',     href: '/products?search=diamond'     },
  { key: 'silver',      labelHi: 'चाँदी',  labelEn: 'Silver',      href: '/products?metal=SILVER'       },
  { key: 'rings',       labelHi: 'अंगूठी', labelEn: 'Rings',       href: '/products?search=ring'        },
  { key: 'earrings',    labelHi: 'झुमके',  labelEn: 'Earrings',    href: '/products?search=earring'     },
  { key: 'pendants',    labelHi: 'पेंडेंट', labelEn: 'Pendants',   href: '/products?search=pendant'     },
  { key: 'bangles',     labelHi: 'चूड़ी',  labelEn: 'Bangles',     href: '/products?search=bangle'      },
  { key: 'collections', labelHi: 'कलेक्शन', labelEn: 'Collections', href: '/collections'                },
];

export const MEGA_MENU_CONTENT: Record<string, MegaMenuPanel> = {
  gold: {
    popular: [
      { labelHi: 'अंगूठी',    labelEn: 'Rings',       href: '/products?metal=GOLD&search=ring'        },
      { labelHi: 'झुमके',     labelEn: 'Earrings',    href: '/products?metal=GOLD&search=earring'     },
      { labelHi: 'पेंडेंट',   labelEn: 'Pendants',    href: '/products?metal=GOLD&search=pendant'     },
      { labelHi: 'मंगलसूत्र', labelEn: 'Mangalsutra', href: '/products?metal=GOLD&search=mangalsutra' },
      { labelHi: 'हार',       labelEn: 'Necklaces',   href: '/products?metal=GOLD&search=necklace'    },
    ],
    style: [
      { labelHi: 'रोज़ाना',    labelEn: 'Daily Wear', href: '/products?metal=GOLD&style=DAILY_WEAR' },
      { labelHi: 'ब्राइडल',   labelEn: 'Bridal',     href: '/products?metal=GOLD&style=BRIDAL'     },
      { labelHi: 'मंदिर',     labelEn: 'Temple',     href: '/products?metal=GOLD&style=TEMPLE'     },
      { labelHi: 'ऑफिस',      labelEn: 'Office',     href: '/products?metal=GOLD&style=OFFICE'     },
      { labelHi: 'स्टेटमेंट', labelEn: 'Statement',  href: '/products?metal=GOLD&style=STATEMENT'  },
    ],
    metalPurity: [
      { labelHi: '24K सोना',    href: '/products?purity=GOLD_24K'                     },
      { labelHi: '22K सोना',    href: '/products?purity=GOLD_22K'                     },
      { labelHi: '18K सोना',    href: '/products?purity=GOLD_18K'                     },
      { labelHi: '14K सोना',    href: '/products?purity=GOLD_14K'                     },
      { labelHi: 'हीरे के साथ', labelEn: 'With Diamonds', href: '/products?metal=GOLD&search=diamond' },
    ],
    priceBand: [
      { labelHi: '₹10,000 तक',     href: '/products?metal=GOLD&priceMax=1000000'                      },
      { labelHi: '₹10K-₹25K',      href: '/products?metal=GOLD&priceMin=1000000&priceMax=2500000'     },
      { labelHi: '₹25K-₹50K',      href: '/products?metal=GOLD&priceMin=2500000&priceMax=5000000'     },
      { labelHi: '₹50K-₹1 लाख',   href: '/products?metal=GOLD&priceMin=5000000&priceMax=10000000'    },
      { labelHi: '₹1 लाख से ऊपर', href: '/products?metal=GOLD&priceMin=10000000'                     },
    ],
    occasion: [
      { labelHi: 'शादी',    labelEn: 'Wedding',     href: '/products?metal=GOLD&occasion=WEDDING'     },
      { labelHi: 'सगाई',    labelEn: 'Engagement',  href: '/products?metal=GOLD&occasion=ENGAGEMENT'  },
      { labelHi: 'त्यौहार', labelEn: 'Festival',    href: '/products?metal=GOLD&occasion=FESTIVAL'    },
      { labelHi: 'उपहार',   labelEn: 'Gift',        href: '/products?metal=GOLD&occasion=GIFT'        },
      { labelHi: 'सालगिरह', labelEn: 'Anniversary', href: '/products?metal=GOLD&occasion=ANNIVERSARY' },
    ],
  },
  silver: {
    popular: [
      { labelHi: 'चाँदी अंगूठी',  labelEn: 'Silver Rings',    href: '/products?metal=SILVER&search=ring'     },
      { labelHi: 'चाँदी पायल',    labelEn: 'Anklets',         href: '/products?metal=SILVER&search=anklet'   },
      { labelHi: 'चाँदी झुमके',   labelEn: 'Silver Earrings', href: '/products?metal=SILVER&search=earring'  },
      { labelHi: 'चाँदी हार',     labelEn: 'Silver Necklaces', href: '/products?metal=SILVER&search=necklace' },
      { labelHi: 'चाँदी चूड़ी',   labelEn: 'Silver Bangles',  href: '/products?metal=SILVER&search=bangle'   },
    ],
    style: [
      { labelHi: 'रोज़ाना',       labelEn: 'Daily Wear', href: '/products?metal=SILVER&style=DAILY_WEAR'   },
      { labelHi: 'मंदिर',         labelEn: 'Temple',     href: '/products?metal=SILVER&style=TEMPLE'       },
      { labelHi: 'ऑक्सीडाइज़्ड', labelEn: 'Oxidised',   href: '/products?metal=SILVER&search=oxidised'    },
      { labelHi: 'सादा',          labelEn: 'Plain',      href: '/products?metal=SILVER&style=OFFICE'        },
      { labelHi: 'पारम्परिक',     labelEn: 'Traditional', href: '/products?metal=SILVER&occasion=FESTIVAL' },
    ],
    metalPurity: [
      { labelHi: '999 शुद्ध चाँदी',    href: '/products?purity=SILVER_999'                 },
      { labelHi: '925 स्टर्लिंग',      href: '/products?purity=SILVER_925'                 },
      { labelHi: 'ऑक्सीडाइज़्ड चाँदी', href: '/products?metal=SILVER&search=oxidised'      },
      { labelHi: 'जड़ाऊ चाँदी',        href: '/products?metal=SILVER&style=STATEMENT'      },
      { labelHi: 'पोलिश चाँदी',        href: '/products?metal=SILVER&style=DAILY_WEAR'     },
    ],
    priceBand: [
      { labelHi: '₹500 तक',     href: '/products?metal=SILVER&priceMax=50000'                  },
      { labelHi: '₹500-₹2000',  href: '/products?metal=SILVER&priceMin=50000&priceMax=200000'  },
      { labelHi: '₹2K-₹5K',     href: '/products?metal=SILVER&priceMin=200000&priceMax=500000' },
      { labelHi: '₹5K-₹10K',    href: '/products?metal=SILVER&priceMin=500000&priceMax=1000000' },
      { labelHi: '₹10K से ऊपर', href: '/products?metal=SILVER&priceMin=1000000'               },
    ],
    occasion: [
      { labelHi: 'त्यौहार', labelEn: 'Festival', href: '/products?metal=SILVER&occasion=FESTIVAL' },
      { labelHi: 'उपहार',   labelEn: 'Gift',     href: '/products?metal=SILVER&occasion=GIFT'     },
      { labelHi: 'शादी',    labelEn: 'Wedding',  href: '/products?metal=SILVER&occasion=WEDDING'  },
      { labelHi: 'रोज़ाना', labelEn: 'Daily',    href: '/products?metal=SILVER&occasion=DAILY'    },
      { labelHi: 'पार्टी',  labelEn: 'Party',    href: '/products?metal=SILVER&occasion=PARTY'    },
    ],
  },
};

export interface CategoryTile {
  key:     string;
  labelHi: string;
  labelEn: string;
  href:    string;
}

export const STOREFRONT_CATEGORY_TILES: CategoryTile[] = [
  { key: 'rings',       labelHi: 'अंगूठी',    labelEn: 'Rings',       href: '/products?search=ring'        },
  { key: 'earrings',    labelHi: 'झुमके',     labelEn: 'Earrings',    href: '/products?search=earring'     },
  { key: 'pendants',    labelHi: 'पेंडेंट',   labelEn: 'Pendants',    href: '/products?search=pendant'     },
  { key: 'bangles',     labelHi: 'चूड़ी',    labelEn: 'Bangles',     href: '/products?search=bangle'      },
  { key: 'necklaces',   labelHi: 'हार',       labelEn: 'Necklaces',   href: '/products?search=necklace'    },
  { key: 'mangalsutra', labelHi: 'मंगलसूत्र', labelEn: 'Mangalsutra', href: '/products?search=mangalsutra' },
  { key: 'bracelets',   labelHi: 'कड़ा',      labelEn: 'Bracelets',   href: '/products?search=bracelet'    },
  { key: 'silver',      labelHi: 'चाँदी',    labelEn: 'Silver',      href: '/products?metal=SILVER'       },
];

export interface OccasionTile {
  key:     string;
  labelHi: string;
  labelEn: string;
  href:    string;
}

export const STOREFRONT_OCCASION_TILES: OccasionTile[] = [
  { key: 'wedding',    labelHi: 'शादी',    labelEn: 'Wedding',    href: '/products?occasion=WEDDING'    },
  { key: 'engagement', labelHi: 'सगाई',    labelEn: 'Engagement', href: '/products?occasion=ENGAGEMENT' },
  { key: 'festival',   labelHi: 'त्यौहार', labelEn: 'Festival',   href: '/products?occasion=FESTIVAL'   },
  { key: 'gift',       labelHi: 'उपहार',   labelEn: 'Gift',       href: '/products?occasion=GIFT'       },
  { key: 'daily',      labelHi: 'रोज़ाना', labelEn: 'Daily Wear', href: '/products?occasion=DAILY'      },
];

export interface GiftPersonaTile {
  key:     string;
  labelHi: string;
  labelEn: string;
  href:    string;
}

export const STOREFRONT_GIFT_PERSONAS: GiftPersonaTile[] = [
  { key: 'mother', labelHi: 'माँ के लिए',    labelEn: 'For Mother', href: '/products?giftPersona=MOTHER' },
  { key: 'sister', labelHi: 'बहन के लिए',    labelEn: 'For Sister', href: '/products?giftPersona=SISTER' },
  { key: 'wife',   labelHi: 'पत्नी के लिए',  labelEn: 'For Wife',   href: '/products?giftPersona=WIFE'   },
  { key: 'bride',  labelHi: 'दुल्हन के लिए', labelEn: 'For Bride',  href: '/products?giftPersona=BRIDE'  },
  { key: 'self',   labelHi: 'खुद के लिए',    labelEn: 'For Self',   href: '/products?giftPersona=SELF'   },
  { key: 'friend', labelHi: 'दोस्त के लिए',  labelEn: 'For Friend', href: '/products?giftPersona=FRIEND' },
];
