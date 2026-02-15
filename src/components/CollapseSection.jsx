import { useState } from "react";

function CollapseSection({ title, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div
  className="mb-4 rounded-[var(--radius-lg)] overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
  style={{
    background: "color-mix(in srgb, var(--panel) 92%, transparent)",
    border: "var(--border-w) solid var(--border-rgba)",
    boxShadow: "var(--glow-shadow)",
  }}
>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
        style={{
          background: "color-mix(in srgb, var(--panel) 85%, transparent)",
          color: "var(--text)",
        }}
      >
        <span
          className="text-xs md:text-sm font-semibold uppercase"
          style={{
            letterSpacing: "0.12em",
            color: "var(--text)",
          }}
        >
          {title}
        </span>

        <span
          className="text-[11px] md:text-xs flex items-center gap-1"
          style={{ color: "var(--muted)" }}
        >
          {open ? "Ocultar" : "Mostrar"}
          <span
            className={`inline-block transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </span>
      </button>

      {open && (
        <div
          className="px-4 pb-4 pt-3"
          style={{
            borderTop: "var(--border-w) solid var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 70%, transparent)",
            color: "var(--text)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapseSection;
