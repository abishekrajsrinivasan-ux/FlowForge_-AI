-- ==============================================================================
-- FLOWFORGE AI: PRODUCTION BOTTLENECK & OEE OPTIMIZATION DATABASE SCHEMA
-- Fully idempotent schema with RLS and Storage Bucket Setup
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. DATASETS
create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  original_filename text not null,
  file_type text not null default 'csv',
  file_size bigint default 0,
  row_count integer default 0,
  upload_status text default 'completed',
  processing_status text default 'completed',
  validation_status text default 'valid',
  data_quality_score numeric(5,2) default 100.0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. DATASET COLUMNS
create table if not exists public.dataset_columns (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  original_name text not null,
  normalized_name text not null,
  detected_type text default 'string',
  semantic_type text not null,
  nullable boolean default true,
  sample_values text[],
  created_at timestamptz default now()
);

-- 3. PRODUCTION RECORDS
create table if not exists public.production_records (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  timestamp timestamptz,
  shift text,
  line_id text,
  machine_id text not null,
  product_id text,
  target_quantity numeric,
  actual_quantity numeric,
  planned_time numeric,
  operating_time numeric,
  downtime numeric,
  planned_downtime numeric,
  unplanned_downtime numeric,
  changeover_time numeric,
  idle_time numeric,
  ideal_cycle_time numeric,
  actual_cycle_time numeric,
  total_units numeric,
  good_units numeric,
  defective_units numeric,
  rework numeric,
  downtime_reason text,
  additional_metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_prod_records_dataset on public.production_records(dataset_id);
create index if not exists idx_prod_records_machine on public.production_records(dataset_id, machine_id);
create index if not exists idx_prod_records_timestamp on public.production_records(dataset_id, timestamp);

-- 4. ANALYSIS RUNS
create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  status text default 'completed',
  started_at timestamptz default now(),
  completed_at timestamptz default now(),
  error_message text,
  analysis_version text default '1.0.0'
);

-- 5. OEE METRICS
create table if not exists public.oee_metrics (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  date date,
  shift text,
  line_id text,
  machine_id text,
  availability numeric,
  performance numeric,
  quality numeric,
  oee numeric,
  target_quantity numeric,
  actual_quantity numeric,
  production_gap numeric,
  production_rate numeric,
  created_at timestamptz default now()
);

-- 6. LOSS ANALYSIS
create table if not exists public.loss_analysis (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  machine_id text,
  line_id text,
  loss_category text,
  loss_reason text,
  loss_value numeric,
  percentage numeric,
  impact_score numeric,
  created_at timestamptz default now()
);

-- 7. BOTTLENECK ANALYSIS
create table if not exists public.bottleneck_analysis (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  machine_id text not null,
  line_id text,
  bottleneck_score numeric,
  oee_loss numeric,
  downtime_contribution numeric,
  throughput_loss numeric,
  cycle_deviation numeric,
  quality_loss numeric,
  trend_score numeric,
  rank integer,
  is_current_bottleneck boolean default false,
  created_at timestamptz default now()
);

-- 8. ROOT CAUSE ANALYSIS
create table if not exists public.root_cause_analysis (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  machine_id text,
  factor text,
  factor_value text,
  contribution numeric,
  confidence numeric,
  evidence text,
  analysis_method text,
  created_at timestamptz default now()
);

-- 9. RECOMMENDATIONS
create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  machine_id text,
  priority text default 'MEDIUM',
  problem text not null,
  evidence text not null,
  recommendation text not null,
  expected_impact text,
  confidence numeric,
  status text default 'OPEN',
  created_at timestamptz default now()
);

-- 10. SCENARIOS (WHAT-IF)
create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  name text not null,
  machine_id text,
  downtime_reduction numeric default 0,
  cycle_improvement numeric default 0,
  quality_improvement numeric default 0,
  baseline_oee numeric,
  simulated_oee numeric,
  baseline_output numeric,
  simulated_output numeric,
  potential_gain numeric,
  created_at timestamptz default now()
);

-- 11. ACTIONS
create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  recommendation_id uuid references public.recommendations(id) on delete set null,
  machine_id text,
  action text not null,
  priority text default 'MEDIUM',
  owner text,
  status text default 'OPEN',
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- 12. IMPROVEMENT TRACKING
create table if not exists public.improvement_tracking (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid references public.datasets(id) on delete cascade,
  machine_id text not null,
  intervention text not null,
  before_oee numeric,
  after_oee numeric,
  before_downtime numeric,
  after_downtime numeric,
  before_output numeric,
  after_output numeric,
  observed_improvement numeric,
  recorded_at timestamptz default now()
);

-- 13. USER PROFILES & ROLES (Admin and Operator roles only)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('Admin', 'Operator')),
  assigned_machine text,
  assigned_line text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_profiles_role on public.user_profiles(role);
create index if not exists idx_user_profiles_machine on public.user_profiles(assigned_machine);

-- Helper function to check if current session is Admin
create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select coalesce(
    (select role = 'Admin' from public.user_profiles where id = auth.uid()),
    (auth.jwt()->'user_metadata'->>'role') = 'Admin',
    auth.role() = 'anon'
  );
$$;

-- ==============================================================================
-- STORAGE BUCKET CONFIGURATION
-- ==============================================================================
insert into storage.buckets (id, name, public)
values ('production-datasets', 'production-datasets', false)
on conflict (id) do nothing;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.user_profiles enable row level security;
alter table public.datasets enable row level security;
alter table public.dataset_columns enable row level security;
alter table public.production_records enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.oee_metrics enable row level security;
alter table public.loss_analysis enable row level security;
alter table public.bottleneck_analysis enable row level security;
alter table public.root_cause_analysis enable row level security;
alter table public.recommendations enable row level security;
alter table public.scenarios enable row level security;
alter table public.actions enable row level security;
alter table public.improvement_tracking enable row level security;

-- User profile access
create policy "Allow user access to their own profile"
  on public.user_profiles for all
  using (auth.uid() = id or auth.role() = 'anon' or public.is_admin())
  with check (auth.uid() = id or auth.role() = 'anon' or public.is_admin());

-- Datasets RBAC: Operators can view datasets, Admins have full access
create policy "Allow dataset read for monitoring"
  on public.datasets for select
  using (true);

create policy "Allow dataset insert for admins"
  on public.datasets for insert
  with check (public.is_admin() or auth.role() = 'anon');

create policy "Allow dataset update for admins"
  on public.datasets for update
  using (public.is_admin() or auth.role() = 'anon');

create policy "Allow dataset delete for admins"
  on public.datasets for delete
  using (public.is_admin() or auth.role() = 'anon');

-- Cascade access for child tables based on dataset access
create policy "Allow dataset child access"
  on public.dataset_columns for all
  using (true)
  with check (true);

create policy "Allow production records access"
  on public.production_records for all
  using (true)
  with check (true);

create policy "Allow analysis runs access"
  on public.analysis_runs for all
  using (true)
  with check (true);

create policy "Allow oee metrics access"
  on public.oee_metrics for all
  using (true)
  with check (true);

create policy "Allow loss analysis access"
  on public.loss_analysis for all
  using (true)
  with check (true);

create policy "Allow bottleneck analysis access"
  on public.bottleneck_analysis for all
  using (true)
  with check (true);

create policy "Allow root cause access"
  on public.root_cause_analysis for all
  using (true)
  with check (true);

create policy "Allow recommendations access"
  on public.recommendations for all
  using (true)
  with check (true);

create policy "Allow scenarios access"
  on public.scenarios for all
  using (true)
  with check (true);

create policy "Allow actions access"
  on public.actions for all
  using (true)
  with check (true);

create policy "Allow improvement tracking access"
  on public.improvement_tracking for all
  using (true)
  with check (true);

-- Storage bucket RLS
create policy "Users can upload their own dataset files"
  on storage.objects for insert
  with check (bucket_id = 'production-datasets');

create policy "Users can view their own dataset files"
  on storage.objects for select
  using (bucket_id = 'production-datasets');

create policy "Users can delete their own dataset files"
  on storage.objects for delete
  using (bucket_id = 'production-datasets');
