//frontend\src\theme\themeStore.js
import { ALL_THEME_KEYS } from "./themeSchema";

const STORAGE_KEY = "ff_theme_v1";

export function loadTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
}

export function clearTheme() {
  localStorage.removeItem(STORAGE_KEY);
}

export function makeEmptyTheme() {
  return { version: 1, name: "Personalizado", preset: "default", vars: {} };
}

// Applies preset + CSS variable overrides to <html>
export function applyTheme(theme) {
  const root = document.documentElement;

  if (theme?.preset) root.setAttribute("data-theme", theme.preset);
  else root.removeAttribute("data-theme");

  // Clear known keys first (so removing a value reverts to default)
  for (const k of ALL_THEME_KEYS) root.style.removeProperty(k);

  // Apply overrides
  const vars = theme?.vars || {};
  for (const [k, v] of Object.entries(vars)) {
    if (v == null || String(v).trim() === "") continue;
    root.style.setProperty(k, String(v));
  }

  // ===== Derived tokens =====
  const cs = getComputedStyle(root);

  const borderColor = cs.getPropertyValue("--border").trim();
  const borderAlpha = Number(cs.getPropertyValue("--border-alpha").trim() || 0.22);

  const glowColor =
    cs.getPropertyValue("--glow-color").trim() || cs.getPropertyValue("--primary").trim();
  const glowAlpha = Number(cs.getPropertyValue("--glow-alpha").trim() || 0.7);
  const glowBlur = cs.getPropertyValue("--glow-blur").trim() || "18px";
  const glowSpread = cs.getPropertyValue("--glow-spread").trim() || "0px";

  const btnGlowAlpha = Number(cs.getPropertyValue("--btn-glow-alpha").trim() || glowAlpha);
  const btnGlowBlur = cs.getPropertyValue("--btn-glow-blur").trim() || glowBlur;

  const borderRgba = toRgba(borderColor, clamp01(borderAlpha));
  const glowRgba = toRgba(glowColor, clamp01(glowAlpha));
  const btnGlowRgba = toRgba(glowColor, clamp01(btnGlowAlpha));

  root.style.setProperty("--border-rgba", borderRgba);
  root.style.setProperty("--glow-rgba", glowRgba);
  root.style.setProperty("--glow-shadow", `0 0 ${glowBlur} ${glowSpread} ${glowRgba}`);
  root.style.setProperty("--btn-glow-shadow", `0 0 ${btnGlowBlur} ${glowSpread} ${btnGlowRgba}`);
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

// Converts any valid CSS color into rgba(...) using the browser parser.
function toRgba(color, alpha) {
  const c = String(color || "").trim();
  if (!c) return `rgba(148, 163, 184, ${alpha})`;

  const el = document.createElement("span");
  el.style.color = c;
  document.body.appendChild(el);
  const parsed = getComputedStyle(el).color; // rgb(...) or rgba(...)
  document.body.removeChild(el);

  const m = parsed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return `rgba(148, 163, 184, ${alpha})`;
  return `rgba(${Number(m[1])}, ${Number(m[2])}, ${Number(m[3])}, ${alpha})`;
}
