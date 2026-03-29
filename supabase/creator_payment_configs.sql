create table if not exists public.creator_payment_configs (
  creator_user_id uuid primary key references auth.users(id) on delete cascade,
  razorpay_key_id text not null,
  razorpay_key_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_payment_configs enable row level security;

create policy if not exists "creator can manage own razorpay config"
on public.creator_payment_configs
for all
to authenticated
using (auth.uid() = creator_user_id)
with check (auth.uid() = creator_user_id);
