alter table public.subscriptions
  add column if not exists expense_type text not null default 'subscription';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_expense_type_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_expense_type_check
      check (expense_type in ('subscription', 'fixed'));
  end if;
end
$$;

create index if not exists subscriptions_expense_type_idx
  on public.subscriptions (expense_type, billing_day);
