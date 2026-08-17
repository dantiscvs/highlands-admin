-- Fix type-aware casting in review_staged_change for all entity types.
-- Replaces the previous trip_days-only fix and adds transport_legs support.
-- Uses information_schema.columns + udt_schema to build the right cast for
-- every column type, including enums (e.g. pay_status, transport_type).

create or replace function app.review_staged_change(p_change_id uuid, p_action text)
returns jsonb
language plpgsql
security definer
as $$
declare
  c app.staged_changes;
  is_locked boolean := false;
  v_new_entity_id uuid;
  v_col_type text;
  v_col_schema text;
  v_cast text;
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

  -- ─── trip_days ──────────────────────────────────────────────────────────────
  if c.entity_type = 'trip_days' then
    if c.entity_id is null then
      return jsonb_build_object('error', 'no_matching_day');
    end if;
    select c.field_name = any(locked_fields) into is_locked from app.trip_days where id = c.entity_id;
    if is_locked then
      update app.staged_changes set status = 'superseded', reviewed_at = now(), reviewed_by = auth.uid() where id = p_change_id;
      return jsonb_build_object('status', 'conflict_locked');
    end if;
    select udt_name, udt_schema into v_col_type, v_col_schema
    from information_schema.columns
    where table_schema = 'app' and table_name = 'trip_days' and column_name = c.field_name;
    v_cast := case
      when v_col_type in ('date') then '::date'
      when v_col_type in ('int2','int4','int8') then '::bigint'
      when v_col_type in ('numeric','float4','float8') then '::numeric'
      when v_col_type in ('bool') then '::boolean'
      when v_col_type in ('timestamptz','timestamp') then '::timestamptz'
      when v_col_schema <> 'pg_catalog' then '::' || v_col_schema || '.' || v_col_type
      else ''
    end;
    execute format(
      'update app.trip_days set %I = ($1' || v_cast || '), meta = jsonb_set(coalesce(meta,''{}''::jsonb), array[%L], $2) where id = $3',
      c.field_name, c.field_name)
      using (c.proposed_value #>> '{}'),
            jsonb_build_object('source', c.source, 'confidence', c.confidence, 'updatedAt', now(), 'updatedBy', auth.uid()),
            c.entity_id;

  -- ─── accommodations ──────────────────────────────────────────────────────────
  elsif c.entity_type = 'accommodations' then
    if c.entity_id is null then
      insert into app.accommodations (trip_id, name)
      values (
        c.trip_id,
        case when c.field_name = 'name' then coalesce(c.proposed_value #>> '{}', 'New stay') else 'New stay (from import)' end
      )
      returning id into v_new_entity_id;
      update app.staged_changes set entity_id = v_new_entity_id
        where import_id = c.import_id and entity_type = 'accommodations' and entity_id is null and id <> c.id and status = 'pending';
      c.entity_id := v_new_entity_id;
      if c.field_name = 'name' then
        update app.staged_changes set status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid() where id = p_change_id;
        insert into app.audit_log (trip_id, actor_id, entity_type, entity_id, field_name, old_value, new_value, source)
        values (c.trip_id, auth.uid(), c.entity_type, c.entity_id, c.field_name, c.current_value, c.proposed_value, c.source);
        return jsonb_build_object('status', 'accepted', 'entityId', c.entity_id);
      end if;
    else
      select c.field_name = any(locked_fields) into is_locked from app.accommodations where id = c.entity_id;
      if is_locked then
        update app.staged_changes set status = 'superseded', reviewed_at = now(), reviewed_by = auth.uid() where id = p_change_id;
        return jsonb_build_object('status', 'conflict_locked');
      end if;
    end if;
    select udt_name, udt_schema into v_col_type, v_col_schema
    from information_schema.columns
    where table_schema = 'app' and table_name = 'accommodations' and column_name = c.field_name;
    v_cast := case
      when v_col_type in ('date') then '::date'
      when v_col_type in ('int2','int4','int8') then '::bigint'
      when v_col_type in ('numeric','float4','float8') then '::numeric'
      when v_col_type in ('bool') then '::boolean'
      when v_col_type in ('timestamptz','timestamp') then '::timestamptz'
      when v_col_schema <> 'pg_catalog' then '::' || v_col_schema || '.' || v_col_type
      else ''
    end;
    execute format(
      'update app.accommodations set %I = ($1' || v_cast || ') where id = $2',
      c.field_name)
      using (c.proposed_value #>> '{}'), c.entity_id;

  -- ─── transport_legs ───────────────────────────────────────────────────────────
  elsif c.entity_type = 'transport_legs' then
    if c.entity_id is null then
      insert into app.transport_legs (trip_id, type, anchor)
      values (c.trip_id, 'other'::app.transport_type, 'trip_start'::app.transport_anchor)
      returning id into v_new_entity_id;
      update app.staged_changes set entity_id = v_new_entity_id
        where import_id = c.import_id and entity_type = 'transport_legs' and entity_id is null and id <> c.id and status = 'pending';
      c.entity_id := v_new_entity_id;
    end if;
    select udt_name, udt_schema into v_col_type, v_col_schema
    from information_schema.columns
    where table_schema = 'app' and table_name = 'transport_legs' and column_name = c.field_name;
    v_cast := case
      when v_col_type in ('date') then '::date'
      when v_col_type in ('int2','int4','int8') then '::bigint'
      when v_col_type in ('numeric','float4','float8') then '::numeric'
      when v_col_type in ('bool') then '::boolean'
      when v_col_type in ('timestamptz','timestamp') then '::timestamptz'
      when v_col_schema <> 'pg_catalog' then '::' || v_col_schema || '.' || v_col_type
      else ''
    end;
    execute format(
      'update app.transport_legs set %I = ($1' || v_cast || ') where id = $2',
      c.field_name)
      using (c.proposed_value #>> '{}'), c.entity_id;

  else
    return jsonb_build_object('error', 'unsupported_entity_type');
  end if;

  update app.staged_changes set status = 'accepted', reviewed_at = now(), reviewed_by = auth.uid() where id = p_change_id;
  insert into app.audit_log (trip_id, actor_id, entity_type, entity_id, field_name, old_value, new_value, source)
  values (c.trip_id, auth.uid(), c.entity_type, c.entity_id, c.field_name, c.current_value, c.proposed_value, c.source);
  return jsonb_build_object('status', 'accepted', 'entityId', c.entity_id);
end;
$$;
