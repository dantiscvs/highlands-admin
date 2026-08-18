// Story — the photo gallery plus a story-card generator.
//
// The legacy PWA could export one fixed 1080x1920 image. This version keeps
// that idea and makes the overlay configurable: pick a background photo, choose
// which stats to burn in, and download. Everything renders client-side on a
// canvas, so nothing is uploaded to make a card.

const STORY_W = 1080, STORY_H = 1920;
const STORY_THEMES = {
  trail:  { bg: '#23261E', accent: '#7FB587', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
  ember:  { bg: '#2A1B12', accent: '#E08A54', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
  slate:  { bg: '#1B1D18', accent: '#86B4CC', text: '#FBFAF6', dim: 'rgba(251,250,246,.72)' },
};

let storyState = {
  photoUrl: null,          // background photo, or null for a gradient
  dayId: null,
  theme: 'trail',
  show: { title: true, day: true, distance: true, elevation: true, profile: true, stay: false, url: true },
  dim: 0.5,
};
let _storyDays = [], _storyPhotos = [], _storyProgress = {};

async function renderStoryModule() {
  if (moduleGate('photos')) return;
  const main = document.getElementById('main');
  main.innerHTML = '<p class="muted">Loading…</p>';

  const [{ data: updates }, { data: days }, { data: prog }] = await Promise.all([
    db().from('updates').select('*').eq('trip_id', activeTrip.id).not('photo_url', 'is', null).order('created_at', { ascending: false }),
    db().from('trip_days').select('*').eq('trip_id', activeTrip.id).order('order_index'),
    db().from('day_progress').select('*').eq('trip_id', activeTrip.id),
  ]);
  _storyPhotos = updates || [];
  _storyDays = days || [];
  _storyProgress = {};
  (prog || []).forEach(p => { _storyProgress[p.day_id] = Number(p.ridden_km) || 0; });

  if (!storyState.dayId) {
    const iso = todayIso();
    const d = _storyDays.find(x => x.date === iso) || _storyDays.find(x => x.distance_km) || _storyDays[0];
    storyState.dayId = d ? d.id : null;
  }
  if (!storyState.photoUrl && _storyPhotos.length) storyState.photoUrl = _storyPhotos[0].photo_url;

  main.innerHTML = `
    <div class="pagehead">
      <div><h1>Story</h1><div class="subtitle">The trip's photo gallery, and shareable story cards built from it.</div></div>
    </div>

    <div class="storygrid">
      <div>
        <div class="card" style="margin-bottom:14px;">
          <h2>Story card</h2>
          <p class="muted" style="font-size:var(--text-sm);margin-bottom:14px;">
            1080 × 1920, sized for Instagram and WhatsApp stories. Rendered in your browser — the photo
            never leaves the page to make one.</p>

          <div class="field"><label>Day</label>
            <select onchange="storySet('dayId', this.value)">
              ${_storyDays.map(d => `<option value="${d.id}" ${d.id === storyState.dayId ? 'selected' : ''}>Day ${d.day_number}${d.title ? ' — ' + esc(d.title) : ''}</option>`).join('')}
            </select>
          </div>

          <div class="field"><label>Background</label>
            <div class="storythumbs">
              <button class="storythumb ${!storyState.photoUrl ? 'on' : ''}" onclick="storySet('photoUrl', null)" title="No photo — gradient">
                <span class="grad"></span></button>
              ${_storyPhotos.slice(0, 11).map(p => `
                <button class="storythumb ${storyState.photoUrl === p.photo_url ? 'on' : ''}"
                  onclick="storySetPhoto('${esc(p.photo_url)}')">
                  <img src="${esc(p.photo_url)}" alt="" loading="lazy"></button>`).join('')}
            </div>
            ${!_storyPhotos.length ? '<div class="muted" style="font-size:var(--text-xs);margin-top:6px;">No photos yet — upload one below and it becomes available here.</div>' : ''}
          </div>

          <div class="field"><label>Theme</label>
            <div style="display:flex;gap:6px;">
              ${Object.keys(STORY_THEMES).map(k => `<button class="btn btn-sm ${storyState.theme === k ? 'btn-primary' : ''}" onclick="storySet('theme','${k}')" style="text-transform:capitalize;">${k}</button>`).join('')}
            </div>
          </div>

          <div class="field"><label>Photo dimming <span class="muted" style="font-weight:400;">(${Math.round(storyState.dim * 100)}%)</span></label>
            <input type="range" min="0" max="85" value="${Math.round(storyState.dim * 100)}"
              oninput="storySet('dim', this.value/100)" style="width:100%;" ${storyState.photoUrl ? '' : 'disabled'}>
          </div>

          <div class="field"><label>Show on the card</label>
            <div class="storytoggles">
              ${[['title','Trip name'],['day','Day counter'],['distance','Distance'],['elevation','Climbing'],
                 ['profile','Elevation profile'],['stay','Tonight\'s stay'],['url','Follow link']]
                .map(([k, l]) => `<label><input type="checkbox" ${storyState.show[k] ? 'checked' : ''}
                  onchange="storyToggle('${k}', this.checked)"> ${l}</label>`).join('')}
            </div>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px;">
            <button class="btn btn-primary" onclick="storyDownload()">⬇ Download story</button>
            <span id="storyMsg" class="saveIndicator"></span>
          </div>
        </div>
      </div>

      <div>
        <div class="storypreview"><canvas id="storyCanvas" width="${STORY_W}" height="${STORY_H}"></canvas></div>
        <div class="muted" style="font-size:var(--text-xs);text-align:center;margin-top:8px;">Live preview</div>
      </div>
    </div>

    ${canPostPhotos() ? `<div class="card" style="margin-top:20px;">
      <h2>Add a photo</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
        <input id="photoFile" type="file" accept="image/*" style="flex:1;min-width:180px;">
        <select id="photoDay" style="width:150px;">
          <option value="">No day tag</option>
          ${_storyDays.map(d => `<option value="${d.id}">Day ${d.day_number}</option>`).join('')}
        </select>
      </div>
      <input id="photoCaption" type="text" placeholder="Caption (optional)" style="width:100%;margin-bottom:10px;">
      <button class="btn btn-primary" onclick="uploadPhoto()">Upload</button>
      <span id="photoStatus" class="saveIndicator" style="margin-left:10px;"></span>
    </div>` : ''}

    <h2 style="margin-top:26px;">Gallery</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
      ${_storyPhotos.map(u => `
        <div class="card" style="padding:8px;position:relative;">
          <img src="${esc(u.photo_url)}" alt="${esc(u.caption || '')}" loading="lazy"
            style="width:100%;height:140px;object-fit:cover;border-radius:8px;display:block;cursor:zoom-in;"
            onclick="adminOpenLightbox('${esc(u.photo_url)}','${esc(u.caption || '')}')">
          ${u.caption ? `<div style="font-size:12px;margin-top:6px;color:var(--text-secondary);">${esc(u.caption)}</div>` : ''}
          <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;">${u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</div>
          <button class="btn btn-sm" style="position:absolute;top:8px;left:8px;padding:2px 7px;font-size:11px;"
            onclick="storySetPhoto('${esc(u.photo_url)}')" title="Use as story background">📲</button>
          ${(isEditor() || (activeMembership && u.membership_id === activeMembership.id))
            ? `<button class="btn btn-sm btn-danger" style="position:absolute;top:8px;right:8px;padding:2px 7px;font-size:11px;" onclick="deletePhoto('${u.id}','${esc(u.photo_url)}')">✕</button>` : ''}
        </div>`).join('') || '<p class="muted">No photos yet.</p>'}
    </div>

    <div id="admin-lb" onclick="adminCloseLightbox()" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;align-items:center;justify-content:center;cursor:zoom-out;flex-direction:column;gap:12px;">
      <img id="admin-lb-img" src="" style="max-width:90vw;max-height:85vh;border-radius:12px;object-fit:contain;">
      <div id="admin-lb-cap" style="color:#fff;font-size:14px;text-align:center;max-width:500px;opacity:.85;"></div>
    </div>
  `;
  drawStoryCard();
}

function storySet(k, v) { storyState[k] = v; if (k === 'dayId' || k === 'photoUrl') renderStoryModule(); else { drawStoryCard(); refreshStoryControls(); } }
function storySetPhoto(url) { storyState.photoUrl = url; renderStoryModule(); }
function storyToggle(k, on) { storyState.show[k] = on; drawStoryCard(); }
function refreshStoryControls() {
  document.querySelectorAll('.storygrid .btn').forEach(b => {
    const m = (b.getAttribute('onclick') || '').match(/storySet\('theme','(\w+)'\)/);
    if (m) b.classList.toggle('btn-primary', m[1] === storyState.theme);
  });
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

async function drawStoryCard() {
  const c = document.getElementById('storyCanvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  const th = STORY_THEMES[storyState.theme] || STORY_THEMES.trail;
  const day = _storyDays.find(d => d.id === storyState.dayId);

  ctx.clearRect(0, 0, STORY_W, STORY_H);

  // background: photo (cover + dim) or a vertical gradient
  let drew = false;
  if (storyState.photoUrl) {
    try {
      const img = await loadImg(storyState.photoUrl);
      const sc = Math.max(STORY_W / img.width, STORY_H / img.height);
      const w = img.width * sc, h = img.height * sc;
      ctx.drawImage(img, (STORY_W - w) / 2, (STORY_H - h) / 2, w, h);
      ctx.fillStyle = `rgba(20,21,15,${storyState.dim})`;
      ctx.fillRect(0, 0, STORY_W, STORY_H);
      drew = true;
    } catch (e) { /* fall through to the gradient */ }
  }
  if (!drew) {
    const g = ctx.createLinearGradient(0, 0, 0, STORY_H);
    g.addColorStop(0, th.bg);
    g.addColorStop(1, th.accent + '33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, STORY_W, STORY_H);
  }

  const km = day ? Number(day.distance_km) || 0 : 0;
  const done = day ? (_storyProgress[day.id] || 0) : 0;
  const totalKm = _storyDays.reduce((s, d) => s + (Number(d.distance_km) || 0), 0);
  const doneTotal = _storyDays.reduce((s, d) => s + (_storyProgress[d.id] || 0), 0);
  const idx = _storyDays.findIndex(d => d.id === storyState.dayId);

  ctx.textAlign = 'center';
  let y = 300;

  if (storyState.show.title) {
    ctx.fillStyle = th.text;
    ctx.font = '800 62px Manrope, -apple-system, Segoe UI, sans-serif';
    wrapText(ctx, activeTrip.name.toUpperCase(), STORY_W / 2, y, 900, 74);
    y += 120;
  }
  if (storyState.show.day && day) {
    ctx.fillStyle = th.dim;
    ctx.font = '600 40px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(`DAY ${idx + 1} OF ${_storyDays.length}`, STORY_W / 2, y);
    y += 70;
    ctx.fillStyle = th.text;
    ctx.font = '700 46px Manrope, -apple-system, Segoe UI, sans-serif';
    wrapText(ctx, day.title || '', STORY_W / 2, y, 900, 56);
    y += 90;
  }

  // elevation profile drawn from the day's stored ascent shape
  if (storyState.show.profile && day && day.gpx_url) {
    const p = await fetchProfile(day.gpx_url).catch(() => null);
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
      if (done > 0 && km) {
        const fx = px + Math.min(1, done / km) * pw;
        ctx.beginPath(); ctx.moveTo(fx, py - 10); ctx.lineTo(fx, py + ph);
        ctx.strokeStyle = th.text; ctx.lineWidth = 4; ctx.setLineDash([12, 10]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(fx, py + ph, 16, 0, Math.PI * 2); ctx.fillStyle = th.text; ctx.fill();
      }
      y += ph + 90;
    }
  }

  if (storyState.show.distance) {
    ctx.fillStyle = th.accent;
    ctx.font = '800 110px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(totalKm ? `${Math.round(doneTotal)} / ${Math.round(totalKm)} km` : `${Math.round(done)} km`, STORY_W / 2, y);
    y += 80;
  }
  if (storyState.show.elevation && day && day.ascent_m) {
    ctx.fillStyle = th.dim;
    ctx.font = '500 42px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(`+${day.ascent_m} m climbed today`, STORY_W / 2, y);
    y += 66;
  }
  if (storyState.show.stay) {
    ctx.fillStyle = th.dim;
    ctx.font = '500 38px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('🏠 tonight', STORY_W / 2, y);
    y += 60;
  }
  if (storyState.show.url) {
    ctx.fillStyle = th.dim;
    ctx.font = '600 34px Manrope, -apple-system, Segoe UI, sans-serif';
    ctx.fillText('triptracker.cc', STORY_W / 2, STORY_H - 110);
  }
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

async function storyDownload() {
  const msg = document.getElementById('storyMsg');
  msg.textContent = 'Rendering…'; msg.className = 'saveIndicator saving';
  try {
    await drawStoryCard();
    const c = document.getElementById('storyCanvas');
    c.toBlob(b => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(activeTrip.slug || 'trip')}-story-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      msg.textContent = '✓ Downloaded'; msg.className = 'saveIndicator saved';
    }, 'image/png');
  } catch (e) {
    // A photo served without CORS headers taints the canvas and blocks export.
    msg.textContent = 'Could not export — try a different background photo.';
    msg.className = 'saveIndicator';
  }
}
