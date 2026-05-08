interface Pillar {
  icon: string;
  label: string;
  variant: 'success' | 'neutral';
}

const TRUST_PILLARS: Pillar[] = [
  { icon: '✓',  label: 'BIS / HUID प्रमाणित',  variant: 'success'  },
  { icon: '↔',  label: 'मुफ़्त एक्सचेंज',        variant: 'neutral'  },
  { icon: '🏠', label: 'घर पर ट्राय करें',       variant: 'neutral'  },
  { icon: '💬', label: 'WhatsApp सहायता',         variant: 'neutral'  },
];

export function TrustStrip() {
  return (
    <div
      role="list"
      aria-label="हमारी गारंटी"
      className="flex flex-wrap gap-2"
    >
      {TRUST_PILLARS.map(p => (
        <div
          key={p.label}
          role="listitem"
          className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 font-ui text-xs font-medium ${
            p.variant === 'success'
              ? 'bg-successWash text-successJade'
              : 'bg-surfaceRecessed text-inkMute'
          }`}
        >
          <span aria-hidden="true">{p.icon}</span>
          {p.label}
        </div>
      ))}
    </div>
  );
}
