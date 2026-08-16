import React from "react";
import { Button } from "../forms/Button.jsx";

const STYLE = `
.tt-drawer-frame { background: var(--bg-overlay-scrim); display: flex; justify-content: flex-end; border-radius: var(--radius-lg); overflow: hidden; height: 480px; }
.tt-drawer { width: 380px; background: var(--bg-card); border-left: 1px solid var(--border-hairline); box-shadow: var(--shadow-e3);
  display: flex; flex-direction: column; font-family: var(--font-ui); }
.tt-drawer-header { padding: var(--space-6) var(--space-7); border-bottom: 1px solid var(--border-hairline);
  display: flex; align-items: center; justify-content: space-between; }
.tt-drawer-title { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); }
.tt-drawer-sub { font-size: var(--text-xs); color: var(--text-tertiary); margin-top: 2px; }
.tt-drawer-close { color: var(--text-tertiary); cursor: pointer; font-size: 18px; }
.tt-drawer-body { flex: 1; overflow-y: auto; padding: var(--space-7); display: flex; flex-direction: column; gap: var(--space-6); }
.tt-drawer-footer { padding: var(--space-5) var(--space-7); border-top: 1px solid var(--border-hairline); background: var(--bg-recessed);
  display: flex; justify-content: flex-end; gap: var(--space-4); }
`;

export function Drawer({ title, subtitle, children }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="tt-drawer-frame">
        <div className="tt-drawer">
          <div className="tt-drawer-header">
            <div>
              <div className="tt-drawer-title">{title}</div>
              {subtitle && <div className="tt-drawer-sub">{subtitle}</div>}
            </div>
            <span className="tt-drawer-close">×</span>
          </div>
          <div className="tt-drawer-body">{children}</div>
          <div className="tt-drawer-footer">
            <Button variant="secondary" size="sm">Cancel</Button>
            <Button variant="primary" size="sm">Save changes</Button>
          </div>
        </div>
      </div>
    </>
  );
}
