export interface TryAtHomeBookingResponse {
  id:          string;
  shopId:      string;
  customerId:  string | null;
  productIds:  string[];
  status:      BookingStatus;
  requestedAt: string;
  dispatchAt:  string | null;
  returnDueAt: string | null;
  notes:       string | null;
}

export type BookingStatus =
  | 'REQUESTED'
  | 'DISPATCHED'
  | 'RETURNED'
  | 'CONVERTED_TO_SALE'
  | 'EXPIRED'
  | 'CANCELLED';

export const STATUS_LABELS: Record<BookingStatus, string> = {
  REQUESTED:         'अनुरोध किया',
  DISPATCHED:        'भेजा गया',
  RETURNED:          'वापस',
  CONVERTED_TO_SALE: 'बिक्री हुई',
  EXPIRED:           'समय समाप्त',
  CANCELLED:         'रद्द',
};

export const STATUS_COLORS: Record<BookingStatus, string> = {
  REQUESTED:         '#B8860B',
  DISPATCHED:        '#1565C0',
  RETURNED:          '#757575',
  CONVERTED_TO_SALE: '#2E7D32',
  EXPIRED:           '#C62828',
  CANCELLED:         '#757575',
};
