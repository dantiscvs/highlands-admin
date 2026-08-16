import React from "react";

const STYLE = `
.tt-card { background: var(--bg-card); border: 1px solid var(--border-hairline); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-e1); padding: var(--space-6); font-family: var(--font-ui); }
.tt-stat-label { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; }
.tt-stat-value { font-size: var(--text-3xl); color: var(--text-primary); font-weight: 600; margin-top: 6px; letter-spacing: -0.01em; }
.tt-stat-trend { font-size: var(--text-xs); color: var(--text-tertiary); margin-top: 6px; }
.tt-card-title { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-3); }
`;

export function Card({ children }) {
  return (<><style>{STYLE}</style><div className="tt-card">{children}</div></>);
}

export function StatCard({ label, value, trend }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="tt-card">
        <div className="tt-stat-label">{label}</div>
        <div className="tt-stat-value">{value}</div>
        {trend && <div className="tt-stat-trend">{trend}</div>}
      </div>
    </>
  );
}
