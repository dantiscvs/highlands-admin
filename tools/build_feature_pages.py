#!/usr/bin/env python3
"""
Generates features/*.html from the FEATURES data below.

There is no build step in this project, so these pages are committed as static
HTML for SEO and simplicity. This script exists so the shared chrome (header,
footer, CTA, cross-links) lives in one place instead of being copy-pasted
twelve times.

Usage:  python tools/build_feature_pages.py
"""
import os
import html

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "features")
DEMO = "c26dcdbd931c46f8804196172c1179b9"


# --------------------------------------------------------------------------
# Small markup helpers so the content below stays readable
# --------------------------------------------------------------------------
def ui(title, body):
    return f"""<div class="ui">
  <div class="ui-bar"><span class="ui-dot"></span><span class="ui-dot"></span><span class="ui-dot"></span>
    <span class="ui-url">{title}</span></div>
  <div class="ui-body">{body}</div>
</div>"""


def row(num, t, m, pill=None, pill_cls="pill-gray"):
    n = f'<span class="ui-num">{num}</span>' if num else ""
    p = f'<span class="ui-pill {pill_cls}">{pill}</span>' if pill else ""
    return (f'<div class="ui-row">{n}<div style="flex:1;min-width:0;">'
            f'<div class="ui-t">{t}</div><div class="ui-m">{m}</div></div>{p}</div>')


def stats(*pairs):
    cells = "".join(f'<div class="ui-stat"><b>{v}</b><span>{l}</span></div>' for v, l in pairs)
    return f'<div class="ui-stats">{cells}</div>'


def facts(*pairs):
    cells = "".join(
        f'<div><div class="ui-m" style="font-size:9px;text-transform:uppercase;letter-spacing:.05em;">{k}</div>'
        f'<div class="mono" style="font-size:12px;font-weight:600;">{v}</div></div>' for k, v in pairs)
    return (f'<div style="display:grid;grid-template-columns:repeat({min(len(pairs),3)},1fr);gap:9px;'
            f'margin-top:12px;padding-top:10px;border-top:1px solid var(--border-hairline);">{cells}</div>')


def bars(values, labels, colors=None):
    colors = colors or ["var(--accent)"] * len(values)
    b = "".join(f'<i style="height:{v}%;background:{c};"></i>' for v, c in zip(values, colors))
    a = "".join(f"<span>{l}</span>" for l in labels)
    return f'<div class="ui-bars">{b}</div><div class="ui-axis">{a}</div>'


# --------------------------------------------------------------------------
# Content
# --------------------------------------------------------------------------
FEATURES = [
    dict(
        slug="route", icon="🗺️", name="Route &amp; Days",
        title="Route &amp; Days",
        lede="The backbone of every trip. One row per stage, with everything else in the app hanging off it.",
        intro="Route &amp; Days is where a trip becomes real. Each day carries its date, title, start and "
              "end point, distance and climbing — and once a GPX is attached, its own elevation profile. "
              "Every other module references these days, so getting this right first makes the rest fall into place.",
        blocks=[
            dict(h="Two views of the same data",
                 p=["Editing a week of stages is a spreadsheet job, so the grid behaves like one: click any "
                    "cell, type, and Tab or arrow-key to the next. Changes save when you leave a cell — there "
                    "is no save button to forget.",
                    "Reading it on a phone at a bunkhouse is a different job entirely. Card view gives each "
                    "day an expandable summary with everything attached to it: sights, the stay, breakfast, "
                    "the map and the GPX download. Cards are the default; the toggle is remembered per trip."],
                 li=["<strong>Keyboard navigation</strong> — Tab, Enter and arrow keys move between cells.",
                     "<strong>Autosave on blur</strong>, with a one-step undo on Ctrl/Cmd+Z.",
                     "<strong>Card view</strong> built for a phone, with everything for that day in one place."],
                 media=ui("Route &amp; Days — grid",
                          '<table style="width:100%;border-collapse:collapse;font-size:11.5px;">'
                          '<tr style="background:var(--bg-recessed);color:var(--text-tertiary);font-size:9px;'
                          'text-transform:uppercase;letter-spacing:.05em;">'
                          '<th style="padding:7px 8px;text-align:left;">Date</th>'
                          '<th style="padding:7px 8px;text-align:left;">Title</th>'
                          '<th style="padding:7px 8px;text-align:left;">km</th>'
                          '<th style="padding:7px 8px;text-align:left;">Ascent</th></tr>'
                          '<tr style="border-top:1px solid var(--border-hairline);"><td class="mono" style="padding:8px;">16 Aug</td><td style="padding:8px;">Edinburgh → Fort Augustus</td><td class="mono" style="padding:8px;">56.9</td><td class="mono" style="padding:8px;">585</td></tr>'
                          '<tr style="border-top:1px solid var(--border-hairline);background:var(--accent-subtle);"><td class="mono" style="padding:8px;">17 Aug</td><td style="padding:8px;">Fort Augustus → Ratagan</td><td class="mono" style="padding:8px;">85.9</td><td class="mono" style="padding:8px;">1161</td></tr>'
                          '<tr style="border-top:1px solid var(--border-hairline);"><td class="mono" style="padding:8px;">18 Aug</td><td style="padding:8px;">Ratagan → Achnasheen</td><td class="mono" style="padding:8px;">88</td><td class="mono" style="padding:8px;">1160</td></tr>'
                          '</table>')),
            dict(h="Fields that match the trip",
                 p=["A campervan trip does not need a climbing column, and a paddling trip does not have a "
                    "road surface. The activity type you pick decides which columns exist and what they are "
                    "called, so the grid never shows you a field that makes no sense for your trip.",
                    "It also decides how pace is modelled — cycling speeds are set per surface, hiking uses a "
                    "climbing rate in the spirit of Naismith's rule, and public-transport trips switch pace "
                    "estimates off entirely."],
                 li=["<strong>Cycling</strong> — distance, ascent, surface.",
                     "<strong>Hiking</strong> — distance, ascent, terrain.",
                     "<strong>Driving and campervan</strong> — distance only, no ascent column.",
                     "<strong>Kayaking</strong> — distance and water conditions.",
                     "<strong>Public transport</strong> — distance optional, pace off.",
                     "<strong>Mixed</strong> — segment types for trips that do several."],
                 media=ui("Day detail",
                          '<div class="ui-t" style="margin-bottom:8px;">Day 4 · Ratagan → Achnasheen</div>'
                          + stats(("88", "km"), ("+1160", "m"), ("18.0", "km/h avg"), ("8.9h", "est. total")) +
                          '<div style="font-size:11.5px;color:var(--text-secondary);border-top:1px solid var(--border-hairline);padding-top:8px;">'
                          '🍳 <strong style="color:var(--text-primary);">Breakfast</strong> — Self-catered, 7 GBP pp</div>'
                          '<div style="font-size:11.5px;color:var(--text-secondary);margin-top:5px;">'
                          '🏰 <strong style="color:var(--text-primary);">Sights</strong> — Eilean Donan · Plockton · Torridon</div>'
                          '<div style="font-size:11.5px;color:var(--text-secondary);margin-top:5px;">'
                          '🏠 <strong style="color:var(--text-primary);">Stay</strong> — Ledgowan Bunkhouse</div>')),
            dict(h="Maps and tracks",
                 p=["Attach a GPX per day and two things appear on their own: that day's elevation profile, "
                    "and the day's track on the whole-trip map, drawn in its own colour alongside every other "
                    "stage. You can also paste a Komoot, RideWithGPS or Google Maps link to embed the route "
                    "view directly in the day card.",
                    "Tracks are downloadable per day from the card, which is how most people get them onto a "
                    "head unit or phone before setting off."],
                 li=["<strong>Upload GPX per day</strong>, stored and served over a stable URL.",
                     "<strong>Whole-trip map</strong> with one colour per stage and a legend.",
                     "<strong>Map embeds</strong> from the usual route planners.",
                     "<strong>Download buttons</strong> on every day card."],
                 media=ui("Whole-trip map",
                          '<svg viewBox="0 0 400 150" style="width:100%;display:block;background:var(--bg-recessed);border-radius:8px;">'
                          '<path d="M40,120 C90,110 110,70 150,66" fill="none" stroke="#2E5339" stroke-width="3"/>'
                          '<path d="M150,66 C190,62 200,96 240,90" fill="none" stroke="#C1602E" stroke-width="3"/>'
                          '<path d="M240,90 C280,84 290,44 330,40" fill="none" stroke="#35637F" stroke-width="3"/>'
                          '<path d="M330,40 C355,37 360,60 372,72" fill="none" stroke="#7B4B94" stroke-width="3"/>'
                          '<circle cx="40" cy="120" r="4" fill="#2E5339"/><circle cx="372" cy="72" r="4" fill="#7B4B94"/>'
                          '</svg>'
                          '<div class="maplegend" style="margin-top:8px;">'
                          '<span class="lg"><span class="sw" style="background:#2E5339;"></span>Day 2</span>'
                          '<span class="lg"><span class="sw" style="background:#C1602E;"></span>Day 3</span>'
                          '<span class="lg"><span class="sw" style="background:#35637F;"></span>Day 4</span>'
                          '<span class="lg"><span class="sw" style="background:#7B4B94;"></span>Day 5</span></div>')),
            dict(h="The long tail, out of the way",
                 p=["Not everything belongs in a grid cell. Opening a day gives you a detail panel for the "
                    "things you write once and read later: a description, free notes, the map and GPX links, "
                    "a planned start time and a target finish time.",
                    "Those two times matter more than they look. Together they define the stage window, which "
                    "is what turns a vague plan into a required pace on the Statistics and Today screens."],
                 li=["<strong>Description and notes</strong> per day.",
                     "<strong>Planned start and target finish</strong>, which unlock required-pace figures.",
                     "<strong>Rest days</strong> that drop out of effort and pace maths.",
                     "<strong>Field locking</strong> so an import cannot overwrite what you wrote."],
                 media=None),
        ],
        limits=["Splitting one multi-day GPX relies on track segments. A file recorded as a single "
                "continuous segment divides distance evenly rather than detecting real stage boundaries.",
                "Distances come from the file or from what you type. Trip Tracker does not route between "
                "points for you — it is a planner, not a route builder.",
                "Elevation totals are computed with smoothing, so they will differ by a few percent from "
                "whatever your route planner reported."],
        related=["today", "statistics", "sights"],
    ),

    dict(
        slug="today", icon="🎯", name="Today",
        title="Today",
        lede="The screen you actually use while moving. One stage, what is left of it, and whether you are going to make it.",
        intro="Everything else in Trip Tracker is about planning. Today is about the next few hours. It shows "
              "the stage you are on, how much of it you have done, what is still ahead, and the pace you need "
              "to hold to arrive on time — recalculated from the real clock every time you open it.",
        blocks=[
            dict(h="Log progress in two taps",
                 p=["Type the kilometres you have ridden, or tap +10 and +25 when you cannot be bothered. "
                    "The progress bar, the remaining distance and every pace figure update together.",
                    "The same number also feeds the public page your family is watching, so one update "
                    "covers both audiences. There is no separate 'post an update' step to remember."],
                 li=["<strong>Riders can log too</strong>, not just the organiser.",
                     "<strong>Quick-add buttons</strong> for when you are wearing gloves.",
                     "<strong>Feeds the live page</strong> automatically."],
                 media=ui("Today — progress",
                          '<div><span class="mono" style="font-size:21px;font-weight:700;">48.0</span>'
                          '<span class="ui-m"> / 88 km · 40 km left</span></div>'
                          '<div style="height:8px;background:var(--bg-recessed);border-radius:4px;overflow:hidden;margin:9px 0 12px;">'
                          '<div style="width:55%;height:100%;background:var(--accent);"></div></div>'
                          '<div style="display:flex;gap:7px;flex-wrap:wrap;">'
                          '<span style="padding:7px 11px;border:1px solid var(--border-strong);border-radius:7px;font-size:11.5px;">km done</span>'
                          '<span style="padding:7px 11px;background:var(--accent);color:var(--text-on-accent);border-radius:7px;font-size:11.5px;font-weight:600;">Update</span>'
                          '<span style="padding:7px 11px;border:1px solid var(--border-strong);border-radius:7px;font-size:11.5px;">+10</span>'
                          '<span style="padding:7px 11px;border:1px solid var(--border-strong);border-radius:7px;font-size:11.5px;">+25</span></div>')),
            dict(h="Pace that knows what time it is",
                 p=["Planned pace is useful before you leave. Mid-stage it is nearly useless — what you want "
                    "to know is how fast you need to go <em>from here</em> to reach the bed before the kitchen "
                    "closes, or the station before the last train.",
                    "If the day has a target finish time, Today divides the distance you have left by the "
                    "hours you have left and colours the answer: green if it is relaxed, amber if you should "
                    "stop dawdling, red if you are going to have to push. Once the target time has passed it "
                    "says so plainly rather than showing an impossible number."],
                 li=["<strong>Required pace from now</strong>, not from the planned start.",
                     "<strong>Colour-banded</strong> so you can read it at a glance.",
                     "<strong>Climbing still ahead</strong>, taken from the elevation profile at your position.",
                     "<strong>Honest when you are late</strong> rather than optimistic."],
                 media=ui("Today — pace",
                          facts(("Req. overall", "8.8 km/h"), ("Finish by 18:00", "14.2 km/h"), ("Climb ahead", "612 m")) +
                          '<div class="ui-m" style="margin-top:10px;">Amber: faster than planned, still doable.</div>')),
            dict(h="What to remember about this day",
                 p=["The rest of Today is the stuff you would otherwise be scrolling three tabs to find: the "
                    "food, resupply and water points for this stage with their opening hours, today's transport "
                    "legs, tonight's bed, and tomorrow's outline.",
                    "Breakfast is attached to the stay you slept at, not the one you are heading for, so it "
                    "appears on the morning you actually eat it."],
                 li=["<strong>Food, resupply and water</strong> with hours and links.",
                     "<strong>Today's transport</strong>, so you do not miss the ferry.",
                     "<strong>Tonight's stay</strong> with map, phone and check-in detail.",
                     "<strong>Tomorrow at a glance</strong>, so nothing is a surprise."],
                 media=ui("Today — resupply",
                          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary);margin-bottom:8px;">🛒 Resupply / water</div>'
                          '<div style="display:flex;gap:8px;padding:7px 0;border-top:1px solid var(--border-hairline);">'
                          '<span>🛒</span><div><div style="font-weight:600;font-size:12.5px;">Co-op Fort Augustus</div>'
                          '<div class="ui-m" style="font-size:11px;">🕐 07:00–22:00 · last shop for 60 km</div></div></div>'
                          '<div style="display:flex;gap:8px;padding:7px 0;border-top:1px solid var(--border-hairline);">'
                          '<span>💧</span><div><div style="font-weight:600;font-size:12.5px;">Loch Maree layby tap</div>'
                          '<div class="ui-m" style="font-size:11px;">🕐 Always open</div></div></div>')),
        ],
        limits=["Today is chosen by comparing your device's date to the day's date. A trip crossing many "
                "time zones may show the neighbouring stage until local midnight catches up.",
                "Progress is entered by hand. Trip Tracker does not read your GPS — connect a Garmin or Wahoo "
                "share link if you want automatic tracking.",
                "Live pace needs a target finish time on the day. Without one you still get the planned "
                "estimate, but not the from-here figure."],
        related=["route", "statistics", "live"],
    ),

    dict(
        slug="statistics", icon="📊", name="Statistics",
        title="Statistics",
        lede="Which day is going to hurt, and whether the pace you have assumed is realistic.",
        intro="Statistics turns the plan into numbers you can compare. Every active day gets a difficulty "
              "score, and the charts show distance, climbing and required pace side by side so an "
              "unreasonable stage stands out before you are standing at the bottom of it.",
        blocks=[
            dict(h="One number per day",
                 p=["Distance alone does not tell you much — 90 flat kilometres and 90 kilometres with 1,500 "
                    "metres of climbing are different days. The difficulty score combines both into a single "
                    "0–10 figure, so stages are comparable at a glance.",
                    "The formula is deliberately simple and published rather than hidden: distance in "
                    "kilometres plus climbing in metres divided by 100, all divided by 12, capped at 10. "
                    "A 90 km day with 900 m of climbing scores 8.3 — hard."],
                 li=["<strong>Under 3</strong> — very easy.",
                     "<strong>3 to 5</strong> — easy.",
                     "<strong>5 to 7</strong> — moderate.",
                     "<strong>7 to 8.5</strong> — hard.",
                     "<strong>8.5 to 9.5</strong> — very hard.",
                     "<strong>Above 9.5</strong> — extreme."],
                 media=ui("Stage difficulty",
                          bars([46, 78, 76, 84, 66, 58], ["16 Aug", "17", "18", "19", "20", "21"],
                               ["var(--info)", "var(--warning)", "var(--warning)", "var(--danger)", "var(--info)", "var(--accent)"]) +
                          '<div class="ui-m" style="margin-top:9px;text-align:center;">5.5 · 8.0 · 8.3 · 9.1 · 7.2 · 6.0</div>')),
            dict(h="Required pace, not hoped-for pace",
                 p=["Give a day a start time and a target finish and Statistics can answer the question that "
                    "actually matters: how fast do you have to move to make that window?",
                    "It reports two figures. <em>Moving</em> pace excludes your daily overhead — the cafe "
                    "stops, the punctures, the photographs. <em>Overall</em> pace includes it, which makes it "
                    "the number to check your watch against mid-ride. If overall pace looks fine but moving "
                    "pace looks brutal, your overhead assumption is the problem, not your legs."],
                 li=["<strong>Both figures per day</strong>, colour-banded by how demanding they are.",
                     "<strong>Based on your own assumptions</strong>, editable in trip settings.",
                     "<strong>Hidden until you set the times</strong>, rather than showing a made-up number."],
                 media=ui("Required overall pace",
                          bars([44, 62, 68, 80, 58, 72], ["16 Aug", "17", "18", "19", "20", "21"],
                               ["var(--accent)", "var(--info)", "var(--info)", "var(--warning)", "var(--accent)", "var(--info)"]) +
                          '<div class="ui-m" style="margin-top:9px;text-align:center;">Under 8 relaxed · 8–10 solid · 10–12 watch the clock · 12+ risk of running late</div>')),
            dict(h="Elevation you can actually read",
                 p=["Profiles are drawn from the real GPX track, smoothed to remove barometric noise, and "
                    "shown either per day or as one continuous profile across the whole trip with cumulative "
                    "distance along the bottom.",
                    "The whole-trip view is the one people find most useful when deciding whether a plan is "
                    "sane — it makes an unbroken week of climbing obvious in a way a table of totals never does."],
                 li=["<strong>Per day or whole trip</strong>, switchable.",
                     "<strong>Real track data</strong>, not an approximation from totals.",
                     "<strong>Min and max altitude</strong> alongside total climbing."],
                 media=ui("Elevation — whole trip",
                          '<svg viewBox="0 0 400 120" style="width:100%;display:block;">'
                          '<line x1="30" y1="28" x2="392" y2="28" stroke="var(--border-hairline)"/>'
                          '<line x1="30" y1="62" x2="392" y2="62" stroke="var(--border-hairline)"/>'
                          '<line x1="30" y1="96" x2="392" y2="96" stroke="var(--border-hairline)"/>'
                          '<text x="25" y="31" text-anchor="end" font-size="8" fill="var(--text-tertiary)">550</text>'
                          '<text x="25" y="65" text-anchor="end" font-size="8" fill="var(--text-tertiary)">280</text>'
                          '<text x="25" y="99" text-anchor="end" font-size="8" fill="var(--text-tertiary)">10</text>'
                          '<path fill="var(--accent)" opacity=".18" d="M30,94 L62,84 L92,60 L122,74 L154,38 L186,58 L216,32 L248,54 L278,40 L310,76 L342,58 L372,88 L392,82 L392,108 L30,108 Z"/>'
                          '<path fill="none" stroke="var(--accent)" stroke-width="2" d="M30,94 L62,84 L92,60 L122,74 L154,38 L186,58 L216,32 L248,54 L278,40 L310,76 L342,58 L372,88 L392,82"/>'
                          '</svg>'
                          '<div class="ui-m" style="text-align:center;margin-top:6px;">514 km · +6156 m · 10–550 m</div>')),
        ],
        limits=["The difficulty score does not know about wind, heat, road surface or how loaded your bike is. "
                "It compares your days to each other, not to somebody else's trip.",
                "Pace assumptions are yours to set. The defaults are reference values, not measurements of you.",
                "Required-pace charts stay hidden until a day has both a start and a target finish time."],
        related=["route", "today", "live"],
    ),

    dict(
        slug="logistics", icon="✈️", name="Logistics",
        title="Logistics",
        lede="Flights, trains, ferries, transfers and bike boxes — everything that moves you or your gear.",
        intro="Logistics covers the parts of a trip that are not the route itself: getting there, getting "
              "back, and any mid-trip hop between two stages. Each leg holds the detail you need at a gate or "
              "a platform, and reads as a boarding pass rather than a spreadsheet row.",
        blocks=[
            dict(h="Ten kinds of leg, anchored anywhere",
                 p=["A leg can sit at the start of the trip, at the end, or on a specific day — which is what "
                    "you want for a mid-week train between two stages, or a ferry you catch on the morning of "
                    "day four.",
                    "The type changes the icon and how it reads, but every type carries the same fields, so "
                    "there is no awkward gap when your bike box hire does not fit the shape of a flight."],
                 li=["<strong>Types</strong> — flight, train, bus, ferry, boat, car, campervan, transfer, bike shipping, other.",
                     "<strong>Anchors</strong> — trip start, trip end, or any day.",
                     "<strong>Full detail</strong> — carrier, reference, seats, places, real departure and arrival times, cost and notes."],
                 media=ui("Logistics",
                          row(None, "Ryanair FR 1801", "Gdansk (GDN) 19:25 → Edinburgh (EDI) 20:55", "Trip start", "pill-green") +
                          row(None, "ScotRail", "Waverley 10:33 → Inverness 14:16 · Coach B", "Day 2") +
                          row(None, "City Bike Store", "3 hard cases hired · 60 GBP", "Trip start"))),
            dict(h="Reads like a ticket",
                 p=["Riders and viewers see a boarding-pass layout: big departure and arrival times, the route "
                    "between them with the journey duration, and the reference, seats and cost as labelled "
                    "facts underneath. An arrival that lands on the next calendar day is flagged, because that "
                    "is exactly the detail people misread at 6am.",
                    "Organisers get an edit toggle on the same page. The dense form is faster to fill in, so "
                    "it is still there — it is just no longer what everyone else has to look at."],
                 li=["<strong>Card view by default</strong> for everyone.",
                     "<strong>Edit form on a toggle</strong>, remembered per tab.",
                     "<strong>Overnight arrivals flagged</strong> so nobody books the wrong day."],
                 media=ui("Logistics — leg detail",
                          '<div style="display:flex;align-items:center;gap:12px;">'
                          '<div><div class="mono" style="font-size:19px;font-weight:700;">10:33</div>'
                          '<div class="ui-m">Edinburgh Waverley</div></div>'
                          '<div style="flex:1;text-align:center;"><div class="ui-m" style="margin-bottom:4px;">3h 43m</div>'
                          '<div style="height:2px;border-radius:2px;background:linear-gradient(to right,var(--accent-subtle-border),var(--accent));"></div></div>'
                          '<div style="text-align:right;"><div class="mono" style="font-size:19px;font-weight:700;">14:16</div>'
                          '<div class="ui-m">Inverness</div></div></div>'
                          + facts(("Reference", "DEMO-RAIL-2201"), ("Seats", "Coach B, 41–43"), ("Cost", "72 GBP")))),
            dict(h="Filled in by forwarding an email",
                 p=["Typing flight numbers off a confirmation is exactly the kind of work a computer should "
                    "do. Forward the booking to your trip's import address and the carrier, reference, times, "
                    "seats and cost come back as proposals you accept.",
                    "This is the same review queue every import goes through, so a misread never lands "
                    "silently in your plan."],
                 li=["<strong>Email, paste or PDF.</strong>",
                     "<strong>Every field reviewed</strong> before it is written.",
                     "<strong>Adding by hand</strong> uses a proper form, not a blank row at the bottom of a list."],
                 media=None),
        ],
        limits=["Times are stored as real timestamps but shown in your browser's zone. A flight that crosses "
                "zones shows local-to-you times rather than local-to-airport.",
                "There is no live flight- or train-status integration. Trip Tracker records what you booked, "
                "it does not tell you the 08:15 is delayed.",
                "Seat numbers are one free-text field per leg, not a seat per person."],
        related=["imports", "accommodation", "today"],
    ),

    dict(
        slug="accommodation", icon="🏠", name="Accommodation",
        title="Accommodation",
        lede="Where you sleep, and the details you need at 7pm and again at 7am.",
        intro="A stay is more than a name and a date. Accommodation holds the room type, the cost and whether "
              "it is paid, the cancellation terms, the phone number, the map link and what breakfast looks "
              "like — and surfaces each of those where it is actually useful.",
        blocks=[
            dict(h="Everything about one night",
                 p=["Each stay links to a day, or stays unlinked if it covers several nights. Pay status is "
                    "a visible badge rather than something buried in a note, because 'did we actually pay for "
                    "this one?' is the question that comes up most.",
                    "Room type was added because 'Ledgowan Bunkhouse' does not tell you whether you booked "
                    "three beds in a shared dorm or two private twins — and that changes what you pack."],
                 li=["<strong>Room type</strong>, address, phone and map link.",
                     "<strong>Pay status</strong> — unpaid, partial, paid or free.",
                     "<strong>Cost and booking reference</strong> kept with the stay.",
                     "<strong>Cancellation policy</strong>, so you know the deadline before it passes.",
                     "<strong>Multi-night stays</strong> can stay unlinked from any one day."],
                 media=ui("Accommodation",
                          '<div style="display:flex;gap:7px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">'
                          '<span style="font-size:15px;">🏠</span><span class="ui-pill pill-gray">Day 4</span>'
                          '<span class="ui-pill pill-green">paid</span></div>'
                          '<div style="font-weight:700;font-size:14px;">Ledgowan Bunkhouse</div>'
                          '<div style="font-size:12px;color:var(--accent-2);font-weight:600;margin-top:2px;">🛏️ Bunkhouse — 3 beds</div>'
                          '<div style="margin-top:11px;padding-top:9px;border-top:1px solid var(--border-hairline);font-size:12px;color:var(--text-secondary);">'
                          '🍳 <strong style="color:var(--text-primary);">Breakfast</strong> — Self-catered, 7 GBP per person</div>'
                          '<div style="font-size:12px;color:var(--text-secondary);margin-top:6px;">⚠️ <strong style="color:var(--text-primary);">Cancellation</strong> — none possible</div>'
                          + facts(("Reference", "DEMO-8F0406"), ("Cost", "150 GBP")))),
            dict(h="Breakfast on the right morning",
                 p=["You arrive at a lodge on day two and eat its breakfast on day three. So it is "
                    "stored on the stay, where you book it, and shown on the morning after, labelled "
                    "with which stay it came from."],
                 li=[],
                 media=None),
        ],
        limits=["One stay links to at most one day. A five-night base is modelled as an unlinked stay rather "
                "than repeating across five days.",
                "Costs are per stay, not per person — split them in Expenses if you need per-head figures.",
                "There is no availability or booking integration. Trip Tracker records what you booked elsewhere."],
        related=["route", "expenses", "imports"],
    ),

    dict(
        slug="sights", icon="🏰", name="Sights &amp; Resupply",
        title="Sights &amp; Resupply",
        lede="Castles worth the detour, the last shop for sixty kilometres, and the pub that stops serving at nine.",
        intro="Points of interest are the difference between a route and a trip. Each one belongs to a day, "
              "carries a category, and can hold opening hours and a link — because a shop that is closed when "
              "you reach it is not a resupply.",
        blocks=[
            dict(h="Five categories, grouped when you read them",
                 p=["Sights, food, resupply, water and other. When editing they are a flat list you can "
                    "reorder; when reading they are grouped, so the food stops are together and the water "
                    "points are together rather than interleaved in the order you happened to add them.",
                    "Opening hours are a plain text field on purpose — 'Mon–Sat 08:00–18:00, closed Sunday' "
                    "is more useful than a rigid structure that cannot express the real thing."],
                 li=["<strong>Sights</strong> — castles, viewpoints, ruins, gardens.",
                     "<strong>Food</strong> — cafes, pubs, restaurants.",
                     "<strong>Resupply</strong> — shops and supermarkets.",
                     "<strong>Water</strong> — taps and refill points.",
                     "<strong>Other</strong> — anything that does not fit."],
                 media=ui("Sights &amp; resupply — Day 4",
                          row(None, "Eilean Donan Castle", "Scotland's icon, where three sea lochs meet") +
                          row(None, "The Cluanie Inn", "🕐 12:00–21:00 · hot food and a fire") +
                          row(None, "Co-op Fort Augustus", "🕐 07:00–22:00 · last supermarket") +
                          row(None, "Loch Maree layby tap", "🕐 Always open · drinking water"))),
            dict(h="In the order you will pass them",
                 p=["Points are drag-and-drop reorderable within their day, and the order is saved as you "
                    "drop them. This matters more than it sounds: a resupply listed after the sight you reach "
                    "two hours later reads as a planning error at exactly the wrong moment.",
                    "Adding a point uses a proper form with a name, category, link and description — not the "
                    "browser prompt box this used to be."],
                 li=["<strong>Drag to reorder</strong> within a day.",
                     "<strong>Links open in a new tab</strong> from every view.",
                     "<strong>Shown on the day card and on Today</strong>, grouped by category."],
                 media=None),
        ],
        limits=["Points belong to a day, not to a position along the route, so they are ordered by hand "
                "rather than by distance from the start.",
                "There is no map pin for a point of interest yet — the whole-trip map draws tracks, not POIs.",
                "Opening hours are free text and are not checked against the date you will arrive."],
        related=["route", "today", "readiness"],
    ),

    dict(
        slug="packing", icon="🎒", name="Packing &amp; Tasks",
        title="Packing &amp; Tasks",
        lede="One multi-tool between three people, but a rain jacket each. The list knows the difference.",
        intro="Packing and tasks share the same model. Every item can be assigned to everyone or to specific "
              "people, and each person ticks only their own boxes — so a shared list stops turning into three "
              "of everything or none of the one thing that mattered.",
        blocks=[
            dict(h="Assignment is the whole point",
                 p=["Most shared checklists assume everyone needs everything, which is wrong for group trips "
                    "in both directions. You end up with three pumps and no chain tool.",
                    "An unassigned item means everyone — that is the sensible default and most items stay "
                    "that way. Assign one to a specific person and it disappears from everyone else's column, "
                    "replaced by a dash, so it is obvious it is covered and by whom."],
                 li=["<strong>Assign to everyone or specific people</strong>, per item.",
                     "<strong>You tick only your own</strong> — you cannot tick for someone else.",
                     "<strong>You can see who has not</strong>, which is the useful part before departure.",
                     "<strong>Same model for tasks</strong> — insurance, bike service, generating tracks."],
                 media=ui("Packing",
                          '<table style="width:100%;border-collapse:collapse;font-size:12px;">'
                          '<tr style="color:var(--text-tertiary);font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;">'
                          '<th style="text-align:left;padding:6px 4px;">Item</th><th style="padding:6px 4px;">Assigned</th>'
                          '<th style="padding:6px 4px;">AM</th><th style="padding:6px 4px;">SR</th><th style="padding:6px 4px;">JB</th></tr>'
                          '<tr style="border-top:1px solid var(--border-hairline);"><td style="padding:8px 4px;">Rain jacket</td>'
                          '<td style="text-align:center;"><span class="ui-pill pill-gray">All</span></td>'
                          '<td style="text-align:center;">✅</td><td style="text-align:center;">✅</td><td style="text-align:center;">☐</td></tr>'
                          '<tr style="border-top:1px solid var(--border-hairline);"><td style="padding:8px 4px;">Bike multi-tool</td>'
                          '<td style="text-align:center;"><span class="ui-pill pill-orange">SR</span></td>'
                          '<td style="text-align:center;color:var(--text-tertiary);">—</td><td style="text-align:center;">✅</td>'
                          '<td style="text-align:center;color:var(--text-tertiary);">—</td></tr>'
                          '<tr style="border-top:1px solid var(--border-hairline);"><td style="padding:8px 4px;">Mini pump</td>'
                          '<td style="text-align:center;"><span class="ui-pill pill-orange">JB</span></td>'
                          '<td style="text-align:center;color:var(--text-tertiary);">—</td>'
                          '<td style="text-align:center;color:var(--text-tertiary);">—</td><td style="text-align:center;">☐</td></tr>'
                          '</table>')),
            dict(h="Starting lists you then argue with",
                 p=["Creating a trip from a template seeds a packing list and a task list appropriate to its "
                    "length. They are a starting point, not a prescription — the point is that you edit an "
                    "existing list rather than staring at an empty one.",
                    "Duplicating a trip you run every year carries both lists over, which is usually most of "
                    "the value of duplicating at all."],
                 li=["<strong>Templates</strong> seed sensible starting lists.",
                     "<strong>Duplicating a trip</strong> carries packing and tasks across.",
                     "<strong>Anyone can be assigned</strong>, including people who are not riding."],
                 media=None),
        ],
        limits=["Items have no quantity field — 'two spare tubes' is expressed in the title.",
                "There are no categories or sections within a list yet; ordering is manual.",
                "Assignment is per item, not per day, so a list is for the whole trip."],
        related=["participants", "readiness", "expenses"],
    ),

    dict(
        slug="expenses", icon="💸", name="Expenses",
        title="Expenses",
        lede="Log what you paid and who it covered. The balances do the rest.",
        intro="Group trips generate a mess of who-paid-for-what that nobody wants to reconstruct afterwards. "
              "Expenses keeps a running balance per person, per currency, so settling up at the end is a "
              "single number each rather than an evening with a spreadsheet.",
        blocks=[
            dict(h="Split across the people it actually covered",
                 p=["Not every cost is shared by everyone. Two people hiring sleeping bags is not a "
                    "three-way split, and pretending otherwise is how these things go wrong.",
                    "Pick who paid and tick who it was for. Balances update immediately, showing who is up "
                    "and who is down."],
                 li=["<strong>Choose the participants</strong> per expense.",
                     "<strong>Anyone on the trip can log</strong> one, not just the organiser.",
                     "<strong>Running balance per person</strong>, always visible."],
                 media=ui("Expenses",
                          '<div style="padding:11px;border:1px solid var(--border-hairline);border-radius:9px;margin-bottom:11px;">'
                          '<div style="font-weight:700;font-size:12.5px;">GBP — total 414.00</div>'
                          '<div style="display:flex;gap:14px;margin-top:7px;flex-wrap:wrap;font-size:11.5px;">'
                          '<span class="muted">Alex <strong style="color:var(--success);">+96.00</strong></span>'
                          '<span class="muted">Sam <strong style="color:var(--danger);">−48.00</strong></span>'
                          '<span class="muted">Jordan <strong style="color:var(--danger);">−48.00</strong></span></div></div>'
                          + row(None, "Dinner at the Cluanie Inn", "Alex · split 3 ways")
                          + row(None, "Sleeping bag hire", "Sam · split 2 ways"))),
            dict(h="Currencies stay separate on purpose",
                 p=["A trip that spends pounds and euros gets two balances, not one converted total. "
                    "Converting means picking a rate, and picking a rate means someone is quietly "
                    "disadvantaged by a decision the app made for them.",
                    "Keeping them apart is less clever and considerably less arguable."],
                 li=["<strong>One balance per currency</strong>.",
                     "<strong>No automatic conversion</strong>, by design.",
                     "<strong>Hidden from the public page</strong> unless you deliberately show it."],
                 media=None),
        ],
        limits=["Splits are even across the selected people. There are no percentage or share-weighted splits.",
                "There is no settle-up ledger — balances tell you who owes what, but paying it back happens "
                "outside the app.",
                "Expenses are not linked to accommodation or transport costs; those are recorded separately."],
        related=["participants", "accommodation", "live"],
    ),

    dict(
        slug="live", icon="🔴", name="Live Sharing",
        title="Live Sharing",
        lede="One public link for everyone at home, and precise control over what it reveals.",
        intro="Family and friends want to follow along without installing anything or making an account. The "
              "live page is a single read-only link that shows the route, today's stage, progress, elevation "
              "profiles and photos — with every sensitive field behind its own switch.",
        blocks=[
            dict(h="Off until you turn it on",
                 p=["Nothing about your trip is public by default. Enabling sharing generates an unguessable "
                    "token; there is no directory and nothing is indexed.",
                    "If even that is too open, add a passcode and the page asks for it before showing anything."],
                 li=["<strong>Disabled by default</strong>.",
                     "<strong>Unguessable link</strong>, not a slug someone could try.",
                     "<strong>Optional passcode</strong> on top.",
                     "<strong>Revocable</strong> — turn it off and the link stops working."],
                 media=ui("Share &amp; live — visibility",
                          '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-hairline);font-size:12.5px;"><span>Show photos</span><span class="ui-pill pill-green">On</span></div>'
                          '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-hairline);font-size:12.5px;"><span>Show costs</span><span class="ui-pill pill-green">On</span></div>'
                          '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-hairline);font-size:12.5px;"><span>Show exact addresses</span><span class="ui-pill pill-gray">Off</span></div>'
                          '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-hairline);font-size:12.5px;"><span>Show phone numbers</span><span class="ui-pill pill-gray">Off</span></div>'
                          '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:12.5px;"><span>Show booking references</span><span class="ui-pill pill-gray">Off</span></div>')),
            dict(h="Field-level, not all-or-nothing",
                 p=["Sharing your route is not the same as sharing the address of the house you are sleeping "
                    "in, or what you paid for it. Each of those is a separate switch, and the public read path "
                    "enforces them server-side rather than just hiding them in the page.",
                    "That distinction matters: a hidden field is not sent to the browser at all, so it cannot "
                    "be recovered by anyone poking at the page."],
                 li=["<strong>Exact addresses</strong> — separate switch.",
                     "<strong>Costs and expense balances</strong> — separate switch.",
                     "<strong>Phone numbers</strong> — separate switch.",
                     "<strong>Booking references</strong> — separate switch.",
                     "<strong>Enforced server-side</strong>, not hidden client-side."],
                 media=None),
            dict(h="What followers actually see",
                 p=["A trip header with total progress, a highlighted card for today's stage, the full day "
                    "list, elevation profiles they can switch between, any tracking links you have added, and "
                    "the photo gallery.",
                    "Progress updates as riders log kilometres, so the page is genuinely live rather than a "
                    "static itinerary."],
                 li=["<strong>Today's stage</strong> highlighted with distance, climbing and tonight's stay.",
                     "<strong>Elevation profiles</strong>, whole trip or per day, with a progress marker.",
                     "<strong>Photo gallery</strong> with a lightbox.",
                     "<strong>Tracking links</strong> from Garmin, Wahoo and similar."],
                 media=None),
        ],
        limits=["The page shows the stage matching the viewer's own local date; a follower in a very "
                "different time zone may see the neighbouring day around midnight.",
                "There is no live GPS position unless you add an external tracking link.",
                "Followers cannot comment or react — it is deliberately one-way."],
        related=["today", "participants", "statistics"],
    ),

    dict(
        slug="imports", icon="📥", name="Imports",
        title="Imports",
        lede="Forward a confirmation instead of retyping it. Nothing is written until you accept it.",
        intro="Imports is the part that saves the most tedious hour of planning. Every trip gets its own "
              "email address; forward a booking to it and the details come back as reviewable proposals. "
              "Routes come in the same way, from GPX or a spreadsheet.",
        blocks=[
            dict(h="Three ways in",
                 p=["Forward the email, paste the text, or upload the PDF. All three land in the same review "
                    "queue, so it makes no difference which is convenient at the time.",
                    "It is not a per-provider integration — it reads the text of the confirmation, which "
                    "means unusual operators generally work too. Tested against real ScotRail and Booking.com "
                    "confirmations."],
                 li=["<strong>Email</strong> to your trip's own address.",
                     "<strong>Paste</strong> the text of a confirmation.",
                     "<strong>Upload</strong> a PDF.",
                     "<strong>Routes</strong> from GPX, CSV or XLSX."],
                 media=ui("Imports",
                          '<div style="padding:11px 13px;border-radius:9px;background:var(--accent-subtle);border:1px solid var(--accent-subtle-border);margin-bottom:11px;">'
                          '<div class="ui-m" style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;">Forward bookings to</div>'
                          '<div class="mono" style="font-size:11.5px;font-weight:600;margin-top:3px;word-break:break-all;">trip-a1b2c3…@triptracker.cc</div></div>'
                          + row(None, "ScotRail confirmation", "17 proposals · 2 min ago", "Review", "pill-orange")
                          + row(None, "Booking.com — Dunroamin", "9 proposals · accepted", "Done", "pill-green"))),
            dict(h="A review queue, not an auto-writer",
                 p=["Every extracted field is a separate proposal showing the current value and the suggested "
                    "one. You accept the good ones and reject the rest. Nothing reaches your trip without that "
                    "step.",
                    "This is the design decision that makes automated extraction safe to use at all. A "
                    "confident wrong answer is the failure mode of every system like this, and the only real "
                    "defence is that a human sees it first."],
                 li=["<strong>Field-by-field</strong>, not all-or-nothing.",
                     "<strong>Shows current versus proposed</strong> so you can judge.",
                     "<strong>Locked fields</strong> can never be overwritten, only flagged as conflicting.",
                     "<strong>Rejections are discarded</strong> and leave no trace on the trip."],
                 media=ui("Review queue",
                          row(None, "Departure time", "— → 10:33, 16 Aug", "Accept", "pill-green") +
                          row(None, "Reference", "— → DEMO-RAIL-2201", "Accept", "pill-green") +
                          row(None, "Seat number", "— → Coach B, 41–43", "Accept", "pill-green"))),
        ],
        limits=["Extraction quality depends on the confirmation. Sparse or unusual formats produce fewer "
                "proposals rather than wrong ones, but you should still read them.",
                "One multi-day GPX is split by track segment; a single-segment file divides distance evenly "
                "rather than finding real stage boundaries.",
                "Spreadsheet import expects one row per day with recognisable column names."],
        related=["logistics", "accommodation", "route"],
    ),

    dict(
        slug="participants", icon="👥", name="Participants",
        title="Participants",
        lede="Four roles, invite links, and a way to check what your group sees before you send it.",
        intro="A trip has an organiser, some people riding it, and usually a few following from home. "
              "Participants gives each of them exactly the access their part needs, without a permissions "
              "matrix nobody wants to configure.",
        blocks=[
            dict(h="Roles that map to real people",
                 p=["Owner and editor change the plan. Riders are on the trip: they tick their own packing "
                    "and tasks, log progress and expenses, and post photos, but cannot rewrite the route. "
                    "Viewers read — a partner at home who wants the detail without edit rights.",
                    "The distinction between a rider and a viewer also drives the maths: viewers are excluded "
                    "from expense splits and from per-person checklists."],
                 li=["<strong>Owner</strong> — everything, including settings, sharing and deletion.",
                     "<strong>Editor</strong> — change the plan.",
                     "<strong>Rider</strong> — own checkboxes, progress, expenses, photos.",
                     "<strong>Viewer</strong> — read only."],
                 media=ui("Participants",
                          row("AM", "Alex Morgan", "On the trip", "Owner", "pill-green") +
                          row("SR", "Sam Rivera", "On the trip", "Rider") +
                          row("JB", "Jordan Blake", "On the trip", "Rider") +
                          row("CD", "Casey Doyle", "Following from home", "Viewer"))),
            dict(h="Preview as a participant",
                 p=["Knowing what your group will see normally means creating a second account and inviting "
                    "yourself. Instead there is a toggle that re-renders the entire app read-only, exactly as "
                    "a rider or viewer gets it.",
                    "It is a view-only lens over the interface, not a security boundary — the database still "
                    "enforces the real permissions underneath. It exists so you can check the experience "
                    "before you send the invite."],
                 li=["<strong>One click</strong> from the sidebar.",
                     "<strong>Every tab</strong>, not just one screen.",
                     "<strong>Clearly banded</strong> so you never forget you are in it."],
                 media=None),
        ],
        limits=["Invitations are by link. There is no email invitation sent from the app yet.",
                "Roles are per trip, so someone can be an editor on one and a viewer on another.",
                "Preview-as-participant hides editing UI; it does not simulate a different person's checkboxes."],
        related=["packing", "expenses", "live"],
    ),

    dict(
        slug="readiness", icon="☑️", name="Readiness",
        title="Readiness",
        lede="What is still missing, a week before you leave.",
        intro="Readiness is a standing check across the whole trip. It looks for the gaps that matter — a "
              "night with no bed, a long stage with no shop — and reports them as warnings you can act on or "
              "dismiss. It never blocks anything.",
        blocks=[
            dict(h="Warnings, never blockers",
                 p=["Plenty of trips deliberately have a night with no accommodation, because you are camping "
                    "or because you have not decided yet. A tool that refuses to let you continue is wrong "
                    "about your trip more often than it is right.",
                    "So Readiness tells you what looks unfinished, shows a completion percentage, and lets "
                    "you dismiss any check that does not apply."],
                 li=["<strong>Nights with no accommodation</strong> that are not rest days.",
                     "<strong>Long stages with no resupply or water</strong> point.",
                     "<strong>Stays marked booked</strong> with no reference or confirmation link.",
                     "<strong>Riders with no tracking link</strong>, if you are sharing live.",
                     "<strong>Dismiss anything</strong> that does not apply."],
                 media=ui("Readiness — 88%",
                          '<div style="display:flex;gap:9px;padding:11px 13px;border-radius:9px;background:var(--accent-subtle);border:1px solid var(--accent-subtle-border);margin-bottom:8px;">'
                          '<span>✓</span><div><div style="font-weight:600;font-size:12.5px;">Every night has a bed</div>'
                          '<div class="ui-m" style="font-size:11px;">All clear</div></div></div>'
                          '<div style="display:flex;gap:9px;padding:11px 13px;border-radius:9px;background:var(--accent-2-subtle);border:1px solid var(--accent-2);">'
                          '<span>⚠</span><div><div style="font-weight:600;font-size:12.5px;">Long days with no resupply</div>'
                          '<div class="ui-m" style="font-size:11px;">Day 5, Day 6</div></div></div>')),
        ],
        limits=["The completion percentage counts days with accommodation, so a camping trip will always "
                "read low unless those days are marked as rest days.",
                "The long-stage threshold is fixed at 60 km and is not yet configurable per activity type.",
                "Dismissals are stored in your browser, so they do not follow you to another device."],
        related=["route", "accommodation", "sights"],
    ),

    dict(
        slug="weather", icon="🌤️", name="Weather",
        title="Weather",
        lede="An hourly meteogram for the end of every stage, not one forecast for the whole trip.",
        intro="A forecast for &quot;Scotland&quot; is useless when your week crosses four valleys and a coast. "
              "Weather gives each day its own hourly chart, for the point where that stage actually ends — "
              "which is where you will be standing when the rain arrives.",
        blocks=[
            dict(h="It already knows where you will be",
                 p=["Most planners make you type coordinates. Trip Tracker takes them from the end of the "
                    "day&#39;s GPX track, because that is the overnight stop, and caches the result on the day "
                    "so it is only worked out once.",
                    "Days without a track can have coordinates set by hand, and any day&#39;s point can be "
                    "overridden if you would rather forecast for a summit than a bunkhouse."],
                 li=["<strong>Derived from your GPX</strong> — no coordinates to look up.",
                     "<strong>Per day</strong>, so a week-long trip gets a week of different forecasts.",
                     "<strong>Editable</strong> when a track is missing or the wrong point is picked."],
                 media=ui("Weather — day picker",
                          '<div style="display:flex;gap:6px;overflow:hidden;">'
                          '<div style="flex:none;padding:7px 13px;border-radius:10px;border:1px solid var(--border-hairline);text-align:center;">'
                          '<div style="font-size:13px;font-weight:600;">Day 3</div><div style="font-size:10.5px;color:var(--text-tertiary);">17 Aug</div></div>'
                          '<div style="flex:none;padding:7px 13px;border-radius:10px;border:1px solid var(--accent-subtle-border);background:var(--accent-subtle);text-align:center;">'
                          '<div style="font-size:13px;font-weight:600;">Day 4</div><div style="font-size:10.5px;color:var(--text-tertiary);">18 Aug</div></div>'
                          '<div style="flex:none;padding:7px 13px;border-radius:10px;border:1px solid var(--border-hairline);text-align:center;">'
                          '<div style="font-size:13px;font-weight:600;">Day 5</div><div style="font-size:10.5px;color:var(--text-tertiary);">19 Aug</div></div>'
                          '<div style="flex:none;padding:7px 13px;border-radius:10px;border:1px solid var(--border-hairline);text-align:center;">'
                          '<div style="font-size:13px;font-weight:600;">Day 6</div><div style="font-size:10.5px;color:var(--text-tertiary);">20 Aug</div></div></div>'
                          '<div class="ui-m" style="margin-top:10px;">57.574, -5.081 (from GPX) · Achnasheen</div>')),
            dict(h="A meteogram, not an emoji",
                 p=["A sun icon and one temperature tells you nothing about whether to start at six or wait "
                    "until nine. The chart stacks the things that change that decision across 48 hours: "
                    "temperature with feels-like and dew point, precipitation with probability, wind with "
                    "gusts and direction, and cloud cover split into low, mid and high.",
                    "Night hours are shaded, days are separated, and the summary above gives the range, "
                    "total rainfall, peak gust and daylight hours for the stage itself."],
                 li=["<strong>48 hours</strong> at a time, pageable through 16 days.",
                     "<strong>Temperature, feels-like and dew point</strong> on one axis.",
                     "<strong>Rain in mm plus probability</strong>, so drizzle and a downpour look different.",
                     "<strong>Wind and gusts</strong> with direction arrows every three hours.",
                     "<strong>Cloud in three layers</strong> — high cloud and hill fog are not the same problem.",
                     "<strong>Sunrise and sunset</strong>, which is what really limits a long day."],
                 media=ui("Weather — Day 4, Achnasheen",
                          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px;">'
                          '<div class="ui-stat"><b>12–14°</b><span>Temp</span></div>'
                          '<div class="ui-stat"><b>7.5 mm</b><span>Rain</span></div>'
                          '<div class="ui-stat"><b>32</b><span>Max gust</span></div>'
                          '<div class="ui-stat"><b>05:52</b><span>Sunrise</span></div></div>'
                          '<svg viewBox="0 0 400 120" style="width:100%;display:block;">'
                          '<rect x="0" y="0" width="70" height="120" fill="var(--bg-recessed)" opacity=".7"/>'
                          '<rect x="300" y="0" width="100" height="120" fill="var(--bg-recessed)" opacity=".7"/>'
                          '<line x1="0" y1="30" x2="400" y2="30" stroke="var(--border-hairline)"/>'
                          '<line x1="0" y1="60" x2="400" y2="60" stroke="var(--border-hairline)"/>'
                          '<path d="M0,58 L50,52 L100,40 L150,34 L200,32 L250,38 L300,48 L350,56 L400,60" fill="none" stroke="var(--accent)" stroke-width="2.2"/>'
                          '<path d="M0,66 L50,60 L100,50 L150,44 L200,42 L250,48 L300,58 L350,64 L400,68" fill="none" stroke="var(--accent-2)" stroke-width="1.5" opacity=".8"/>'
                          '<rect x="196" y="84" width="10" height="30" rx="2" fill="var(--info)" opacity=".8"/>'
                          '<rect x="210" y="76" width="10" height="38" rx="2" fill="var(--info)" opacity=".8"/>'
                          '<rect x="224" y="90" width="10" height="24" rx="2" fill="var(--info)" opacity=".8"/>'
                          '<rect x="238" y="98" width="10" height="16" rx="2" fill="var(--info)" opacity=".8"/>'
                          '</svg>'
                          '<div class="ui-m" style="margin-top:6px;text-align:center;">Shaded columns are night · rain arrives 15:00</div>')),
            dict(h="Pick the model you trust",
                 p=["Forecast models disagree, especially in mountains, and most people who ride in bad "
                    "weather have a favourite. Switch between ECMWF, the UK Met Office, GFS and ICON, or let "
                    "the service pick the best available for that location.",
                    "Disagreement between two models is itself information. If ECMWF and the Met Office "
                    "differ about Thursday, Thursday is uncertain — worth knowing before you commit to a "
                    "90 km day."],
                 li=["<strong>Five sources</strong>, switchable per trip.",
                     "<strong>Cached for three hours</strong>, so paging between days is instant.",
                     "<strong>Last good forecast is kept</strong> and labelled with its age if the network drops."],
                 media=None),
        ],
        limits=["Forecasts come from Open-Meteo and need a connection the first time for each point and "
                "model. After that a cached copy is shown, labelled with its age.",
                "The point used is where the stage ends. A day that climbs 1,000 m to a pass and descends "
                "will not show the weather at the top.",
                "Only days with a GPX track get coordinates automatically; the rest need them set by hand.",
                "Wind is forecast at 10 m in open ground — valleys and forest will differ considerably."],
        related=["today", "route", "readiness"],
    ),

    dict(
        slug="story", icon="📸", name="Story &amp; Photos",
        title="Story &amp; Photos",
        lede="The trip gallery, and story cards built from it that are actually worth posting.",
        intro="Photos from a trip end up scattered across four phones and a group chat. Story keeps them "
              "in one gallery attached to the trip, shows them on the public page, and turns any of them "
              "into a story card with the day&#39;s real numbers burned in.",
        blocks=[
            dict(h="A gallery the whole group fills",
                 p=["Anyone on the trip can post, tagged to a day. They appear in the gallery, and on the "
                    "public page if photos are switched on there — so the people following along see the "
                    "trip as it happens rather than a fortnight later.",
                    "You can delete your own; organisers can delete any."],
                 li=["<strong>Anyone on the trip uploads</strong>, not just the organiser.",
                     "<strong>Tagged to a day</strong>, so the gallery stays in order.",
                     "<strong>Shown on the live page</strong> when you allow it."],
                 media=None),
            dict(h="Story cards with the real numbers",
                 p=["A photo of a hill is a photo of a hill. A photo of a hill with <em>day 4 of 8, 48 of "
                    "88 km, +1160 m</em> and the elevation profile you are standing halfway along is a "
                    "story about a trip.",
                    "Pick a photo, pick the day, choose what to overlay, and download a 1080 × 1920 PNG "
                    "sized for Instagram and WhatsApp stories. It renders in your browser — nothing is "
                    "uploaded to make a card."],
                 li=["<strong>Toggle each element</strong> — trip name, day counter, distance, climbing, "
                     "elevation profile, follow link.",
                     "<strong>Elevation profile</strong> from the day&#39;s GPX, with your position marked.",
                     "<strong>Three themes</strong> and adjustable photo dimming.",
                     "<strong>Gradient fallback</strong> when you have no photo yet."],
                 media=ui("Story card",
                          '<div style="display:flex;gap:14px;align-items:flex-start;">'
                          '<div style="width:120px;flex:none;border-radius:8px;overflow:hidden;'
                          'background:linear-gradient(160deg,var(--accent),var(--accent-2));aspect-ratio:9/16;'
                          'display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;color:#fff;padding:8px;text-align:center;">'
                          '<div style="font-size:8px;font-weight:800;letter-spacing:.06em;">HIGHLANDS TRAVERSE</div>'
                          '<div style="font-size:7px;opacity:.8;">DAY 4 OF 8</div>'
                          '<svg viewBox="0 0 80 24" style="width:88%;"><path d="M0,18 L14,15 L26,9 L38,13 L50,6 L62,14 L80,11" fill="none" stroke="#fff" stroke-width="1.6"/><line x1="40" y1="2" x2="40" y2="24" stroke="#fff" stroke-width="1" stroke-dasharray="2,2"/></svg>'
                          '<div style="font-family:var(--font-mono);font-size:13px;font-weight:800;">191/513</div>'
                          '<div style="font-size:6.5px;opacity:.75;">+1160 m climbed today</div></div>'
                          '<div style="flex:1;font-size:12px;">'
                          '<div style="font-weight:600;margin-bottom:6px;">Show on the card</div>'
                          '<div style="display:flex;flex-direction:column;gap:4px;color:var(--text-secondary);">'
                          '<span>☑ Trip name</span><span>☑ Day counter</span><span>☑ Distance</span>'
                          '<span>☑ Elevation profile</span><span>☐ Tonight&#39;s stay</span><span>☑ Follow link</span></div></div></div>')),
        ],
        limits=["Cards are generated from a photo already uploaded to the trip. A photo served without "
                "permissive CORS headers cannot be exported — use one from your own gallery.",
                "The elevation profile only appears for days that have a GPX track.",
                "There is no text or sticker editor — the overlay is the trip&#39;s own data, by design."],
        related=["live", "route", "today"],
    ),
]

BY_SLUG = {f["slug"]: f for f in FEATURES}


# --------------------------------------------------------------------------
# Template
# --------------------------------------------------------------------------

# Hero photography per feature, all Unsplash, credited in the subhero.
# key: slug -> (file, author, author profile, photo page)
PHOTOS = {
  "today":         ("../hero.jpg", "Timur Valiev", "https://unsplash.com/@timur_valiev", "https://unsplash.com/photos/a-person-standing-next-to-a-bike-near-hay-bales-Wf2KXzaAKvc"),
  "route":         ("route.jpg", "Stephen Talas", "https://unsplash.com/@hunupnorth", "https://unsplash.com/photos/a-dirt-road-going-through-a-lush-green-countryside-aU-9J8sN9GM"),
  "sights":        ("sights.jpg", "Claudia de Wet", "https://unsplash.com/@claudia_de_wet", "https://unsplash.com/photos/a-yellow-building-with-a-black-roof-SnYPTO7ULxI"),
  "logistics":     ("logistics.jpg", "Dominic Kurniawan Suryaputra", "https://unsplash.com/@d_ks11", "https://unsplash.com/photos/a-large-crowd-of-people-walking-through-an-airport-xQt-b6uRFaE"),
  "statistics":    ("statistics.jpg", "Patrick Hendry", "https://unsplash.com/@worldsbetweenlines", "https://unsplash.com/photos/man-riding-on-bicycle-during-daytime-qDBbM9Erwo4"),
  "weather":       ("weather.jpg", "Max", "https://unsplash.com/@notquitemax", "https://unsplash.com/photos/closeup-photography-of-water-drops-on-body-of-water-22x7fxFpl_8"),
  "accommodation": ("accommodation.jpg", "Zoshua Colah", "https://unsplash.com/@zoshuacolah", "https://unsplash.com/photos/a-room-filled-with-lots-of-bunk-beds-next-to-a-window-TzMGehZmocI"),
  "packing":       ("packing.jpg", "Patrick Hendry", "https://unsplash.com/@worldsbetweenlines", "https://unsplash.com/photos/black-and-gray-mountain-bike-OrI5O9tuF7w"),
  "expenses":      ("expenses.jpg", "Jakub \u017berdzicki", "https://unsplash.com/@jakubzerdzicki", "https://unsplash.com/photos/a-person-holding-a-bunch-of-money-next-to-a-calculator-Yh26MxQhPsc"),
  "participants":  ("participants.jpg", "Ben Guernsey", "https://unsplash.com/@benguernsey", "https://unsplash.com/photos/a-group-of-people-riding-bikes-down-a-dirt-road-rfuOpSqD0ks"),
  "live":          ("live.jpg", "Nguy\u1ec5n Hi\u1ec7p", "https://unsplash.com/@hieptltb97", "https://unsplash.com/photos/a-woman-sitting-on-a-couch-taking-a-picture-of-herself-6I5nprn1ol0"),
  "story":         ("live.jpg", "Nguy\u1ec5n Hi\u1ec7p", "https://unsplash.com/@hieptltb97", "https://unsplash.com/photos/a-woman-sitting-on-a-couch-taking-a-picture-of-herself-6I5nprn1ol0"),
  "imports":       ("imports.jpg", "Ilya Pavlov", "https://unsplash.com/@ilyapavlov", "https://unsplash.com/photos/a-close-up-of-a-computer-screen-with-a-menu-hXrPSgGFpqQ"),
  "readiness":     ("readiness.jpg", "Patrick Hendry", "https://unsplash.com/@worldsbetweenlines", "https://unsplash.com/photos/orange-and-black-off-road-bicycle-on-hill-1ow9zrlldJU"),
}
UTM = "?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"


def subhero(f):
    """Photo-backed hero when the feature has one, plain band otherwise."""
    ph = PHOTOS.get(f["slug"])
    inner = (f'<div class="crumb"><a href="../">Home</a> \u2192 <a href="../features.html">Features</a> \u2192 {f["name"]}</div>'
             f'<div style="display:flex;gap:14px;align-items:flex-start;">'
             f'<span style="font-size:36px;line-height:1;">{f["icon"]}</span>'
             f'<div><h1 style="font-size:clamp(28px,4vw,42px);">{f["title"]}</h1>'
             f'<p class="lede" style="margin-top:12px;max-width:640px;">{f["lede"]}</p></div></div>')
    if not ph:
        return f'<section class="subhero"><div class="wrap">{inner}</div></section>'
    file, author, aurl, purl = ph
    return (f'<section class="subhero subhero-photo" style="--sub-img:url(\'/img/features/{file}\');">'
            f'<div class="sub-bg"></div><div class="sub-scrim"></div>'
            f'<div class="wrap">{inner}</div>'
            f'<div class="photo-credit">Photo by <a href="{aurl}{UTM}" target="_blank" rel="noopener nofollow">{author}</a>'
            f' on <a href="{purl}{UTM}" target="_blank" rel="noopener nofollow">Unsplash</a></div></section>')

def render(f):
    blocks = []
    for i, b in enumerate(f["blocks"]):
        flip = " flip" if i % 2 else ""
        paras = "".join(f"<p>{p}</p>" for p in b.get("p", []))
        lis = ""
        if b.get("li"):
            lis = "<ul>" + "".join(f"<li>{x}</li>" for x in b["li"]) + "</ul>"
        media = f'<div class="detail-media">{b["media"]}</div>' if b.get("media") else ""
        if media:
            blocks.append(f'<div class="detail{flip}"><div><h3>{b["h"]}</h3>{paras}{lis}</div>{media}</div>')
        else:
            blocks.append(f'<div class="detail" style="grid-template-columns:1fr;max-width:780px;">'
                          f'<div><h3>{b["h"]}</h3>{paras}{lis}</div></div>')
    blocks_html = "\n".join(blocks)

    limits = "".join(f"<li>{x}</li>" for x in f["limits"])
    related = "".join(
        f'<a class="card" href="{BY_SLUG[s]["slug"]}.html"><span class="ico">{BY_SLUG[s]["icon"]}</span>'
        f'<h4>{BY_SLUG[s]["name"]}</h4><p>{BY_SLUG[s]["lede"][:90]}…</p><span class="more">Read more →</span></a>'
        for s in f["related"])

    plain_lede = f["lede"].replace("&amp;", "&")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{f['title'].replace('&amp;', '&')} — Trip Tracker</title>
<meta name="description" content="{html.escape(plain_lede, quote=True)}">
<meta name="theme-color" content="#F7F5F0">
<script>
(function () {{
  var h = location.hash || '', q = location.search || '';
  if (h.indexOf('access_token=') > -1 || q.indexOf('code=') > -1) location.replace('/app.html' + q + h);
  var t = localStorage.getItem('theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
}})();
</script>
<link rel="stylesheet" href="../css/site.css">
<link rel="stylesheet" href="../css/scenes.css">
</head>
<body>

<header class="site">
  <div class="wrap bar">
    <a class="brand" href="../">
      <svg class="mark" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <circle cx="8" cy="20" r="2.2" fill="currentColor"/><circle cx="20" cy="8" r="2.2" fill="currentColor"/>
        <path d="M8 20C16 20 12 8 20 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      Trip Tracker
    </a>
    <nav class="mainnav" id="mainnav">
      <div class="navdrop" id="navdrop">
        <button type="button" class="on" aria-expanded="false" onclick="toggleFeatureMenu(event)">Features
          <svg class="caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="navdrop-menu">
          <a href="route.html"><i>🗺️</i><b>Route &amp; Days<span>Stages, elevation, maps</span></b></a><a href="today.html"><i>🎯</i><b>Today<span>The on-the-road screen</span></b></a><a href="statistics.html"><i>📊</i><b>Statistics<span>Effort and pace charts</span></b></a><a href="weather.html"><i>🌤️</i><b>Weather<span>Hourly, per stage</span></b></a><a href="logistics.html"><i>✈️</i><b>Logistics<span>Flights, trains, ferries</span></b></a><a href="accommodation.html"><i>🏠</i><b>Accommodation<span>Rooms, costs, breakfast</span></b></a><a href="sights.html"><i>🏰</i><b>Sights &amp; Resupply<span>Food, shops, water</span></b></a><a href="packing.html"><i>🎒</i><b>Packing &amp; Tasks<span>Assigned per person</span></b></a><a href="expenses.html"><i>💸</i><b>Expenses<span>Split and settle</span></b></a><a href="story.html"><i>📸</i><b>Story &amp; Photos<span>Gallery and story cards</span></b></a><a href="live.html"><i>🔴</i><b>Live Sharing<span>One public link</span></b></a><a href="imports.html"><i>📥</i><b>Imports<span>Email, PDF, GPX</span></b></a>
          <a class="all" href="../features.html">All features →</a>
        </div>
      </div>
      <a href="../how-it-works.html">How it works</a>
      <a href="../live.html?t={DEMO}">Live demo</a>
      <a href="../faq.html">FAQ</a>
    </nav>
    <div class="headcta">
      <a class="btn btn-ghost btn-sm" href="../app.html">Sign in</a>
      <a class="btn btn-primary btn-sm" href="../app.html">Get started</a>
      <button id="navToggle" aria-label="Menu" aria-expanded="false">
        <svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>
      </button>
    </div>
  </div>
</header>

{subhero(f)}

<section class="tight">
  <div class="wrap narrow">
    <p style="font-size:17px;color:var(--text-secondary);line-height:1.65;">{f['intro']}</p>
  </div>
</section>

<section style="padding-top:0;">
  <div class="wrap">
{blocks_html}
  </div>
</section>

<section class="tight">
  <div class="wrap narrow">
    <div class="limits">
      <h4>Good to know</h4>
      <ul>{limits}</ul>
    </div>
  </div>
</section>

<section class="alt tight">
  <div class="wrap">
    <div class="sec-head" style="margin-bottom:24px;"><h2 style="font-size:24px;">Related</h2></div>
    <div class="nextprev">{related}</div>
  </div>
</section>

<section class="tight">
  <div class="wrap">
    <div class="cta-band">
      <h2>Try it on your next trip</h2>
      <p>Free while in early access. A couple of minutes to set up.</p>
      <div class="cta-actions">
        <a class="btn btn-lg" href="../app.html">Get started</a>
        <a class="btn btn-lg btn-outline" href="../live.html?t={DEMO}">View the demo trip</a>
      </div>
    </div>
  </div>
</section>

<footer class="site">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="../" style="margin-bottom:12px;">
          <svg class="mark" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="12.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <circle cx="8" cy="20" r="2.2" fill="currentColor"/><circle cx="20" cy="8" r="2.2" fill="currentColor"/>
            <path d="M8 20C16 20 12 8 20 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
          Trip Tracker
        </a>
        <p class="muted" style="max-width:300px;font-size:14px;">Planning and live sharing for multi-day group trips.</p>
      </div>
      <div><h4>Product</h4><ul>
        <li><a href="../features.html">All features</a></li>
        <li><a href="../how-it-works.html">How it works</a></li>
        <li><a href="../faq.html">FAQ</a></li></ul></div>
      <div><h4>Try it</h4><ul>
        <li><a href="../app.html">Sign in</a></li>
        <li><a href="../app.html">Create a trip</a></li>
        <li><a href="../live.html?t={DEMO}">Live demo</a></li></ul></div>
      <div><h4>Deep dives</h4><ul>
        <li><a href="route.html">Route &amp; Days</a></li>
        <li><a href="today.html">Today</a></li>
        <li><a href="live.html">Live sharing</a></li>
        <li><a href="imports.html">Imports</a></li></ul></div>
    </div>
    <div class="foot-bottom">
      <span>© 2026 Trip Tracker</span>
      <span>Early access — <a href="../app.html">free to use</a></span>
    </div>
  </div>
</footer>

<script>
// Features menu: hover on desktop (CSS), tap to expand in the hamburger.
function toggleFeatureMenu(e) {{
  e.preventDefault();
  var d = document.getElementById('navdrop');
  var open = d.classList.toggle('open');
  d.querySelector('button').setAttribute('aria-expanded', open ? 'true' : 'false');
}}
document.addEventListener('click', function (e) {{
  var d = document.getElementById('navdrop');
  if (d && !d.contains(e.target)) d.classList.remove('open');
}});
document.getElementById('navToggle').addEventListener('click', function () {{
  var n = document.getElementById('mainnav');
  var open = n.classList.toggle('open');
  this.setAttribute('aria-expanded', open ? 'true' : 'false');
}});
</script>
</body>
</html>
"""


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for f in FEATURES:
        path = os.path.join(OUT_DIR, f["slug"] + ".html")
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(render(f))
        print("wrote", os.path.relpath(path))
    print(f"\n{len(FEATURES)} feature pages generated.")


if __name__ == "__main__":
    main()
