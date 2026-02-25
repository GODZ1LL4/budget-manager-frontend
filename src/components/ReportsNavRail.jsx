import { useEffect, useMemo, useState } from "react";

function normalize(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(key);
    return raw != null ? JSON.parse(raw) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function GroupCollapse({ title, count, open, onToggle, children }) {
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-2 rounded-lg"
        style={{
          background: "color-mix(in srgb, var(--panel) 70%, transparent)",
          border: "1px solid var(--border-rgba)",
          color: "var(--text)",
        }}
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
          {title}
        </span>

        <span className="flex items-center gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--panel) 60%, transparent)",
              border: "1px solid var(--border-rgba)",
              color: "var(--muted)",
            }}
          >
            {count}
          </span>
          <span
            className={`text-xs transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            style={{ color: "var(--muted)" }}
          >
            ▼
          </span>
        </span>
      </button>

      {open ? <div className="mt-2 space-y-1">{children}</div> : null}
    </div>
  );
}

export default function ReportsNavRail({
  sections,
  storageKey = "reports_active_section",
  defaultSectionId,
  preloadNext = true,
  railStorageKey = "reports_rail_collapsed",
  groupStorageKey = "reports_group_open_map",
  searchInputRef,
}) {
  // Sidebar colapsable (ancho)
  const [railCollapsed, setRailCollapsed] = useLocalStorageState(
    railStorageKey,
    false
  );

  const [query, setQuery] = useState("");

  const [activeId, setActiveId] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved || defaultSectionId || sections?.[0]?.items?.[0]?.id;
  });

  useEffect(() => {
    if (!activeId) return;
    localStorage.setItem(storageKey, activeId);
  }, [activeId, storageKey]);

  // Estado abierto/cerrado por grupo
  const [openMap, setOpenMap] = useLocalStorageState(groupStorageKey, {});

  const filteredSections = useMemo(() => {
    const q = normalize(query.trim());
    const base = sections || [];

    if (!q) return base;

    return base
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          const hay = normalize(`${it.title} ${it.keywords || ""}`);
          return hay.includes(q);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [query, sections]);

  const flat = useMemo(
    () => filteredSections.flatMap((g) => g.items),
    [filteredSections]
  );

  const active = useMemo(
    () => flat.find((x) => x.id === activeId) || flat[0],
    [flat, activeId]
  );

  // Si el filtro sacó el active, mover al primero visible
  useEffect(() => {
    if (!active && flat[0]) setActiveId(flat[0].id);
  }, [active, flat]);

  // Preload del siguiente para UX suave
  const next = useMemo(() => {
    if (!preloadNext || !active) return null;
    const idx = flat.findIndex((x) => x.id === active.id);
    return idx >= 0 ? flat[idx + 1] : null;
  }, [preloadNext, flat, active]);

  // Auto-open de grupos cuando hay búsqueda
  useEffect(() => {
    if (!query.trim()) return;
    const nextMap = { ...openMap };
    for (const g of filteredSections) nextMap[g.groupId] = true;
    setOpenMap(nextMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const railWidth = railCollapsed ? "72px" : "240px";

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `${railWidth} 1fr` }}>
      {/* LEFT RAIL */}
      <aside
        className="rounded-2xl p-2 md:sticky md:top-4"
        style={{
          height: "calc(100vh - 2rem)",
          background: "color-mix(in srgb, var(--panel) 85%, transparent)",
          border: "var(--border-w) solid var(--border-rgba)",
          boxShadow: "var(--glow-shadow)",
          overflow: "hidden",
        }}
      >
        {/* Header rail */}
        <div className="flex items-center justify-between gap-2 px-1 py-1">
          {!railCollapsed ? (
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "var(--text)" }}
              >
                Reportes
              </div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                {flat.length} resultado(s)
              </div>
            </div>
          ) : (
            <div
              className="text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
              title="Reportes"
            >
              R
            </div>
          )}

          <button
            type="button"
            onClick={() => setRailCollapsed((v) => !v)}
            className="px-2 py-1 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              border: "1px solid var(--border-rgba)",
              color: "var(--muted)",
            }}
            title={railCollapsed ? "Expandir" : "Colapsar"}
          >
            {railCollapsed ? "»" : "«"}
          </button>
        </div>

        {/* Search */}
        {!railCollapsed ? (
          <div className="mt-2 px-1">
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Buscar… ("/" para enfocar)'
              className="w-full px-3 py-2 rounded-lg outline-none"
              style={{
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                border: "1px solid var(--border-rgba)",
                color: "var(--text)",
              }}
            />
          </div>
        ) : (
          <div className="mt-2 px-1">
            <button
              type="button"
              onClick={() => {
                setRailCollapsed(false);
                // en el siguiente tick para asegurar que el input exista
                setTimeout(() => searchInputRef?.current?.focus(), 0);
              }}
              className="w-full px-2 py-2 rounded-lg"
              style={{
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                border: "1px solid var(--border-rgba)",
                color: "var(--muted)",
              }}
              title="Buscar"
            >
              🔎
            </button>
          </div>
        )}

        {/* Scrollable nav */}
        <div
          className="mt-3 px-1 pb-2"
          style={{
            height: railCollapsed ? "calc(100% - 68px)" : "calc(100% - 108px)",
            overflowY: "auto",
          }}
        >
          {filteredSections.map((group) => {
            const isOpen =
              openMap[group.groupId] ?? (query.trim() ? true : false); // default abierto
            return (
              <GroupCollapse
                key={group.groupId}
                title={railCollapsed ? group.groupTitle.slice(0, 2) : group.groupTitle}
                count={group.items.length}
                open={!railCollapsed && isOpen}
                onToggle={() =>
                  setOpenMap((m) => ({
                    ...m,
                    [group.groupId]: !isOpen,
                  }))
                }
              >
                {group.items.map((it) => {
                  const isActive = active?.id === it.id;

                  // En modo colapsado: botones “icon style” (aquí usamos el short como mini label)
                  if (railCollapsed) {
                    return (
                      <button
                        key={it.id}
                        onClick={() => setActiveId(it.id)}
                        className="w-full px-2 py-2 rounded-lg transition"
                        style={{
                          background: isActive
                            ? "color-mix(in srgb, var(--panel) 60%, transparent)"
                            : "transparent",
                          border: isActive
                            ? "1px solid color-mix(in srgb, var(--text) 14%, transparent)"
                            : "1px solid transparent",
                          color: "var(--text)",
                        }}
                        title={it.title}
                      >
                        <span className="text-xs font-bold">
                          {(it.short || it.title).slice(0, 2)}
                        </span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={it.id}
                      onClick={() => setActiveId(it.id)}
                      className="w-full text-left px-3 py-2 rounded-lg transition"
                      style={{
                        color: "var(--text)",
                        background: isActive
                          ? "color-mix(in srgb, var(--panel) 60%, transparent)"
                          : "transparent",
                        border: isActive
                          ? "1px solid color-mix(in srgb, var(--text) 14%, transparent)"
                          : "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {it.short || it.title}
                        </span>
                        {it.badge ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                "color-mix(in srgb, var(--panel) 60%, transparent)",
                              border: "1px solid var(--border-rgba)",
                              color: "var(--muted)",
                            }}
                          >
                            {it.badge}
                          </span>
                        ) : null}
                      </div>

                      {it.subtitle ? (
                        <div
                          className="text-[11px] mt-1"
                          style={{ color: "var(--muted)" }}
                        >
                          {it.subtitle}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </GroupCollapse>
            );
          })}
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main
        className="rounded-2xl p-4 min-h-[240px]"
        style={{
          background: "color-mix(in srgb, var(--panel) 85%, transparent)",
          border: "var(--border-w) solid var(--border-rgba)",
          boxShadow: "var(--glow-shadow)",
        }}
      >
        {active ? (
          <>
            <div className="mb-3">
              <h3
                className="text-sm font-bold uppercase tracking-[0.18em]"
                style={{ color: "var(--text)" }}
              >
                {active.title}
              </h3>
              {active.panelHint ? (
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {active.panelHint}
                </p>
              ) : null}
            </div>

            <div>{active.render()}</div>

            {next ? <div className="hidden">{next.render()}</div> : null}
          </>
        ) : (
          <p style={{ color: "var(--muted)" }}>No hay secciones para mostrar.</p>
        )}
      </main>
    </div>
  );
}