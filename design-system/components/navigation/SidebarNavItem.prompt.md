Sidebar section-nav row (Overview, Day-by-day, Accommodation, etc).

```jsx
<SidebarNavItem label="Overview" active icon={<CircleIcon />} />
<SidebarNavItem label="Accommodation" count={6} icon={<HouseIcon />} />
```

Active state is a filled tint (no left-border stripe — that reads as generic-SaaS). Icon recolors to accent-primary only when active.
