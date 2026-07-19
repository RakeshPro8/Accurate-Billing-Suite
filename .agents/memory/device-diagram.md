---
name: Interactive Device Diagram
description: SVG-based motherboard visualizer for explaining phone repairs to customers.
---

## Rule

The Device Diagram is a separate page (`/device-diagram`) linked from the sidebar. It shows a stylized, clickable SVG motherboard with tabs for Android and iPhone.

**Why:** A visual aid helps non-technical customers understand which part is being repaired and why replacement is recommended.

**How to apply:**

1. Add a sidebar nav item under the same `navItems` array in `AppLayout.tsx`.
2. Render the board with an SVG containing `<rect>` hotspots for each component (CPU, Power IC, Backlight IC, Touch IC, charging IC, connectors, passives, etc.).
3. Keep component data in a typed array: `id`, `label`, `type`, `function`, `symptoms`, `whyReplace`.
4. On click, show the selected component in a side panel with function, common failure signs, and why it is replaced.
5. Use color coding per component type (`ic`, `connector`, `passive`, `shield`) and a dark card background to match the app theme.
