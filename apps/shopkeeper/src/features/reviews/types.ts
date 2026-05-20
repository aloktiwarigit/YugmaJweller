export interface ModerationReviewItem {
  id: string;
  productId: string;
  productName: string | null;
  customerId: string | null;
  customerFirstName: string | null;
  rating: number;
  reviewText: string | null;
  isPubliclyVisible: boolean;
  createdAt: string;
}
