import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { RateLockDetailScreen } from '../../src/features/rate-lock/RateLockDetailScreen';

export default function RateLockDetailRoute(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <RateLockDetailScreen
      bookingId={id ?? ''}
      onCreateInvoice={(customerId) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(`/billing?customerId=${customerId}` as any)
      }
    />
  );
}
