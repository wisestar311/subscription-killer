alter table public.subscriptions
  add column if not exists schedule_type text not null default 'recurring';

alter table public.subscriptions
  add column if not exists scheduled_date date;

alter table public.subscriptions
  drop constraint if exists subscriptions_schedule_type_check;

alter table public.subscriptions
  add constraint subscriptions_schedule_type_check
  check (schedule_type in ('recurring', 'one_time'));

create index if not exists subscriptions_scheduled_date_idx
  on public.subscriptions (schedule_type, scheduled_date);
