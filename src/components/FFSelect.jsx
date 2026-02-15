//frontend\src\components\FFSelect.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

// 👇 encuentra contenedores que realmente scrollean (clave dentro de modales)
function getScrollParents(el) {
  const parents = [];
  if (!el) return parents;

  const overflowRe = /(auto|scroll|overlay)/;
  let p = el.parentElement;

  while (p && p !== document.body) {
    const cs = getComputedStyle(p);
    const overflow =
      (cs.overflow || "") + (cs.overflowY || "") + (cs.overflowX || "");
    if (overflowRe.test(overflow)) parents.push(p);
    p = p.parentElement;
  }

  parents.push(window);
  return parents;
}

function PortalDropdown({ anchorEl, open, onClose, children }) {
  const dropdownRef = useRef(null);

  // lock de dirección durante la apertura
  const openUpRef = useRef(null);

  const applyPosition = () => {
    if (!open || !anchorEl) return;
    const el = dropdownRef.current;
    if (!el) return;

    const rect = anchorEl.getBoundingClientRect();

    const gap = 6;
    const padding = 12;
    const desired = 320;
    const minH = 160;

    const spaceBelow = window.innerHeight - rect.bottom - gap - padding;
    const spaceAbove = rect.top - gap - padding;

    // decide solo una vez por apertura
    if (openUpRef.current == null) {
      openUpRef.current = spaceBelow < 220 && spaceAbove > spaceBelow;
    }
    const shouldOpenUp = openUpRef.current;

    const maxH = Math.max(
      minH,
      Math.min(desired, shouldOpenUp ? spaceAbove : spaceBelow)
    );

    // ✅ aplica estilos DIRECTO al DOM (más estable que setState)
    el.style.position = "fixed";
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
    el.style.maxHeight = `${maxH}px`;
    el.style.zIndex = "9999";
    el.style.willChange = "top,bottom";

    if (shouldOpenUp) {
      // ✅ CLAVE: ancla por bottom para que al encoger, lo haga desde arriba
      el.style.top = "auto"; // limpia SIEMPRE
      el.style.bottom = `${window.innerHeight - rect.top + gap}px`;
      el.style.transformOrigin = "bottom";
    } else {
      el.style.bottom = "auto";
      el.style.top = `${rect.bottom + gap}px`;
      el.style.transformOrigin = "top";
    }
  };

  // reset lock al abrir/cerrar + primera medición sin “parpadeo”
  useLayoutEffect(() => {
    if (!open) {
      openUpRef.current = null;
      return;
    }
    openUpRef.current = null;
    applyPosition();
    // doble pasada por layout/portal/fonts
    requestAnimationFrame(applyPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open || !anchorEl) return;

    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyPosition);
    };

    // scroll real (modal/containers) + window
    const scrollParents = getScrollParents(anchorEl);
    for (const sp of scrollParents) {
      sp.addEventListener?.("scroll", schedule, { passive: true });
    }
    window.addEventListener("resize", schedule, { passive: true });

    // observar cambios del input y del dropdown (cuando filtras y cambia la lista)
    const ro = new ResizeObserver(schedule);
    ro.observe(anchorEl);
    if (dropdownRef.current) ro.observe(dropdownRef.current);

    // observar mutaciones del contenido (lista cambia aunque no cambie height “todavía”)
    const mo = new MutationObserver(schedule);
    if (dropdownRef.current) {
      mo.observe(dropdownRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    // mobile/zoom/teclado
    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);

    // primera medición
    schedule();
    setTimeout(schedule, 0);

    return () => {
      cancelAnimationFrame(raf);
      for (const sp of scrollParents) {
        sp.removeEventListener?.("scroll", schedule);
      }
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      mo.disconnect();
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorEl]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-[9998] cursor-default"
        aria-label="close"
        tabIndex={-1}
      />

      <div
        ref={dropdownRef}
        // ✅ estilos visuales aquí; posición se aplica por DOM
        style={{
          background: "var(--select-bg)",
          borderColor: "var(--border-rgba)",
          boxShadow: "var(--select-shadow)",
        }}
        className="z-[9999] overflow-y-auto overscroll-contain border rounded-[var(--radius-lg)]"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

export default function FFSelect({
  value,
  onChange,
  options = [],
  placeholder = "Selecciona...",
  disabled = false,

  searchable = true,
  clearable = true,
  maxVisible = 80,

  getOptionLabel,
  getOptionValue,
  renderOption,
  className = "",
}) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const getVal = (opt) =>
    getOptionValue ? getOptionValue(opt) : opt?.value ?? opt?.id ?? opt;
  const getLab = (opt) =>
    getOptionLabel ? getOptionLabel(opt) : opt?.label ?? opt?.name ?? String(opt);

  const selectedOption = useMemo(() => {
    const v = value ?? "";
    return options.find((o) => String(getVal(o)) === String(v)) || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, value]);

  useEffect(() => {
    if (!open) setQuery(selectedOption ? getLab(selectedOption) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedOption]);

  useEffect(() => {
    setQuery(selectedOption ? getLab(selectedOption) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!searchable || !q) return options;
    return options.filter((o) => normalize(getLab(o)).includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query, searchable]);

  const visibleOptions = useMemo(
    () => filtered.slice(0, maxVisible),
    [filtered, maxVisible]
  );

  const close = () => setOpen(false);

  const openNow = () => {
    if (disabled) return;
    setOpen(true);
    if (searchable) setQuery("");

    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus?.();
      el.select?.();
    });
  };

  const commit = (opt) => {
    if (opt?.disabled) return;
    const v = getVal(opt);
    onChange?.(v, opt);
    setOpen(false);
  };

  const clear = () => {
    onChange?.("", null);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={className}>
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (!open) setOpen(true);

            if (clearable && v.trim() === "") onChange?.("", null);
          }}
          onFocus={openNow}
          onClick={openNow}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={!searchable}
          className="ff-input pr-10"
          style={{
            cursor: disabled ? "not-allowed" : searchable ? "text" : "pointer",
            borderWidth: "var(--select-border-w)",
            borderRadius: "var(--select-radius)",
          }}
        />

        <button
          type="button"
          onClick={() => (open ? close() : openNow())}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs"
          style={{ color: "var(--select-muted)", background: "transparent" }}
          aria-label="toggle"
        >
          ▾
        </button>
      </div>

      <PortalDropdown
        anchorEl={inputRef.current}
        open={open && !disabled}
        onClose={close}
      >
        {clearable && (
          <button
            type="button"
            onClick={clear}
            className="w-full text-left px-3 py-2 text-xs border-b"
            style={{
              color: "var(--select-muted)",
              borderColor: "color-mix(in srgb, var(--border-rgba) 70%, transparent)",
              background: "color-mix(in srgb, var(--panel) 40%, transparent)",
            }}
          >
            — Limpiar selección —
          </button>
        )}

        {visibleOptions.map((opt) => {
          const v = getVal(opt);
          const label = getLab(opt);
          const isActive = String(v) === String(value ?? "");
          const isDisabled = !!opt?.disabled;
          const sub = opt?.subLabel ? String(opt.subLabel) : "";

          return (
            <button
              key={String(v)}
              type="button"
              onClick={() => commit(opt)}
              disabled={isDisabled}
              aria-disabled={isDisabled ? "true" : "false"}
              className="w-full text-left px-3 py-2 text-sm"
              style={{
                borderRadius: "var(--select-item-radius)",
                background: isActive ? "var(--select-active-bg)" : "transparent",
                color: isDisabled
                  ? "color-mix(in srgb, var(--select-muted) 85%, transparent)"
                  : "var(--select-text)",
                opacity: isDisabled ? 0.55 : 1,
                cursor: isDisabled ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (isDisabled) return;
                e.currentTarget.style.background = "var(--select-hover-bg)";
              }}
              onMouseLeave={(e) => {
                if (isDisabled) return;
                e.currentTarget.style.background = isActive
                  ? "var(--select-active-bg)"
                  : "transparent";
              }}
            >
              {renderOption ? (
                renderOption(opt, { isActive, isDisabled })
              ) : (
                <div className="flex flex-col">
                  <span className="truncate">{label}</span>
                  {sub && (
                    <span
                      className="text-[11px] mt-0.5 truncate"
                      style={{ color: "var(--select-muted)" }}
                    >
                      {sub}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-3 py-2 text-xs" style={{ color: "var(--select-muted)" }}>
            No hay resultados.
          </div>
        )}

        {filtered.length > maxVisible && (
          <div className="px-3 py-2 text-[11px]" style={{ color: "var(--select-muted)" }}>
            Mostrando {maxVisible} de {filtered.length}. Refina tu búsqueda.
          </div>
        )}
      </PortalDropdown>
    </div>
  );
}
