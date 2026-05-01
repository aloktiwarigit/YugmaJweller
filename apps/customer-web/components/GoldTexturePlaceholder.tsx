export function GoldTexturePlaceholder({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      role="img"
      aria-label="उत्पाद की छवि उपलब्ध नहीं"
    >
      <defs>
        <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#D4A853" />
          <stop offset="50%"  stopColor="#B58A3C" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <pattern id="gold-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="url(#gold-grad)" opacity="0.15" />
          <line x1="0" y1="40" x2="40" y2="0" stroke="#B58A3C" strokeWidth="0.5" opacity="0.3" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill="#F5EDDD" />
      <rect width="400" height="400" fill="url(#gold-pattern)" />
      <text x="200" y="220" textAnchor="middle" fontSize="60" fill="#B58A3C" opacity="0.4" fontFamily="serif">
        ◈
      </text>
    </svg>
  );
}
