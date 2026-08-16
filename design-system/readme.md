# Trip Tracker Design System

Design system for **Trip Tracker**, a planning tool for organizers of multi-day group adventure
trips (bikepacking, hiking/trekking, road trips and campervan tours, multi-day kayaking, rail/public
transport tours). Two surfaces:

- **Admin panel** — dense, desktop-first, where the organizer builds the trip (sidebar + day-by-day
  spreadsheet grid + module list screens + slide-in drawer).
- **Participant live page** — light, mobile-first, read-only page the group checks mid-trip.

This is a from-scratch system (no existing codebase or Figma file was attached) built from a written
brief. It targets a plain HTML/CSS/JS implementation — every token below is real, copy-pasteable CSS.

## Mood & references
Blends Apple's product-page restraint (quiet neutral grays, one confident accent, generous
whitespace, hairline borders over heavy shadows) with the outdoor-adventure identity of apps like
Komoot (forest green + terracotta accents, confident sans-serif, rounded-not-bubbly corners) and
Mapy.cz (map-forward clarity, comfortable data density, utilitarian iconography). Trustworthy and
calm — not a generic SaaS dashboard, not military-tactical gear aesthetic.

## Index
- `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/fonts.css` — paste-ready
  CSS custom properties. `styles.css` at root imports all four.
- `guidelines/*.html` — foundation specimen cards (colors, type, spacing, radius, elevation) shown in
  the Design System tab.
- `components/forms/` — Button, Input (text/number/date), Select (+ custom open-menu spec).
- `components/feedback/` — Badge (status + activity-type), Tooltip, EmptyState, ChecklistItem.
- `components/navigation/` — SidebarNavItem, Tabs.
- `components/overlay/` — Modal, Drawer.
- `components/data/` — Card/StatCard, AvatarChip/AvatarGroup, EditableCell (5-state spreadsheet cell).
- `ui_kits/admin-panel/` — full click-through: sidebar, Overview, day grid, drawer, accommodation,
  packing, expenses, sights, readiness, sharing, import review.
- `ui_kits/participant-live/` — the mobile rider view.

## Content fundamentals
- Copy is plain and functional: field labels are nouns ("Distance (km)", "Surface"), not questions.
  Section titles are one or two words ("Readiness", "Sharing", "Import review").
- Second person for the organizer's own actions ("Preview live page"), first-person-plural implied
  for the group ("What the group sees").
- Numbers carry their unit inline (`42.3 km`, `+1,240 m`, `€ 640`) — never a unit in a separate column.
- Readiness/checklist copy is advisory, never alarming: "No accommodation linked for Day 4," not
  "Error: missing accommodation." Nothing in the readiness list is framed as blocking.
- No emoji anywhere in the UI. No exclamation points in system copy.

## Visual foundations
- **Color**: warm off-white surfaces (not clinical white), one deep trail-green primary accent used
  sparingly (primary buttons, active nav, links), one terracotta secondary accent reserved for the
  organizer-marker dot and as a second brand moment — not for general warnings (warnings use amber).
  Dark theme is a distinct warm charcoal palette, not an inverted light theme.
- **Type**: Manrope (UI, headings, buttons) + IBM Plex Mono (distances, dates, table values) — see
  Iconography note below on why mono is used for data, not just numbers-as-numbers but as a visual
  cue that a cell is a *value*, not prose.
- **Depth**: hairline borders (`--border-hairline`) are the primary depth cue; box-shadows
  (`--shadow-e1/e2/e3`) are a soft assist, never a heavy drop shadow. No gradients anywhere.
- **Radius**: 6/10/14/20px + full pill — rounded-but-not-bubbly, matching the Komoot reference.
- **Motion**: not specified in detail here (no codebase to source real easing from) — recommend
  120–160ms ease for hover/focus transitions, no bounce/spring easing, no page-transition animation.
  Flag this as an area to firm up once real interactions are built.
- **Backgrounds**: flat color only. No photography, no illustration, no texture. Empty states use a
  dashed hairline border instead of an image.
- **Hover/press**: hover = background tint or border darken; press = scale(0.98) + darker fill.
  No opacity-only hover states (fails the "high contrast" requirement on interactive elements).

## Iconography
No icon font or SVG library was provided, so nav/status icons are hand-built as minimal geometric
line icons (1.5–1.6px stroke, `currentColor`, 18×18) built only from basic shapes (circles, rects,
polygons, simple paths) — see `ui_kits/admin-panel/AdminApp.jsx`'s `ICONS` map for the full set
(overview, grid, home, route, bag, wallet, pin, check, share, upload). This replaces the emoji
placeholders mentioned in the brief — emoji reads inconsistent across OSes and undercuts the "quiet,
confident" mood. If a proper icon set (e.g. Lucide/Phosphor, stroke-matched to this weight) becomes
available, swap it in; keep stroke weight and size consistent with the current set.

## Do / Don't
**Do**: warm off-white surfaces, one accent color doing most of the work, hairline borders,
generous internal padding on cards, mono type for tabular data, advisory (non-red) readiness
copy, rounded-not-bubbly corners (10–14px on cards/buttons).

**Don't**: purple/blue gradients, colored-left-border cards (generic-SaaS tell), emoji as icons,
pure-white (`#fff`) full-bleed backgrounds, heavy drop shadows or skeuomorphic bevels, a "tactical"
dark-camo/rugged-gear look, red for anything non-destructive, more than two accent colors doing
brand work (activity chips are a utility, not a brand color).

## Caveats
- No real logo was provided — the wordmark is set in plain type ("Trip Tracker") wherever a mark
  would go. Swap in a real logo file under `assets/` when available.
- Font is a Google Fonts substitution (Manrope + IBM Plex Mono) chosen to match the brief's
  described mood — not sourced from an existing brand file.
- Component styling is embedded per-file (`<style>` blocks with `.tt-*` class prefixes) rather than
  in a shared stylesheet, so each `.jsx` stays copy-paste-portable; when you port this to plain
  HTML/CSS, you can lift those blocks into your own stylesheet directly.
