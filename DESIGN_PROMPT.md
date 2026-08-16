# Prompt for Claude Design — Trip Admin design system

Paste everything below into a new Claude Design session.

---

I'm designing a web app called **Trip Admin** — a planning tool for organizers of multi-day group adventure trips (bikepacking, hiking/trekking, road trips and campervan tours, multi-day kayaking, rail/public-transport tours). The organizer builds the trip in a dense, desktop-first admin panel; their group later sees a light, mobile-first read-only page with the plan and live progress.

I need a complete **design system** for the admin panel: color palette (light + dark), typography scale, spacing/radius/elevation tokens, and a component library. I'll hand the result to an engineer (me, working with Claude Code) to implement in plain HTML/CSS/JS — no design tool handoff needed beyond CSS values and component specs.

## Mood and positioning

Blend two references:

- **Apple's product-page/system-app restraint** — generous whitespace, quiet neutral grays, one confident accent color used sparingly, content-first hierarchy, no visual noise, subtle depth (soft shadows, thin hairline borders) instead of heavy skeuomorphism or gradients.
- **Komoot and Mapy.cz's outdoor/trail identity** — fresh, optimistic, slightly rugged-but-friendly. Komoot's palette (warm off-whites, deep forest/trail green as the primary accent, terracotta/sunset as a secondary accent, confident sans-serif type, rounded-but-not-bubbly corners) and Mapy.cz's map-forward clarity (legible at a glance, utilitarian iconography, comfortable data density) are both good references. Look these up for concrete visual reference before proposing values.

The result should feel like a well-funded outdoor-adventure product, not a generic SaaS admin dashboard and not a rugged/military "tactical" gear aesthetic. Trustworthy and calm, not loud.

## Hard requirements

- **Both a light and a dark theme**, token-driven (CSS custom properties), each a complete, intentional palette — not just an inverted version of the other.
- **High contrast, especially on form controls.** The current build has a bug where native `<select>` dropdowns render with a white background and low-contrast gray text — the new system must specify explicit, accessible styling for selects, options, inputs, and textareas in both themes (WCAG AA minimum for all text).
- **Desktop-first for the admin panel** (nobody plans a 14-day trip on a phone) but the components should degrade reasonably to tablet width.
- A **separate, simpler mobile-first light theme** for the read-only participant/live page (think: what a rider glances at mid-ride, in bright sun, one-handed). This can share tokens with the admin system but should be its own simpler screen spec.
- Everything must be specifiable as **plain CSS** (custom properties + real values), not tied to a specific design tool's proprietary features.

## Information the system needs to support

The admin panel is organized as a left sidebar (trip switcher + section nav) and a main content area. Sections: Overview (stat cards + quick links), a dense **spreadsheet-style editable grid** (one row per day: date, title, start/end point, distance, elevation, surface, linked accommodation, linked sights — inline-editable cells, keyboard navigable), a slide-in **detail drawer** for per-day long-tail fields, module list-screens (accommodation cards, logistics/transport rows, packing/task checklists with per-person avatars, an expense ledger with balances, a sights/POI list grouped by day), a **readiness checklist** (warning-style list items, not blocking), a **sharing panel** (visibility toggles, copyable share link, a tracking-provider list with per-rider status badges), and an **import review queue** (side-by-side "source excerpt" vs "proposed value" diff rows with accept/reject actions).

Please design and specify:

1. **Color tokens** — background layers (page / card / recessed input), border/hairline colors, primary text, secondary/muted text, the primary trail-green accent (and a hover/pressed variant), a secondary accent (terracotta/sunset — for warnings, or for a second brand moment), semantic colors for success/warning/danger/info, and per-activity-type accent colors if you think trips of different types (cycling / hiking / driving / kayaking / public transport) deserve distinct small accent chips.
2. **Typography** — a system font stack (or one Google Font pairing if you think it's worth the load), a type scale from small metadata text up through page titles, and weight usage rules.
3. **Spacing, radius, and elevation scales** — as tokens, not ad hoc values.
4. **Core components**, each specified for both themes: buttons (primary / secondary / danger / small variants), form inputs (text, number, date, select — including the open dropdown list styling), badges/chips (status, role, activity-type), cards, the sidebar nav item (default/hover/active states), tabs, tooltips, modals, the slide-in drawer, an inline-editable table cell (default / hover / focused-editing / saving / saved states), avatar chips for participants, empty states, and a warning/checklist list item.
5. A short **do/don't** section — what would make this feel generic-SaaS instead of trail-adventure, so I can sanity-check any custom deviations later.

## Deliverable format

Give me:
- The full CSS custom-property token block for both themes (`:root` and a dark-mode block), ready to paste.
- Per-component CSS (or clear enough specs that I can write the CSS myself) covering all the states listed above.
- A couple of small inline SVG or Unicode-emoji-free icon suggestions for nav items if relevant (the current build leans on emoji for icons as a placeholder — happy to keep emoji if you think it fits the trail-friendly tone, or replace with a minimal line-icon set — your call, just be explicit either way).

I'll paste your output back into Claude Code to implement directly, so favor concrete, copy-pasteable values over abstract guidance.
