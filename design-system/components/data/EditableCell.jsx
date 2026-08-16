import React from "react";

const STYLE = `
.tt-cell-demo { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.tt-cell-caption { font-family: var(--font-mono); font-size: 10px; color: var(--text-tertiary); }
.tt-cell { font-family: var(--font-ui); font-size: var(--text-base); color: var(--text-primary); padding: 6px 8px;
  border-radius: var(--radius-sm); border: 1px solid transparent; min-width: 120px; }
.tt-cell--hover { background: var(--bg-recessed); border-color: var(--border-hairline); cursor: text; }
.tt-cell--editing { background: var(--bg-card); border-color: var(--border-focus); box-shadow: var(--focus-ring); }
.tt-cell--saving { background: var(--bg-card); border-color: var(--color-info-border); }
.tt-cell--saving .tt-cell-spinner { display: inline-block; width: 10px; height: 10px; border-radius: 50%;
  border: 1.5px solid var(--color-info-border); border-top-color: var(--color-info); margin-left: 6px; animation: tt-spin 0.7s linear infinite; }
.tt-cell--saved { background: var(--color-success-subtle); border-color: var(--color-success-border); }
@keyframes tt-spin { to { transform: rotate(360deg); } }
`;

const STATES = [
  { label: "default", cls: "" },
  { label: "hover", cls: "tt-cell--hover" },
  { label: "editing", cls: "tt-cell--editing" },
  { label: "saving", cls: "tt-cell--saving" },
  { label: "saved", cls: "tt-cell--saved" },
];

export function EditableCell({ value = "42.3 km" }) {
  return (
    <>
      <style>{STYLE}</style>
      <div style={{ display: "flex", gap: 20 }}>
        {STATES.map((s) => (
          <div key={s.label} className="tt-cell-demo">
            <div className={`tt-cell ${s.cls}`}>{value}{s.label === "saving" && <span className="tt-cell-spinner" />}</div>
            <span className="tt-cell-caption">{s.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
