-- ============================================================================
-- RPC functions callable by authenticated users via supabase.rpc(...).
-- These run SECURITY INVOKER (the default) — they execute as the calling
-- user and are subject to the exact same RLS policies as any direct table
-- write, so they can never do more than the caller's role already allows.
-- ============================================================================

-- Section 3.3 — duplicate a trip: same day structure, route, POIs, packing
-- list and tasks; cleared dates, no accommodations/transport/expenses/photos/
-- tracking carried over.
create or replace function app.duplicate_trip(p_source_trip_id uuid, p_new_name text)
returns uuid
language plpgsql
as $$
declare
  v_new_trip_id uuid;
  src app.trips;
begin
  select * into src from app.trips where id = p_source_trip_id;
  if not found then
    raise exception 'trip not found or not accessible';
  end if;

  insert into app.trips (owner_id, name, slug, status, timezone, default_currency, enabled_modules, pace_assumptions, duplicated_from)
  values (auth.uid(), p_new_name, lower(regexp_replace(p_new_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text,1,6),
    'draft', src.timezone, src.default_currency, src.enabled_modules, src.pace_assumptions, src.id)
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
$$;
grant execute on function app.duplicate_trip(uuid, text) to authenticated;

-- Section 7.3 — start-from-template. Templates seed day structure + packing
-- list, not geography. Three shipped templates.
create or replace function app.create_trip_from_template(p_template text, p_name text)
returns uuid
language plpgsql
as $$
declare
  v_trip_id uuid;
  v_days int;
begin
  v_days := case p_template when 'weekend' then 3 when 'toured' then 7 when 'expedition' then 14 else 3 end;

  insert into app.trips (owner_id, name, slug, status, enabled_modules)
  values (auth.uid(), p_name, lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text,1,6),
    'draft',
    case p_template
      when 'weekend' then '["route","accommodation"]'::jsonb
      when 'toured' then '["route","accommodation","resupply","poi","packing","tasks"]'::jsonb
      else '["route","accommodation","resupply","poi","packing","tasks","expenses"]'::jsonb
    end)
  returning id into v_trip_id;

  insert into app.trip_days (trip_id, day_number, title, order_index, is_rest_day)
  select v_trip_id, n, 'Day ' || n, n, false
  from generate_series(1, v_days) as n;

  if p_template in ('toured','expedition') then
    insert into app.packing_items (trip_id, title, order_index)
    select v_trip_id, x.title, x.ord from (values
      ('Spare inner tube',0),('Multi-tool',1),('Rain jacket',2),('Helmet',3),
      ('Phone with offline maps',4),('Power bank',5),('First-aid kit',6)
    ) as x(title, ord);
    insert into app.tasks (trip_id, title, icon, order_index)
    select v_trip_id, x.title, x.icon, x.ord from (values
      ('Book accommodation','🏠',0),('Check bike service','🔧',1),('Sort travel insurance','🛡️',2)
    ) as x(title, icon, ord);
  end if;
  if p_template = 'expedition' then
    insert into app.tasks (trip_id, title, icon, order_index) values
      (v_trip_id, 'Plan resupply points', '🛒', 3);
  end if;

  return v_trip_id;
end;
$$;
grant execute on function app.create_trip_from_template(text, text) to authenticated;

-- Section 5.4 — review one staged change: accept (writes the field, unless
-- locked — a locked field can only produce a superseded/conflicting
-- proposal, never a silent overwrite) or reject.
create or replace function app.review_staged_change(p_change_id uuid, p_action text)
returns jsonb
language plpgsql
as $$
declare
  c app.staged_changes;
  is_locked boolean := false;
begin
  select * into c from app.staged_changes where id = p_change_id;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if not app.is_trip_editor(c.trip_id) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_action = 'reject' then
    update app.staged_changes set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid() where id = p_change_id;
    return jsonb_build_object('status', 'rejected');
  end if;
  if p_action <> 'accept' then
    return jsonb_build_object('error', 'invalid_action');
  end if;

  if c.entity_type = 'trip_days' and c.entity_id is not null then
    select c.field_name = any(locked_fields) into is_locked from app.trip_days where id = c.entity_id;
    if is_locked then
      update app.staged_changes set status = 'superseded', reviewed_at = now(), reviewed_by = auth.uid() where id = p_change_id;
      return jsonb_build_object('status', 'conflict_locked');
    end if;
    execute format('update app.trip_days set %I = $1, meta = jsonb_set(coalesce(meta,''{}''::jsonb), array[%L], $2) where id = $3',
      c.field_name, c.field_name)
      using (c.proposed_value #>> '{}'), jsonb_build_object('source', c.source, 'confidence', c.confidence, 'updatedAt', now(), 'updatedBy', auth.uid()), c.entity_id;
  elsif c.entity_type = 'accommodations' and c.entity_id is not null then
    select c.field_name = any(locked_fields) into is_locked from app.accommodations where id = c.entity_id;
    if is_locked then
      update app.staged_changes set status = 'superseded', reviewed_at = now(), reviewed_by = auth.uid() where id = p_change_id;
      return jsonb_build_object('status', 'conflict_locked');
    end if;
    execute format('update app.accommodations set %I = $1 where id = $2', c.field_name)
      using (c.proposed_value #>> '{}'), c.entity_id;
  else
    return jsonb_build_object('error', 'unsupported_entity_type');
  end if;

  update app.staged_changes set status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid() where id = p_change_id;
  insert into app.audit_log (trip_id, actor_id, entity_type, entity_id, field_name, old_value, new_value, source)
  values (c.trip_id, auth.uid(), c.entity_type, c.entity_id, c.field_name, c.current_value, c.proposed_value, c.source);
  return jsonb_build_object('status', 'accepted');
end;
$$;
grant execute on function app.review_staged_change(uuid, text) to authenticated;

-- Section 12 — readiness checklist, computed on the fly (warn, never block)
create or replace function app.trip_readiness(p_trip_id uuid)
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'noAccommodationNoCamping', (
      select coalesce(jsonb_agg(d.day_number), '[]'::jsonb) from app.trip_days d
      where d.trip_id = p_trip_id and d.is_rest_day = false
        and not exists (select 1 from app.accommodations a where a.day_id = d.id)
    ),
    'noResupplyLongDay', (
      select coalesce(jsonb_agg(d.day_number), '[]'::jsonb) from app.trip_days d
      where d.trip_id = p_trip_id and coalesce(d.distance_km,0) > 60
        and not exists (select 1 from app.points_of_interest p where p.day_id = d.id and p.category in ('resupply','water'))
    ),
    'unbookedMarkedBooked', (
      select coalesce(jsonb_agg(a.name), '[]'::jsonb) from app.accommodations a
      where a.trip_id = p_trip_id and a.is_booked = true and a.url is null and a.booking_reference is null
    ),
    'noTrackingRider', (
      select coalesce(jsonb_agg(m.display_name), '[]'::jsonb) from app.trip_memberships m
      where m.trip_id = p_trip_id and m.is_on_trip = true and m.role = 'rider'
        and not exists (select 1 from app.tracking_links t where t.membership_id = m.id and t.is_active)
    ),
    'totalDays', (select count(*) from app.trip_days where trip_id = p_trip_id),
    'completePct', (
      select case when count(*) = 0 then 100 else
        round(100.0 * count(*) filter (
          where exists (select 1 from app.accommodations a where a.day_id = d.id) or d.is_rest_day
        ) / count(*))
      end
      from app.trip_days d where d.trip_id = p_trip_id
    )
  );
$$;
grant execute on function app.trip_readiness(uuid) to authenticated;
