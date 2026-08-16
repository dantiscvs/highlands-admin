import React from "react";

const STYLE = `
.tt-check-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: var(--radius-md);
  font-family: var(--font-ui); border: 1px solid transparent; }
.tt-check-row--warning { background: var(--color-warning-subtle); border-color: var(--color-warning-border); }
.tt-check-row--done { background: var(--color-success-subtle); border-color: var(--color-success-border); }
.tt-check-icon { width: 18px; height: 18px; flex: none; margin-top: 1px; }
.tt-check-body { flex: 1; }
.tt-check-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.tt-check-desc { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; }
.tt-check-action { font-size: var(--text-xs); font-weight: 600; color: var(--text-link); cursor: pointer; flex: none; align-self: center; }
.tt-check-action:hover { color: var(--text-link-hover); }
`;

export function ChecklistItem({ status = "warning", title, description, actionLabel = "Resolve" }) {
  const isDone = status === "done";
  return (
    <>
      <style>{STYLE}</style>
      <div className={`tt-check-row ${isDone ? "tt-check-row--done" : "tt-check-row--warning"}`}>
        <svg className="tt-check-icon" viewBox="0 0 18 18">
          {isDone ? (
            <><circle cx="9" cy="9" r="7.5" fill="none" stroke="var(--color-success)" strokeWidth="1.5" /><polyline points="5.5,9.2 8,11.8 12.5,6.5" fill="none" stroke="var(--color-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>
          ) : (
            <><polygon points="9,2.5 16,15 2,15" fill="none" stroke="var(--color-warning)" strokeWidth="1.5" strokeLinejoin="round" /><line x1="9" y1="7.5" x2="9" y2="11" stroke="var(--color-warning)" strokeWidth="1.5" strokeLinecap="round" /><circle cx="9" cy="13" r="0.9" fill="var(--color-warning)" /></>
          )}
        </svg>
        <div className="tt-check-body">
          <div className="tt-check-title">{title}</div>
          {description && <div className="tt-check-desc">{description}</div>}
        </div>
        {!isDone && <span className="tt-check-action">{actionLabel}</span>}
      </div>
    </>
  );
}
