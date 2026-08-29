/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#d7fff7',
    tint: '#00e6c3',

    // Core surfaces
    background: '#081313',
    foreground: '#d7fff7',

    // Cards / elevated surfaces
    card: '#102020',
    cardForeground: '#d7fff7',

    // Primary action color (buttons, links, active states)
    primary: '#00e6c3',
    primaryForeground: '#081313',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#18302f',
    secondaryForeground: '#d7fff7',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#18302f',
    mutedForeground: '#8aa6a1',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#1c3d3a',
    accentForeground: '#d7fff7',

    // Destructive actions (delete, error states)
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#28504b',
    input: '#28504b',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
