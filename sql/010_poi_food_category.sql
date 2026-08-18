-- 010: 'food' POI category (restaurants / cafes / pubs).
-- The legacy PWA showed restaurants as their own line on each day card;
-- 'sight' was the wrong bucket for them and 'resupply' means shops.
alter type app.poi_category add value if not exists 'food';
