-- ============================================================================
-- Trip Admin Panel — schema for the multi-trip backend.
-- Lives in its own Postgres schema ("app") inside the existing highlands-live
-- Supabase project, alongside — but never touching — the legacy public.updates
-- / public.livetrack / public.progress tables that power the original,
-- single-trip Scotland app. Nothing here renames, alters, or reads those.
-- ============================================================================

create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type app.trip_status as enum ('draft','active','archived');
create type app.member_role as enum ('owner','editor','rider','viewer');
create type app.pay_status as enum ('unpaid','partial','paid','free');
create type app.transport_type as enum ('flight','train','ferry','transfer','bike_shipping','other');
create type app.transport_anchor as enum ('trip_start','trip_end','custom');
create type app.poi_category as enum ('sight','resupply','water','other');
create type app.change_status as enum ('pending','accepted','rejected','superseded');
create type app.change_source as enum ('manual','import-route','import-email','import-document','computed');

-- ---------------------------------------------------------------------------
-- trips
-- ---------------------------------------------------------------------------
create table app.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  status app.trip_status not null default 'draft',
  start_date date,
  end_date date,
  timezone text not null default 'Europe/Warsaw',
  default_currency text not null default 'EUR',
  enabled_modules jsonb not null default '["route","accommodation","resupply"]'::jsonb,
  visibility jsonb not null default '{
    "showCosts": false, "showExpenseBalances": false, "showBookingRefs": false,
    "showPhones": false, "showExactAddresses": false, "showPhotos": true
  }'::jsonb,
  pace_assumptions jsonb not null default '{
    "flatKmh": {"tarmac": 18, "gravel": 14, "singletrack": 8, "hikeABike": 3},
    "climbMPerHour": 500, "stopOverheadMin": 15, "dayOverheadMin": 30
  }'::jsonb,
  share_token text unique default encode(gen_random_bytes(12), 'hex'),
  share_passcode text,
  share_enabled boolean not null default false,
  duplicated_from uuid references app.trips(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table app.trips is 'A single organized trip. First-class, owned entity — everything else hangs off tripId.';

-- ---------------------------------------------------------------------------
-- trip_memberships
-- ---------------------------------------------------------------------------
create table app.trip_memberships (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role app.member_role not null default 'viewer',
  display_name text not null,
  color text,
  is_on_trip boolean not null default true,
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);
comment on column app.trip_memberships.is_on_trip is 'Distinguishes a rider from a viewer (e.g. partner at home) — excluded from expense splits and pace calcs.';

create table app.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  token text unique not null default encode(gen_random_bytes(16), 'hex'),
  role app.member_role not null,
  display_name text,
  created_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- trip_days — the route/itinerary entity
-- ---------------------------------------------------------------------------
create table app.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  day_number int not null,
  date date,
  title text,
  title_en text,
  description text,
  description_en text,
  distance_km numeric,
  ascent_m numeric,
  descent_m numeric,
  surface text,
  start_point text,
  end_point text,
  start_lat double precision,
  start_lon double precision,
  end_lat double precision,
  end_lon double precision,
  is_rest_day boolean not null default false,
  gpx_url text,
  map_embed_url text,
  notes text,
  notes_en text,
  actual_start_time time,
  order_index int not null,
  locked_fields text[] not null default '{}',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_number)
);
comment on column app.trip_days.locked_fields is 'Field names a human has explicitly edited — imports may propose changes to these but never auto-write them.';
comment on column app.trip_days.meta is 'Per-field provenance: {"distance_km": {"source":"import-route","confidence":0.9,"updatedAt":...,"updatedBy":...}}';

create table app.accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  day_id uuid references app.trip_days(id) on delete set null,
  name text not null,
  url text,
  address text,
  phone text,
  cost numeric,
  currency text,
  pay_status app.pay_status not null default 'unpaid',
  is_booked boolean not null default false,
  cancellation_policy text,
  booking_reference text,
  breakfast_info text,
  breakfast_url text,
  notes text,
  locked_fields text[] not null default '{}',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.transport_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  type app.transport_type not null,
  anchor app.transport_anchor not null default 'custom',
  day_id uuid references app.trip_days(id) on delete set null,
  carrier text,
  reference text,
  departure_time timestamptz,
  departure_place text,
  arrival_time timestamptz,
  arrival_place text,
  cost numeric,
  currency text,
  notes text,
  order_index int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app.points_of_interest (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  day_id uuid references app.trip_days(id) on delete cascade,
  category app.poi_category not null default 'sight',
  name text not null,
  icon text,
  description text,
  url text,
  image_url text,
  opening_hours text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Modules: tasks / packing / expenses / photos
-- ---------------------------------------------------------------------------
create table app.tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  title text not null,
  icon text default '📌',
  order_index int not null default 9999,
  created_at timestamptz not null default now()
);
create table app.task_checks (
  task_id uuid not null references app.tasks(id) on delete cascade,
  membership_id uuid not null references app.trip_memberships(id) on delete cascade,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (task_id, membership_id)
);

create table app.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  title text not null,
  order_index int not null default 9999,
  created_at timestamptz not null default now()
);
create table app.packing_checks (
  item_id uuid not null references app.packing_items(id) on delete cascade,
  membership_id uuid not null references app.trip_memberships(id) on delete cascade,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (item_id, membership_id)
);

create table app.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  description text not null,
  amount numeric not null,
  currency text not null,
  paid_by uuid not null references app.trip_memberships(id),
  participants uuid[] not null,
  created_at timestamptz not null default now()
);

create table app.updates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  day_id uuid references app.trip_days(id) on delete set null,
  membership_id uuid references app.trip_memberships(id) on delete set null,
  caption text,
  photo_url text,
  lat double precision,
  lon double precision,
  created_at timestamptz not null default now()
);

create table app.day_progress (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  day_id uuid not null references app.trip_days(id) on delete cascade,
  ridden_km numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (trip_id, day_id)
);

-- ---------------------------------------------------------------------------
-- Tracking — registry, not a switch statement
-- ---------------------------------------------------------------------------
create table app.tracking_providers (
  id text primary key,
  display_name text not null,
  url_patterns text[] not null default '{}',
  embeddable boolean not null default false,
  instructions jsonb not null default '[]'::jsonb,
  sort_order int not null default 0
);

create table app.tracking_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  membership_id uuid not null references app.trip_memberships(id) on delete cascade,
  provider_id text not null references app.tracking_providers(id),
  url text not null,
  label text,
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Imports: staged changes + review queue (Section 5)
-- ---------------------------------------------------------------------------
create table app.staged_imports (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  kind text not null check (kind in ('email','document')),
  filename text,
  raw_excerpt text,
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  error text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table app.staged_changes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references app.trips(id) on delete cascade,
  import_id uuid references app.staged_imports(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  day_number int,
  field_name text not null,
  proposed_value jsonb,
  current_value jsonb,
  confidence numeric,
  source app.change_source not null,
  source_excerpt text,
  source_ref text,
  status app.change_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

-- ---------------------------------------------------------------------------
-- Audit log — append-only
-- ---------------------------------------------------------------------------
create table app.audit_log (
  id bigint generated always as identity primary key,
  trip_id uuid references app.trips(id) on delete cascade,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  source app.change_source not null default 'manual',
  created_at timestamptz not null default now()
);
