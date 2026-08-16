Inline-editable spreadsheet cell for the day-by-day grid. States: default (transparent) → hover (recessed fill, text cursor) → editing (white fill, focus ring) → saving (info-tinted, spinner) → saved (success-tinted, fades back to default after ~1.2s in the real implementation).

```jsx
<EditableCell value="42.3 km" />
```

Keyboard: Tab/Shift+Tab moves cell-to-cell; Enter commits and moves down; Esc reverts and exits editing.
