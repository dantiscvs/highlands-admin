-- 014: per-day coordinates, so the Weather module knows where to forecast for.
--
-- The legacy PWA hard-coded a lat/lon per day for one specific trip. Here the
-- app derives them from the day's GPX track (the end point — where you will
-- actually be that evening) and caches the result, but they stay editable for
-- days that have no track.

alter table app.trip_days add column if not exists lat double precision;
alter table app.trip_days add column if not exists lon double precision;

comment on column app.trip_days.lat is 'Forecast/geo latitude for the day, usually the end of the stage. Auto-derived from gpx_url when absent.';
comment on column app.trip_days.lon is 'Forecast/geo longitude for the day, usually the end of the stage.';
