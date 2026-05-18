import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, typography, spacing, radii } from '@goldsmith/ui-tokens';
import { submitCustomerReview } from '../api/endpoints';
import { captureEvent } from '../lib/posthog';
import { useCustomerSession } from '../hooks/useCustomerSession';

interface ReviewSubmitFormProps {
  productId: string;
}

export function ReviewSubmitForm({ productId }: ReviewSubmitFormProps): React.ReactElement {
  const [rating, setRating]         = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitted, setSubmitted]   = useState(false);
  const { customer, isAuthenticated } = useCustomerSession();
  const queryClient = useQueryClient();

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => submitCustomerReview({ productId, rating, reviewText: reviewText.trim() || undefined }),
    onSuccess: () => {
      captureEvent('review_submit', {
        productId,
        rating,
        shopId: customer?.shopId,
      });
      setSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ['product-reviews-public', productId] });
    },
  });

  if (!isAuthenticated) return <></>;

  if (submitted) {
    return (
      <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
        <Text style={{ fontFamily: typography.body.family, fontSize: 14, color: colors.primary }}>
          समीक्षा सफलतापूर्वक दर्ज हुई। धन्यवाद!
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ fontFamily: typography.serif.family, fontSize: 16, color: colors.ink }}>
        अपनी समीक्षा दें
      </Text>

      {/* Star rating selector */}
      <View
        style={{ flexDirection: 'row', gap: spacing.xs }}
        accessibilityLabel="रेटिंग चुनें"
        accessibilityRole="radiogroup"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            testID={`star-${star}`}
            onPress={() => setRating(star)}
            style={{ padding: 4, minWidth: 36, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
            accessibilityLabel={`${star} तारा`}
            accessibilityRole="radio"
            accessibilityState={{ checked: rating === star }}
          >
            <Text style={{ fontSize: 24, color: star <= rating ? '#C68A1F' : colors.border }}>
              {star <= rating ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Optional review text */}
      <TextInput
        testID="review-text-input"
        value={reviewText}
        onChangeText={setReviewText}
        placeholder="अपने अनुभव के बारे में लिखें (वैकल्पिक)"
        placeholderTextColor={colors.inkMute}
        multiline
        maxLength={500}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radii.sm,
          padding: spacing.sm,
          fontFamily: typography.body.family,
          fontSize: 14,
          color: colors.ink,
          minHeight: 72,
          textAlignVertical: 'top',
        }}
        accessibilityLabel="समीक्षा का पाठ"
      />

      {isError && (
        <Text
          style={{ fontFamily: typography.body.family, fontSize: 13, color: colors.error }}
          accessibilityRole="alert"
        >
          समीक्षा दर्ज नहीं हो सकी। पुनः प्रयास करें।
        </Text>
      )}

      <TouchableOpacity
        testID="submit-review-button"
        onPress={() => { if (rating > 0) mutate(); }}
        disabled={rating === 0 || isPending}
        style={{
          backgroundColor: rating > 0 ? colors.primary : colors.border,
          borderRadius: radii.sm,
          paddingVertical: spacing.sm,
          alignItems: 'center',
          minHeight: 48,
          justifyContent: 'center',
          opacity: (rating === 0 || isPending) ? 0.6 : 1,
        }}
        accessibilityLabel="समीक्षा जमा करें"
        accessibilityRole="button"
      >
        {isPending ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={{ fontFamily: typography.body.family, fontSize: 15, color: colors.white, fontWeight: '600' }}>
            समीक्षा जमा करें
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
