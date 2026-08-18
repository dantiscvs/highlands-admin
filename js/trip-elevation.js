// Elevation profiles from GPX — ported from the legacy Highlands PWA.
// Deliberately dependency-free (no Supabase client, no esc(), no globals from
// the admin app) so live.html can load the exact same file.

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Points are read attribute-by-attribute (XML gives no ordering guarantee) and
// <ele> is optional — a track without elevation still yields a distance axis.
function parseGpxPoints(text) {
  const pts = [];
  const tagRe = /<trkpt\b([^>]*)>([\s\S]*?)(?:<\/trkpt>|(?=<trkpt\b)|$)/g;
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    const la = /\blat\s*=\s*["'](-?[\d.]+)["']/.exec(m[1]);
    const lo = /\blon\s*=\s*["'](-?[\d.]+)["']/.exec(m[1]);
    if (!la || !lo) continue;
    const el = /<ele>\s*(-?[\d.]+)\s*<\/ele>/.exec(m[2] || '');
    pts.push({ lat: parseFloat(la[1]), lon: parseFloat(lo[1]), ele: el ? parseFloat(el[1]) : null });
  }
  return pts;
}

// -> { dist[], ele[], gain[], totalKm, totalGain, minEle, maxEle, hasEle }
function buildProfileFromGpx(text) {
  const pts = parseGpxPoints(text);
  if (pts.length < 2) return null;
  const hasEle = pts.some(p => p.ele != null);

  // 11-point moving average: raw barometric/SRTM data is noisy enough that
  // unsmoothed cumulative gain overstates climbing badly.
  let smooth;
  if (hasEle) {
    const filled = [];
    let last = 0;
    for (const p of pts) { if (p.ele != null) last = p.ele; filled.push(last); }
    const half = 5;
    smooth = filled.map((_, i) => {
      let sum = 0, cnt = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(filled.length - 1, i + half); j++) { sum += filled[j]; cnt++; }
      return sum / cnt;
    });
  } else {
    smooth = pts.map(() => 0);
  }

  const dist = [0], gain = [0];
  for (let i = 1; i < pts.length; i++) {
    dist.push(dist[i-1] + haversineKm(pts[i-1].lat, pts[i-1].lon, pts[i].lat, pts[i].lon));
    const diff = smooth[i] - smooth[i-1];
    gain.push(gain[i-1] + (diff > 0 ? diff : 0));
  }
  return {
    dist, ele: smooth, gain,
    totalKm: dist[dist.length - 1],
    totalGain: gain[gain.length - 1],
    minEle: Math.min(...smooth), maxEle: Math.max(...smooth),
    hasEle,
  };
}

const _profileCache = new Map();
async function fetchProfile(url) {
  if (!url) return null;
  if (_profileCache.has(url)) return _profileCache.get(url);
  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return buildProfileFromGpx(await res.text());
    } catch (e) { return null; }
  })();
  _profileCache.set(url, p);
  return p;
}

// opts: { frac, height, stroke, fill, grid, text, showMarker }
function buildElevationSvg(profile, opts) {
  opts = opts || {};
  if (!profile || !profile.hasEle) return '';
  const h = opts.height || 170;
  const w = 640, padL = 42, padR = 10, padT = 10, padB = 24;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const stroke = opts.stroke || 'var(--accent-primary)';
  const fill   = opts.fill   || 'var(--accent-primary)';
  const grid   = opts.grid   || 'var(--border-hairline)';
  const textC  = opts.text   || 'var(--text-tertiary)';

  const minE = profile.minEle, maxE = profile.maxEle;
  const spanE = (maxE - minE) || 1;
  const n = profile.dist.length, totalKm = profile.totalKm || 1;
  const x = km => padL + (km / totalKm) * innerW;
  const y = ele => padT + innerH - ((ele - minE) / spanE) * innerH;

  let path = '';
  const step = Math.max(1, Math.floor(n / 300));
  for (let i = 0; i < n; i += step) path += (path === '' ? 'M' : 'L') + x(profile.dist[i]).toFixed(1) + ',' + y(profile.ele[i]).toFixed(1) + ' ';
  path += 'L' + x(profile.dist[n-1]).toFixed(1) + ',' + y(profile.ele[n-1]).toFixed(1);
  const area = path + ` L${x(totalKm).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z`;

  let gridSvg = '';
  const gStep = spanE > 400 ? 100 : spanE > 150 ? 50 : 20;
  for (let v = Math.ceil(minE / gStep) * gStep; v <= maxE; v += gStep) {
    gridSvg += `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${w - padR}" y2="${y(v).toFixed(1)}" stroke="${grid}" stroke-width="1"/>`
             + `<text x="${padL - 6}" y="${(y(v) + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="${textC}">${Math.round(v)}</text>`;
  }
  let axis = '';
  const kmStep = totalKm > 50 ? 10 : totalKm > 20 ? 5 : 2;
  for (let k = 0; k <= totalKm; k += kmStep) axis += `<text x="${x(k).toFixed(1)}" y="${h - 6}" text-anchor="middle" font-size="9" fill="${textC}">${k}km</text>`;

  let marker = '';
  if (opts.showMarker) {
    const frac = Math.max(0, Math.min(1, opts.frac || 0));
    const idx = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
    const mx = x(frac * totalKm), my = y(profile.ele[idx]);
    marker = `<line x1="${mx.toFixed(1)}" y1="${padT}" x2="${mx.toFixed(1)}" y2="${padT + innerH}" stroke="${opts.markerColor || 'var(--accent-secondary)'}" stroke-width="2" stroke-dasharray="4,3"/>`
           + `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="${opts.markerColor || 'var(--accent-secondary)'}"/>`;
  }

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="display:block;min-width:480px;">
    ${gridSvg}
    <path d="${area}" fill="${fill}" opacity="0.15"/>
    <path d="${path}" fill="none" stroke="${stroke}" stroke-width="2" vector-effect="non-scaling-stroke"/>
    ${marker}
    ${axis}
  </svg>`;
}
