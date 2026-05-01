'use client';
import { useState } from 'react';
import { StarRating } from './StarRating';

export interface ReviewItem {
  id:                string;
  rating:            number;
  reviewText:        string | null;
  customerFirstName: string | null;
  createdAt:         string;
}

interface ReviewSectionProps {
  productId:     string;
  shopId:        string;
  reviews:       ReviewItem[];
  averageRating: number | null;
  total:         number;
}

export function ReviewSection({ reviews, averageRating, total }: ReviewSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? reviews : reviews.slice(0, 3);

  return (
    <section aria-label="ग्राहक समीक्षाएं" className="mt-10 border-t border-border pt-6">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="font-heading text-xl text-ink">ग्राहक समीक्षाएं</h2>
        {averageRating !== null && (
          <span className="font-body text-sm text-inkMute">
            <StarRating rating={averageRating} size="sm" />
            <span className="ml-1">{averageRating} ({total})</span>
          </span>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="font-body text-sm text-inkMute">अभी तक कोई समीक्षा नहीं।</p>
      ) : (
        <ul className="space-y-4">
          {displayed.map((r) => (
            <li key={r.id} className="bg-surface rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <StarRating rating={r.rating} size="sm" />
                <span className="font-body text-xs text-inkMute">
                  {r.customerFirstName ?? 'ग्राहक'}
                </span>
              </div>
              {r.reviewText && (
                <p className="font-body text-sm text-ink">{r.reviewText}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {reviews.length > 3 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 font-body text-sm text-primary underline focus-visible:outline-2 focus-visible:outline-primary"
        >
          सभी {total} समीक्षाएं देखें
        </button>
      )}
    </section>
  );
}
