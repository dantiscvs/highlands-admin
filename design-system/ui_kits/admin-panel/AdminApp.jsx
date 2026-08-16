const { useState } = React;

/* Self-contained local primitives mirroring components/ — kept in sync manually for this standalone preview. */
function Button({ variant = "primary", size = "md", disabled, children, onClick }) {
  const base = { fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: size === "sm" ? "var(--text-xs)" : "var(--text-sm)",
    borderRadius: size === "sm" ? "var(--radius-sm)" : "var(--radius-md)", padding: size === "sm" ? "6px 12px" : "10px 18px",
    display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid transparent", cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1 };
  const variants = {
    primary: { background: "var(--accent-primary)", color: "var(--text-on-accent)", borderColor: "var(--accent-primary)" },
    secondary: { background: "var(--bg-card)", color: "var(--text-primary)", borderColor: "var(--border-strong)" },
    danger: { background: "var(--color-danger)", color: "var(--text-on-accent)", borderColor: "var(--color-danger)" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

function Input({ label, type = "text", placeholder, defaultValue, disabled, error }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-ui)" }}>
      {label && <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{label}</label>}
      <input type={type} placeholder={placeholder} defaultValue={defaultValue} disabled={disabled} style={{
        fontFamily: "var(--font-ui)", fontSize: "var(--text-base)", color: "var(--text-primary)", background: "var(--bg-recessed)",
        border: `1px solid ${error ? "var(--color-danger)" : "var(--border-strong)"}`, borderRadius: "var(--radius-sm)",
        padding: "9px 12px", boxSizing: "border-box", opacity: disabled ? 0.55 : 1 }} />
      {error && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)" }}>{error}</span>}
    </div>
  );
}

function Select({ label, options = [], defaultValue }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-ui)" }}>
      {label && <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{label}</label>}
      <select defaultValue={defaultValue} style={{ fontFamily: "var(--font-ui)", fontSize: "var(--text-base)", color: "var(--text-primary)",
        background: "var(--bg-recessed)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: "9px 12px" }}>
        {options.map((o) => <option key={o} value={o} style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>{o}</option>)}
      </select>
    </div>
  );
}

function Badge({ status = "neutral", children }) {
  const map = {
    success: { bg: "var(--color-success-subtle)", fg: "var(--color-success)", bd: "var(--color-success-border)" },
    warning: { bg: "var(--color-warning-subtle)", fg: "var(--color-warning)", bd: "var(--color-warning-border)" },
    danger: { bg: "var(--color-danger-subtle)", fg: "var(--color-danger)", bd: "var(--color-danger-border)" },
    info: { bg: "var(--color-info-subtle)", fg: "var(--color-info)", bd: "var(--color-info-border)" },
    neutral: { bg: "var(--bg-recessed)", fg: "var(--text-secondary)", bd: "var(--border-hairline)" },
  };
  const c = map[status];
  return <span style={{ display: "inline-flex", fontFamily: "var(--font-ui)", fontSize: "var(--text-xs)", fontWeight: 600,
    padding: "3px 10px", borderRadius: "var(--radius-full)", background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}>{children}</span>;
}

function ChecklistItem({ status = "warning", title, description }) {
  const done = status === "done";
  return (
    <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--radius-md)", fontFamily: "var(--font-ui)",
      background: done ? "var(--color-success-subtle)" : "var(--color-warning-subtle)",
      border: `1px solid ${done ? "var(--color-success-border)" : "var(--color-warning-border)"}` }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, flex: "none", background: done ? "var(--color-success)" : "var(--color-warning)" }} />
      <div>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
        {description && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", marginTop: 2 }}>{description}</div>}
      </div>
    </div>
  );
}

function EmptyState({ title, description, actionLabel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 10,
      padding: "48px 32px", border: "1.5px dashed var(--border-strong)", borderRadius: "var(--radius-lg)", background: "var(--bg-card)", fontFamily: "var(--font-ui)" }}>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
      {description && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: 320 }}>{description}</div>}
      {actionLabel && <Button variant="secondary" size="sm">{actionLabel}</Button>}
    </div>
  );
}

function SidebarNavItem({ icon, label, active, count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: "var(--radius-md)",
      fontFamily: "var(--font-ui)", fontSize: "var(--text-sm)", fontWeight: active ? 600 : 500, cursor: "pointer",
      color: active ? "var(--text-primary)" : "var(--text-secondary)", background: active ? "var(--accent-primary-subtle)" : "transparent" }}>
      <span style={{ width: 18, height: 18, flex: "none", color: active ? "var(--accent-primary)" : "inherit" }}>{icon}</span>
      <span>{label}</span>
      {count != null && <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{count}</span>}
    </div>
  );
}

function StatCard({ label, value, trend }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-e1)", padding: "var(--space-6)", fontFamily: "var(--font-ui)" }}>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: "var(--text-3xl)", fontWeight: 600, color: "var(--text-primary)", marginTop: 6 }}>{value}</div>
      {trend && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 6 }}>{trend}</div>}
    </div>
  );
}

function Card({ children }) {
  return <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-e1)", padding: "var(--space-6)", fontFamily: "var(--font-ui)" }}>{children}</div>;
}

const PALETTE = ["var(--activity-cycling)", "var(--activity-hiking)", "var(--activity-driving)", "var(--activity-kayaking)", "var(--activity-transit)"];
function colorFor(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % PALETTE.length; return PALETTE[h]; }
function initials(name) { return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }
function AvatarChip({ name, size = "md" }) {
  const d = size === "sm" ? 24 : 32;
  return <span style={{ width: d, height: d, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: size === "sm" ? 10 : 12, background: colorFor(name),
    boxShadow: "0 0 0 2px var(--bg-card)" }}>{initials(name)}</span>;
}
function AvatarGroup({ names = [] }) {
  return <span style={{ display: "flex" }}>{names.map((n, i) => <span key={n} style={{ marginLeft: i ? -8 : 0 }}><AvatarChip name={n} size="sm" /></span>)}</span>;
}

function Drawer({ title, subtitle, children }) {
  return (
    <div style={{ width: 380, height: "100%", background: "var(--bg-card)", borderLeft: "1px solid var(--border-hairline)",
      boxShadow: "var(--shadow-e3)", display: "flex", flexDirection: "column", fontFamily: "var(--font-ui)" }}>
      <div style={{ padding: "var(--space-6) var(--space-7)", borderBottom: "1px solid var(--border-hairline)", display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
          {subtitle && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{subtitle}</div>}
        </div>
        <span style={{ color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18 }}>×</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-7)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>{children}</div>
      <div style={{ padding: "var(--space-5) var(--space-7)", borderTop: "1px solid var(--border-hairline)", background: "var(--bg-recessed)", display: "flex", justifyContent: "flex-end", gap: "var(--space-4)" }}>
        <Button variant="secondary" size="sm">Cancel</Button>
        <Button size="sm">Save changes</Button>
      </div>
    </div>
  );
}

const ICONS = {
  overview: <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>,
  grid: <svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="3" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="10" y="3" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="3" y="10" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="10" y="10" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>,
  home: <svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,3 15,8 15,15 3,15 3,8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>,
  route: <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="4" cy="14" r="1.8" fill="currentColor" /><circle cx="14" cy="4" r="1.8" fill="currentColor" /><path d="M4 14 C10 14, 8 4, 14 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>,
  bag: <svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="6" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M6.5 6 V4.5 a2.5 2.5 0 0 1 5 0 V6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>,
  wallet: <svg width="18" height="18" viewBox="0 0 18 18"><rect x="2.5" y="5" width="13" height="9.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="9.7" r="1.1" fill="currentColor" /></svg>,
  pin: <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 15 C9 15, 4 10.2, 4 6.8 A5 5 0 0 1 14 6.8 C14 10.2, 9 15, 9 15Z" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="9" cy="6.8" r="1.6" fill="currentColor" /></svg>,
  check: <svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="3" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><polyline points="6,9.5 8.3,12 12.5,6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  share: <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="5" cy="9" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="13" cy="4.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><circle cx="13" cy="13.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" /><line x1="6.7" y1="8" x2="11.3" y2="5.3" stroke="currentColor" strokeWidth="1.4" /><line x1="6.7" y1="10" x2="11.3" y2="12.7" stroke="currentColor" strokeWidth="1.4" /></svg>,
  upload: <svg width="18" height="18" viewBox="0 0 18 18"><line x1="9" y1="13" x2="9" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><polyline points="5,7.5 9,3.5 13,7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><line x1="3.5" y1="15" x2="14.5" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>,
};

const NAV = [
  { key: "overview", label: "Overview", icon: ICONS.overview },
  { key: "grid", label: "Day by day", icon: ICONS.grid, count: 9 },
  { key: "accommodation", label: "Accommodation", icon: ICONS.home, count: 6 },
  { key: "logistics", label: "Logistics", icon: ICONS.route, count: 4 },
  { key: "packing", label: "Packing & tasks", icon: ICONS.bag },
  { key: "expenses", label: "Expenses", icon: ICONS.wallet },
  { key: "sights", label: "Sights", icon: ICONS.pin, count: 14 },
  { key: "readiness", label: "Readiness", icon: ICONS.check },
  { key: "sharing", label: "Sharing", icon: ICONS.share },
  { key: "import", label: "Import review", icon: ICONS.upload },
];

const DAYS = [
  { d: "Sep 5", title: "Zermatt → Saas-Fee", start: "Zermatt", end: "Saas-Fee", dist: "38.2 km", elev: "+1,180 m", surface: "Gravel", stay: "Alpine Lodge", sights: 2 },
  { d: "Sep 6", title: "Saas-Fee → Grächen", start: "Saas-Fee", end: "Grächen", dist: "51.6 km", elev: "+920 m", surface: "Mixed", stay: "Riverside Camp", sights: 1 },
  { d: "Sep 7", title: "Rest day — Grächen", start: "Grächen", end: "Grächen", dist: "—", elev: "—", surface: "—", stay: "Riverside Camp", sights: 3 },
  { d: "Sep 8", title: "Grächen → Col de la Croix", start: "Grächen", end: "Col de la Croix", dist: "42.3 km", elev: "+1,240 m", surface: "Singletrack", stay: "Summit Hut", sights: 0 },
];

function TopBar({ title, subtitle }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: "var(--text-2xl)", fontWeight: 600, color: "var(--text-primary)" }}>{title}</div>
        {subtitle && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 4 }}>{subtitle}</div>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" size="sm">Preview live page</Button>
        <Button size="sm">Share trip</Button>
      </div>
    </div>
  );
}

function Overview() {
  return (
    <div>
      <TopBar title="Alps Ridge Traverse" subtitle="Sep 5–13 · Bikepacking · 9 participants" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total distance" value="612 km" trend="9 riding days" />
        <StatCard label="Elevation gain" value="8,420 m" />
        <StatCard label="Participants" value="9" trend="1 organizer" />
        <StatCard label="Budget / rider" value="€ 640" trend="est." />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: 14 }}>Readiness</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ChecklistItem title="No accommodation linked for Day 4" description="Riders will see a gap in the plan." />
            <ChecklistItem title="3 riders haven't confirmed tracking" description="Sharing panel → tracking providers." />
            <ChecklistItem status="done" title="Share link generated" />
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: 14 }}>Quick links</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {["Add a day", "Invite a participant", "Import from GPX", "Generate share link"].map((t) => (
              <div key={t} style={{ fontSize: "var(--text-sm)", color: "var(--text-link)", cursor: "pointer" }}>{t} →</div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function DayGrid({ onOpenDrawer }) {
  const cols = ["Date", "Title", "Start", "End", "Distance", "Elevation", "Surface", "Stay", "Sights"];
  return (
    <div>
      <TopBar title="Day by day" subtitle="9 days · click any cell to edit, click a row to open details" />
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px 1.4fr 1fr 1fr 90px 90px 100px 1fr 60px", background: "var(--bg-recessed)", borderBottom: "1px solid var(--border-hairline)" }}>
          {cols.map((c) => <div key={c} style={{ padding: "8px 10px", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{c}</div>)}
        </div>
        {DAYS.map((row, i) => (
          <div key={i} onClick={onOpenDrawer} style={{ display: "grid", gridTemplateColumns: "70px 1.4fr 1fr 1fr 90px 90px 100px 1fr 60px", borderBottom: i < DAYS.length - 1 ? "1px solid var(--border-hairline)" : "none", cursor: "pointer" }}>
            {[row.d, row.title, row.start, row.end, row.dist, row.elev, row.surface, row.stay, row.sights].map((v, j) => (
              <div key={j} style={{ padding: "10px", fontSize: "var(--text-base)", color: "var(--text-primary)", fontFamily: (j >= 4 && j <= 5) ? "var(--font-mono)" : "var(--font-ui)" }}>{v}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Accommodation() {
  return (
    <div>
      <TopBar title="Accommodation" subtitle="6 bookings across 9 nights" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {["Alpine Lodge · Zermatt", "Riverside Camp · Saas-Fee", "Summit Hut · Col de la Croix"].map((t) => (
          <Card key={t}>
            <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-primary)" }}>{t.split(" · ")[0]}</div>
            <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginTop: 2 }}>{t.split(" · ")[1]}</div>
            <div style={{ marginTop: 10 }}><Badge status="success">Confirmed</Badge></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Packing() {
  const items = ["Repair kit", "Water filter", "Tent stakes", "First aid kit"];
  return (
    <div>
      <TopBar title="Packing & tasks" subtitle="Shared checklist across the group" />
      <Card>
        {items.map((it, i) => (
          <div key={it} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < items.length - 1 ? "1px solid var(--border-hairline)" : "none" }}>
            <span style={{ fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{it}</span>
            <AvatarGroup names={["Mira Kohl", "Tom Reyes"]} />
          </div>
        ))}
      </Card>
    </div>
  );
}

function Expenses() {
  const rows = [{ p: "Mira Kohl", paid: "€ 340", balance: "+€ 120" }, { p: "Tom Reyes", paid: "€ 80", balance: "-€ 60" }];
  return (
    <div>
      <TopBar title="Expenses" subtitle="Shared ledger · settles at trip end" />
      <Card>
        {rows.map((r, i) => (
          <div key={r.p} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--border-hairline)" : "none" }}>
            <AvatarChip name={r.p} />
            <span style={{ flex: 1, fontSize: "var(--text-base)", color: "var(--text-primary)" }}>{r.p}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>paid {r.paid}</span>
            <Badge status={r.balance.startsWith("+") ? "success" : "danger"}>{r.balance}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Sights() {
  return (
    <div>
      <TopBar title="Sights" subtitle="Grouped by day" />
      <EmptyState title="No sights added for Day 7 yet" description="Rest days are a good place to note a viewpoint or café." actionLabel="Add a sight" />
    </div>
  );
}

function Readiness() {
  return (
    <div>
      <TopBar title="Readiness" subtitle="Advisory only — nothing here blocks sharing" />
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ChecklistItem title="No accommodation linked for Day 4" description="Riders will see a gap in the plan." />
          <ChecklistItem title="3 riders haven't confirmed tracking" description="Sharing panel → tracking providers." />
          <ChecklistItem title="Day 7 has no distance or elevation set" description="Fine for rest days — otherwise check the day grid." />
          <ChecklistItem status="done" title="Share link generated" />
        </div>
      </Card>
    </div>
  );
}

function Sharing() {
  return (
    <div>
      <TopBar title="Sharing" subtitle="Control what the group sees" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: 14 }}>Visibility</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["Route & elevation", "Accommodation details", "Expense ledger"].map((t) => (
              <div key={t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{t}</span>
                <div style={{ width: 36, height: 20, borderRadius: 999, background: "var(--accent-primary)", position: "relative" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, right: 2 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Input defaultValue="triptracker.app/t/alps-ridge-9f2" disabled />
            <Button size="sm" variant="secondary">Copy</Button>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: 14 }}>Tracking providers</div>
          {[{ n: "Mira Kohl", s: "success", l: "Connected" }, { n: "Tom Reyes", s: "warning", l: "Invited" }, { n: "Nadia Bloom", s: "danger", l: "Not shared" }].map((r) => (
            <div key={r.n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <AvatarChip name={r.n} size="sm" />
              <span style={{ flex: 1, fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{r.n}</span>
              <Badge status={r.s}>{r.l}</Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function ImportReview() {
  const rows = [
    { src: "\"Day 4: Grächen to Zinal, ~42km, 1200m climb\"", field: "Distance", val: "42.3 km" },
    { src: "\"...camp at Riverside, GPS 46.108, 7.784...\"", field: "Accommodation", val: "Riverside Camp" },
  ];
  return (
    <div>
      <TopBar title="Import review" subtitle="From uploaded itinerary.pdf — accept or reject each proposed value" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r, i) => (
          <Card key={i}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 600 }}>SOURCE EXCERPT</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontStyle: "italic" }}>{r.src}</div>
              </div>
              <div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 600 }}>PROPOSED — {r.field.toUpperCase()}</div>
                <div style={{ fontSize: "var(--text-base)", color: "var(--text-primary)", fontWeight: 600 }}>{r.val}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button size="sm" variant="secondary">Reject</Button>
                <Button size="sm">Accept</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const SCREENS = { overview: Overview, accommodation: Accommodation, packing: Packing, expenses: Expenses, sights: Sights, readiness: Readiness, sharing: Sharing, import: ImportReview, logistics: Sights };

function AdminApp() {
  const [section, setSection] = useState("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const Screen = section === "grid" ? null : SCREENS[section] || Overview;
  return (
    <div data-theme="light" style={{ display: "flex", height: "100%", background: "var(--bg-page)", fontFamily: "var(--font-ui)" }}>
      <div style={{ width: 232, background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-hairline)", padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)", padding: "4px 8px" }}>Trip Tracker</div>
        <div style={{ padding: "8px 12px", background: "var(--bg-card)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>Alps Ridge Traverse ▾</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => <div key={n.key} onClick={() => setSection(n.key)}><SidebarNavItem label={n.label} icon={n.icon} active={section === n.key} count={n.count} /></div>)}
        </div>
      </div>
      <div style={{ flex: 1, padding: 28, overflow: "auto", position: "relative" }}>
        {section === "grid" ? <DayGrid onOpenDrawer={() => setDrawerOpen(true)} /> : <Screen />}
        {drawerOpen && (
          <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "var(--bg-overlay-scrim)", display: "flex", justifyContent: "flex-end", zIndex: 300 }}>
            <div onClick={(e) => e.stopPropagation()}>
              <Drawer title="Day 4 — Col de la Croix" subtitle="Tue, Sep 8">
                <Input label="Title" defaultValue="Grächen → Col de la Croix" />
                <Input label="GPX link" placeholder="https://…" />
                <Select label="Surface" options={["Paved", "Gravel", "Singletrack", "Mixed"]} defaultValue="Singletrack" />
                <Input label="Resupply notes" placeholder="Last water at km 30" />
              </Drawer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
