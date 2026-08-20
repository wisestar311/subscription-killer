export interface Subscription {
  id: string;
  name: string;
  price: number;
  billing_day: number;
  cancel_url: string | null;
  is_active: boolean;
  last_used_month: string | null;
  created_at: string;
}
