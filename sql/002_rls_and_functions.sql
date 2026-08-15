-- ============================================================================
-- Helper functions, RLS policies, triggers.
-- Model: every table (except the registry and audit_log) is reached only
-- through app.trip_memberships. No policy ever trusts a client-supplied
-- tripId or role — every check re-derives the caller's role server-side
-- from auth.uid().
-- ============================================================================

create or replace function app.current_role_for_trip(p_trip_id uuid)
returns app.member_role
language sql stable security definer
set search_path = app, public
as $$
  select role from app.trip_memberships
  where trip_id = p_trip_id and user_id = auth.uid()
  limit 1;
$$;

create or replace function app.is_trip_member(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.trip_memberships
    where trip_id = p_trip_id and user_id = auth.uid()
  );
$$;

create or replace function app.is_trip_editor(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = app, public
as $$
  select app.current_role_for_trip(p_trip_id) in ('owner','editor');
$$;

create or replace function app.owns_membership(p_membership_id uuid)
returns boolean
language sql stable security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.trip_memberships
    where id = p_membership_id and user_id = auth.uid()
  );
$$;

-- Auto-create the owner's membership row the moment a trip is created.
create or replace function app.create_owner_membership()
returns trigger
language plpgsql security definer
set search_path = app, public
as $$
begin
  insert into app.trip_memberships (trip_id, user_id, role, display_name)
  values (new.id, new.owner_id, 'owner',
    coalesce((select raw_user_meta_data->>'display_name' from auth.users where id = new.owner_id), 'Organizer'));
  return new;
end;
$$;
create trigger trg_trip_owner_membership
  after insert on app.trips
  for each row execute function app.create_owner_membership();

-- touch updated_at
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_trips_touch before update on app.trips for each row execute function app.touch_updated_at();
create trigger trg_trip_days_touch before update on app.trip_days for each row execute function app.touch_updated_at();
create trigger trg_accommodations_touch before update on app.accommodations for each row execute function app.touch_updated_at();
create trigger trg_transport_legs_touch before update on app.transport_legs for each row execute function app.touch_updated_at();
create trigger trg_tracking_links_touch before update on app.tracking_links for each row execute function app.touch_updated_at();

-- Generic per-column audit trigger: diffs OLD vs NEW jsonb and logs one
-- audit_log row per changed column. Attached to the tables organizers edit
-- directly in the grid/forms.
create or replace function app.audit_row_change()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare
  k text;
  old_j jsonb := to_jsonb(old);
  new_j jsonb := to_jsonb(new);
  trip uuid;
begin
  begin
    trip := new.trip_id;
  exception when undefined_column then
    trip := null;
  end;
  for k in select jsonb_object_keys(new_j) loop
    if k in ('updated_at','created_at','meta') then continue; end if;
    if old_j -> k is distinct from new_j -> k then
      insert into app.audit_log (trip_id, actor_id, entity_type, entity_id, field_name, old_value, new_value, source)
      values (trip, auth.uid(), TG_TABLE_NAME, new.id, k, old_j -> k, new_j -> k, 'manual');
    end if;
  end loop;
  return new;
end;
$$;
create trigger trg_audit_trip_days after update on app.trip_days for each row execute function app.audit_row_change();
create trigger trg_audit_accommodations after update on app.accommodations for each row execute function app.audit_row_change();
create trigger trg_audit_transport_legs after update on app.transport_legs for each row execute function app.audit_row_change();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table app.trips enable row level security;
alter table app.trip_memberships enable row level security;
alter table app.trip_invites enable row level security;
alter table app.trip_days enable row level security;
alter table app.accommodations enable row level security;
alter table app.transport_legs enable row level security;
alter table app.points_of_interest enable row level security;
alter table app.tasks enable row level security;
alter table app.task_checks enable row level security;
alter table app.packing_items enable row level security;
alter table app.packing_checks enable row level security;
alter table app.expenses enable row level security;
alter table app.updates enable row level security;
alter table app.day_progress enable row level security;
alter table app.tracking_providers enable row level security;
alter table app.tracking_links enable row level security;
alter table app.staged_imports enable row level security;
alter table app.staged_changes enable row level security;
alter table app.audit_log enable row level security;

-- trips
create policy trips_insert on app.trips for insert with check (owner_id = auth.uid());
create policy trips_select on app.trips for select using (app.is_trip_member(id));
create policy trips_update on app.trips for update using (app.is_trip_editor(id));
create policy trips_delete on app.trips for delete using (app.current_role_for_trip(id) = 'owner');

-- trip_memberships: members can see each other; only owner/editor manage them;
-- a user can always see/update their own row (e.g. leave a trip).
create policy memberships_select on app.trip_memberships for select using (app.is_trip_member(trip_id));
create policy memberships_write_admin on app.trip_memberships for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));
create policy memberships_self_update on app.trip_memberships for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- trip_invites: owner/editor only
create policy invites_admin on app.trip_invites for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));

-- day-level / route data: any member reads, owner/editor writes
create policy trip_days_select on app.trip_days for select using (app.is_trip_member(trip_id));
create policy trip_days_write on app.trip_days for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));

create policy accommodations_select on app.accommodations for select using (app.is_trip_member(trip_id));
create policy accommodations_write on app.accommodations for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));

create policy transport_legs_select on app.transport_legs for select using (app.is_trip_member(trip_id));
create policy transport_legs_write on app.transport_legs for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));

create policy poi_select on app.points_of_interest for select using (app.is_trip_member(trip_id));
create policy poi_write on app.points_of_interest for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));

-- tasks / packing definitions: owner/editor manage the list; all members read
create policy tasks_select on app.tasks for select using (app.is_trip_member(trip_id));
create policy tasks_write on app.tasks for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));
create policy packing_select on app.packing_items for select using (app.is_trip_member(trip_id));
create policy packing_write on app.packing_items for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));

-- checkboxes: any member reads all; a member may only write their OWN checkbox
create policy task_checks_select on app.task_checks for select
  using (exists (select 1 from app.tasks t where t.id = task_id and app.is_trip_member(t.trip_id)));
create policy task_checks_write on app.task_checks for all
  using (app.owns_membership(membership_id)) with check (app.owns_membership(membership_id));
create policy packing_checks_select on app.packing_checks for select
  using (exists (select 1 from app.packing_items p where p.id = item_id and app.is_trip_member(p.trip_id)));
create policy packing_checks_write on app.packing_checks for all
  using (app.owns_membership(membership_id)) with check (app.owns_membership(membership_id));

-- expenses: owner/editor/rider may log; viewer read-only
create policy expenses_select on app.expenses for select using (app.is_trip_member(trip_id));
create policy expenses_write on app.expenses for all
  using (app.current_role_for_trip(trip_id) in ('owner','editor','rider'))
  with check (app.current_role_for_trip(trip_id) in ('owner','editor','rider'));

-- photo updates: any member can post; author or editor can delete
create policy updates_select on app.updates for select using (app.is_trip_member(trip_id));
create policy updates_insert on app.updates for insert
  with check (app.current_role_for_trip(trip_id) in ('owner','editor','rider'));
create policy updates_delete on app.updates for delete
  using (app.is_trip_editor(trip_id) or app.owns_membership(membership_id));

create policy day_progress_select on app.day_progress for select using (app.is_trip_member(trip_id));
create policy day_progress_write on app.day_progress for all
  using (app.current_role_for_trip(trip_id) in ('owner','editor','rider'))
  with check (app.current_role_for_trip(trip_id) in ('owner','editor','rider'));

-- tracking registry: public read (needed by anonymous share-link viewers via RPC, and by the app)
create policy tracking_providers_read on app.tracking_providers for select using (true);

-- tracking links: per spec 9.2 — a rider adds/edits/revokes ONLY their own link.
-- The organizer cannot create one on someone else's behalf, only view/deactivate is not even granted here.
create policy tracking_links_select on app.tracking_links for select using (app.is_trip_member(trip_id));
create policy tracking_links_self on app.tracking_links for all
  using (app.owns_membership(membership_id)) with check (app.owns_membership(membership_id));

-- imports / staged changes: owner/editor only
create policy staged_imports_admin on app.staged_imports for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));
create policy staged_changes_admin on app.staged_changes for all
  using (app.is_trip_editor(trip_id)) with check (app.is_trip_editor(trip_id));

-- audit log: read-only for owner/editor, no client writes at all (only triggers, which run as security definer)
create policy audit_log_select on app.audit_log for select using (app.is_trip_editor(trip_id));

-- grants: authenticated role uses RLS above; anon gets nothing directly —
-- public/share-link access goes exclusively through the security-definer RPC below.
grant usage on schema app to authenticated, anon;
grant select, insert, update, delete on all tables in schema app to authenticated;
revoke all on app.audit_log from authenticated;
grant select on app.audit_log to authenticated;
grant select on app.tracking_providers to anon;

-- ---------------------------------------------------------------------------
-- Public share-link read path — the ONLY way an anonymous visitor sees
-- anything. Validates token (+ optional passcode), then returns a curated
-- payload respecting trips.visibility. No table grants to anon beyond this.
-- ---------------------------------------------------------------------------
create or replace function app.public_trip_view(p_token text, p_passcode text default null)
returns jsonb
language plpgsql stable security definer
set search_path = app, public
as $$
declare
  t app.trips;
  vis jsonb;
  result jsonb;
begin
  select * into t from app.trips where share_token = p_token and share_enabled = true;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if t.share_passcode is not null and t.share_passcode <> coalesce(p_passcode, '') then
    return jsonb_build_object('error', 'passcode_required');
  end if;
  vis := t.visibility;

  select jsonb_build_object(
    'trip', jsonb_build_object(
      'id', t.id, 'name', t.name, 'startDate', t.start_date, 'endDate', t.end_date,
      'timezone', t.timezone, 'enabledModules', t.enabled_modules,
      'defaultCurrency', case when (vis->>'showCosts')::boolean then t.default_currency else null end
    ),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'dayNumber', d.day_number, 'date', d.date, 'title', d.title, 'titleEn', d.title_en,
        'description', d.description, 'descriptionEn', d.description_en,
        'distanceKm', d.distance_km, 'ascentM', d.ascent_m, 'isRestDay', d.is_rest_day,
        'mapEmbedUrl', d.map_embed_url,
        'accommodationName', (
          select a.name from app.accommodations a where a.day_id = d.id order by a.created_at limit 1
        ),
        'accommodationAddress', case when (vis->>'showExactAddresses')::boolean then (
          select a.address from app.accommodations a where a.day_id = d.id order by a.created_at limit 1
        ) else null end,
        'riddenKm', (select dp.ridden_km from app.day_progress dp where dp.day_id = d.id)
      ) order by d.order_index), '[]'::jsonb)
      from app.trip_days d where d.trip_id = t.id
    ),
    'trackingLinks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'label', coalesce(tl.label, m.display_name), 'providerId', tl.provider_id, 'url', tl.url
      )), '[]'::jsonb)
      from app.tracking_links tl
      join app.trip_memberships m on m.id = tl.membership_id
      where tl.trip_id = t.id and tl.is_public = true and tl.is_active = true
    ),
    'photos', case when (vis->>'showPhotos')::boolean then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'photoUrl', u.photo_url, 'caption', u.caption, 'createdAt', u.created_at
      ) order by u.created_at desc), '[]'::jsonb)
      from app.updates u where u.trip_id = t.id
    ) else '[]'::jsonb end
  ) into result;

  return result;
end;
$$;
grant execute on function app.public_trip_view(text, text) to anon, authenticated;
