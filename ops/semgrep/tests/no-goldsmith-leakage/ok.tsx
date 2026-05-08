// OK: uses tenant-dynamic brand name — no "Goldsmith" literal anywhere

interface Props {
  appName: string;
  logoUrl: string | null;
}

export function StorefrontFooter({ appName, logoUrl }: Props) {
  return (
    <footer className="border-t border-border py-8">
      {logoUrl && <img src={logoUrl} alt={appName} className="h-8" />}
      <p className="font-ui text-inkMute text-sm">{appName}</p>
    </footer>
  );
}

// OK: aria label uses dynamic name
export function NavBrand({ shopName }: { shopName: string }) {
  return <span aria-label={`${shopName} होम`}>{shopName}</span>;
}
