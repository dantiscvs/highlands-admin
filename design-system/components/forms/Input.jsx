import React from "react";

const STYLE = `
.tt-field { display: flex; flex-direction: column; gap: 6px; font-family: var(--font-ui); }
.tt-field label { font-size: var(--text-sm); font-weight: 500; color: var(--text-primary); }
.tt-field .tt-help { font-size: var(--text-xs); color: var(--text-secondary); }
.tt-field .tt-help--error { color: var(--color-danger); }
.tt-input { font-family: var(--font-ui); font-size: var(--text-base); color: var(--text-primary);
  background: var(--bg-recessed); border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  padding: 9px 12px; transition: border-color .12s ease, box-shadow .12s ease, background-color .12s ease; width: 100%; box-sizing: border-box; }
.tt-input::placeholder { color: var(--text-tertiary); }
.tt-input:hover:not(:disabled):not(:focus) { border-color: var(--text-tertiary); }
.tt-input:focus { outline: none; background: var(--bg-card); border-color: var(--border-focus); box-shadow: var(--focus-ring); }
.tt-input:disabled { opacity: 0.55; cursor: not-allowed; }
.tt-input--error { border-color: var(--color-danger); }
.tt-input--error:focus { box-shadow: var(--focus-ring-danger); border-color: var(--color-danger); }
.tt-input--numeric { text-align: right; font-variant-numeric: tabular-nums; }
`;

export function Input({ label, type = "text", placeholder, help, error, disabled, defaultValue }) {
  return (
    <>
      <style>{STYLE}</style>
      <div className="tt-field">
        {label && <label>{label}</label>}
        <input
          type={type}
          className={`tt-input${type === "number" ? " tt-input--numeric" : ""}${error ? " tt-input--error" : ""}`}
          placeholder={placeholder}
          disabled={disabled}
          defaultValue={defaultValue}
        />
        {error ? <span className="tt-help tt-help--error">{error}</span> : help ? <span className="tt-help">{help}</span> : null}
      </div>
    </>
  );
}
