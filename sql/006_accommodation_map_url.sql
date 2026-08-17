-- Applied live via migration accommodation_map_url_and_unlinked_stays.
-- Google Maps link on accommodation stays, plus surface/unlinked-stays
-- support in the public participant/viewer RPC.

alter table app.accommodations add column if not exists map_url text;

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
        'surface', d.surface,
        'mapEmbedUrl', d.map_embed_url,
        'accommodationName', (
          select a.name from app.accommodations a where a.day_id = d.id order by a.created_at limit 1
        ),
        'accommodationAddress', case when (vis->>'showExactAddresses')::boolean then (
          select a.address from app.accommodations a where a.day_id = d.id order by a.created_at limit 1
        ) else null end,
        'accommodationMapUrl', case when (vis->>'showExactAddresses')::boolean then (
          select a.map_url from app.accommodations a where a.day_id = d.id order by a.created_at limit 1
        ) else null end,
        'riddenKm', (select dp.ridden_km from app.day_progress dp where dp.day_id = d.id)
      ) order by d.order_index), '[]'::jsonb)
      from app.trip_days d where d.trip_id = t.id
    ),
    'unlinkedStays', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', a.name,
        'address', case when (vis->>'showExactAddresses')::boolean then a.address else null end,
        'mapUrl', case when (vis->>'showExactAddresses')::boolean then a.map_url else null end,
        'bookingReference', case when (vis->>'showBookingRefs')::boolean then a.booking_reference else null end
      ) order by a.created_at), '[]'::jsonb)
      from app.accommodations a where a.trip_id = t.id and a.day_id is null
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
