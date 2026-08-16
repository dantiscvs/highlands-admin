Native select (surface picker, activity type, linked accommodation) fixed for the white-background/low-contrast bug: explicit background-color and color on both `select` and `option`, custom chevron, visible focus ring.

```jsx
<Select label="Surface" options={["Paved", "Gravel", "Singletrack", "Mixed"]} defaultValue="Gravel" />
<OpenMenu items={["Trailhead Lodge", "Riverside Camp", "Summit Hut"]} selected="Riverside Camp" />
```

`OpenMenu` shows the open-dropdown visual spec (selected row uses the accent-primary-subtle fill) for cases needing a custom listbox instead of a native select.
