-- GPX file storage bucket.
-- Files are stored at {trip_id}/route.gpx (multi-day) or {trip_id}/day-{n}.gpx (per-day).
-- Public bucket so gpx_url values work in map viewers without signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-gpx',
  'trip-gpx',
  true,
  52428800,
  array['application/gpx+xml', 'application/octet-stream', 'text/xml', 'application/xml', 'text/plain']
)
on conflict (id) do nothing;

-- Any authenticated user can upload (trip ownership enforced at app layer via RLS on trip_days).
create policy "auth users can upload gpx"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trip-gpx');

-- Public reads so map viewers can fetch track files without auth.
create policy "public can read gpx"
  on storage.objects for select
  using (bucket_id = 'trip-gpx');

-- Allow updates (upsert during re-import).
create policy "auth users can update gpx"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'trip-gpx');
