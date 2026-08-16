// Section 2 (expand beyond cycling) + Section 4 (gate bike-specific fields,
// tooltip recommended pace values). One config object drives: which grid
// columns show, what they're labelled, and what the pace-assumptions form
// looks like for a given trip.
const ACTIVITY_TYPES = {
  cycling: {
    label: 'Cycling', icon: '🚴', distanceLabel: 'Distance (km)',
    showAscent: true, ascentLabel: 'Ascent (m)',
    showSurface: true, surfaceLabel: 'Surface', surfaceOptions: ['tarmac', 'gravel', 'singletrack', 'mixed'],
    paceKeys: ['tarmac', 'gravel', 'singletrack'], paceLabel: 'Cycling speed by surface (km/h)', showClimb: true,
    climbLabel: 'Climbing rate (vertical m/hour)',
  },
  hiking: {
    label: 'Hiking / trekking', icon: '🥾', distanceLabel: 'Distance (km)',
    showAscent: true, ascentLabel: 'Ascent (m)',
    showSurface: true, surfaceLabel: 'Terrain', surfaceOptions: ['trail', 'scree', 'paved', 'mixed'],
    paceKeys: ['trail'], paceLabel: 'Walking speed (km/h)', showClimb: true,
    climbLabel: 'Climbing rate (vertical m/hour, Naismith\'s rule)',
  },
  kayaking: {
    label: 'Kayaking / paddling', icon: '🛶', distanceLabel: 'Distance (km)',
    showAscent: false,
    showSurface: true, surfaceLabel: 'Water conditions', surfaceOptions: ['calm', 'moderate', 'rough'],
    paceKeys: ['calm', 'moderate'], paceLabel: 'Paddling speed by water conditions (km/h)', showClimb: false,
  },
  driving: {
    label: 'Driving / campervan', icon: '🚐', distanceLabel: 'Distance (km)',
    showAscent: false, showSurface: false,
    paceKeys: ['driving'], paceLabel: 'Average driving speed, incl. stops (km/h)', showClimb: false,
  },
  public_transport: {
    label: 'Public transport tour', icon: '🚆', distanceLabel: 'Distance (optional, km)',
    showAscent: false, showSurface: false,
    paceKeys: [], paceLabel: null, showClimb: false,
  },
  mixed: {
    label: 'Mixed / multi-activity', icon: '🧭', distanceLabel: 'Distance (km)',
    showAscent: true, ascentLabel: 'Ascent (m)',
    showSurface: true, surfaceLabel: 'Segment type', surfaceOptions: ['tarmac', 'gravel', 'trail', 'water', 'road', 'mixed'],
    paceKeys: ['tarmac', 'gravel', 'trail'], paceLabel: 'Speed by segment type (km/h)', showClimb: true,
    climbLabel: 'Climbing rate (vertical m/hour)',
  },
};

// Recommended defaults, three experience levels, shown as tooltips next to
// the pace-assumption inputs in Settings.
const PACE_PRESETS = {
  cycling: {
    beginner: { tarmac: 14, gravel: 10, singletrack: 6, climbMPerHour: 250 },
    moderate: { tarmac: 18, gravel: 14, singletrack: 8, climbMPerHour: 450 },
    experienced: { tarmac: 24, gravel: 19, singletrack: 12, climbMPerHour: 650 },
  },
  hiking: {
    beginner: { trail: 3, climbMPerHour: 250 },
    moderate: { trail: 4.5, climbMPerHour: 400 },
    experienced: { trail: 6, climbMPerHour: 600 },
  },
  kayaking: {
    beginner: { calm: 3, moderate: 2 },
    moderate: { calm: 5, moderate: 3.5 },
    experienced: { calm: 7, moderate: 5 },
  },
  driving: {
    beginner: { driving: 50 },
    moderate: { driving: 70 },
    experienced: { driving: 90 },
  },
  mixed: {
    beginner: { tarmac: 12, gravel: 8, trail: 3, climbMPerHour: 250 },
    moderate: { tarmac: 16, gravel: 12, trail: 4.5, climbMPerHour: 400 },
    experienced: { tarmac: 22, gravel: 16, trail: 6, climbMPerHour: 600 },
  },
};

function activityConfig(trip) {
  return ACTIVITY_TYPES[(trip && trip.activity_type) || 'cycling'] || ACTIVITY_TYPES.cycling;
}
function activityTypeOptionsHtml(selected) {
  return Object.entries(ACTIVITY_TYPES).map(([key, cfg]) =>
    `<option value="${key}" ${key === selected ? 'selected' : ''}>${cfg.icon} ${cfg.label}</option>`
  ).join('');
}
function pacePresetTooltip(activityType) {
  const presets = PACE_PRESETS[activityType];
  if (!presets) return '';
  const fmt = (p) => Object.entries(p).map(([k, v]) => `${k}: ${v}`).join(', ');
  return `Beginner — ${fmt(presets.beginner)}\nModerate — ${fmt(presets.moderate)}\nExperienced — ${fmt(presets.experienced)}`;
}

// Maps trip.activity_type onto the design system's 5-hue activity accent palette.
const ACTIVITY_ACCENT_KEY = { cycling: 'cycling', hiking: 'hiking', driving: 'driving', kayaking: 'kayaking', public_transport: 'transit', mixed: 'cycling' };
function activityBadgeHtml(trip) {
  const type = (trip && trip.activity_type) || 'cycling';
  const cfg = activityConfig(trip);
  const key = ACTIVITY_ACCENT_KEY[type] || 'cycling';
  return `<span class="badge badge-activity" style="background:var(--activity-${key}-subtle);"><span class="activity-dot" style="background:var(--activity-${key});"></span>${esc(cfg.label)}</span>`;
}
