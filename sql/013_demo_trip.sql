-- 013: Build a shareable DEMO trip from the real "Highlands 2026" data.
--
-- Three things happen here, and the original trip is never modified:
--   1. Translate — every remaining Polish string becomes English.
--   2. Sanitise — a private residential address, a named private driver, the
--      real rail booking reference, real prices and real participant names are
--      all replaced.
--   3. Reschedule — dates shift so "today" falls mid-trip, so the Today tab,
--      progress bars and the live page all have something to show.
--
-- Re-runnable: drops any existing demo trip with the same slug first.

do $do$
declare
  v_src   uuid;
  v_demo  uuid;
  v_owner uuid;
  v_shift int;
  v_m_alex uuid; v_m_sam uuid; v_m_jordan uuid;
  v_day uuid;
begin
  select id, owner_id into v_src, v_owner from app.trips where name = 'Highlands 2026';
  if v_src is null then raise exception 'source trip not found'; end if;

  delete from app.trips where slug = 'demo-highlands-traverse';

  -- Land day 4 (the biggest riding day) on today, so screenshots show a trip
  -- in progress rather than one that finished a fortnight ago.
  select (current_date - (select date from app.trip_days where trip_id = v_src and day_number = 4))
    into v_shift;

  insert into app.trips (owner_id, name, slug, status, activity_type, timezone,
                         default_currency, enabled_modules, pace_assumptions,
                         start_date, end_date, share_enabled, share_token, visibility)
  select v_owner,
         'Scottish Highlands Traverse — Demo',
         'demo-highlands-traverse',
         'active',
         'cycling',                       -- content is all cycling; source said hiking
         timezone,
         'GBP',                           -- single currency; source mixed GBP and PLN
         enabled_modules,
         '{"flatKmh":{"tarmac":18,"gravel":13,"singletrack":8},"climbMPerHour":450,"dayOverheadMin":120,"stopOverheadMin":15}'::jsonb,
         start_date + v_shift, end_date + v_shift,
         true,
         replace(gen_random_uuid()::text, '-', ''),
         '{"showCosts":true,"showPhones":false,"showPhotos":true,"showBookingRefs":false,"showExactAddresses":true,"showExpenseBalances":true}'::jsonb
  from app.trips where id = v_src
  returning id into v_demo;

  -- ---------- Days ----------
  insert into app.trip_days (trip_id, day_number, date, title, title_en, description,
                             distance_km, ascent_m, surface, is_rest_day, notes,
                             actual_start_time, target_end_time, map_embed_url, gpx_url, order_index)
  select v_demo, day_number, date + v_shift,
         coalesce(title_en, title), title_en,
         case day_number
           when 1 then 'Ryanair FR 1801 Gdansk to Edinburgh (19:25-20:55). Pre-booked van transfer from the airport at 21:30. First night in Musselburgh.'
           when 8 then 'Last day. Ryanair FR 1802 Edinburgh to Gdansk (21:20, landing 00:40).'
           else description_en
         end,
         distance_km, ascent_m,
         case when is_rest_day then null else 'tarmac' end,
         is_rest_day,
         case day_number
           when 1 then 'Van transfer booked for 21:30 (70 GBP) - one rider travels with the bikes, the other two by taxi (~35 GBP).'
           when 2 then 'Early start: assemble the bikes and pick up supplies in Musselburgh before the 10:33 train.'
           when 4 then 'Sleeping bag hire is 10 GBP at the bunkhouse. No breakfast or dinner included.'
           when 7 then 'Return train: Inverness 18:52 to Edinburgh Waverley 22:15 (coach B). Van collects the bikes from Musselburgh at 19:00 (70 GBP).'
           when 8 then 'Departure 21:20 from Edinburgh.'
           else notes
         end,
         -- A real stage window unlocks the required-pace charts in Statistics.
         case when is_rest_day then null when day_number = 2 then time '14:45' else time '08:00' end,
         case when is_rest_day then null when day_number = 7 then time '17:00' else time '18:00' end,
         map_embed_url, gpx_url, order_index
  from app.trip_days where trip_id = v_src;

  -- ---------- Accommodation ----------
  -- The source used a private residential address as the stay name on the
  -- first and last nights; that becomes a generic guesthouse here.
  insert into app.accommodations (trip_id, day_id, name, room_type, address, url, map_url,
                                  cost, currency, pay_status, is_booked, booking_reference,
                                  breakfast_info, cancellation_policy, notes)
  select v_demo,
         (select nd.id from app.trip_days nd
           where nd.trip_id = v_demo and nd.day_number = od.day_number),
         case when a.name like '%Holmes Gardens%' then 'Musselburgh Guest House' else a.name end,
         case a.name
           when 'Morag''s Lodge' then 'Twin en-suite x2 + single'
           when 'Ratagan Youth Hostel (SYHA)' then '4-bed shared dorm'
           when 'Ledgowan Bunkhouse' then 'Bunkhouse - 3 beds'
           when 'The Dundonnell Hotel' then 'Double + twin, garden view'
           when 'Dunroamin Hotel' then 'Twin rooms x2'
           else 'Twin room'
         end,
         case when a.name like '%Holmes Gardens%' then 'Musselburgh, East Lothian' else a.address end,
         nullif(a.url, ''), nullif(a.map_url, ''),
         -- Rounded demo prices, not the real amounts paid.
         case a.name
           when 'Morag''s Lodge' then 180
           when 'Ratagan Youth Hostel (SYHA)' then 240
           when 'Ledgowan Bunkhouse' then 150
           when 'The Dundonnell Hotel' then 260
           when 'Dunroamin Hotel' then 210
           else null
         end,
         'GBP',
         case when a.name like '%Holmes Gardens%' then 'free'::app.pay_status else 'paid'::app.pay_status end,
         a.name not like '%Holmes Gardens%',
         case when a.name like '%Holmes Gardens%' then null else 'DEMO-' || upper(substr(md5(a.name), 1, 6)) end,
         case a.name
           when 'Morag''s Lodge' then 'Bring breakfast supplies - no time for a shop run before the 10:33 train.'
           when 'Ratagan Youth Hostel (SYHA)' then 'Self-catered, 7 GBP per person'
           when 'Ledgowan Bunkhouse' then 'Self-catered, 7 GBP per person'
           when 'The Dundonnell Hotel' then 'Served 07:30-09:00, included'
           when 'Dunroamin Hotel' then 'Included, from 07:00'
           else null
         end,
         a.cancellation_policy, a.notes
  from app.accommodations a
  left join app.trip_days od on od.id = a.day_id
  where a.trip_id = v_src;

  -- ---------- Transport ----------
  -- Real flight numbers and the real ScotRail booking reference are replaced.
  insert into app.transport_legs (trip_id, type, anchor, day_id, carrier, reference, seat_number,
                                  departure_place, departure_time, arrival_place, arrival_time,
                                  cost, currency, notes, order_index)
  select v_demo, l.type, l.anchor,
         (select nd.id from app.trip_days nd join app.trip_days od on od.id = l.day_id
           where nd.trip_id = v_demo and nd.day_number = od.day_number),
         case l.carrier
           when 'Ryanair FR 6123' then 'Ryanair FR 1801'
           when 'Ryanair FR 6124' then 'Ryanair FR 1802'
           when 'Bike Atelier Kartuzy' then 'City Bike Store'
           else l.carrier
         end,
         case when l.type = 'train' then 'DEMO-RAIL-2201'
              when l.type = 'flight' then 'DEMO-AIR-7734'
              else nullif(l.reference, '') end,
         case when l.type = 'train' then 'Coach B, seats 41-43'
              when l.type = 'flight' then '12A, 12B, 12C' end,
         nullif(l.departure_place, ''), l.departure_time + (v_shift || ' days')::interval,
         nullif(l.arrival_place, ''),   l.arrival_time   + (v_shift || ' days')::interval,
         case l.type when 'flight' then 240 when 'train' then 72 else 60 end,
         'GBP',
         case l.type when 'bike_shipping' then 'Three hard cases hired for the trip.' else l.notes end,
         l.order_index
  from app.transport_legs l where l.trip_id = v_src;

  -- ---------- Points of interest ----------
  insert into app.points_of_interest (trip_id, day_id, category, name, icon, description, url, opening_hours, order_index)
  select v_demo,
         (select nd.id from app.trip_days nd where nd.trip_id = v_demo and nd.day_number = od.day_number),
         p.category,
         replace(p.name, '(widok)', '(viewpoint)'),
         p.icon, p.description, p.url, nullif(p.opening_hours, ''), p.order_index
  from app.points_of_interest p
  join app.trip_days od on od.id = p.day_id
  where p.trip_id = v_src;

  -- A few food stops so the demo exercises the 'food' category too.
  select id into v_day from app.trip_days where trip_id = v_demo and day_number = 3;
  insert into app.points_of_interest (trip_id, day_id, category, name, icon, description, opening_hours, order_index) values
    (v_demo, v_day, 'food', 'The Cluanie Inn', '🍽️', 'Classic Highland roadside inn - hot food and a fire.', '12:00-21:00', 10),
    (v_demo, v_day, 'resupply', 'Co-op Fort Augustus', '🛒', 'Last proper supermarket before the remote stretch.', '07:00-22:00', 11);
  select id into v_day from app.trip_days where trip_id = v_demo and day_number = 5;
  insert into app.points_of_interest (trip_id, day_id, category, name, icon, description, opening_hours, order_index) values
    (v_demo, v_day, 'food', 'Midge Bite Cafe', '🍽️', 'Cyclist-friendly cafe at Achnasheen - big portions.', '08:00-16:00', 10),
    (v_demo, v_day, 'water', 'Loch Maree layby tap', '💧', 'Reliable drinking water refill point.', 'Always open', 11);

  -- ---------- People ----------
  -- Demo participants are NOT linked to real accounts. Only the owner row keeps
  -- a user_id, so the trip appears in the owner's own trip list.
  -- A trigger already creates the owner membership on trip insert, so adopt
  -- that row instead of inserting a second one.
  insert into app.trip_memberships (trip_id, user_id, role, display_name, color, is_on_trip)
  values (v_demo, v_owner, 'owner', 'Alex Morgan', '#2E5339', true)
  on conflict (trip_id, user_id) do update
    set display_name = excluded.display_name, color = excluded.color,
        role = 'owner', is_on_trip = true
  returning id into v_m_alex;
  insert into app.trip_memberships (trip_id, user_id, role, display_name, color, is_on_trip)
  values (v_demo, null, 'rider', 'Sam Rivera', '#C1602E', true) returning id into v_m_sam;
  insert into app.trip_memberships (trip_id, user_id, role, display_name, color, is_on_trip)
  values (v_demo, null, 'rider', 'Jordan Blake', '#35637F', true) returning id into v_m_jordan;
  insert into app.trip_memberships (trip_id, user_id, role, display_name, color, is_on_trip)
  values (v_demo, null, 'viewer', 'Casey Doyle', '#7B4B94', false);

  -- ---------- Packing ----------
  insert into app.packing_items (trip_id, title, order_index, assigned_to)
  select v_demo, title, order_index,
         case
           when title like 'Bike multi-tool%' then array[v_m_sam]      -- one between three
           when title like 'Mini pump%'       then array[v_m_jordan]
           when title like 'First-aid kit%'   then array[v_m_alex]
           else null                                                   -- null = everyone
         end
  from app.packing_items where trip_id = v_src;

  -- ---------- Tasks ----------
  insert into app.tasks (trip_id, title, icon, order_index, assigned_to)
  select v_demo,
         replace(title, 'Chilly Winston + Uber', 'van + taxi'),
         icon, order_index,
         case order_index
           when 0 then array[v_m_sam]
           when 2 then array[v_m_alex]
           when 4 then array[v_m_jordan]
           else null
         end
  from app.tasks where trip_id = v_src;

  -- Tick some boxes so the checklists do not screenshot empty.
  insert into app.packing_checks (item_id, membership_id, checked)
  select i.id, m.id, true
  from app.packing_items i
  cross join (values (v_m_alex), (v_m_sam), (v_m_jordan)) as m(id)
  where i.trip_id = v_demo and i.order_index < 14
    and (i.assigned_to is null or m.id = any(i.assigned_to));

  insert into app.task_checks (task_id, membership_id, checked)
  select t.id, m.id, true
  from app.tasks t
  cross join (values (v_m_alex), (v_m_sam), (v_m_jordan)) as m(id)
  where t.trip_id = v_demo and t.order_index < 5
    and (t.assigned_to is null or m.id = any(t.assigned_to));

  -- ---------- Expenses ----------
  insert into app.expenses (trip_id, description, amount, currency, paid_by, participants) values
    (v_demo, 'Airport van transfer',       70, 'GBP', v_m_alex,   array[v_m_alex, v_m_sam, v_m_jordan]),
    (v_demo, 'Rail tickets to Inverness',  72, 'GBP', v_m_sam,    array[v_m_alex, v_m_sam, v_m_jordan]),
    (v_demo, 'Groceries - Fort Augustus',  38, 'GBP', v_m_jordan, array[v_m_alex, v_m_sam, v_m_jordan]),
    (v_demo, 'Dinner at the Cluanie Inn',  64, 'GBP', v_m_alex,   array[v_m_alex, v_m_sam, v_m_jordan]),
    (v_demo, 'Sleeping bag hire',          20, 'GBP', v_m_sam,    array[v_m_sam, v_m_jordan]),
    (v_demo, 'Bunkhouse deposit',         150, 'GBP', v_m_jordan, array[v_m_alex, v_m_sam, v_m_jordan]);

  -- ---------- Progress ----------
  -- Days before today finished; today part-done, so the live page and Today tab
  -- both show a trip actually under way.
  insert into app.day_progress (trip_id, day_id, ridden_km)
  select v_demo, d.id,
         case when d.date < current_date then d.distance_km
              when d.date = current_date then round(d.distance_km * 0.55)
              else 0 end
  from app.trip_days d
  where d.trip_id = v_demo and d.distance_km is not null and d.date <= current_date;

  raise notice 'demo trip %', v_demo;
end
$do$;
