interface StarRatingProps {
  rating: number;
  max?: number;
  size?: 'sm' | 'md';
}

export function StarRating({ rating, max = 5, size = 'md' }: StarRatingProps) {
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <span
      role="img"
      aria-label={`${rating} में से ${max} स्टार`}
      className={`${sizeClass} leading-none`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? 'text-yellow-500' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </span>
  );
}
