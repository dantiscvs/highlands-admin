-- ============================================================================
-- One-time seed: ports the real Scotland trip (from highlands/index.html's
-- DAYS/DEFAULT_SIGHTS/DEFAULT_TASKS/DEFAULT_PKG constants + the live
-- expenses row) into the new multi-trip schema as trip #1 — the reference
-- data and demo trip. This is a PARALLEL copy: the legacy highlands and
-- highlands-live apps keep reading their own original tables untouched.
--
-- Usage: select app.seed_scotland_trip('<the organizer''s auth.users id>');
-- Safe to call once per owner (no dedupe guard — re-running creates a
-- second copy, which is fine for a demo trip but don't run it twice for
-- the same real user without meaning to).
-- ============================================================================

create or replace function app.seed_scotland_trip(p_owner_id uuid)
returns uuid
language plpgsql security definer
set search_path = app, public
as $$
declare
  v_trip_id uuid;
  v_owner_membership uuid;
begin
  insert into app.trips (owner_id, name, slug, status, start_date, end_date, timezone, default_currency, enabled_modules, share_enabled, pace_assumptions)
  values (
    p_owner_id, 'Highlands 2026', 'highlands-2026-' || substr(gen_random_uuid()::text,1,8), 'active',
    '2026-08-05', '2026-08-12', 'Europe/London', 'GBP',
    '["route","gpx","elevation","weather","accommodation","resupply","poi","packing","tasks","expenses","sightseeing","transport","live"]'::jsonb,
    true,
    '{"flatKmh": {"tarmac": 16, "gravel": 12, "singletrack": 7, "hikeABike": 3}, "climbMPerHour": 400, "stopOverheadMin": 15, "dayOverheadMin": 30}'::jsonb
  )
  returning id into v_trip_id;

  select id into v_owner_membership from app.trip_memberships where trip_id = v_trip_id and user_id = p_owner_id;
  -- roster: the other two riders as additional memberships (no user_id yet — invite-only until they redeem)
  insert into app.trip_memberships (trip_id, user_id, role, display_name, color, is_on_trip) values
    (v_trip_id, null, 'rider', 'Kuba', '#79c0ff', true),
    (v_trip_id, null, 'rider', 'Maciek', '#d2a8ff', true);
  update app.trip_memberships set display_name = 'Michał', color = '#56d364' where id = v_owner_membership;

  insert into app.trip_days (trip_id, day_number, date, title, title_en, description, description_en, distance_km, ascent_m, is_rest_day, order_index, notes, notes_en, gpx_url, map_embed_url) values
    (v_trip_id, 1, '2026-08-05', 'Przylot — Edynburg', 'Arrival — Edinburgh',
      'Ryanair FR 6123 Gdańsk → Edynburg (19:25–20:55). Chilly Winston odbiera nas z lotniska o 21:30 (Van). Nocleg u dziewczyn w Musselburgh.',
      'Ryanair FR 6123 Gdańsk → Edinburgh (19:25–20:55). Chilly Winston picks us up from the airport at 21:30 (van). Staying with the girls in Musselburgh.',
      null, null, true, 1,
      '🚕 Chilly Winston 21:30 (70 GBP) — 1 osoba jedzie z rowerami vanem, 2 pozostałe Uberem (~35 GBP). Łącznie ~105 GBP.',
      '🚕 Chilly Winston 21:30 (70 GBP) — 1 person rides with the bikes in the van, the other 2 by Uber (~35 GBP). ~105 GBP total.',
      null, null),
    (v_trip_id, 2, '2026-08-06', 'Edynburg → Fort Augustus', 'Edinburgh → Fort Augustus',
      'Pociąg Edinburgh Waverley → Inverness (10:33–14:16), po południu ruszamy na trasę.',
      'Train Edinburgh Waverley → Inverness (10:33–14:16), we set off on the route in the afternoon.',
      56.9, 585, false, 2,
      '⏰ Wcześnie wstać żeby zmontować rowery i zrobić zakupy w Lidlu w Musselburgh.',
      '⏰ Get up early to assemble the bikes and shop at Lidl in Musselburgh.',
      'gpx/day1-inverness-fort-augustus.gpx', 'https://mapy.com/s/dozovegege'),
    (v_trip_id, 3, '2026-08-07', 'Fort Augustus → Ratagan', 'Fort Augustus → Ratagan',
      'Dzień 2. Przez Great Glen i Glen Shiel.', 'Day 2. Through the Great Glen and Glen Shiel.',
      85.9, 1161, false, 3, null, null,
      'gpx/day2-fort-augustus-ratagan.gpx', 'https://mapy.com/s/nenuvoluse'),
    (v_trip_id, 4, '2026-08-08', 'Ratagan → Achnasheen', 'Ratagan → Achnasheen',
      'Dzień 3. Przez Kyle of Lochalsh i Torridon.', 'Day 3. Through Kyle of Lochalsh and Torridon.',
      88, 1160, false, 4,
      '⚠️ Trzeba kupić śpiwór za 10 GBP na miejscu. Brak śniadania i kolacji w cenie noclegu.',
      '⚠️ Need to buy a sleeping bag for 10 GBP on site. Breakfast and dinner not included in the stay.',
      'gpx/day3-ratagan-achnasheen.gpx', 'https://mapy.com/s/hepezubulo'),
    (v_trip_id, 5, '2026-08-09', 'Achnasheen → Dundonnell', 'Achnasheen → Dundonnell',
      'Dzień 4. Największe przewyższenie całej trasy. Przez Poolewe i Loch Maree.',
      'Day 4. The biggest elevation gain of the whole route. Through Poolewe and Loch Maree.',
      93, 1183, false, 5, null, null,
      'gpx/day4-achnasheen-dundonnell.gpx', 'https://mapy.com/s/mebemahuda'),
    (v_trip_id, 6, '2026-08-10', 'Dundonnell → Bonar Bridge', 'Dundonnell → Bonar Bridge',
      'Dzień 5. Przez Corrieshalloch Gorge i Ullapool.', 'Day 5. Through Corrieshalloch Gorge and Ullapool.',
      90, 996, false, 6, null, null,
      'gpx/day5-dundonnell-bonar-bridge.gpx', 'https://mapy.com/s/lufevaraku'),
    (v_trip_id, 7, '2026-08-11', 'Bonar Bridge → Inverness → Edynburg', 'Bonar Bridge → Inverness → Edinburgh',
      'Dzień 6 — ostatni etap. Pociąg powrotny z Inverness (18:52–22:15).',
      'Day 6 — the final stage. Return train from Inverness (18:52–22:15).',
      99.6, 607, false, 7,
      '🚂 Pociąg: Inverness 18:52 → Edinburgh Waverley 22:15 (wagon B). 🚕 Chilly Winston odbiera rowery z Musselburgh o 19:00 (70 GBP) i wiezie na lotnisko.',
      '🚂 Train: Inverness 18:52 → Edinburgh Waverley 22:15 (coach B). 🚕 Chilly Winston picks up the bikes from Musselburgh at 19:00 (70 GBP) and takes them to the airport.',
      'gpx/day6-bonar-bridge-inverness.gpx', 'https://mapy.com/s/fedobomosu'),
    (v_trip_id, 8, '2026-08-12', 'Edynburg — zwiedzanie', 'Edinburgh — sightseeing',
      'Ostatni dzień. Ryanair FR 6124 Edynburg → Gdańsk (21:20 → 00:40 w czwartek).',
      'Last day. Ryanair FR 6124 Edinburgh → Gdańsk (21:20 → 00:40 on Thursday).',
      null, null, true, 8,
      '✈️ Wylot: 21:20 z Edynburga.', '✈️ Departure: 21:20 from Edinburgh.',
      null, null);

  -- accommodations, one per day (day 8 has none — reuses day 1's booking, matching production)
  insert into app.accommodations (trip_id, day_id, name, cost, currency, pay_status, breakfast_info)
  select v_trip_id, d.id, '104 W Holmes Gardens, Musselburgh', null, 'GBP', 'free', null
  from app.trip_days d where d.trip_id = v_trip_id and d.day_number in (1,7);

  insert into app.accommodations (trip_id, day_id, name, url, cost, currency, pay_status, cancellation_policy, breakfast_info)
  select v_trip_id, d.id, x.name, x.url, x.cost, 'GBP', 'paid', x.cancel, x.bf
  from app.trip_days d
  join (values
    (2, E'Morag''s Lodge', 'https://www.booking.com/hotel/gb/morag-s-lodge.en-gb.html', 606, 'Free cancellation before 4 August 2026', 'Weźmy rzeczy na śniadanie z domu — rano nie ma czasu na wycieczki do sklepu (pociąg 10:33).'),
    (3, 'Ratagan Youth Hostel (SYHA)', 'https://www.booking.com/hotel/gb/ratagan-youth-hostel-syha-hostelling-scotland.en-gb.html', 1029, 'Free cancellation before 4 August 2026', '32 zł / osoba'),
    (4, 'Ledgowan Bunkhouse', 'https://www.booking.com/hotel/gb/ledgowan-bunkhouse.en-gb.html', 684, 'NO cancellation possible', '32 zł / osoba'),
    (5, 'The Dundonnell Hotel', 'https://www.booking.com/hotel/gb/the-dundonnell.en-gb.html', 1044, 'Free cancellation before 7 August 2026', 'The Midge Bite Cafe Achnasheen'),
    (6, 'Dunroamin Hotel', 'https://www.booking.com/hotel/gb/dunroamin-hotel.en-gb.html', 851, 'Free cancellation until 2 August 2026 23:59', 'included')
  ) as x(day_number, name, url, cost, cancel, bf) on d.day_number = x.day_number
  where d.trip_id = v_trip_id;

  -- transport legs (flights + trains, replacing the old static HTML)
  insert into app.transport_legs (trip_id, type, anchor, carrier, reference, departure_time, departure_place, arrival_time, arrival_place, cost, currency, order_index) values
    (v_trip_id, 'flight', 'trip_start', 'Ryanair FR 6123', null, '2026-08-05 19:25+01', 'Gdańsk (GDN)', '2026-08-05 20:55+01', 'Edinburgh (EDI)', 1159, 'PLN', 1),
    (v_trip_id, 'flight', 'trip_end', 'Ryanair FR 6124', null, '2026-08-12 21:20+01', 'Edinburgh (EDI)', '2026-08-13 00:40+02', 'Gdańsk (GDN)', 1159, 'PLN', 2),
    (v_trip_id, 'train', 'custom', 'ScotRail', 'KGNKTJWG', '2026-08-06 10:33+01', 'Edinburgh Waverley', '2026-08-06 14:16+01', 'Inverness', 345, 'PLN', 3),
    (v_trip_id, 'train', 'custom', 'ScotRail', 'KGNKTJWG', '2026-08-11 18:52+01', 'Inverness', '2026-08-11 22:15+01', 'Edinburgh Waverley', 0, 'PLN', 4),
    (v_trip_id, 'bike_shipping', 'trip_start', 'Bike Atelier Kartuzy', null, null, null, null, null, 280, 'PLN', 5);

  -- sights (29 rows, the full shipped default set — category=sight)
  insert into app.points_of_interest (trip_id, day_id, category, name, icon, description, url, order_index)
  select v_trip_id, d.id, 'sight', x.name, x.icon, x.description, x.url, x.ord
  from app.trip_days d
  join (values
    (1,'Musselburgh','🏘️','A seaside town near Edinburgh where we stay the first and last nights.','https://en.wikipedia.org/wiki/Musselburgh',1),
    (2,'Inverness Castle','🏰','A 19th-century castle in the centre of Inverness, right above the River Ness. A viewpoint.','https://en.wikipedia.org/wiki/Inverness_Castle',1),
    (2,'Loch Ness','🐉','Scotland''s most famous loch — 37 km long, 230 m deep. Home of the legendary Nessie.','https://en.wikipedia.org/wiki/Loch_Ness',2),
    (2,'Urquhart Castle','🏰','13th-century castle ruins on Loch Ness — one of the most visited sites in Scotland.','https://en.wikipedia.org/wiki/Urquhart_Castle',3),
    (2,'Caledonian Canal (Fort Augustus)','⛵','A flight of 5 locks in Fort Augustus, linking Loch Ness with Loch Oich.','https://en.wikipedia.org/wiki/Caledonian_Canal',4),
    (3,'Loch Oich & Loch Lochy','🏞️','Two lochs in the Great Glen — the road runs along their shores.','https://en.wikipedia.org/wiki/Loch_Oich',1),
    (3,'Well of the Seven Heads','💀','A grim 1812 monument commemorating revenge for the 1663 murder of members of Clan MacDonell.','https://en.wikipedia.org/wiki/Well_of_the_Seven_Heads',2),
    (3,'Glen Shiel','⛰️','A dramatic valley — site of an 1719 battle.','https://en.wikipedia.org/wiki/Battle_of_Glen_Shiel',3),
    (4,'Eilean Donan Castle','🏰','Scotland''s ICON. A 13th-century castle on an island where three sea lochs meet.','https://www.eileandonancastle.com/',1),
    (4,'Five Sisters of Kintail','⛰️','A sharp, five-peaked ridge above Glen Shiel.','https://en.wikipedia.org/wiki/Five_Sisters_of_Kintail',2),
    (4,'Plockton','🐬','A picturesque fishing village with palm trees, thanks to the Gulf Stream.','https://en.wikipedia.org/wiki/Plockton',3),
    (4,'Torridon Hills','⛰️','One of Scotland''s most iconic mountain regions.','https://en.wikipedia.org/wiki/Torridon',4),
    (5,'Beinn Eighe National Nature Reserve','🌲','The UK''s first national nature reserve (1951).','https://en.wikipedia.org/wiki/Beinn_Eighe',1),
    (5,'Loch Maree','🏞️','One of Scotland''s most beautiful lochs.','https://en.wikipedia.org/wiki/Loch_Maree',2),
    (5,'Inverewe Garden (Poolewe)','🌺','A subtropical botanical garden by the sea.','https://www.nts.org.uk/visit/places/inverewe',3),
    (5,'Corrieshalloch Gorge','💦','A gorge with the 46 m Falls of Measach.','https://en.wikipedia.org/wiki/Corrieshalloch_Gorge',4),
    (5,'An Teallach','⛰️','One of Scotland''s most famous and dramatic mountains.','https://en.wikipedia.org/wiki/An_Teallach',5),
    (5,'Ullapool','⚓','A fishing port on Loch Broom.','https://en.wikipedia.org/wiki/Ullapool',6),
    (6,'Ardvreck Castle','🏰','The ruins of a 16th-century castle on a headland of Loch Assynt.','https://en.wikipedia.org/wiki/Ardvreck_Castle',1),
    (6,'Falls of Shin','🐟','A waterfall known for leaping salmon (Aug–Sep).','https://en.wikipedia.org/wiki/Falls_of_Shin',2),
    (6,'Carbisdale Castle','🏰','The "Wedding Cake Castle" — a 20th-century building above the Kyle of Sutherland.','https://en.wikipedia.org/wiki/Carbisdale_Castle',3),
    (7,'Dornoch Firth','🌊','A scenic firth along the way.','https://en.wikipedia.org/wiki/Dornoch_Firth',1),
    (7,'Struie Hill (widok)','👁️','The Struie viewpoint over the Dornoch Firth and Ben Wyvis.','https://www.walkhighlands.co.uk/',2),
    (7,'Culloden Battlefield','⚔️','Site of the 1746 battle — the end of the Jacobite rising.','https://www.nts.org.uk/visit/places/culloden',3),
    (8,'Edinburgh Castle','🏰','A castle on a volcanic rock in the heart of the city.','https://www.edinburghcastle.scot/',1),
    (8,'Royal Mile','🚶','The Old Town''s main street.','https://en.wikipedia.org/wiki/Royal_Mile',2),
    (8,'Arthur''s Seat','🗻','An extinct volcano in the city centre (251 m).','https://en.wikipedia.org/wiki/Arthur%27s_Seat',3),
    (8,'Calton Hill','🏛️','A columned monument plus views over the Old Town and the Firth of Forth.','https://en.wikipedia.org/wiki/Calton_Hill',4),
    (8,'National Museum of Scotland','🏛️','A huge museum — from dinosaurs to modern Scotland. Free admission.','https://www.nms.ac.uk/national-museum-of-scotland/',5)
  ) as x(day_number,name,icon,description,url,ord) on d.day_number = x.day_number
  where d.trip_id = v_trip_id;

  -- tasks (9 shipped defaults)
  insert into app.tasks (trip_id, title, icon, order_index)
  select v_trip_id, x.title, x.icon, x.ord from (values
    ('Calculate and plan food for the route','🍌',0),
    ('Arrange transport from the airport (Chilly Winston + Uber)','🚕',1),
    ('Generate GPX files for each stage','🗺️',2),
    ('Order / arrange a box or travel case','📦',3),
    ('Bike service before departure','🔧',4),
    ('Travel insurance','🛡️',5),
    ('Download offline maps (Mapy.cz / Komoot)','📱',6),
    ('Train to/from Edinburgh — domestic tickets','🚆',7),
    ('Activate card / bring GBP cash','💳',8)
  ) as x(title,icon,ord);

  -- packing list (29 shipped defaults)
  insert into app.packing_items (trip_id, title, order_index)
  select v_trip_id, x.title, x.ord from (values
    ('Spare inner tube (×2)',0),('Puncture patches',1),('Mini pump',2),
    ('Bike multi-tool + Allen keys',3),('Spare chain link',4),
    ('Rain jacket',5),('Cycling shorts (×2)',6),('Cycling jersey (×2)',7),
    ('Socks (×3)',8),('Underwear (×3)',9),('Evening t-shirt',10),('Hoodie / midlayer',11),
    ('Helmet',12),('Cycling shoes',13),('Cycling gloves',14),('Sunglasses / goggles',15),
    ('Sunscreen',16),('Midge repellent spray (VERY important in Scotland!)',17),
    ('Power bank',18),('Charger + UK adapter',19),('Phone with offline maps',20),
    ('ID card / passport',21),('Card + GBP cash',22),
    ('Basic medication',23),('First-aid kit',24),('Towel',25),
    ('Toiletries (mini)',26),('Sleeping bag (some hostels charge a rental fee)',27),
    ('Bike lock',28),('Panniers / bike bags',29),('Reflectors + lights',30)
  ) as x(title,ord);

  insert into app.expenses (trip_id, description, amount, currency, paid_by, participants)
  select v_trip_id, 'Train tickets Musselburgh to Waverley', 55, 'PLN', v_owner_membership,
    array(select id from app.trip_memberships where trip_id = v_trip_id);

  return v_trip_id;
end;
$$;
