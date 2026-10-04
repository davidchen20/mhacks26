"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
export type Theme = "light" | "dark" | "contrast";
export type Palette = "standard" | "deuteranopia" | "protanopia";
const Context = createContext<{theme: Theme; palette: Palette; setTheme: (v: Theme) => void; setPalette: (v: Palette) => void} | null>(null);
export function ThemeProvider({children}: {children: ReactNode}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [palette, setPalette] = useState<Palette>("standard");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem("wolverlean-accessibility") || "{}");
      if (["light", "dark", "contrast"].includes(v.theme)) setTheme(v.theme);
      else if (matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
      if (["standard", "deuteranopia", "protanopia"].includes(v.palette)) setPalette(v.palette);
    } catch { /* Storage can be disabled. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.palette = palette;
    try { localStorage.setItem("wolverlean-accessibility", JSON.stringify({theme, palette})); } catch {}
  }, [theme, palette, ready]);
  return <Context.Provider value={{theme, palette, setTheme, setPalette}}>{children}</Context.Provider>;
}
export function useTheme() { const c = useContext(Context); if (!c) throw new Error("ThemeProvider is required"); return c; }
export default function ThemeControls() {
  const {theme, palette, setTheme, setPalette} = useTheme();
  return <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="sr-only">Accessibility settings</legend>
    <label>Appearance<select className="input" value={theme} onChange={e => setTheme(e.target.value as Theme)}><option value="light">Light</option><option value="dark">Dark</option><option value="contrast">High contrast</option></select></label>
    <label>Indicator palette<select className="input" value={palette} onChange={e => setPalette(e.target.value as Palette)}><option value="standard">Standard</option><option value="deuteranopia">Deuteranopia safe</option><option value="protanopia">Protanopia safe</option></select></label>
  </fieldset>;
}
