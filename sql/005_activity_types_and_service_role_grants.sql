-- Applied live via mcp migrations app_schema_011/012 and grant_service_role_app_schema.
-- Recorded here so sql/ stays the source-of-truth mirror of what's live.

-- ---------------------------------------------------------------------------
-- Multi-activity-type support (feedback item: "expand this tool to every
-- kind of trip, not just bike trips").
-- ---------------------------------------------------------------------------
alter table app.trips add column if not exists activity_type text not null default 'cycling'
  check (activity_type in ('cycling','hiking','driving','public_transport','kayaking','mixed'));

alter type app.transport_type add value if not exists 'bus';
alter type app.transport_type add value if not exists 'car';
alter type app.transport_type add value if not exists 'campervan';
alter type app.transport_type add value if not exists 'boat';

-- duplicate_trip() was missing activity_type in its column copy.
CREATE OR REPLACE FUNCTION app.duplicate_trip(p_source_trip_id uuid, p_new_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'app', 'public'
AS $function$
declare
  v_new_trip_id uuid;
  src app.trips;
begin
  select * into src from app.trips where id = p_source_trip_id;
  if not found then
    raise exception 'trip not found or not accessible';
  end if;

  insert into app.trips (owner_id, name, slug, status, timezone, default_currency, enabled_modules, pace_assumptions, duplicated_from, activity_type)
  values (auth.uid(), p_new_name, lower(regexp_replace(p_new_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text,1,6),
    'draft', src.timezone, src.default_currency, src.enabled_modules, src.pace_assumptions, src.id, src.activity_type)
  returning id into v_new_trip_id;

  insert into app.trip_days (trip_id, day_number, title, title_en, description, description_en, distance_km, ascent_m, descent_m, surface, start_point, end_point, is_rest_day, order_index)
  select v_new_trip_id, day_number, title, title_en, description, description_en, distance_km, ascent_m, descent_m, surface, start_point, end_point, is_rest_day, order_index
  from app.trip_days where trip_id = p_source_trip_id;

  insert into app.points_of_interest (trip_id, day_id, category, name, icon, description, url, order_index)
  select v_new_trip_id, nd.id, p.category, p.name, p.icon, p.description, p.url, p.order_index
  from app.points_of_interest p
  join app.trip_days od on od.id = p.day_id
  join app.trip_days nd on nd.trip_id = v_new_trip_id and nd.day_number = od.day_number
  where p.trip_id = p_source_trip_id;

  insert into app.tasks (trip_id, title, icon, order_index)
  select v_new_trip_id, title, icon, order_index from app.tasks where trip_id = p_source_trip_id;

  insert into app.packing_items (trip_id, title, order_index)
  select v_new_trip_id, title, order_index from app.packing_items where trip_id = p_source_trip_id;

  return v_new_trip_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- service_role had no grants anywhere in the app schema (not even USAGE on
-- the schema itself) — every edge function using the service-role/admin
-- client against app.* tables (invite-redeem in particular, since a redeemer
-- isn't a trip member yet so RLS-scoped access can't work) was silently
-- failing every query and returning generic not-found errors. Found while
-- testing the new participants/invite UI.
-- ---------------------------------------------------------------------------
grant usage on schema app to service_role;
grant all privileges on all tables in schema app to service_role;
grant all privileges on all sequences in schema app to service_role;
grant execute on all functions in schema app to service_role;
alter default privileges in schema app grant all privileges on tables to service_role;
alter default privileges in schema app grant all privileges on sequences to service_role;
alter default privileges in schema app grant execute on functions to service_role;
