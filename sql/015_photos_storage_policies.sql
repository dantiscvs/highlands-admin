-- 015: the 'photos' bucket had only an ALL-commands policy scoped to the
-- `anon` role (applied ad hoc via the dashboard, not through a migration).
-- Every real user uploading a photo is signed in and therefore holds the
-- `authenticated` role, which that policy never covered — so every upload
-- from the app was rejected by RLS. This is the root cause of the "upload
-- just hangs" report: the client showed the failure in a small status line
-- next to the button that's easy to miss, which read as nothing happening.
--
-- Mirrors the existing trip-gpx bucket's policy shape (any authenticated user
-- may insert/update/delete; the bucket is public so reads need no policy).

create policy "auth users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

create policy "auth users can update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'photos');

create policy "auth users can delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos');
