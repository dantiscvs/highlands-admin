// Story & Gallery — a shared photo pool (app.updates + the "photos" bucket)
// behind two tabs: Story (the card generator) and Gallery (pure upload/browse).
//
// Story editor v3 — implements the Claude Design handoff
// (design_handoff_story_editor/story-editor-redesign.dc.html + README). Full
// IG/TikTok-style direct-manipulation editor: on mobile a full-bleed camera-
// app take-over (fixed, near-black backdrop, the 1080x1920 canvas centered
// and filling the viewport height, a slim bottom icon row that expands into
// a bottom sheet per tool); on desktop a fixed two-pane split (card left,
// tools panel right). Multi-card: a "set" of independently editable cards
// (own photo/pan/zoom/dim/theme/elements), not a main card plus fixed
// "clean frame" format.
//
// Deliberate addition beyond the handoff: a back (←) control in the top bar.
// The handoff's mobile/desktop views are fixed, full-viewport takeovers with
// no visible way back to the rest of the app (sidebar, other tabs) — without
// it the editor would be a dead end.

const STORY_W = 1080, STORY_H = 1920;
const STORY_SAFE_FRAC = 0.13; // IG/FB Stories safe zone: top/bottom 13% of the frame
const STORY_THEMES = {
  trail: { bg: '#23261E', accent: '#7FB587', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
  ember: { bg: '#2A1B12', accent: '#E08A54', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
  slate: { bg: '#1B1D18', accent: '#86B4CC', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
};
const STORY_PRESETS_KEY = 'storyPresets'; // unchanged key — carries forward presets saved in the previous editor

// [key, label, hasScope]
const STORY_TOGGLES = [
  ['title', 'Trip name', false],
  ['day', 'Day counter', true],
  ['distance', 'Distance', true],
  ['elevation', 'Climbing', true],
  ['profile', 'Elevation profile', true],
  ['map', 'Route map', true],
  ['pace', 'Average pace', true],
  ['weather', "Today's weather", false],
  ['place', 'Photo location', false],
  ['stay', "Tonight's stay", false],
];

const STORY_ICON_PHOTO = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="8.5" cy="10" r="1.5"></circle><path d="M21 15l-5-5-9 9"></path></svg>';
const STORY_ICON_ELEMENTS = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M20 18h0"></path><circle cx="15" cy="6" r="1.8" fill="currentColor" stroke="none"></circle><circle cx="7" cy="12" r="1.8" fill="currentColor" stroke="none"></circle><circle cx="17" cy="18" r="1.8" fill="currentColor" stroke="none"></circle></svg>';
const STORY_ICON_THEME = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"></circle></svg>';
const STORY_ICON_CARDS = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 9h18M3 15h18M8 4v16M16 4v16"></path></svg>';
const STORY_ICON_PLUS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>';
const STORY_ICON_LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#97927D" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
const STORY_TABS = [
  ['photo', STORY_ICON_PHOTO, 'Photo'],
  ['elements', STORY_ICON_ELEMENTS, 'Elements'],
  ['theme', STORY_ICON_THEME, 'Theme'],
  ['frames', STORY_ICON_CARDS, 'Cards'],
];

// ---- editor state: a set of independently editable cards ----
let storyEditor = null;
let _cardSeq = 0;
function mainCardDefaults() {
  return {
    id: 'c' + (++_cardSeq), photoUrl: null, transform: { scale: 1, x: 0, y: 0 }, dim: 0.5, theme: 'trail',
    show: { title: true, day: true, distance: true, elevation: true, profile: true, map: false,
            pace: false, weather: false, place: false, stay: false },
    scopeOf: { day: 'day', distance: 'day', elevation: 'day', profile: 'trip', map: 'trip', pace: 'day' },
  };
}
// Follow-on cards default light: low dim, most elements off, just a location/weather tag —
// the idea being the first card carries the detail and later ones are quick posts.
function lightCardDefaults(theme) {
  return {
    id: 'c' + (++_cardSeq), photoUrl: null, transform: { scale: 1, x: 0, y: 0 }, dim: 0.15, theme: theme || 'trail',
    show: { title: false, day: false, distance: false, elevation: false, profile: false, map: false,
            pace: false, weather: true, place: true, stay: false },
    scopeOf: { day: 'day', distance: 'day', elevation: 'day', profile: 'trip', map: 'trip', pace: 'day' },
  };
}
function initStoryEditor() {
  if (storyEditor) return;
  storyEditor = {
    dayId: null, activeCardIdx: 0, cards: [mainCardDefaults()],
    activePanel: 'photo', // sheet auto-opens on first load — doubles as the empty-state onboarding
    dayPickerOpen: false, downloading: false, batchDownloading: false,
    presetDraftOpen: false, presetNameDraft: '',
  };
}
function currentCard() { return storyEditor.cards[storyEditor.activeCardIdx] || storyEditor.cards[0]; }
function isStoryDesktop() { return window.innerWidth >= 900; }

let _storyDays = [], _storyPhotos = [], _storyProgress = {};

// ---- shared load (both tabs pull from the same pool) ----
async function loadPhotoPool() {
  const [{ data: updates }, { data: days }] = await Promise.all([
    db().from('updates').select('*').eq('trip_id', activeTrip.id).not('photo_url', 'is', null).order('created_at', { ascending: false }),
    db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index'),
  ]);
  _storyPhotos = updates || [];
  _storyDays = days || [];
}

function _rerenderPhotoTab() {
  const route = parseRoute();
  if (route.view === 'trip' && route.section === 'gallery') renderGalleryModule();
  else renderStoryModule();
}

// ==================== STORY TAB ====================
async function renderStoryModule() {
  if (moduleGate('photos')) return;
  const main = document.getElementById('main');
  main.innerHTML = '<p class="muted">Loading…</p>';

  await loadPhotoPool();
  const { data: prog } = await db().from('day_progress').select('*').eq('trip_id', activeTrip.id);
  _storyProgress = {};
  (prog || []).forEach(p => { _storyProgress[p.day_id] = Number(p.ridden_km) || 0; });

  initStoryEditor();
  if (!storyEditor.dayId) {
    const iso = todayIso();
    const d = _storyDays.find(x => x.date === iso) || _storyDays.find(x => x.distance_km) || _storyDays[0];
    storyEditor.dayId = d ? d.id : null;
  }

  main.innerHTML = isStoryDesktop() ? storyDesktopHtml() : storyMobileHtml();
  wireStoryResize();
  wireStoryOutsideClick();
  drawAllStoryCanvases();
  wireStoryCanvasGestures();
}

function drawAllStoryCanvases() {
  drawMainCanvas();
  if (storyEditor.activePanel === 'frames') drawCardThumbnails();
}
function drawCardThumbnails() {
  storyEditor.cards.forEach(c => {
    const el = document.getElementById('cardThumb_' + c.id);
    if (el) drawCardTo(el, c);
  });
}
async function drawMainCanvas() {
  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;
  await drawCardTo(canvas, currentCard());
}

// ---- mobile: full-bleed "camera app" takeover ----
function storyMobileHtml() {
  const card = currentCard();
  const panel = storyEditor.activePanel;
  return `
  <div style="position:fixed;inset:0;z-index:900;background:var(--stage-bg);font-family:var(--font-ui);overflow:hidden;">
    <div style="position:relative;height:100dvh;width:100%;display:flex;align-items:center;justify-content:center;">
      <div style="position:relative;height:100%;aspect-ratio:1080/1920;max-width:100vw;overflow:hidden;">
        <canvas id="storyCanvas" width="${STORY_W}" height="${STORY_H}" style="width:100%;height:100%;display:block;touch-action:none;cursor:grab;background:var(--stage-bg);"></canvas>
        <div style="position:absolute;left:0;right:0;top:13%;height:0;border-top:1px dashed rgba(255,255,255,.4);pointer-events:none;"></div>
        <div style="position:absolute;left:0;right:0;bottom:13%;height:0;border-top:1px dashed rgba(255,255,255,.4);pointer-events:none;"></div>

        ${!card.photoUrl && !panel ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
          <span style="color:rgba(255,255,255,.75);font-size:15px;font-weight:600;text-align:center;padding:0 44px;">Tap Photo below to add a background</span>
        </div>` : ''}

        <div style="position:absolute;left:0;right:0;top:0;padding:14px 14px 20px;display:flex;justify-content:space-between;align-items:flex-start;background:linear-gradient(180deg,rgba(0,0,0,.5),transparent);gap:8px;">
          <button onclick="storyExitEditor()" title="Back to trip" style="flex:none;background:rgba(20,21,15,.55);color:#fff;border:none;border-radius:999px;width:34px;height:34px;font-size:15px;cursor:pointer;">←</button>
          <div data-daypicker-root style="position:relative;flex:1;min-width:0;">
            <button onclick="storyToggleDayPicker()" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(20,21,15,.55);color:#fff;border:none;border-radius:999px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">${esc(storyDayChipLabel())} ▾</button>
            ${storyEditor.dayPickerOpen ? storyDayPickerHtml() : ''}
          </div>
          <button onclick="storyDownloadCurrent()" ${storyEditor.downloading ? 'disabled' : ''} style="flex:none;background:var(--accent-primary);color:#fff;border:none;border-radius:999px;padding:8px 16px;font-size:12.5px;font-weight:700;cursor:pointer;">${storyEditor.downloading ? 'Rendering…' : 'Download'}</button>
        </div>

        <div style="position:absolute;left:8px;top:64px;background:rgba(20,21,15,.55);color:#fff;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:600;">Card ${storyEditor.activeCardIdx + 1} of ${storyEditor.cards.length}</div>

        ${!panel ? storyBottomIconRowHtml() : storyBottomSheetHtml()}
      </div>
    </div>
  </div>`;
}
function storyBottomIconRowHtml() {
  return `<div style="position:absolute;left:50%;bottom:calc(13% + 14px);transform:translateX(-50%);display:flex;gap:4px;background:rgba(20,21,15,.6);backdrop-filter:blur(8px);border-radius:999px;padding:6px;">
    ${STORY_TABS.map(([key, icon, label]) => `<button onclick="storySetPanel('${key}')" style="display:flex;flex-direction:column;align-items:center;gap:2px;border:none;background:none;color:#fff;padding:7px 13px;border-radius:999px;cursor:pointer;">${icon}<span style="font-size:9.5px;font-weight:600;">${label}</span></button>`).join('')}
  </div>`;
}
function storyBottomSheetHtml() {
  const panel = storyEditor.activePanel;
  const tab = (key, label) => `<button onclick="storySetPanel('${key}')" style="border:none;background:none;padding:6px 10px;font-size:12px;cursor:pointer;${panel === key ? 'font-weight:700;color:var(--accent-primary);border-bottom:2px solid var(--accent-primary);' : 'font-weight:600;color:var(--text-tertiary);border-bottom:2px solid transparent;'}">${label}</button>`;
  return `<div style="position:absolute;left:0;right:0;bottom:0;max-height:58%;background:#FFFFFF;border-radius:20px 20px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.3);display:flex;flex-direction:column;animation:storySheetUp .2s ease;">
    <div style="display:flex;justify-content:center;padding:8px 0 2px;flex:none;"><span style="width:36px;height:4px;border-radius:999px;background:var(--border-hairline);display:block;"></span></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 12px 8px;border-bottom:1px solid var(--border-hairline);flex:none;">
      <div style="display:flex;gap:2px;">${tab('photo', 'Photo')}${tab('elements', 'Elements')}${tab('theme', 'Theme')}${tab('frames', 'Cards')}</div>
      <button onclick="storySetPanel(null)" style="border:none;background:var(--bg-recessed);color:var(--accent-primary);border-radius:999px;width:28px;height:28px;font-size:14px;cursor:pointer;flex:none;">✓</button>
    </div>
    <div style="padding:14px 16px 22px;overflow-y:auto;" id="storySheetBody">${storyPanelBodyHtml()}</div>
  </div>`;
}

// ---- desktop: fixed two-pane split ----
function storyDesktopHtml() {
  const card = currentCard();
  const panel = storyEditor.activePanel || 'photo';
  const tab = (key, label) => `<button onclick="storySelectPanel('${key}')" style="flex:1;text-align:center;padding:15px 4px;border:none;background:none;cursor:pointer;font-size:13px;${panel === key ? 'font-weight:700;color:var(--accent-primary);border-bottom:2px solid var(--accent-primary);' : 'font-weight:600;color:var(--text-tertiary);border-bottom:2px solid transparent;'}">${label}</button>`;
  return `<div style="position:fixed;inset:0;z-index:900;background:var(--bg-page);display:flex;align-items:center;justify-content:center;gap:28px;padding:32px;font-family:var(--font-ui);box-sizing:border-box;">
    <div style="position:relative;height:min(86vh,860px);aspect-ratio:1080/1920;border-radius:20px;overflow:hidden;box-shadow:var(--shadow-e2);background:var(--stage-bg);flex:none;">
      <canvas id="storyCanvas" width="${STORY_W}" height="${STORY_H}" style="width:100%;height:100%;display:block;touch-action:none;cursor:grab;"></canvas>
      <div style="position:absolute;left:0;right:0;top:13%;height:0;border-top:1px dashed rgba(255,255,255,.4);pointer-events:none;"></div>
      <div style="position:absolute;left:0;right:0;bottom:13%;height:0;border-top:1px dashed rgba(255,255,255,.4);pointer-events:none;"></div>
      ${!card.photoUrl ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <span style="color:rgba(255,255,255,.75);font-size:16px;font-weight:600;text-align:center;padding:0 44px;">Pick a photo from the panel to add a background</span>
      </div>` : ''}
      <div style="position:absolute;left:0;right:0;top:0;padding:16px;display:flex;justify-content:space-between;align-items:flex-start;background:linear-gradient(180deg,rgba(0,0,0,.5),transparent);gap:8px;">
        <button onclick="storyExitEditor()" title="Back to trip" style="flex:none;background:rgba(20,21,15,.55);color:#fff;border:none;border-radius:999px;width:36px;height:36px;font-size:16px;cursor:pointer;">←</button>
        <div data-daypicker-root style="position:relative;flex:1;min-width:0;margin-right:8px;">
          <button onclick="storyToggleDayPicker()" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(20,21,15,.55);color:#fff;border:none;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;">${esc(storyDayChipLabel())} ▾</button>
          ${storyEditor.dayPickerOpen ? storyDayPickerHtml() : ''}
        </div>
        <div style="background:rgba(20,21,15,.55);color:#fff;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:600;white-space:nowrap;flex:none;">Card ${storyEditor.activeCardIdx + 1} of ${storyEditor.cards.length}</div>
      </div>
    </div>
    <div style="width:380px;height:min(86vh,860px);background:#fff;border-radius:20px;box-shadow:var(--shadow-e2);display:flex;flex-direction:column;overflow:hidden;flex:none;">
      <div style="display:flex;border-bottom:1px solid var(--border-hairline);flex:none;">
        ${tab('photo', 'Photo')}${tab('elements', 'Elements')}${tab('theme', 'Theme')}${tab('frames', 'Cards')}
      </div>
      <div style="flex:1;overflow-y:auto;padding:18px;" id="storySheetBody">${storyPanelBodyHtml()}</div>
      <div style="padding:14px 18px;border-top:1px solid var(--border-hairline);display:flex;gap:8px;flex:none;">
        <button onclick="storyDownloadCurrent()" ${storyEditor.downloading ? 'disabled' : ''} style="flex:1;background:var(--accent-primary);color:#fff;border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;">${storyEditor.downloading ? 'Rendering…' : 'Download'}</button>
        ${storyEditor.cards.length > 1 ? `<button onclick="storyDownloadAll()" style="flex:1;background:var(--bg-recessed);color:var(--accent-primary);border:none;border-radius:12px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;">${storyEditor.batchDownloading ? 'Downloading…' : 'Download all (' + storyEditor.cards.length + ')'}</button>` : ''}
      </div>
    </div>
  </div>`;
}

// ---- panel bodies (shared between the mobile sheet and the desktop pane) ----
function storyPanelBodyHtml() {
  const p = storyEditor.activePanel;
  if (p === 'elements') return storyElementsPanelHtml();
  if (p === 'theme') return storyThemePanelHtml();
  if (p === 'frames') return storyCardsPanelHtml();
  return storyPhotoPanelHtml();
}
function storyPhotoPanelHtml() {
  const card = currentCard();
  const desktop = isStoryDesktop();
  const sz = desktop ? 60 : 56;
  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;gap:10px;${desktop ? 'flex-wrap:wrap;' : 'overflow-x:auto;padding-bottom:2px;'}">
        <label style="flex:none;width:${sz}px;height:${sz}px;border-radius:12px;border:2px dashed var(--border-strong);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-secondary);background:var(--bg-page);">
          <input type="file" accept="image/*" onchange="storyUploadForCard(this)" style="display:none;">
          ${STORY_ICON_PLUS}
        </label>
        <button onclick="storySetCardPhoto(null)" style="flex:none;width:${sz}px;height:${sz}px;border-radius:12px;padding:0;cursor:pointer;background:linear-gradient(160deg,var(--accent-primary),var(--accent-secondary));border:2px solid ${!card.photoUrl ? 'var(--accent-primary)' : 'var(--border-hairline)'};"></button>
        ${_storyPhotos.map(p => `<button onclick="storySetCardPhoto('${esc(p.photo_url)}')" title="${esc(p.place_name || '')}" style="flex:none;width:${sz}px;height:${sz}px;border-radius:12px;padding:0;cursor:pointer;overflow:hidden;border:2px solid ${card.photoUrl === p.photo_url ? 'var(--accent-primary)' : 'var(--border-hairline)'};"><img src="${esc(p.photo_url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"></button>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);"><span>Dim</span><span>${Math.round(card.dim * 100)}%</span></div>
        <input type="range" min="0" max="85" value="${Math.round(card.dim * 100)}" oninput="storySetDim(this.value/100)" ${card.photoUrl ? '' : 'disabled'} style="width:100%;accent-color:var(--accent-primary);">
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);"><span>Zoom</span><span>${Math.round(card.transform.scale * 100)}%</span></div>
        <input type="range" min="100" max="400" value="${Math.round(card.transform.scale * 100)}" oninput="storySetZoom(this.value/100)" ${card.photoUrl ? '' : 'disabled'} style="width:100%;accent-color:var(--accent-primary);">
      </div>
      <button onclick="storyResetPosition()" ${card.photoUrl ? '' : 'disabled'} style="align-self:flex-start;border:1px solid var(--border-strong);background:#fff;color:var(--text-primary);border-radius:999px;padding:7px 14px;font-size:12px;cursor:pointer;">↺ Reset position</button>
      ${desktop ? `<p style="font-size:11.5px;color:var(--text-tertiary);margin:0;">Drag the photo on the canvas to pan · scroll or pinch to zoom.</p>` : ''}
    </div>`;
}
function storyElementsPanelHtml() {
  const card = currentCard();
  return `<div style="display:flex;flex-direction:column;gap:0;">
    ${STORY_TOGGLES.map(([key, label, hasScope]) => {
      const on = card.show[key];
      const dayActive = card.scopeOf[key] === 'day', tripActive = card.scopeOf[key] === 'trip';
      return `<div style="display:flex;flex-direction:column;gap:8px;padding:10px 2px;border-bottom:1px solid var(--border-hairline);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <span style="font-size:14px;font-weight:${on ? '600' : '500'};color:${on ? 'var(--text-primary)' : 'var(--text-secondary)'};">${label}</span>
          <button onclick="storyToggleElement('${key}')" style="position:relative;width:40px;height:24px;border-radius:999px;border:none;cursor:pointer;padding:0;flex:none;background:${on ? 'var(--accent-primary)' : 'var(--border-strong)'};">
            <span style="position:absolute;top:2px;left:${on ? '20px' : '2px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:left .15s ease;display:block;"></span>
          </button>
        </div>
        ${hasScope && on ? `<div style="display:inline-flex;border:1px solid var(--border-hairline);border-radius:999px;overflow:hidden;align-self:flex-start;">
          <button onclick="storySetElementScope('${key}','day')" style="border:none;padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer;background:${dayActive ? 'var(--accent-primary)' : 'transparent'};color:${dayActive ? '#fff' : 'var(--text-tertiary)'};">Day</button>
          <button onclick="storySetElementScope('${key}','trip')" style="border:none;padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer;background:${tripActive ? 'var(--accent-primary)' : 'transparent'};color:${tripActive ? '#fff' : 'var(--text-tertiary)'};">Trip</button>
        </div>` : ''}
      </div>`;
    }).join('')}
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 2px 2px;margin-top:4px;">
      <div style="display:flex;align-items:center;gap:8px;">${STORY_ICON_LOCK}<span style="font-size:14px;color:var(--text-tertiary);">Trip Tracker mark</span></div>
      <span style="font-size:10.5px;font-weight:600;color:var(--text-tertiary);background:var(--bg-recessed);padding:3px 9px;border-radius:999px;white-space:nowrap;">Locked · free plan</span>
    </div>
  </div>`;
}
function storyThemePanelHtml() {
  const card = currentCard();
  return `<div style="display:flex;flex-direction:column;gap:18px;">
    <div style="display:flex;gap:16px;">
      ${Object.entries(STORY_THEMES).map(([k, t]) => `<button onclick="storySetTheme('${k}')" style="display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:none;cursor:pointer;">
        <span style="width:44px;height:44px;border-radius:50%;display:block;border:3px solid ${card.theme === k ? 'var(--accent-primary)' : 'transparent'};background:linear-gradient(135deg,${t.bg},${t.accent});"></span>
        <span style="font-size:12px;font-weight:${card.theme === k ? '700' : '500'};color:${card.theme === k ? 'var(--text-primary)' : 'var(--text-tertiary)'};text-transform:capitalize;">${k}</span>
      </button>`).join('')}
    </div>
    <div style="border-top:1px solid var(--border-hairline);padding-top:14px;display:flex;flex-direction:column;gap:8px;">
      <div style="font-size:11.5px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;">Presets</div>
      ${storyPresets().map((p, i) => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:var(--bg-page);border-radius:10px;">
        <span style="font-size:13px;color:var(--text-primary);">${esc(p.name)}</span>
        <div style="display:flex;gap:6px;">
          <button onclick="storyApplyPreset(${i})" style="border:1px solid var(--border-strong);background:#fff;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;">Apply</button>
          <button onclick="storyDeletePreset(${i})" style="border:1px solid var(--color-danger-border);color:var(--color-danger);background:#fff;border-radius:8px;padding:4px 10px;font-size:11px;cursor:pointer;">✕</button>
        </div>
      </div>`).join('') || ''}
      ${storyEditor.presetDraftOpen ? `<div style="display:flex;gap:6px;">
        <input type="text" placeholder="Preset name" value="${esc(storyEditor.presetNameDraft)}" oninput="storyEditor.presetNameDraft=this.value" style="flex:1;min-width:0;padding:8px 10px;border:1px solid var(--border-strong);border-radius:8px;font-size:13px;">
        <button onclick="storySavePreset()" style="border:none;background:var(--accent-primary);color:#fff;border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;flex:none;">Save</button>
        <button onclick="storyCancelPresetDraft()" style="border:1px solid var(--border-strong);background:#fff;border-radius:8px;padding:8px 10px;font-size:12px;cursor:pointer;flex:none;">✕</button>
      </div>` : `<button onclick="storyOpenPresetDraft()" style="align-self:flex-start;border:1px dashed var(--border-strong);background:none;color:var(--text-secondary);border-radius:8px;padding:8px 12px;font-size:12px;cursor:pointer;">+ Save current as preset</button>`}
    </div>
  </div>`;
}
function storyCardsPanelHtml() {
  return `<div style="display:flex;flex-direction:column;gap:14px;">
    <p style="font-size:13px;color:var(--text-secondary);margin:0;">Each card has its own photo and element mix. Start full on the first, keep the rest light — a tag or two is plenty. Tap a card to edit it.</p>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${storyEditor.cards.map((c, i) => {
        const active = i === storyEditor.activeCardIdx;
        return `<div style="display:flex;align-items:center;gap:8px;background:var(--bg-page);border-radius:12px;padding:8px;">
          <button onclick="storySelectCard(${i})" style="display:flex;align-items:center;gap:10px;border:none;background:none;padding:0;cursor:pointer;flex:1;min-width:0;">
            <canvas id="cardThumb_${c.id}" width="${STORY_W}" height="${STORY_H}" style="width:34px;height:60px;border-radius:8px;flex:none;display:block;border:2px solid ${active ? 'var(--accent-primary)' : 'var(--border-hairline)'};"></canvas>
            <span style="font-size:13px;font-weight:${active ? '700' : '500'};color:${active ? 'var(--text-primary)' : 'var(--text-secondary)'};">Card ${i + 1}</span>
          </button>
          <button onclick="storyMoveCard(${i},-1)" style="border:none;background:none;font-size:14px;padding:2px 6px;${i > 0 ? 'cursor:pointer;color:var(--text-secondary);' : 'cursor:default;color:var(--border-strong);'}">↑</button>
          <button onclick="storyMoveCard(${i},1)" style="border:none;background:none;font-size:14px;padding:2px 6px;${i < storyEditor.cards.length - 1 ? 'cursor:pointer;color:var(--text-secondary);' : 'cursor:default;color:var(--border-strong);'}">↓</button>
          <button onclick="storyDownloadCardAt(${i})" style="border:none;background:none;cursor:pointer;color:var(--accent-primary);font-size:14px;padding:2px 6px;">⬇</button>
          ${storyEditor.cards.length > 1 ? `<button onclick="storyRemoveCard(${i})" style="border:none;background:none;cursor:pointer;color:var(--color-danger);font-size:14px;padding:2px 6px;">✕</button>` : ''}
        </div>`;
      }).join('')}
    </div>
    <button onclick="storyAddCard()" style="align-self:flex-start;border:1px dashed var(--border-strong);background:none;color:var(--accent-primary);border-radius:999px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;">+ Add card</button>
    ${storyEditor.cards.length > 1 && !isStoryDesktop() ? `<button onclick="storyDownloadAll()" style="margin-top:2px;border:none;background:var(--accent-primary);color:#fff;border-radius:10px;padding:11px 14px;font-size:13px;font-weight:700;cursor:pointer;">${storyEditor.batchDownloading ? 'Downloading…' : 'Download all (' + storyEditor.cards.length + ')'}</button>` : ''}
  </div>`;
}

// ---- day picker ----
function storyDayChipLabel() {
  const d = _storyDays.find(x => x.id === storyEditor.dayId);
  return d ? `Day ${d.day_number} — ${d.title || ''}` : 'Pick a day';
}
function storyDayPickerHtml() {
  return `<div style="position:absolute;top:40px;left:0;background:#fff;border-radius:12px;box-shadow:var(--shadow-e3);padding:6px;min-width:230px;z-index:30;">
    ${_storyDays.map(d => `<button onclick="storySetDay('${d.id}')" style="display:block;width:100%;text-align:left;border:none;background:${d.id === storyEditor.dayId ? 'var(--accent-primary-subtle)' : 'transparent'};color:${d.id === storyEditor.dayId ? 'var(--text-primary)' : 'var(--text-secondary)'};border-radius:8px;padding:9px 10px;font-size:13px;cursor:pointer;">Day ${d.day_number} — ${esc(d.title || '')}</button>`).join('') || '<div style="padding:9px 10px;font-size:13px;color:var(--text-tertiary);">No days yet</div>'}
  </div>`;
}
function storyToggleDayPicker() { storyEditor.dayPickerOpen = !storyEditor.dayPickerOpen; renderStoryModule(); }
function storySetDay(id) { storyEditor.dayId = id; storyEditor.dayPickerOpen = false; renderStoryModule(); }

let _dayPickerClickHandler = null;
function wireStoryOutsideClick() {
  if (_dayPickerClickHandler) document.removeEventListener('click', _dayPickerClickHandler, true);
  _dayPickerClickHandler = e => {
    if (!storyEditor || !storyEditor.dayPickerOpen) return;
    if (e.target.closest('[data-daypicker-root]')) return;
    storyEditor.dayPickerOpen = false;
    renderStoryModule();
  };
  document.addEventListener('click', _dayPickerClickHandler, true);
}

// ---- layout: re-render on crossing the 900px breakpoint ----
let _storyResizeHandler = null, _storyIsDesktopCached = null;
function wireStoryResize() {
  _storyIsDesktopCached = isStoryDesktop();
  if (_storyResizeHandler) window.removeEventListener('resize', _storyResizeHandler);
  _storyResizeHandler = () => {
    const route = parseRoute();
    if (!(route.view === 'trip' && route.section === 'photos')) return; // navigated away
    const nowDesktop = isStoryDesktop();
    if (nowDesktop !== _storyIsDesktopCached) { _storyIsDesktopCached = nowDesktop; renderStoryModule(); }
  };
  window.addEventListener('resize', _storyResizeHandler);
}

function storyExitEditor() { goTrip(activeTrip.id, 'overview'); }

// ---- panel switching ----
// Mobile: tapping the already-open tool closes the sheet back to the icon row.
function storySetPanel(name) {
  storyEditor.activePanel = (storyEditor.activePanel === name) ? null : name;
  renderStoryModule();
}
// Desktop: the panel is always open, tabs just switch content.
function storySelectPanel(name) { storyEditor.activePanel = name; renderStoryModule(); }

function storyRefreshPanelBody() {
  const el = document.getElementById('storySheetBody');
  if (el) el.innerHTML = storyPanelBodyHtml();
}

// ---- per-card controls ----
function storySetCardPhoto(url) {
  const c = currentCard();
  c.photoUrl = url;
  c.transform = { scale: 1, x: 0, y: 0 };
  renderStoryModule();
}
function storySetDim(v) { currentCard().dim = v; drawMainCanvas(); }
function storySetZoom(v) { currentCard().transform = { ...currentCard().transform, scale: v }; drawMainCanvas(); }
function storyResetPosition() { currentCard().transform = { scale: 1, x: 0, y: 0 }; drawMainCanvas(); storyRefreshPanelBody(); }
function storyToggleElement(key) { const c = currentCard(); c.show[key] = !c.show[key]; drawMainCanvas(); storyRefreshPanelBody(); }
function storySetElementScope(key, scope) { currentCard().scopeOf[key] = scope; drawMainCanvas(); storyRefreshPanelBody(); }
function storySetTheme(k) { currentCard().theme = k; drawMainCanvas(); storyRefreshPanelBody(); }

// ---- card set management ----
function storySelectCard(i) { storyEditor.activeCardIdx = i; renderStoryModule(); }
function storyAddCard() {
  const theme = currentCard().theme;
  storyEditor.cards.push(lightCardDefaults(theme));
  storyEditor.activeCardIdx = storyEditor.cards.length - 1;
  renderStoryModule();
}
function storyRemoveCard(i) {
  if (storyEditor.cards.length <= 1) return;
  storyEditor.cards.splice(i, 1);
  storyEditor.activeCardIdx = Math.min(storyEditor.activeCardIdx, storyEditor.cards.length - 1);
  renderStoryModule();
}
function storyMoveCard(i, dir) {
  const j = i + dir; if (j < 0 || j >= storyEditor.cards.length) return;
  const cards = storyEditor.cards;
  [cards[i], cards[j]] = [cards[j], cards[i]];
  if (storyEditor.activeCardIdx === i) storyEditor.activeCardIdx = j;
  else if (storyEditor.activeCardIdx === j) storyEditor.activeCardIdx = i;
  renderStoryModule();
}

// ---- presets ----
function storyPresets() {
  try { return JSON.parse(localStorage.getItem(STORY_PRESETS_KEY) || '[]'); } catch (e) { return []; }
}
function storyOpenPresetDraft() { storyEditor.presetDraftOpen = true; storyEditor.presetNameDraft = ''; storyRefreshPanelBody(); }
function storyCancelPresetDraft() { storyEditor.presetDraftOpen = false; storyRefreshPanelBody(); }
function storySavePreset() {
  const name = (storyEditor.presetNameDraft || 'Untitled').trim() || 'Untitled';
  const c = currentCard();
  const presets = storyPresets();
  presets.push({ name, theme: c.theme, show: { ...c.show }, scopeOf: { ...c.scopeOf } });
  localStorage.setItem(STORY_PRESETS_KEY, JSON.stringify(presets));
  storyEditor.presetDraftOpen = false;
  storyRefreshPanelBody();
}
function storyApplyPreset(i) {
  const p = storyPresets()[i]; if (!p) return;
  const c = currentCard();
  c.theme = p.theme; c.show = { ...c.show, ...p.show }; c.scopeOf = { ...c.scopeOf, ...(p.scopeOf || {}) };
  drawMainCanvas(); storyRefreshPanelBody();
}
function storyDeletePreset(i) {
  const presets = storyPresets(); presets.splice(i, 1);
  localStorage.setItem(STORY_PRESETS_KEY, JSON.stringify(presets));
  storyRefreshPanelBody();
}

// ---- data helpers (per-scope, not per-card) ----
// metricsFor('day') and metricsFor('trip') are both computed up front each
// draw; each element then reads whichever one its own scopeOf says to.
function metricsFor(scope) {
  const day = _storyDays.find(d => d.id === storyEditor.dayId);
  const idx = _storyDays.findIndex(d => d.id === storyEditor.dayId);
  if (scope === 'day') {
    const km = day ? Number(day.distance_km) || 0 : 0;
    const done = day ? (_storyProgress[day.id] || 0) : 0;
    return { day, idx, km, done, ascent: day ? Number(day.ascent_m) || 0 : 0, label: day ? day.title : '' };
  }
  const km = _storyDays.reduce((s, d) => s + (Number(d.distance_km) || 0), 0);
  const done = _storyDays.reduce((s, d) => s + (_storyProgress[d.id] || 0), 0);
  const ascent = _storyDays.reduce((s, d) => s + (Number(d.ascent_m) || 0), 0);
  return { day, idx, km, done, ascent, label: activeTrip.name };
}

// Merge every day's elevation profile end to end so "Trip" scope gets one
// continuous chart with cumulative distance, matching how Statistics does it.
async function storyTripProfile() {
  const gpxDays = _storyDays.filter(d => d.gpx_url);
  if (!gpxDays.length) return null;
  const profiles = await Promise.all(gpxDays.map(d => fetchProfile(d.gpx_url)));
  const good = profiles.map((p, i) => [p, gpxDays[i]]).filter(([p]) => p && p.hasEle);
  if (!good.length) return null;
  const merged = { dist: [], ele: [], gain: [] };
  let kmOff = 0, gainOff = 0;
  good.forEach(([p]) => {
    for (let i = 0; i < p.dist.length; i++) {
      merged.dist.push(kmOff + p.dist[i]); merged.ele.push(p.ele[i]); merged.gain.push(gainOff + p.gain[i]);
    }
    kmOff += p.totalKm; gainOff += p.totalGain;
  });
  merged.hasEle = true;
  merged.totalKm = kmOff; merged.totalGain = gainOff;
  merged.minEle = Math.min(...merged.ele); merged.maxEle = Math.max(...merged.ele);
  return merged;
}

// Distance-weighted average speed from the same pace engine Route & Days uses
// (js/trip-pace.js) — not a separate estimate.
function storyPaceKmh(scope) {
  const cfg = activityConfig(activeTrip);
  if (!cfg.paceKeys || !cfg.paceKeys.length) return null;
  if (scope === 'day') {
    const day = _storyDays.find(d => d.id === storyEditor.dayId);
    const p = day ? computeDayPace(day, activeTrip.pace_assumptions) : null;
    return p ? p.speedKmh : null;
  }
  const days = _storyDays.filter(d => d.distance_km);
  if (!days.length) return null;
  let totalKm = 0, totalHours = 0;
  days.forEach(d => {
    const p = computeDayPace(d, activeTrip.pace_assumptions);
    if (p) { totalKm += Number(d.distance_km); totalHours += p.movingHours; }
  });
  return totalHours ? totalKm / totalHours : null;
}

// Today's min/max temperature, reusing Weather's own cached fetch (js/trip-weather.js)
// — no separate API call pattern, no separate key.
async function storyWeather() {
  const day = _storyDays.find(d => d.id === storyEditor.dayId);
  if (!day || !day.date) return null;
  const coords = await wxCoordsFor(day);
  if (!coords) return null;
  const wx = await wxFetch(coords.lat, coords.lon);
  if (!wx || !wx.hourly || !wx.hourly.time) return null;
  const temps = wx.hourly.time.map((t, i) => t.startsWith(day.date) ? wx.hourly.temperature_2m[i] : null).filter(v => v != null);
  if (!temps.length) return null;
  return { min: Math.min(...temps), max: Math.max(...temps) };
}

function currentPhotoRowFor(url) { return _storyPhotos.find(p => p.photo_url === url) || null; }

// ---- route trace (the legacy "watermark map") ----
// Projects every day's GPX onto one canvas region with an equirectangular
// projection corrected for latitude, fit to the trip's own bounding box —
// there is no hard-coded basemap here since the app is not tied to one trip.
function storyProjector(allPoints, w, h, pad) {
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  allPoints.forEach(pts => pts.forEach(([lat, lon]) => {
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
  }));
  const midLat = (minLat + maxLat) / 2;
  const latCos = Math.cos(midLat * Math.PI / 180) || 0.5;
  const spanLon = (maxLon - minLon) * latCos || 0.0001;
  const spanLat = (maxLat - minLat) || 0.0001;
  const innerW = w - pad * 2, innerH = h - pad * 2;
  const scale = Math.min(innerW / spanLon, innerH / spanLat);
  const drawW = spanLon * scale, drawH = spanLat * scale;
  const offX = pad + (innerW - drawW) / 2, offY = pad + (innerH - drawH) / 2;
  return ([lat, lon]) => [
    offX + (lon - minLon) * latCos * scale,
    offY + (maxLat - lat) * scale,
  ];
}

async function routeDaysFor(scope) {
  // Trip scope: every day with a track. Day scope: just the selected one —
  // still drawn through the same projector so a single stage reads as a
  // clean, well-framed line rather than a tiny squiggle in a trip-sized box.
  if (scope === 'trip') return _storyDays.filter(d => d.gpx_url);
  const day = _storyDays.find(d => d.id === storyEditor.dayId);
  return day && day.gpx_url ? [day] : [];
}

async function drawStoryTrace(ctx, x, y, w, h, scope) {
  const routeDays = await routeDaysFor(scope);
  if (!routeDays.length) return 0;
  const profiles = await Promise.all(routeDays.map(d => fetchProfile(d.gpx_url)));
  const withPts = routeDays.map((d, i) => [d, profiles[i]]).filter(([, p]) => p && p.latlon && p.latlon.length > 1);
  if (!withPts.length) return 0;

  const project = storyProjector(withPts.map(([, p]) => p.latlon), w, h, 36);
  const currentIdx = _storyDays.findIndex(d => d.id === storyEditor.dayId);

  withPts.forEach(([d, p], i) => {
    const dIdx = _storyDays.findIndex(x2 => x2.id === d.id);
    const color = DAY_TRACK_COLORS[i % DAY_TRACK_COLORS.length];
    const pix = p.latlon.map(project);

    // Dim full line underneath everything — the "watermark".
    ctx.beginPath();
    pix.forEach(([px, py], j) => { const X = x + px, Y = y + py; j === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); });
    ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = 0.16; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

    // Lit portion: fully done days solid, the current day lit up to progress,
    // days ahead left dim. Day scope always lights the whole line since there
    // is only the one day and the number above already shows how far into it.
    let litFrac = 0;
    if (scope === 'day') litFrac = 1;
    else if (dIdx < currentIdx) litFrac = 1;
    else if (dIdx === currentIdx) { const km = Number(d.distance_km) || 0; litFrac = km ? Math.min(1, (_storyProgress[d.id] || 0) / km) : 0; }
    const litCount = Math.max(0, Math.round(pix.length * litFrac));
    if (litCount > 1) {
      ctx.beginPath();
      pix.slice(0, litCount).forEach(([px, py], j) => { const X = x + px, Y = y + py; j === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); });
      ctx.strokeStyle = color; ctx.globalAlpha = 0.95; ctx.lineWidth = 10; ctx.stroke();
      // marker at the point reached
      const [mx, my] = pix[litCount - 1];
      ctx.beginPath(); ctx.arc(x + mx, y + my, 12, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
  return h;
}

// ---- canvas ----
function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';   // Supabase storage sends permissive CORS
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('image load failed'));
    i.src = src;
  });
}
// Cache of loaded background Images by URL. Dragging/zooming redraws every
// frame; re-awaiting loadImg() on each of those frames meant several
// draw calls could be in flight at once, each racing the others' clearRect
// against a stale one's drawImage. With the image already resolved, the hot
// gesture-redraw path below never awaits anything.
const _bgImgCache = new Map();
function loadImgCached(src) {
  if (!_bgImgCache.has(src)) {
    const p = loadImg(src);
    p.catch(() => _bgImgCache.delete(src));
    _bgImgCache.set(src, p);
  }
  return _bgImgCache.get(src);
}
function clampPhotoTransform(t, imgW, imgH) {
  const baseScale = Math.max(STORY_W / imgW, STORY_H / imgH);
  let scale = Number.isFinite(t.scale) ? t.scale : 1;
  scale = Math.max(1, Math.min(4, scale));
  const w = imgW * baseScale * scale, h = imgH * baseScale * scale;
  const maxX = Math.max(0, (w - STORY_W) / 2), maxY = Math.max(0, (h - STORY_H) / 2);
  const x = Number.isFinite(t.x) ? t.x : 0;
  const y = Number.isFinite(t.y) ? t.y : 0;
  return { scale, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
}

// Renders one card to any canvas (the live main canvas, an offscreen
// download canvas, or a small Cards-panel thumbnail) — draw logic doesn't
// care which. Sequencing is tracked per-canvas (canvas._drawSeq) rather than
// with one global counter, since several canvases can be drawing at once
// (main canvas + card thumbnails).
async function drawCardTo(canvas, card) {
  canvas._drawSeq = (canvas._drawSeq || 0) + 1;
  const seq = canvas._drawSeq;
  const ctx = canvas.getContext('2d');
  const th = STORY_THEMES[card.theme] || STORY_THEMES.trail;
  const mDay = metricsFor('day'), mTrip = metricsFor('trip');
  const mFor = k => card.scopeOf[k] === 'trip' ? mTrip : mDay;

  let drew = false;
  if (card.photoUrl) {
    try {
      const img = await loadImgCached(card.photoUrl);
      if (seq !== canvas._drawSeq) return;
      ctx.clearRect(0, 0, STORY_W, STORY_H);
      card.transform = clampPhotoTransform(card.transform, img.width, img.height);
      const baseScale = Math.max(STORY_W / img.width, STORY_H / img.height);
      const scale = baseScale * card.transform.scale;
      const w = img.width * scale, h = img.height * scale;
      const x = (STORY_W - w) / 2 + card.transform.x;
      const y = (STORY_H - h) / 2 + card.transform.y;
      ctx.drawImage(img, x, y, w, h);
      ctx.fillStyle = `rgba(20,21,15,${card.dim})`;
      ctx.fillRect(0, 0, STORY_W, STORY_H);
      drew = true;
    } catch (e) { /* fall through to the gradient */ }
  }
  if (!drew) {
    ctx.clearRect(0, 0, STORY_W, STORY_H);
    const g = ctx.createLinearGradient(0, 0, 0, STORY_H);
    g.addColorStop(0, th.bg);
    g.addColorStop(1, th.accent + '33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  }

  ctx.textAlign = 'center';
  const bottomLimit = STORY_H * (1 - STORY_SAFE_FRAC);
  let y = STORY_H * STORY_SAFE_FRAC + 50;
  const room = need => y + need <= bottomLimit;

  if (card.show.title && room(74)) {
    ctx.fillStyle = th.text;
    ctx.font = '800 62px Manrope, -apple-system, Segoe UI, sans-serif';
    wrapText(ctx, activeTrip.name.toUpperCase(), STORY_W / 2, y, 900, 74);
    y += 120;
  }
  if (card.show.day && room(70)) {
    const m = mFor('day');
    ctx.fillStyle = th.dim;
    ctx.font = '600 40px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(card.scopeOf.day === 'trip'
      ? `${_storyDays.length} DAYS`
      : `DAY ${m.idx + 1} OF ${_storyDays.length}`, STORY_W / 2, y);
    y += 70;
    if (m.label && room(56)) {
      ctx.fillStyle = th.text;
      ctx.font = '700 46px Manrope, -apple-system, Segoe ui, sans-serif';
      wrapText(ctx, m.label, STORY_W / 2, y, 900, 56);
      y += 90;
    }
  }

  if (card.show.profile && room(310)) {
    const scope = card.scopeOf.profile;
    const m = mFor('profile');
    const p = scope === 'trip' ? await storyTripProfile() : (m.day && m.day.gpx_url ? await fetchProfile(m.day.gpx_url) : null);
    if (seq !== canvas._drawSeq) return;
    if (p && p.hasEle) {
      const px = 110, pw = STORY_W - 220, ph = 220, py = y;
      const minE = p.minEle, spanE = (p.maxEle - p.minEle) || 1;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(p.dist.length / 200));
      for (let i = 0; i < p.dist.length; i += step) {
        const X = px + (p.dist[i] / p.totalKm) * pw;
        const Y = py + ph - ((p.ele[i] - minE) / spanE) * ph;
        i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.strokeStyle = th.accent; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.lineTo(px + pw, py + ph); ctx.lineTo(px, py + ph); ctx.closePath();
      ctx.fillStyle = th.accent + '2E'; ctx.fill();
      if (m.done > 0 && p.totalKm) {
        const fx = px + Math.min(1, m.done / p.totalKm) * pw;
        ctx.beginPath(); ctx.moveTo(fx, py - 10); ctx.lineTo(fx, py + ph);
        ctx.strokeStyle = th.text; ctx.lineWidth = 4; ctx.setLineDash([12, 10]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(fx, py + ph, 16, 0, Math.PI * 2); ctx.fillStyle = th.text; ctx.fill();
      }
      y += ph + 90;
    }
  }

  if (card.show.map && room(200)) {
    const scope = card.scopeOf.map;
    const boxH = Math.min(460, bottomLimit - y);
    const consumed = await drawStoryTrace(ctx, 60, y, STORY_W - 120, boxH, scope);
    if (seq !== canvas._drawSeq) return;
    if (consumed) y += consumed + 50;
  }

  if (card.show.distance && room(90)) {
    const m = mFor('distance');
    ctx.fillStyle = th.accent;
    ctx.font = '800 110px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(m.km ? `${Math.round(m.done)} / ${Math.round(m.km)} km` : `${Math.round(m.done)} km`, STORY_W / 2, y);
    y += 80;
  }
  if (card.show.elevation && room(66)) {
    const m = mFor('elevation');
    if (m.ascent) {
      ctx.fillStyle = th.dim;
      ctx.font = '500 42px Manrope, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`+${Math.round(m.ascent)} m climbed${card.scopeOf.elevation === 'trip' ? ' in total' : ' today'}`, STORY_W / 2, y);
      y += 66;
    }
  }
  if (card.show.pace && room(60)) {
    const kmh = storyPaceKmh(card.scopeOf.pace);
    if (kmh) {
      ctx.fillStyle = th.dim;
      ctx.font = '500 38px Manrope, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`⚡ ${kmh.toFixed(1)} km/h avg`, STORY_W / 2, y);
      y += 60;
    }
  }
  if (card.show.weather && room(60)) {
    const wx = await storyWeather();
    if (seq !== canvas._drawSeq) return;
    if (wx) {
      ctx.fillStyle = th.dim;
      ctx.font = '500 38px Manrope, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`🌡 ${Math.round(wx.min)}–${Math.round(wx.max)}°C`, STORY_W / 2, y);
      y += 60;
    }
  }
  if (card.show.place && room(52)) {
    const row = currentPhotoRowFor(card.photoUrl);
    if (row && row.place_name) {
      ctx.fillStyle = th.dim;
      ctx.font = '500 36px Manrope, -apple-system, Segoe UI, sans-serif';
      ctx.fillText(`📍 ${row.place_name}`, STORY_W / 2, y);
      y += 52;
    }
  }
  if (card.show.stay && room(60)) {
    ctx.fillStyle = th.dim;
    ctx.font = '500 38px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('🏠 tonight', STORY_W / 2, y);
    y += 60;
  }
  drawStoryWatermark(ctx, th, bottomLimit);
}

// Always on (not one of STORY_TOGGLES) — a small drawn wordmark, not a bare
// URL. No paid-plan system exists yet to actually let it be removed; the
// Elements panel shows it locked/greyed with a "Locked · free plan" badge as
// a placeholder for that, per the design intent, not a built gate.
function drawStoryWatermark(ctx, th, bottomLimit) {
  const label = 'Trip Tracker';
  ctx.font = '700 30px Manrope, -apple-system, Segoe UI, sans-serif';
  const textW = ctx.measureText(label).width;
  const iconW = 26, gap = 10;
  const startX = STORY_W / 2 - (iconW + gap + textW) / 2;
  const wy = bottomLimit - 40;
  const mx = startX + iconW / 2, my = wy - 10;

  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = th.text; ctx.fillStyle = th.text; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(mx - 9, my + 6); ctx.quadraticCurveTo(mx, my - 9, mx + 9, my + 6); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx - 9, my + 6, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + 9, my + 6, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillText(label, startX + iconW + gap, wy);
  ctx.restore();
  ctx.textAlign = 'center';
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text || '').split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

// ---- direct manipulation: drag to pan, wheel/pinch to zoom ----
function wireStoryCanvasGestures() {
  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;
  const pointers = new Map();
  let mode = null, start = null;

  const toCanvasScale = () => STORY_W / (canvas.getBoundingClientRect().width || STORY_W);

  canvas.addEventListener('pointerdown', e => {
    if (!currentCard().photoUrl) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* some browsers reject this mid multi-touch — harmless, keep tracking the pointer anyway */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      mode = 'pan';
      start = { x: e.clientX, y: e.clientY, t: { ...currentCard().transform } };
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      mode = 'pinch';
      // Floor the start distance — two fingers can land within a pixel of
      // each other on the very first frame; dividing by ~0 sends scale to
      // Infinity/NaN, which used to make the photo vanish.
      start = { dist: Math.max(8, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)), t: { ...currentCard().transform } };
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pan' && pointers.size === 1) {
      const sf = toCanvasScale();
      const dx = (e.clientX - start.x) * sf, dy = (e.clientY - start.y) * sf;
      storyQueueTransform({ ...start.t, x: start.t.x + dx, y: start.t.y + dy });
    } else if (mode === 'pinch' && pointers.size === 2) {
      const pts = [...pointers.values()];
      const dist = Math.max(8, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      const factor = dist / start.dist;
      storyQueueTransform({ ...start.t, scale: start.t.scale * factor });
    }
  });
  const release = e => {
    pointers.delete(e.pointerId);
    if (pointers.size === 1) {
      // Dropped from pinch to a single finger — re-seed the pan baseline from
      // here, otherwise the next move used the pinch's original start point
      // and the photo jumped.
      const [[, p]] = pointers;
      mode = 'pan';
      start = { x: p.x, y: p.y, t: { ...currentCard().transform } };
    } else if (pointers.size === 0) {
      mode = null; start = null;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', e => {
    if (!currentCard().photoUrl) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    storyQueueTransform({ ...currentCard().transform, scale: currentCard().transform.scale * factor });
  }, { passive: false });
}
let _storyTransformRaf = null;
function storyQueueTransform(t) {
  currentCard().transform = t; // clamped for real once the image's actual size is known, inside drawCardTo
  if (_storyTransformRaf) return;
  _storyTransformRaf = requestAnimationFrame(() => { _storyTransformRaf = null; drawMainCanvas(); });
}

// ---- download ----
function downloadCanvasBlob(canvas, filename) {
  canvas.toBlob(b => {
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}
function storyDownloadCardAt(i) {
  const card = storyEditor.cards[i]; if (!card) return;
  const tmp = document.createElement('canvas'); tmp.width = STORY_W; tmp.height = STORY_H;
  drawCardTo(tmp, card).then(() => downloadCanvasBlob(tmp, `${activeTrip.slug || 'trip'}-story-${i + 1}.png`));
}
async function storyDownloadCurrent() {
  storyEditor.downloading = true;
  renderStoryModule();
  await drawMainCanvas();
  const canvas = document.getElementById('storyCanvas');
  downloadCanvasBlob(canvas, `${activeTrip.slug || 'trip'}-story-${storyEditor.activeCardIdx + 1}.png`);
  setTimeout(() => { storyEditor.downloading = false; renderStoryModule(); }, 700);
}
async function storyDownloadAll() {
  storyEditor.batchDownloading = true;
  renderStoryModule();
  for (let i = 0; i < storyEditor.cards.length; i++) {
    const tmp = document.createElement('canvas'); tmp.width = STORY_W; tmp.height = STORY_H;
    await drawCardTo(tmp, storyEditor.cards[i]);
    downloadCanvasBlob(tmp, `${activeTrip.slug || 'trip'}-story-${i + 1}.png`);
    await new Promise(r => setTimeout(r, 300)); // stagger — back-to-back downloads get blocked by some browsers
  }
  storyEditor.batchDownloading = false;
  renderStoryModule();
}

// ---- EXIF/geolocation read, shared by both upload entry points ----
// GPS + capture time read client-side from EXIF (exifr, no backend). Place
// name is a best-effort reverse-geocode against the free OSM Nominatim API
// (no key) — it resolves to the nearest named settlement/area, so it won't
// always surface an unnamed landmark, but costs nothing and needs no infra.
async function readPhotoExifMeta(file) {
  let lat = null, lon = null, takenAt = null, placeName = null;
  if (typeof exifr !== 'undefined') {
    try {
      const gps = await exifr.gps(file);
      if (gps && gps.latitude != null) { lat = gps.latitude; lon = gps.longitude; }
    } catch (e) { /* no GPS block in this photo — fine */ }
    try {
      // No `pick` option — exifr 7.1.3's lite bundle throws unconditionally
      // ("undefined is not iterable") whenever `pick` is used, verified
      // against a real GPS-tagged JPEG. A full parse works fine.
      const tags = await exifr.parse(file);
      if (tags && tags.DateTimeOriginal) takenAt = new Date(tags.DateTimeOriginal).toISOString();
    } catch (e) { /* no EXIF at all — fine */ }
  }
  if (lat != null && lon != null) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&accept-language=en`);
      if (res.ok) {
        const j = await res.json();
        const a = j.address || {};
        placeName = a.hamlet || a.village || a.town || a.suburb || a.city_district || a.city
          || a.county || (j.display_name ? j.display_name.split(',')[0] : null);
      }
    } catch (e) { /* offline or rate-limited — not fatal, just no place name */ }
  }
  return { lat, lon, takenAt, placeName };
}

// Quick-upload from the Photo panel's "+" tile: no day-tag/caption fields —
// tags the photo with this editing session's day, selects it immediately.
async function storyUploadForCard(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const meta = await readPhotoExifMeta(file);
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `trips/${activeTrip.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await sb.storage.from('photos').upload(path, file, { cacheControl: '3600' });
  if (upErr) { alert('Upload failed: ' + upErr.message); return; }
  const { data: { publicUrl } } = sb.storage.from('photos').getPublicUrl(path);
  const { error: insErr } = await db().from('updates').insert({
    trip_id: activeTrip.id, day_id: storyEditor.dayId,
    membership_id: activeMembership?.id || null,
    caption: null, photo_url: publicUrl,
    lat: meta.lat, lon: meta.lon, place_name: meta.placeName, taken_at: meta.takenAt,
  });
  if (insErr) { alert('DB error: ' + insErr.message); return; }
  await loadPhotoPool();
  currentCard().photoUrl = publicUrl;
  currentCard().transform = { scale: 1, x: 0, y: 0 };
  renderStoryModule();
}

// Used by the Gallery tab's "use as story background" button — pre-selects
// the photo on the current card and switches to Story.
function storySetPhoto(url) {
  initStoryEditor();
  currentCard().photoUrl = url;
  currentCard().transform = { scale: 1, x: 0, y: 0 };
  const route = parseRoute();
  if (route.view === 'trip' && route.section === 'gallery') goTrip(activeTrip.id, 'photos');
  else renderStoryModule();
}

// ==================== GALLERY TAB ====================
async function renderGalleryModule() {
  if (moduleGate('photos')) return;
  const main = document.getElementById('main');
  main.innerHTML = '<p class="muted">Loading…</p>';
  await loadPhotoPool();

  main.innerHTML = `
    <div class="pagehead">
      <div><h1>Gallery</h1><div class="subtitle">Every photo from the trip. Upload here or from Story — both go to the same place.</div></div>
    </div>
    ${photoUploadFormHtml()}
    <h2 style="margin-top:20px;">${_storyPhotos.length} photo${_storyPhotos.length === 1 ? '' : 's'}</h2>
    ${photoGalleryGridHtml()}
    ${lightboxHtml()}
  `;
}

// ---- shared markup: upload form, gallery grid, lightbox ----
function photoUploadFieldsHtml() {
  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;align-items:center;">
      <input id="photoFile" type="file" accept="image/*" style="flex:1;min-width:140px;">
      <select id="photoDay" style="width:130px;">
        <option value="">No day tag</option>
        ${_storyDays.map(d => `<option value="${d.id}">Day ${d.day_number}</option>`).join('')}
      </select>
    </div>
    <input id="photoCaption" type="text" placeholder="Caption (optional)" style="width:100%;margin-bottom:8px;">
    <button class="btn btn-primary btn-sm" onclick="uploadPhoto()">Upload</button>
    <span id="photoStatus" class="saveIndicator" style="margin-left:8px;"></span>
    <div class="muted" style="font-size:11px;margin-top:6px;">If the photo has GPS data we'll tag it with a place name automatically.</div>
  `;
}
function photoUploadFormHtml() {
  if (!canPostPhotos()) return '';
  return `<div class="card" style="margin-top:20px;">
    <h2>Add a photo</h2>
    ${photoUploadFieldsHtml()}
  </div>`;
}
function photoGalleryGridHtml() {
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
    ${_storyPhotos.map(u => `
      <div class="card" style="padding:8px;position:relative;">
        <img src="${esc(u.photo_url)}" alt="${esc(u.caption || '')}" loading="lazy"
          style="width:100%;height:140px;object-fit:cover;border-radius:8px;display:block;cursor:zoom-in;"
          onclick="adminOpenLightbox('${esc(u.photo_url)}','${esc(u.caption || '')}')">
        ${u.place_name ? `<div style="font-size:11px;margin-top:6px;color:var(--text-secondary);">📍 ${esc(u.place_name)}</div>` : ''}
        ${u.caption ? `<div style="font-size:12px;margin-top:2px;color:var(--text-secondary);">${esc(u.caption)}</div>` : ''}
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">${(u.taken_at || u.created_at) ? new Date(u.taken_at || u.created_at).toLocaleDateString() : ''}</div>
        <button class="btn btn-sm" style="position:absolute;top:8px;left:8px;padding:2px 7px;font-size:11px;"
          onclick="storySetPhoto('${esc(u.photo_url)}')" title="Use as story background">📲</button>
        ${(isEditor() || (activeMembership && u.membership_id === activeMembership.id))
          ? `<button class="btn btn-sm btn-danger" style="position:absolute;top:8px;right:8px;padding:2px 7px;font-size:11px;" onclick="deletePhoto('${u.id}','${esc(u.photo_url)}')">✕</button>` : ''}
      </div>`).join('') || '<p class="muted">No photos yet.</p>'}
  </div>`;
}
function lightboxHtml() {
  return `<div id="admin-lb" onclick="adminCloseLightbox()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;flex-direction:column;gap:12px;">
    <img id="admin-lb-img" src="" style="max-width:90vw;max-height:85vh;border-radius:12px;object-fit:contain;">
    <div id="admin-lb-cap" style="color:#fff;font-size:14px;text-align:center;max-width:500px;opacity:.85;"></div>
  </div>`;
}

// ---- gallery: upload, delete, lightbox ----
async function uploadPhoto() {
  const file = document.getElementById('photoFile').files[0];
  if (!file) { alert('Pick a file first.'); return; }
  const status = document.getElementById('photoStatus');
  status.textContent = 'Reading photo…'; status.className = 'saveIndicator saving';
  const meta = await readPhotoExifMeta(file);
  if (meta.lat != null) status.textContent = 'Looking up location…';

  status.textContent = 'Uploading…'; status.className = 'saveIndicator saving';
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `trips/${activeTrip.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error: upErr } = await sb.storage.from('photos').upload(path, file, { cacheControl: '3600' });
  if (upErr) { status.textContent = 'Upload failed: ' + upErr.message; status.className = 'saveIndicator'; return; }
  const { data: { publicUrl } } = sb.storage.from('photos').getPublicUrl(path);
  const dayId = document.getElementById('photoDay').value || null;
  const caption = document.getElementById('photoCaption').value.trim() || null;
  const { error: insErr } = await db().from('updates').insert({
    trip_id: activeTrip.id, day_id: dayId,
    membership_id: activeMembership?.id || null,
    caption, photo_url: publicUrl,
    lat: meta.lat, lon: meta.lon, place_name: meta.placeName, taken_at: meta.takenAt,
  });
  if (insErr) { status.textContent = 'DB error: ' + insErr.message; status.className = 'saveIndicator'; return; }
  status.textContent = '✓ Uploaded' + (meta.placeName ? ` — 📍 ${meta.placeName}` : ''); status.className = 'saveIndicator saved';
  _rerenderPhotoTab();
}
async function deletePhoto(id, url) {
  if (!confirm('Delete this photo? This cannot be undone.')) return;
  const storagePath = url.split('/photos/').slice(1).join('/photos/');
  if (storagePath) await sb.storage.from('photos').remove([storagePath]);
  await db().from('updates').delete().eq('id', id);
  _rerenderPhotoTab();
}
function adminOpenLightbox(url, caption) {
  const lb = document.getElementById('admin-lb');
  document.getElementById('admin-lb-img').src = url;
  document.getElementById('admin-lb-cap').textContent = caption || '';
  lb.style.display = 'flex';
  document.addEventListener('keydown', adminLbKey);
}
function adminCloseLightbox() {
  document.getElementById('admin-lb').style.display = 'none';
  document.removeEventListener('keydown', adminLbKey);
}
function adminLbKey(e) { if (e.key === 'Escape') adminCloseLightbox(); }
