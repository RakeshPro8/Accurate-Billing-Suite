export type ThemePreset = "terminal" | "ocean" | "sunset" | "berry" | "forest" | "monochrome";
export type ButtonShape = "default" | "sharp" | "soft" | "pill";
export type BackgroundTreatment = "theme" | "plain" | "grid" | "wash";
export type CardTreatment = "theme" | "flat" | "outlined" | "lifted";
export type TypographyTreatment =
  | "theme"
  | "inter"
  | "space-grotesk"
  | "dm-sans"
  | "ibm-plex-mono"
  | "jetbrains-mono"
  | "plus-jakarta";
export type Density = "theme" | "compact" | "comfortable";

export type UiPreferences = {
  theme: ThemePreset | null;
  buttonShape: ButtonShape;
  background: BackgroundTreatment;
  card: CardTreatment;
  typography: TypographyTreatment;
  density: Density;
};

export const UI_PREFERENCES_EVENT = "mobilinq:ui-preferences";
const STORAGE_KEY = "mobilinq.ui-preferences";

export const defaultUiPreferences: UiPreferences = {
  theme: null,
  buttonShape: "default",
  background: "theme",
  card: "theme",
  typography: "theme",
  density: "theme",
};

function isValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function sanitizePreferences(value: unknown): UiPreferences {
  const candidate = value && typeof value === "object" ? value as Partial<UiPreferences> : {};
  const typography = candidate.typography === "system" ? "inter"
    : candidate.typography === "mono" ? "jetbrains-mono"
    : candidate.typography === "editorial" ? "dm-sans"
    : candidate.typography;
  return {
    theme: isValue(candidate.theme, ["terminal", "ocean", "sunset", "berry", "forest", "monochrome"]) ? candidate.theme : null,
    buttonShape: isValue(candidate.buttonShape, ["default", "sharp", "soft", "pill"]) ? candidate.buttonShape : "default",
    background: isValue(candidate.background, ["theme", "plain", "grid", "wash"]) ? candidate.background : "theme",
    card: isValue(candidate.card, ["theme", "flat", "outlined", "lifted"]) ? candidate.card : "theme",
    typography: isValue(typography, ["theme", "inter", "space-grotesk", "dm-sans", "ibm-plex-mono", "jetbrains-mono", "plus-jakarta"]) ? typography : "theme",
    density: isValue(candidate.density, ["theme", "compact", "comfortable"]) ? candidate.density : "theme",
  };
}

export function readUiPreferences(): UiPreferences {
  if (typeof window === "undefined") return defaultUiPreferences;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? sanitizePreferences(JSON.parse(stored)) : defaultUiPreferences;
  } catch {
    return defaultUiPreferences;
  }
}

export function saveUiPreferences(preferences: UiPreferences) {
  const next = sanitizePreferences(preferences);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A restricted browser can deny local storage; the live preview still works.
  }
  window.dispatchEvent(new CustomEvent<UiPreferences>(UI_PREFERENCES_EVENT, { detail: next }));
}

export function applyUiPreferencesToDocument(preferences: UiPreferences, fallbackTheme = "terminal") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", preferences.theme ?? fallbackTheme);
  root.setAttribute("data-ui-shape", preferences.buttonShape);
  root.setAttribute("data-ui-background", preferences.background);
  root.setAttribute("data-ui-card", preferences.card);
  root.setAttribute("data-ui-type", preferences.typography);
  root.setAttribute("data-ui-density", preferences.density);
}