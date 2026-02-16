//frontend\src\theme\themeSchema.js
export const THEME_PRESETS = [
  { id: "default", name: "FinanceFlow (Default)" },
  { id: "ironman", name: "Iron Man (Dev)" },
  { id: "ferrari-corsa", name: "Ferrari Corsa" },
  { id: "white", name: "White Quartz (Light) PRO" },
  { id: "black-gold", name: "BlackGold × Rolex PRO v2" },
  { id: "gulf", name: "Gulf Racing 🏁" },
  { id: "gulf-blue", name: "Gulf Heritage Blue 🏁" },

];

export const THEME_SECTIONS = [
  {
    id: "global",
    title: "Global",
    description: "Colores base de la aplicación.",
    fields: [
      { key: "--bg-1", label: "Fondo 1", type: "color" },
      { key: "--bg-2", label: "Fondo 2", type: "color" },
      { key: "--bg-3", label: "Fondo 3", type: "color" },
      { key: "--panel", label: "Panel", type: "color" },
      { key: "--panel-2", label: "Panel secundario", type: "color" },

      { key: "--text", label: "Texto", type: "color" },
      { key: "--muted", label: "Texto muted", type: "color" },

      { key: "--border", label: "Borde (color)", type: "color" },
      { key: "--ring", label: "Ring / foco", type: "color" },

      { key: "--primary", label: "Primary", type: "color" },
      { key: "--danger", label: "Danger", type: "color" },
      { key: "--success", label: "Success", type: "color" },
      { key: "--warning", label: "Warning", type: "color" }
    ]
  },

  {
    id: "headings",
    title: "Títulos",
    description: "Colores para encabezados (h1/h2/h3) sin afectar el body text.",
    fields: [
      { key: "--heading", label: "Heading", type: "color" },
      { key: "--heading-muted", label: "Heading muted", type: "color" },
      { key: "--heading-accent", label: "Heading accent", type: "color" }
    ]
  },

  {
    id: "derived",
    title: "Derivados (solo lectura)",
    description: "Se calculan automáticamente (no se guardan como overrides).",
    fields: [
      { key: "--border-rgba", label: "Border RGBA", type: "derived" },
      { key: "--glow-shadow", label: "Glow shadow", type: "derived" },
      { key: "--btn-glow-shadow", label: "Button glow shadow", type: "derived" }
    ]
  },

  {
    id: "controls",
    title: "Controles (Inputs / Selects)",
    description: "Fondo y borde de controles interactivos (más opacos que paneles).",
    fields: [
      { key: "--control-bg", label: "BG control", type: "color" },
      { key: "--control-bg-2", label: "BG control secundario", type: "color" },
      { key: "--control-text", label: "Texto control", type: "color" },
      { key: "--control-muted", label: "Muted control", type: "color" },

      { key: "--control-border", label: "Borde control", type: "color" },
      { key: "--control-border-hover", label: "Borde hover", type: "color" },
      { key: "--control-border-focus", label: "Borde focus", type: "color" }
    ]
  },

  {
    id: "borders",
    title: "Bordes & radios",
    description: "Ajustes globales para elementos con borde.",
    fields: [
      {
        key: "--radius-sm",
        label: "Radio SM (px)",
        type: "range",
        min: 0,
        max: 18,
        step: 1,
        unit: "px"
      },
      {
        key: "--radius-md",
        label: "Radio MD (px)",
        type: "range",
        min: 0,
        max: 24,
        step: 1,
        unit: "px"
      },
      {
        key: "--radius-lg",
        label: "Radio LG (px)",
        type: "range",
        min: 0,
        max: 32,
        step: 1,
        unit: "px"
      },

      {
        key: "--border-w",
        label: "Ancho borde (px)",
        type: "range",
        min: 0,
        max: 3,
        step: 1,
        unit: "px"
      },
      {
        key: "--border-alpha",
        label: "Opacidad borde",
        type: "range",
        min: 0.05,
        max: 1,
        step: 0.05,
        unit: ""
      }
    ]
  },

  {
    id: "glow",
    title: "Glow / Neon",
    description: "El aura de elementos destacados.",
    fields: [
      { key: "--glow-color", label: "Color glow", type: "color" },
      {
        key: "--glow-alpha",
        label: "Intensidad glow",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        unit: ""
      },
      {
        key: "--glow-blur",
        label: "Blur glow (px)",
        type: "range",
        min: 0,
        max: 40,
        step: 1,
        unit: "px"
      },
      {
        key: "--glow-spread",
        label: "Spread glow (px)",
        type: "range",
        min: 0,
        max: 20,
        step: 1,
        unit: "px"
      }
    ]
  },

  {
    id: "button",
    title: "Botones",
    description: "Sistema de botones (padding/tipo/colores).",
    fields: [
      {
        key: "--btn-radius",
        label: "Radio botón (px)",
        type: "range",
        min: 0,
        max: 32,
        step: 1,
        unit: "px"
      },
      {
        key: "--btn-border-w",
        label: "Borde botón (px)",
        type: "range",
        min: 0,
        max: 3,
        step: 1,
        unit: "px"
      },

      {
        key: "--btn-pad-y",
        label: "Padding Y (px)",
        type: "range",
        min: 4,
        max: 18,
        step: 1,
        unit: "px"
      },
      {
        key: "--btn-pad-x",
        label: "Padding X (px)",
        type: "range",
        min: 6,
        max: 26,
        step: 1,
        unit: "px"
      },
      {
        key: "--btn-font-size",
        label: "Tamaño texto (px)",
        type: "range",
        min: 11,
        max: 18,
        step: 1,
        unit: "px"
      },
      {
        key: "--btn-font-weight",
        label: "Peso texto",
        type: "range",
        min: 400,
        max: 800,
        step: 50,
        unit: ""
      },

      { key: "--btn-bg", label: "BG base", type: "color" },
      { key: "--btn-text", label: "Texto base", type: "color" },
      { key: "--btn-border", label: "Borde base", type: "color" },

      { key: "--btn-hover-bg", label: "BG hover", type: "color" },
      { key: "--btn-hover-border", label: "Borde hover", type: "color" },

      { key: "--btn-primary-bg", label: "Primary BG", type: "color" },
      { key: "--btn-primary-text", label: "Primary texto", type: "color" },

      { key: "--btn-success-bg", label: "Success BG", type: "color" },
      { key: "--btn-success-text", label: "Success texto", type: "color" },

      { key: "--btn-warning-bg", label: "Warning BG", type: "color" },
      { key: "--btn-warning-text", label: "Warning texto", type: "color" },

      { key: "--btn-danger-bg", label: "Danger BG", type: "color" },
      { key: "--btn-danger-text", label: "Danger texto", type: "color" },

      { key: "--btn-ghost-hover-bg", label: "Ghost hover BG", type: "color" },
      { key: "--btn-outline-border", label: "Outline borde", type: "color" },

      { key: "--btn-hover-text", label: "Texto hover (base)", type: "color" },

      {
        key: "--btn-primary-hover-text",
        label: "Primary texto hover",
        type: "color"
      },
      {
        key: "--btn-success-hover-text",
        label: "Success texto hover",
        type: "color"
      },
      {
        key: "--btn-warning-hover-text",
        label: "Warning texto hover",
        type: "color"
      },
      {
        key: "--btn-danger-hover-text",
        label: "Danger texto hover",
        type: "color"
      },

      {
        key: "--btn-primary-hover-bg",
        label: "Primary hover BG (gradient)",
        type: "text"
      },
      {
        key: "--btn-success-hover-bg",
        label: "Success hover BG (gradient)",
        type: "text"
      },
      {
        key: "--btn-warning-hover-bg",
        label: "Warning hover BG (gradient)",
        type: "text"
      },
      {
        key: "--btn-danger-hover-bg",
        label: "Danger hover BG (gradient)",
        type: "text"
      },

      {
        key: "--btn-glow-alpha",
        label: "Glow botón",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        unit: ""
      },
      {
        key: "--btn-glow-blur",
        label: "Blur glow botón (px)",
        type: "range",
        min: 0,
        max: 50,
        step: 1,
        unit: "px"
      },

      {
        key: "--btn-outline-hover-text",
        label: "Outline texto hover",
        type: "color"
      },
      {
        key: "--btn-ghost-hover-text",
        label: "Ghost texto hover",
        type: "color"
      }
    ]
  },

  {
    id: "select",
    title: "Select (Dropdown)",
    description: "Ajustes para el dropdown custom (FFSelect).",
    fields: [
      {
        key: "--select-radius",
        label: "Radio select (px)",
        type: "range",
        min: 0,
        max: 32,
        step: 1,
        unit: "px"
      },
      {
        key: "--select-border-w",
        label: "Borde select (px)",
        type: "range",
        min: 0,
        max: 3,
        step: 1,
        unit: "px"
      },

      { key: "--select-bg", label: "BG trigger", type: "color" },
      { key: "--select-text", label: "Texto trigger", type: "color" },
      { key: "--select-border", label: "Borde trigger", type: "color" },

      { key: "--select-hover-bg", label: "Hover item BG", type: "color" },
      { key: "--select-active-bg", label: "Active item BG", type: "color" },

      {
        key: "--select-max-h",
        label: "Max height (px)",
        type: "range",
        min: 120,
        max: 420,
        step: 10,
        unit: "px"
      }
    ]
  }
];

export const ALL_THEME_KEYS = THEME_SECTIONS.flatMap((s) =>
  s.fields.filter((f) => f.type !== "derived").map((f) => f.key)
);
