---
name: Interactive Device Diagram
description: Image-based motherboard visualizer with clickable hotspots for explaining phone repairs.
---

## Rule

The Device Diagram is a separate page (`/device-diagram`) linked from the sidebar. It shows a real photo of each logic board with an SVG overlay of clickable hotspots for Android and iPhone.

**Why:** A visual aid helps non-technical customers understand which part is being repaired and why replacement is recommended. Real board photos feel more credible than stylized diagrams.

**How to apply:**

1. Add a sidebar nav item under the same `navItems` array in `AppLayout.tsx`.
2. Store board images in `public/` (e.g. `motherboard-android.jpg`, `motherboard-iphone.png`) and reference them by path.
3. Define each component with relative coordinates (`x`, `y`, `w`, `h` as 0–1 fractions of the board image) so hotspots scale with the image.
4. Render an `<img>` and an absolutely positioned `<svg>` with the same `viewBox`/`preserveAspectRatio` so hotspots align with the photo at any display size.
5. Keep component data in a typed array: `id`, `label`, `type`, `function`, `symptoms`, `whyReplace`.
6. On click, show the selected component in a side panel with function, common failure signs, and why it is replaced.
7. Use color coding per component type (`ic`, `connector`, `passive`, `shield`) and labels inside the hotspots to match the app theme.
