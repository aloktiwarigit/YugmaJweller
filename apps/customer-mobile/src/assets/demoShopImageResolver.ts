import { demoShopImageUris } from './demoShopImageData';
import { demoShopCampaignImageUris } from './demoShopCampaignImageData';

const DEMO_SHOP_PATH_RE = /(?:^|\/)demo-shop\/([^/?#]+)/;

function demoShopAssetKey(value: string): string | null {
  const match = value.match(DEMO_SHOP_PATH_RE);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function demoShopImageUriForPath(value: string | null | undefined): string | null {
  if (!value) return null;

  const key = demoShopAssetKey(value);
  if (!key) return null;

  return demoShopImageUris[key] ?? demoShopCampaignImageUris[key] ?? null;
}
