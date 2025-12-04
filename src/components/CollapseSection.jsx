import { useState } from "react";

function CollapseSection({ title, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="
        mb-4 rounded-2xl overflow-hidden
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800
        border border-slate-700/80
        shadow-[0_10px_30px_rgba(0,0,0,0.65)]
        transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.9)]
      "
    >
      <button
        onClick={() => setOpen(!open)}
        className="
          w-full flex items-center justify-between
          px-4 py-3
          text-left
          text-slate-100
          bg-gradient-to-r from-slate-900/80 via-slate-900 to-slate-900/80
          hover:from-slate-800 hover:to-slate-800
          transition-colors
        "
      >
        <span className="text-xs md:text-sm font-semibold tracking-[0.12em] uppercase">
          {title}
        </span>

        <span className="text-[11px] md:text-xs text-slate-300 flex items-center gap-1">
          {open ? "Ocultar" : "Mostrar"}
          <span
            className={`
              inline-block transition-transform duration-200
              ${open ? "rotate-180" : ""}
            `}
          >
            ▼
          </span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-slate-700/70 bg-slate-900/60">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapseSection;
