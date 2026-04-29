export interface CustomOrderResponse {
  id:                    string;
  shopId:                string;
  customerId:            string | null;
  description:           string;
  designReferenceUrl:    string | null;
  quotedAmountPaise:     string | null;
  depositAmountPaise:    string;
  depositPaidPaise:      string;
  razorpayOrderId:       string | null;
  status:                CustomOrderStatus;
  estimatedDeliveryDate: string | null;
  createdAt:             string;
  milestones?:           MilestoneResponse[];
}

export type CustomOrderStatus =
  | 'QUOTE'
  | 'DEPOSIT_PENDING'
  | 'IN_PROGRESS'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface MilestoneResponse {
  id:            string;
  customOrderId: string;
  title:         string;
  note:          string | null;
  photoUrl:      string | null;
  createdAt:     string;
}

export const STATUS_LABELS: Record<CustomOrderStatus, string> = {
  QUOTE:            'अनुमान',
  DEPOSIT_PENDING:  'अग्रिम बाकी',
  IN_PROGRESS:      'निर्माणाधीन',
  READY:            'तैयार है',
  DELIVERED:        'सुपुर्द',
  CANCELLED:        'रद्द',
};

export const STATUS_COLORS: Record<CustomOrderStatus, string> = {
  QUOTE:            '#B8860B',
  DEPOSIT_PENDING:  '#CC6600',
  IN_PROGRESS:      '#1565C0',
  READY:            '#2E7D32',
  DELIVERED:        '#6A1B9A',
  CANCELLED:        '#757575',
};
