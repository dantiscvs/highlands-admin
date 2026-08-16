import React from "react";

const STYLE = `
.tt-tabs { display: flex; gap: var(--space-6); border-bottom: 1px solid var(--border-hairline); font-family: var(--font-ui); }
.tt-tab { padding: 10px 2px; font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .1s ease, border-color .1s ease; }
.tt-tab:hover { color: var(--text-primary); }
.tt-tab--active { color: var(--text-primary); font-weight: 600; border-bottom-color: var(--accent-primary); }
`;

export function Tabs({ items = [], active }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="tt-tabs">
        {items.map((it) => <div key={it} className={`tt-tab${it === active ? " tt-tab--active" : ""}`}>{it}</div>)}
      </div>
    </>
  );
}
