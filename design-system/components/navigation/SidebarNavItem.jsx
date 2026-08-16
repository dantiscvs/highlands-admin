import React from "react";

const STYLE = `
.tt-navitem { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--radius-md);
  font-family: var(--font-ui); font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary);
  cursor: pointer; transition: background-color .1s ease, color .1s ease; }
.tt-navitem:hover { background: var(--bg-recessed); color: var(--text-primary); }
.tt-navitem--active { background: var(--accent-primary-subtle); color: var(--text-primary); font-weight: 600; }
.tt-navitem-icon { width: 18px; height: 18px; flex: none; color: inherit; }
.tt-navitem--active .tt-navitem-icon { color: var(--accent-primary); }
.tt-navitem-count { margin-left: auto; font-size: var(--text-xs); color: var(--text-tertiary); font-weight: 500; }
`;

export function SidebarNavItem({ icon, label, active = false, count }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className={`tt-navitem${active ? " tt-navitem--active" : ""}`}>
        <span className="tt-navitem-icon">{icon}</span>
        <span>{label}</span>
        {count != null && <span className="tt-navitem-count">{count}</span>}
      </div>
    </>
  );
}
