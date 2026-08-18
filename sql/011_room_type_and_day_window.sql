-- 011: room type on stays, and an optional day end-time so "required pace"
-- can be computed the way the legacy app did (distance over the real stage
-- window, not just the assumed cruising speed).

alter table app.accommodations add column if not exists room_type text;

-- Target arrival/finish time for a day. Together with actual_start_time this
-- gives the stage window the Statistics and Today tabs need to answer
-- "how fast do I have to move to get there on time?".
alter table app.trip_days add column if not exists target_end_time time;
