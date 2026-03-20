alter table public.weekly_reports
add column if not exists budget_currency text not null default 'USD';

