create table if not exists assets (
  id text primary key,
  asset_code text,
  account_asset_code text,
  asset_name text,
  main_category text,
  sub_category text,
  asset_type text,
  brand text,
  model text,
  serial_number text,
  quantity text,
  plant_code text,
  location text,
  department text,
  assigned_to text,
  employee_id text,
  assigned_date text,
  purchase_date text,
  purchase_cost text,
  vendor_name text,
  invoice_number text,
  warranty_start text,
  warranty_end text,
  condition text,
  status text,
  ram text,
  ssd text,
  cpu text,
  windows_version text,
  mac_address text,
  ip_address text,
  host_name text,
  contact_email text,
  contact_mobile text,
  photo_url text,
  document_url text,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists employees (
  employee_id text primary key,
  name text,
  email text,
  phone text,
  department text,
  designation text,
  location text,
  plant text,
  status text,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists users (
  email text primary key,
  role text,
  locations text,
  plants text,
  categories text,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists inventory (
  item_id text primary key,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists assignment_history (
  record_id text primary key,
  asset_id text,
  action text,
  employee_id text,
  employee_name text,
  assigned_date text,
  returned_date text,
  assigned_by text,
  remarks text,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists damaged_items (
  record_id text primary key,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists missing_items (
  record_id text primary key,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists extra_items (
  record_id text primary key,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists assignments (
  record_id text primary key,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  log_id text primary key,
  json_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  category_name text primary key,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists asset_types_lookup (
  type_id text primary key,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists asset_details (
  asset_id text not null,
  field_key text not null,
  field_value text,
  updated_at timestamptz not null default now(),
  primary key (asset_id, field_key)
);

create table if not exists locations (
  location_name text primary key,
  department text,
  created_date text
);

create table if not exists plants (
  plant_code text primary key,
  plant_name text,
  location_name text,
  created_date text
);

create table if not exists catalog_options (
  option_type text not null,
  option_value text not null,
  primary key (option_type, option_value)
);

create table if not exists type_definitions (
  id int primary key default 1,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  id int primary key default 1,
  json_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists otp_log (
  email text primary key,
  otp text not null,
  expiry timestamptz not null,
  attempts int not null default 0,
  requested_at timestamptz not null default now(),
  status text
);

create table if not exists uploaded_files (
  file_id text primary key,
  file_name text,
  mime_type text,
  disk_path text,
  url text,
  uploaded_at timestamptz not null default now()
);

alter table assets enable row level security;
alter table employees enable row level security;
alter table users enable row level security;
alter table inventory enable row level security;
alter table assignment_history enable row level security;
alter table damaged_items enable row level security;
alter table missing_items enable row level security;
alter table extra_items enable row level security;
alter table assignments enable row level security;
alter table audit_logs enable row level security;
alter table categories enable row level security;
alter table asset_types_lookup enable row level security;
alter table asset_details enable row level security;
alter table locations enable row level security;
alter table plants enable row level security;
alter table catalog_options enable row level security;
alter table type_definitions enable row level security;
alter table app_settings enable row level security;
alter table otp_log enable row level security;
alter table uploaded_files enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all tables in schema public to postgres;
notify pgrst, 'reload schema';
