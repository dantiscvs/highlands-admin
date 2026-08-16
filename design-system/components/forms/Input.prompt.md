Text/number/date field used across trip setup forms and the day-detail drawer.

```jsx
<Input label="Trip title" placeholder="Alps ridge traverse" />
<Input label="Distance (km)" type="number" defaultValue="42" />
<Input label="Start date" type="date" />
<Input label="Rider count" type="number" error="Must be at least 1" />
```

Recessed fill (var(--bg-recessed)) reads as "editable" against the white card surface. Focus swaps fill to white and adds a visible ring — never rely on border color change alone.
