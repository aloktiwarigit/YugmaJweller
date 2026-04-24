import type { ConflictRecord } from '@goldsmith/sync';

// Map server conflict reasons to user-facing Hindi messages for OfflineBadge
export function getConflictMessage(conflict: ConflictRecord): string {
  switch (conflict.reason) {
    case 'stock.negative_balance':
      return 'यह टुकड़ा पहले ही बिक चुका है';
    case 'lww.client_older':
      return 'नया डेटा सर्वर से लोड हो गया है';
    default:
      return 'बदलाव सहेजा नहीं जा सका — सर्वर से ताजा डेटा लोड करें';
  }
}
