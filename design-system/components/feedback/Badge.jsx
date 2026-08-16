import React from "react";

const STYLE = `
.tt-badge { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-ui); font-size: var(--text-xs);
  font-weight: 600; padding: 3px 10px; border-radius: var(--radius-full); border: 1px solid transparent; line-height: 1.4; white-space: nowrap; }
.tt-badge--success { background: var(--color-success-subtle); color: var(--color-success); border-color: var(--color-success-border); }
.tt-badge--warning { background: var(--color-warning-subtle); color: var(--color-warning); border-color: var(--color-warning-border); }
.tt-badge--danger { background: var(--color-danger-subtle); color: var(--color-danger); border-color: var(--color-danger-border); }
.tt-badge--info { background: var(--color-info-subtle); color: var(--color-info); border-color: var(--color-info-border); }
.tt-badge--neutral { background: var(--bg-recessed); color: var(--text-secondary); border-color: var(--border-hairline); }
.tt-badge-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
.tt-badge--activity { background: var(--bg-recessed); color: var(--text-primary); border-color: var(--border-hairline); }
`;

const STATUS_MAP = { success: "success", warning: "warning", danger: "danger", info: "info", neutral: "neutral" };
const ACTIVITY_COLOR = { cycling: "var(--activity-cycling)", hiking: "var(--activity-hiking)", driving: "var(--activity-driving)", kayaking: "var(--activity-kayaking)", transit: "var(--activity-transit)" };
const ACTIVITY_SUBTLE = { cycling: "var(--activity-cycling-subtle)", hiking: "var(--activity-hiking-subtle)", driving: "var(--activity-driving-subtle)", kayaking: "var(--activity-kayaking-subtle)", transit: "var(--activity-transit-subtle)" };

export function Badge({ kind = "status", status = "neutral", activity = "cycling", children }) {
  if (kind === "activity") {
    return (
      <>
        <style>{STYLE}</style>
        <span className="tt-badge tt-badge--activity" style={{ background: ACTIVITY_SUBTLE[activity] }}>
          <span className="tt-badge-dot" style={{ background: ACTIVITY_COLOR[activity] }} />
          {children}
        </span>
      </>
    );
  }
  return (
    <>
      <style>{STYLE}</style>
      <span className={`tt-badge tt-badge--${STATUS_MAP[status]}`}>{children}</span>
    </>
  );
}
