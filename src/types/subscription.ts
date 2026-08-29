export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  expense_type: 'subscription' | 'fixed';
  billing_day: number;
  billing_cycle: 'monthly' | 'annual';
  billing_month: number | null;
  expires_at: string | null;
  cancel_url: string | null;
  is_active: boolean;
  last_used_month: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  telegram_chat_id: string | null;
  current_balance: number | null;
  balance_updated_at: string | null;
  balance_source: string | null;
}
