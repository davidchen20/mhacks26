"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ColorMode =
  | "standard"
  | "red-green"
  | "blue-yellow"
  | "high-contrast";

const STORAGE_KEY = "wolverlean:accessibility:color-mode:v1";
const ColorModeContext = createContext<{
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
} | null>(null);
const MODES = new Set<ColorMode>([
  "standard",
  "red-green",
  "blue-yellow",
  "high-contrast",
]);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>("standard");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ColorMode | null;
      if (saved && MODES.has(saved)) setColorModeState(saved);
    } catch {
      // The default palette remains available when browser storage is disabled.
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.colorMode = colorMode;
    try {
      localStorage.setItem(STORAGE_KEY, colorMode);
    } catch {
      // Keep the in-memory setting for this visit.
    }
  }, [colorMode]);

  return (
    <ColorModeContext.Provider
      value={{ colorMode, setColorMode: setColorModeState }}
    >
      {children}
    </ColorModeContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(ColorModeContext);
  if (!context) throw new Error("AccessibilityProvider is missing");
  return context;
}

export function ColorVisionControl() {
  const { colorMode, setColorMode } = useAccessibility();
  return (
    <fieldset className="flex items-center gap-2">
      <legend className="sr-only">Color vision display settings</legend>
      <label htmlFor="color-vision-mode" className="text-sm font-semibold">
        Color theme
      </label>
      <select
        id="color-vision-mode"
        className="input w-auto min-w-44"
        value={colorMode}
        onChange={(event) => setColorMode(event.target.value as ColorMode)}
        aria-describedby="color-vision-help"
      >
        <option value="standard">Standard</option>
        <option value="red-green">Blue/orange · red-green safe</option>
        <option value="blue-yellow">Purple/orange · blue-yellow safe</option>
        <option value="high-contrast">High contrast</option>
      </select>
      <span id="color-vision-help" className="sr-only">
        Changes the color palette. Status text and symbols are also shown.
      </span>
    </fieldset>
  );
}
