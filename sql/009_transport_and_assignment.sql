-- 009: Transport leg extras + per-item assignment for packing / tasks.
-- Applied via Supabase dashboard SQL editor.

-- Seat/berth number field on transport legs (one text field; can list multiple,
-- e.g. "14A, 15B". Stored alongside the existing meta JSONB but as a proper
-- column so the UI can query / display it without JSON parsing client-side).
alter table app.transport_legs add column if not exists seat_number text;

-- Per-item assignment for packing lists and tasks.
-- null  = assigned to everyone on the trip (existing behaviour, default).
-- uuid[] = membership IDs of the people specifically assigned this item.
--          People not in the array see the item greyed out / not their job.
alter table app.packing_items add column if not exists assigned_to uuid[] default null;
alter table app.tasks add column if not exists assigned_to uuid[] default null;
