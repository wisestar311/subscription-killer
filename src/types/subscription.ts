export interface Subscription {
  id: string;
  name: string;
  price: number;
  billing_day: number;
  billing_cycle: 'monthly' | 'annual';
  billing_month: number | null;
  expires_at: string | null;
  cancel_url: string | null;
  is_active: boolean;
  last_used_month: string | null;
  created_at: string;
}
