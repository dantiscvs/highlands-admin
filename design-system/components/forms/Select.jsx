import React from "react";

const STYLE = `
.tt-select-wrap { position: relative; display: block; }
.tt-select { appearance: none; -webkit-appearance: none; font-family: var(--font-ui); font-size: var(--text-base);
  color: var(--text-primary); background-color: var(--bg-recessed); border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm); padding: 9px 34px 9px 12px; width: 100%; box-sizing: border-box; cursor: pointer;
  transition: border-color .12s ease, box-shadow .12s ease, background-color .12s ease; }
.tt-select option { background-color: var(--bg-card); color: var(--text-primary); }
.tt-select:hover { border-color: var(--text-tertiary); }
.tt-select:focus { outline: none; background-color: var(--bg-card); border-color: var(--border-focus); box-shadow: var(--focus-ring); }
.tt-select:disabled { opacity: 0.55; cursor: not-allowed; }
.tt-select-wrap::after { content: ""; position: absolute; right: 12px; top: 50%; width: 8px; height: 8px;
  border-right: 1.5px solid var(--text-secondary); border-bottom: 1.5px solid var(--text-secondary);
  transform: translateY(-70%) rotate(45deg); pointer-events: none; }

.tt-menu { font-family: var(--font-ui); background: var(--bg-card); border: 1px solid var(--border-hairline);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-e2); padding: 6px; width: 220px; }
.tt-menu-item { padding: 8px 10px; border-radius: var(--radius-sm); font-size: var(--text-base); color: var(--text-primary);
  display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
.tt-menu-item:hover { background: var(--bg-recessed); }
.tt-menu-item--selected { background: var(--accent-primary-subtle); color: var(--accent-primary-hover); font-weight: 600; }
`;

export function Select({ label, options = [], defaultValue, disabled }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="tt-field" style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-ui)" }}>
        {label && <label style={{ fontSize: "var(--text-sm)", fontWeight: 500, color: "var(--text-primary)" }}>{label}</label>}
        <div className="tt-select-wrap">
          <select className="tt-select" defaultValue={defaultValue} disabled={disabled}>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}

/** Custom listbox — use when the trigger needs richer content (icons, descriptions) than a native <select> allows. */
export function OpenMenu({ items = [], selected }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="tt-menu">
        {items.map((item) => (
          <div key={item} className={`tt-menu-item${item === selected ? " tt-menu-item--selected" : ""}`}>
            <span>{item}</span>
            {item === selected && <span>✓</span>}
          </div>
        ))}
      </div>
    </>
  );
}
