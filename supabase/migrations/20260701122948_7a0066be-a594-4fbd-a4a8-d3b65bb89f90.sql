
-- ============ UTIL: updated_at trigger ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ============ ENUMS ============
create type public.app_role as enum ('admin','user');
create type public.txn_type as enum ('income','expense');
create type public.budget_period as enum ('daily','weekly','monthly');
create type public.debt_status as enum ('active','installment','paid','overdue','problematic','cancelled');
create type public.receivable_status as enum ('active','waiting_payment','installment','paid','overdue','hard_to_collect','forgiven','problematic');
create type public.bill_status as enum ('upcoming','paid','overdue','cancelled');
create type public.bill_type as enum ('credit_card','subscription','installment','annual_fee','internet','software','domain','hosting','other');
create type public.asset_type as enum ('cash','savings','gold','investment','business_equipment','productive_asset','other');
create type public.priority_level as enum ('low','medium','high','urgent');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text default 'Asia/Jakarta',
  currency text default 'IDR',
  onboarded boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

-- ============ USER PREFERENCES ============
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  locale text default 'id',
  theme text default 'light',
  hide_amounts boolean default false,
  show_amounts_in_telegram boolean default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
grant select, insert, update on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;
alter table public.user_preferences enable row level security;
create policy "prefs_own" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trg_prefs_updated before update on public.user_preferences for each row execute function public.set_updated_at();

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "roles_select_own" on public.user_roles for select using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Signup trigger (installed after preferences table exists)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============ TAGS / FILES / NOTES ============
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.tags to authenticated;
grant all on public.tags to service_role;
alter table public.tags enable row level security;
create policy "tags_own" on public.tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  category text,
  is_private boolean default true,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.files to authenticated;
grant all on public.files to service_role;
alter table public.files enable row level security;
create policy "files_own" on public.files for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
alter table public.notes enable row level security;
create policy "notes_own" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trg_notes_updated before update on public.notes for each row execute function public.set_updated_at();

-- ============ MONEY: ACCOUNTS ============
create table public.money_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null default 'cash',
  initial_balance numeric(15,2) default 0,
  currency text default 'IDR',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.money_accounts to authenticated;
grant all on public.money_accounts to service_role;
alter table public.money_accounts enable row level security;
create policy "money_accounts_own" on public.money_accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trg_money_accounts_updated before update on public.money_accounts for each row execute function public.set_updated_at();

-- ============ MONEY: CATEGORIES ============
create table public.money_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind public.txn_type not null,
  icon text,
  color text,
  is_required boolean default false,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.money_categories to authenticated;
grant all on public.money_categories to service_role;
alter table public.money_categories enable row level security;
create policy "money_categories_own" on public.money_categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ MONEY: TRANSACTIONS ============
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.txn_type not null,
  amount numeric(15,2) not null check (amount > 0),
  date date not null default current_date,
  category_id uuid references public.money_categories(id) on delete set null,
  account_id uuid references public.money_accounts(id) on delete set null,
  payment_method text,
  note text,
  attachment_file_id uuid references public.files(id) on delete set null,
  is_productive boolean default false,
  is_required boolean default false,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "transactions_own" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index idx_txn_user_date on public.transactions(user_id, date desc);
create index idx_txn_category on public.transactions(category_id);
create trigger trg_transactions_updated before update on public.transactions for each row execute function public.set_updated_at();

-- ============ MONEY: BUDGETS ============
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid references public.money_categories(id) on delete set null,
  period_type public.budget_period not null default 'monthly',
  planned_amount numeric(15,2) not null check (planned_amount >= 0),
  start_date date not null,
  end_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.budgets to authenticated;
grant all on public.budgets to service_role;
alter table public.budgets enable row level security;
create policy "budgets_own" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trg_budgets_updated before update on public.budgets for each row execute function public.set_updated_at();

-- ============ MONEY: DEBTS ============
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lender_name text not null,
  amount numeric(15,2) not null check (amount > 0),
  borrowed_date date not null default current_date,
  due_date date,
  installment_amount numeric(15,2) check (installment_amount is null or installment_amount >= 0),
  payment_frequency text,
  remaining_balance numeric(15,2) not null check (remaining_balance >= 0),
  status public.debt_status not null default 'active',
  priority public.priority_level default 'medium',
  risk_level text,
  notes text,
  proof_file_id uuid references public.files(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.debts to authenticated;
grant all on public.debts to service_role;
alter table public.debts enable row level security;
create policy "debts_own" on public.debts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index idx_debts_user_status on public.debts(user_id, status);
create index idx_debts_due on public.debts(user_id, due_date);
create trigger trg_debts_updated before update on public.debts for each row execute function public.set_updated_at();

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric(15,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text,
  proof_file_id uuid references public.files(id) on delete set null,
  note text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.debt_payments to authenticated;
grant all on public.debt_payments to service_role;
alter table public.debt_payments enable row level security;
create policy "debt_payments_own" on public.debt_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index idx_debt_pay_debt on public.debt_payments(debt_id);

-- Auto-update debt remaining balance
create or replace function public.apply_debt_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.debts%rowtype; new_bal numeric(15,2);
begin
  select * into d from public.debts where id = coalesce(new.debt_id, old.debt_id);
  if not found then return coalesce(new, old); end if;
  select d.amount - coalesce(sum(amount),0) into new_bal
    from public.debt_payments
    where debt_id = d.id and deleted_at is null;
  if new_bal < 0 then raise exception 'Pembayaran melebihi sisa hutang'; end if;
  update public.debts
    set remaining_balance = new_bal,
        status = case when new_bal = 0 then 'paid'::public.debt_status else
                      case when status = 'paid' then 'active'::public.debt_status else status end
                 end
    where id = d.id;
  return coalesce(new, old);
end $$;
create trigger trg_debt_payment_ai after insert or update or delete on public.debt_payments
  for each row execute function public.apply_debt_payment();

-- ============ MONEY: RECEIVABLES ============
create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  borrower_name text not null,
  amount numeric(15,2) not null check (amount > 0),
  lent_date date not null default current_date,
  promised_payment_date date,
  amount_paid numeric(15,2) not null default 0 check (amount_paid >= 0),
  remaining_amount numeric(15,2) not null check (remaining_amount >= 0),
  status public.receivable_status not null default 'active',
  relationship text,
  risk_level text,
  notes text,
  chat_proof_file_id uuid references public.files(id) on delete set null,
  transfer_proof_file_id uuid references public.files(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.receivables to authenticated;
grant all on public.receivables to service_role;
alter table public.receivables enable row level security;
create policy "receivables_own" on public.receivables for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index idx_receivables_user_status on public.receivables(user_id, status);
create trigger trg_receivables_updated before update on public.receivables for each row execute function public.set_updated_at();

create table public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  amount numeric(15,2) not null check (amount > 0),
  received_date date not null default current_date,
  method text,
  proof_file_id uuid references public.files(id) on delete set null,
  note text,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.receivable_payments to authenticated;
grant all on public.receivable_payments to service_role;
alter table public.receivable_payments enable row level security;
create policy "receivable_payments_own" on public.receivable_payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index idx_recv_pay_recv on public.receivable_payments(receivable_id);

create or replace function public.apply_receivable_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.receivables%rowtype; total_paid numeric(15,2); new_rem numeric(15,2);
begin
  select * into r from public.receivables where id = coalesce(new.receivable_id, old.receivable_id);
  if not found then return coalesce(new, old); end if;
  select coalesce(sum(amount),0) into total_paid from public.receivable_payments
    where receivable_id = r.id and deleted_at is null;
  new_rem := r.amount - total_paid;
  if new_rem < 0 then raise exception 'Pembayaran melebihi sisa piutang'; end if;
  update public.receivables
    set amount_paid = total_paid,
        remaining_amount = new_rem,
        status = case when new_rem = 0 then 'paid'::public.receivable_status else
                      case when status = 'paid' then 'active'::public.receivable_status else status end
                 end
    where id = r.id;
  return coalesce(new, old);
end $$;
create trigger trg_recv_payment_ai after insert or update or delete on public.receivable_payments
  for each row execute function public.apply_receivable_payment();

-- ============ MONEY: BILLS ============
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(15,2) not null check (amount >= 0),
  due_date date not null,
  recurrence text default 'monthly',
  category text,
  bill_type public.bill_type default 'other',
  status public.bill_status not null default 'upcoming',
  reminder_enabled boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.bills to authenticated;
grant all on public.bills to service_role;
alter table public.bills enable row level security;
create policy "bills_own" on public.bills for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index idx_bills_user_due on public.bills(user_id, due_date);
create trigger trg_bills_updated before update on public.bills for each row execute function public.set_updated_at();

-- ============ MONEY: ASSETS ============
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  asset_type public.asset_type not null default 'cash',
  current_value numeric(15,2) not null default 0 check (current_value >= 0),
  acquisition_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
grant select, insert, update, delete on public.assets to authenticated;
grant all on public.assets to service_role;
alter table public.assets enable row level security;
create policy "assets_own" on public.assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger trg_assets_updated before update on public.assets for each row execute function public.set_updated_at();
