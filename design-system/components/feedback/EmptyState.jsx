import React from "react";
import { Button } from "../forms/Button.jsx";

const STYLE = `
.tt-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px;
  padding: var(--space-9) var(--space-7); border: 1.5px dashed var(--border-strong); border-radius: var(--radius-lg);
  background: var(--bg-card); font-family: var(--font-ui); }
.tt-empty-icon { width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--border-strong); display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); margin-bottom: 4px; }
.tt-empty-title { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); }
.tt-empty-desc { font-size: var(--text-sm); color: var(--text-secondary); max-width: 320px; }
`;

export function EmptyState({ title, description, actionLabel }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="tt-empty">
        <div className="tt-empty-icon">
          <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" /><line x1="9" y1="5.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1.5" /><circle cx="9" cy="12.3" r="0.9" fill="currentColor" /></svg>
        </div>
        <div className="tt-empty-title">{title}</div>
        {description && <div className="tt-empty-desc">{description}</div>}
        {actionLabel && <div style={{ marginTop: 6 }}><Button variant="secondary" size="sm">{actionLabel}</Button></div>}
      </div>
    </>
  );
}
