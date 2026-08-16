import React from "react";

const PALETTE = ["var(--activity-cycling)", "var(--activity-hiking)", "var(--activity-driving)", "var(--activity-kayaking)", "var(--activity-transit)"];

const STYLE = `
.tt-avatar { border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff;
  font-family: var(--font-ui); font-weight: 600; box-shadow: 0 0 0 2px var(--bg-card); flex: none; }
.tt-avatar--sm { width: 24px; height: 24px; font-size: 10px; }
.tt-avatar--md { width: 32px; height: 32px; font-size: 12px; }
.tt-avatar-group { display: flex; }
.tt-avatar-group .tt-avatar:not(:first-child) { margin-left: -8px; }
.tt-avatar-organizer { position: relative; }
.tt-avatar-organizer::after { content: ""; position: absolute; bottom: -1px; right: -1px; width: 9px; height: 9px; border-radius: 50%;
  background: var(--accent-secondary); box-shadow: 0 0 0 2px var(--bg-card); }
`;

function colorFor(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % PALETTE.length; return PALETTE[h]; }
function initials(name) { return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

export function AvatarChip({ name, size = "md", organizer = false }) {
  return (
    <>
      <style>{STYLE}</style>
      <span className={`tt-avatar tt-avatar--${size}${organizer ? " tt-avatar-organizer" : ""}`} style={{ background: colorFor(name) }} title={name}>
        {initials(name)}
      </span>
    </>
  );
}

export function AvatarGroup({ names = [] }) {
  return (
    <>
      <style>{STYLE}</style>
      <span className="tt-avatar-group">
        {names.map((n) => <AvatarChip key={n} name={n} size="sm" />)}
      </span>
    </>
  );
}
