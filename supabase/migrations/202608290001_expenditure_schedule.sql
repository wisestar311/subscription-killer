alter table public.profiles
  add column if not exists current_balance bigint,
  add column if not exists balance_updated_at timestamptz,
  add column if not exists balance_source text,
  add column if not exists balance_import_token_hash text;

create unique index if not exists profiles_balance_import_token_hash_key
  on public.profiles (balance_import_token_hash)
  where balance_import_token_hash is not null;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  billing_date date not null,
  channel text not null check (channel in ('email', 'telegram')),
  status text not null check (status in ('processing', 'sent', 'failed')),
  provider_id text,
  error text,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (subscription_id, billing_date, channel)
);

alter table public.notification_deliveries enable row level security;

drop policy if exists "본인 발송 이력만 조회" on public.notification_deliveries;
create policy "본인 발송 이력만 조회"
  on public.notification_deliveries for select
  using (auth.uid() = user_id);

create or replace function public.claim_notification_delivery(
  p_subscription_id uuid,
  p_user_id uuid,
  p_billing_date date,
  p_channel text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  insert into public.notification_deliveries (
    subscription_id, user_id, billing_date, channel, status
  ) values (
    p_subscription_id, p_user_id, p_billing_date, p_channel, 'processing'
  )
  on conflict (subscription_id, billing_date, channel) do nothing
  returning id into claimed_id;

  if claimed_id is not null then
    return true;
  end if;

  update public.notification_deliveries
  set status = 'processing', error = null, attempted_at = now()
  where subscription_id = p_subscription_id
    and billing_date = p_billing_date
    and channel = p_channel
    and (
      (status = 'failed' and attempted_at < now() - interval '5 minutes')
      or (status = 'processing' and attempted_at < now() - interval '15 minutes')
    )
  returning id into claimed_id;

  return claimed_id is not null;
end;
$$;

revoke all on function public.claim_notification_delivery(uuid, uuid, date, text) from public;
grant execute on function public.claim_notification_delivery(uuid, uuid, date, text) to service_role;
