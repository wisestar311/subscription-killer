alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists billing_month smallint,
  add column if not exists expires_at date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_billing_cycle_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_cycle_check
      check (billing_cycle in ('monthly', 'annual')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_billing_month_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_month_check
      check (
        (billing_cycle = 'monthly' and billing_month is null)
        or (billing_cycle = 'annual' and billing_month between 1 and 12)
      ) not valid;
  end if;
end
$$;

alter table public.subscriptions
  validate constraint subscriptions_billing_cycle_check;

alter table public.subscriptions
  validate constraint subscriptions_billing_month_check;

create index if not exists subscriptions_annual_schedule_idx
  on public.subscriptions (billing_cycle, billing_month, billing_day)
  where is_active = true;
