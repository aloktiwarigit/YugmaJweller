export type BodyPart = 'EAR' | 'NECK' | 'FINGER' | 'WRIST';

/** Face items first (most stable / highest wow), then hand items — matches the spec sequence. */
export const BODY_PARTS: BodyPart[] = ['EAR', 'NECK', 'FINGER', 'WRIST'];

/** Which mm field the dominant dimension maps to, matching the renderer's resolution order. */
export function mmFieldForBodyPart(part: BodyPart): 'tryOnLengthMm' | 'tryOnDiameterMm' {
  return part === 'FINGER' || part === 'WRIST' ? 'tryOnDiameterMm' : 'tryOnLengthMm';
}

export interface Preset {
  /** i18n key for the chip label. */
  labelKey: 'inventory.tryon_preset_small' | 'inventory.tryon_preset_medium' | 'inventory.tryon_preset_large';
  mm: number;
}

/**
 * Small/Medium/Large convenience presets (mm). Ring/bangle values track the
 * canonical diameter tables in @goldsmith/try-on-core (RING_DIAMETER_MM /
 * BANGLE_DIAMETER_MM); earring/pendant lengths are typical drops. Shopkeepers
 * can always override with the raw mm input.
 */
const PRESETS: Record<BodyPart, Preset[]> = {
  EAR:    [{ labelKey: 'inventory.tryon_preset_small', mm: 15 }, { labelKey: 'inventory.tryon_preset_medium', mm: 25 }, { labelKey: 'inventory.tryon_preset_large', mm: 40 }],
  NECK:   [{ labelKey: 'inventory.tryon_preset_small', mm: 20 }, { labelKey: 'inventory.tryon_preset_medium', mm: 30 }, { labelKey: 'inventory.tryon_preset_large', mm: 45 }],
  FINGER: [{ labelKey: 'inventory.tryon_preset_small', mm: 14 }, { labelKey: 'inventory.tryon_preset_medium', mm: 16 }, { labelKey: 'inventory.tryon_preset_large', mm: 18 }],
  WRIST:  [{ labelKey: 'inventory.tryon_preset_small', mm: 56 }, { labelKey: 'inventory.tryon_preset_medium', mm: 58 }, { labelKey: 'inventory.tryon_preset_large', mm: 60 }],
};

export function presetsForBodyPart(part: BodyPart): Preset[] {
  return PRESETS[part];
}

/** i18n key for the mm-input label, by body part. */
export function mmLabelKeyForBodyPart(part: BodyPart): string {
  return `inventory.tryon_mm_label_${part.toLowerCase()}`;
}

/** i18n key for a body-part chip. */
export function bodyPartLabelKey(part: BodyPart): string {
  return `inventory.tryon_bodypart_${part.toLowerCase()}`;
}

/** Clamp a normalized anchor coordinate into [0,1]. */
export function clampAnchor(v: number): number {
  if (Number.isNaN(v)) return 0.5;
  return Math.min(1, Math.max(0, v));
}
