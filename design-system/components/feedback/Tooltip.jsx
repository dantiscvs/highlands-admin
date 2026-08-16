import React from "react";

const STYLE = `
.tt-tooltip { position: relative; display: inline-block; }
.tt-tooltip-bubble { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  background: #23261E; color: #FBFAF6; font-family: var(--font-ui); font-size: var(--text-xs); font-weight: 500;
  padding: 6px 10px; border-radius: var(--radius-sm); box-shadow: var(--shadow-e2); white-space: nowrap; z-index: var(--z-tooltip); }
.tt-tooltip-bubble::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  border: 5px solid transparent; border-top-color: #23261E; }
`;

export function Tooltip({ label, children }) {
  return (
    <>
      <style>{STYLE}</style>
      <span className="tt-tooltip">
        {children}
        <span className="tt-tooltip-bubble">{label}</span>
      </span>
    </>
  );
}
