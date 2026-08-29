alter table public.subscriptions
  add column if not exists description text;
