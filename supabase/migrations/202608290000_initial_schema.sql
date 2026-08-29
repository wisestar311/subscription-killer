create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  price integer not null,
  billing_day integer not null check (billing_day between 1 and 31),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  billing_month smallint check (billing_month between 1 and 12),
  expires_at date,
  cancel_url text,
  is_active boolean not null default true,
  last_used_month text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  telegram_chat_id text,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.profiles enable row level security;

create index if not exists subscriptions_active_billing_day_idx
  on public.subscriptions (is_active, billing_day);

drop policy if exists "본인 데이터만 접근" on public.subscriptions;
create policy "본인 데이터만 접근"
  on public.subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "본인만 접근" on public.profiles;
create policy "본인만 접근"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_price_positive'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_price_positive check (price > 0) not valid;
  end if;
end
$$;
