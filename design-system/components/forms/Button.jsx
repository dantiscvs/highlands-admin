import React from "react";

const STYLE = `
.tt-btn { font-family: var(--font-ui); font-weight: 500; font-size: var(--text-sm); line-height: 1;
  border-radius: var(--radius-md); padding: 10px 18px; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid transparent; cursor: pointer; transition: background-color .12s ease, border-color .12s ease, box-shadow .12s ease, transform .04s ease; }
.tt-btn:active { transform: scale(0.98); }
.tt-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.tt-btn[disabled] { opacity: 0.5; cursor: not-allowed; transform: none; }
.tt-btn--sm { padding: 6px 12px; font-size: var(--text-xs); border-radius: var(--radius-sm); }
.tt-btn--primary { background: var(--accent-primary); color: var(--text-on-accent); border-color: var(--accent-primary); }
.tt-btn--primary:hover:not([disabled]) { background: var(--accent-primary-hover); border-color: var(--accent-primary-hover); }
.tt-btn--primary:active:not([disabled]) { background: var(--accent-primary-pressed); border-color: var(--accent-primary-pressed); }
.tt-btn--secondary { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-strong); }
.tt-btn--secondary:hover:not([disabled]) { background: var(--bg-recessed); }
.tt-btn--secondary:active:not([disabled]) { background: var(--bg-recessed-hover); }
.tt-btn--danger { background: var(--color-danger); color: var(--text-on-accent); border-color: var(--color-danger); }
.tt-btn--danger:hover:not([disabled]) { filter: brightness(0.92); }
.tt-btn--danger:active:not([disabled]) { filter: brightness(0.84); }
.tt-btn--ghost { background: transparent; color: var(--text-secondary); border-color: transparent; }
.tt-btn--ghost:hover:not([disabled]) { background: var(--bg-recessed); color: var(--text-primary); }
`;

export function Button({ variant = "primary", size = "md", disabled = false, children, onClick, type = "button" }) {
  const cls = `tt-btn tt-btn--${variant}${size === "sm" ? " tt-btn--sm" : ""}`;
  return (
    <>
      <style>{STYLE}</style>
      <button type={type} className={cls} disabled={disabled} onClick={onClick}>{children}</button>
    </>
  );
}
