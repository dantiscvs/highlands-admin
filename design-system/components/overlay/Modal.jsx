import React from "react";
import { Button } from "../forms/Button.jsx";

const STYLE = `
.tt-modal-scrim { background: var(--bg-overlay-scrim); padding: 60px; display: flex; justify-content: center; border-radius: var(--radius-lg); }
.tt-modal { width: 480px; max-width: 100%; background: var(--bg-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-e3);
  border: 1px solid var(--border-hairline); font-family: var(--font-ui); overflow: hidden; }
.tt-modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-6) var(--space-7);
  border-bottom: 1px solid var(--border-hairline); }
.tt-modal-title { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); }
.tt-modal-close { color: var(--text-tertiary); cursor: pointer; font-size: 18px; line-height: 1; }
.tt-modal-close:hover { color: var(--text-primary); }
.tt-modal-body { padding: var(--space-7); font-size: var(--text-base); color: var(--text-secondary); line-height: var(--leading-relaxed); }
.tt-modal-footer { display: flex; justify-content: flex-end; gap: var(--space-4); padding: var(--space-5) var(--space-7);
  border-top: 1px solid var(--border-hairline); background: var(--bg-recessed); }
`;

export function Modal({ title, children, confirmLabel = "Confirm", danger = false }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="tt-modal-scrim">
        <div className="tt-modal">
          <div className="tt-modal-header">
            <span className="tt-modal-title">{title}</span>
            <span className="tt-modal-close">×</span>
          </div>
          <div className="tt-modal-body">{children}</div>
          <div className="tt-modal-footer">
            <Button variant="secondary">Cancel</Button>
            <Button variant={danger ? "danger" : "primary"}>{confirmLabel}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
