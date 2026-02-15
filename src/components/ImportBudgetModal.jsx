import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";

function currency(n) {
  const v = Number(n || 0);
  return `RD$ ${v.toFixed(2)}`;
}

export default function ImportBudgetModal({
  isOpen,
  onClose,
  scope,
  setScope,
  loading,
  preview,
  onConfirm,
}) {
  const items = preview?.items || [];
  const conflicts = preview?.conflicts || [];
  const hasItems = items.length > 0;

  // ✅ tokens helpers
  const border = "var(--border-rgba)";
  const panel = "var(--panel)";
  const text = "var(--text)";
  const muted = "var(--muted)";
  const primary = "var(--primary)";
  const success = "var(--success)";
  const warning = "var(--warning)";

  // Mapa de conflictos por clave "month::category_id"
  const conflictMap = useMemo(() => {
    const m = new Map();
    for (const c of conflicts) {
      const key = `${c.month}::${c.category_id}`;
      m.set(key, c);
    }
    return m;
  }, [conflicts]);

  // Todas las claves posibles
  const allKeys = useMemo(
    () => items.map((r) => `${r.month}::${r.category_id}`),
    [items]
  );

  const [selectedKeys, setSelectedKeys] = useState([]);

  // ✅ FIX: Al cambiar preview, selecciona por defecto SOLO los que NO tienen budget existente
  useEffect(() => {
    if (!items.length) {
      setSelectedKeys((prev) => (prev.length ? [] : prev));
      return;
    }

    const initial = items
      .filter((r) => !conflictMap.has(`${r.month}::${r.category_id}`))
      .map((r) => `${r.month}::${r.category_id}`);

    setSelectedKeys((prev) => {
      if (prev.length !== initial.length) return initial;

      const s = new Set(prev);
      for (const k of initial) {
        if (!s.has(k)) return initial;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, conflicts]);

  const allChecked =
    allKeys.length > 0 && selectedKeys.length === allKeys.length;
  const someChecked =
    selectedKeys.length > 0 && selectedKeys.length < allKeys.length;

  const toggleAll = () => {
    if (allChecked) setSelectedKeys([]);
    else setSelectedKeys(allKeys);
  };

  const toggleOne = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleConfirm = () => onConfirm({ selectedKeys });

  const scopeBtnBase =
    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importar a presupuesto" size="xl">
      <div className="space-y-4" style={{ color: text }}>
        {/* Descripción */}
        <div className="text-sm" style={{ color: "color-mix(in srgb, var(--text) 85%, transparent)" }}>
          Selecciona qué rango importar desde el escenario.
          <br />
          <strong style={{ color: text }}>Ingresos no se importan</strong>; solo
          gastos por categoría.
        </div>

        {/* Selector de alcance */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={scopeBtnBase}
            onClick={() => setScope("current")}
            disabled={loading}
            style={
              scope === "current"
                ? {
                    background: `color-mix(in srgb, ${panel} 88%, transparent)`,
                    borderColor: `color-mix(in srgb, ${success} 45%, ${border})`,
                    color: success,
                    boxShadow: "var(--glow-shadow)",
                  }
                : {
                    background: `color-mix(in srgb, ${panel} 70%, transparent)`,
                    borderColor: border,
                    color: muted,
                  }
            }
          >
            Mes actual
          </button>

          <button
            type="button"
            className={scopeBtnBase}
            onClick={() => setScope("all")}
            disabled={loading}
            style={
              scope === "all"
                ? {
                    background: `color-mix(in srgb, ${panel} 88%, transparent)`,
                    borderColor: `color-mix(in srgb, ${success} 45%, ${border})`,
                    color: success,
                    boxShadow: "var(--glow-shadow)",
                  }
                : {
                    background: `color-mix(in srgb, ${panel} 70%, transparent)`,
                    borderColor: border,
                    color: muted,
                  }
            }
          >
            Todo el escenario (hasta 31 dic)
          </button>
        </div>

        {/* Rango calculado */}
        <div className="text-xs" style={{ color: muted }}>
          Rango efectivo:{" "}
          <span style={{ color: text, fontWeight: 600 }}>
            {preview?.from || "—"}
          </span>{" "}
          →{" "}
          <span style={{ color: text, fontWeight: 600 }}>
            {preview?.to || "—"}
          </span>
        </div>

        {/* Resumen rápido */}
        <div
          className="rounded-xl px-3 py-2 flex flex-wrap gap-3 text-xs sm:text-sm"
          style={{
            background: `color-mix(in srgb, ${panel} 78%, transparent)`,
            border: `var(--border-w) solid ${border}`,
            color: text,
          }}
        >
          <span>
            Detectados: <span style={{ fontWeight: 700 }}>{items.length}</span>
          </span>
          <span>
            Con budget existente:{" "}
            <span style={{ fontWeight: 700 }}>{conflicts.length}</span>
          </span>
          <span>
            Seleccionados:{" "}
            <span style={{ fontWeight: 800, color: success }}>
              {selectedKeys.length}
            </span>
          </span>
        </div>

        {/* Tabla */}
        <div
          className="rounded-lg p-2 max-h-60 overflow-auto"
          style={{
            border: `var(--border-w) solid ${border}`,
            background: `color-mix(in srgb, ${panel} 70%, transparent)`,
          }}
        >
          {loading && <div className="text-sm" style={{ color: muted }}>Cargando…</div>}

          {!loading && !hasItems && (
            <div className="text-sm italic" style={{ color: muted }}>
              No hay nada para importar con las reglas y fechas actuales.
            </div>
          )}

          {!loading && hasItems && (
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr
                  className="text-left border-b"
                  style={{
                    background: `color-mix(in srgb, ${panel} 86%, transparent)`,
                    borderColor: border,
                  }}
                >
                  <th className="py-1 px-2 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someChecked;
                      }}
                      onChange={toggleAll}
                      style={{ accentColor: primary }}
                    />
                  </th>
                  <th className="py-1 px-2" style={{ color: muted }}>
                    Mes
                  </th>
                  <th className="py-1 px-2" style={{ color: muted }}>
                    Categoría
                  </th>
                  <th className="py-1 px-2 text-right" style={{ color: muted }}>
                    Monto
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((r, i) => {
                  const key = `${r.month}::${r.category_id}`;
                  const checked = selectedKeys.includes(key);
                  const hasConflict = conflictMap.has(key);

                  const rowBg =
                    i % 2 === 0
                      ? `color-mix(in srgb, ${panel} 76%, transparent)`
                      : `color-mix(in srgb, ${panel} 84%, transparent)`;

                  return (
                    <tr
                      key={key}
                      style={{
                        background: rowBg,
                        borderTop: `1px solid color-mix(in srgb, ${border} 75%, transparent)`,
                      }}
                    >
                      <td className="py-1 px-2 align-middle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(key)}
                          style={{ accentColor: primary }}
                        />
                      </td>

                      <td className="py-1 px-2" style={{ color: text }}>
                        {r.month}
                      </td>

                      <td className="py-1 px-2" style={{ color: text }}>
                        {r.category_name || r.category_id}
                        {hasConflict && (
                          <span
                            className="ml-2 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full border"
                            style={{
                              borderColor: `color-mix(in srgb, ${warning} 45%, ${border})`,
                              background: `color-mix(in srgb, ${warning} 12%, transparent)`,
                              color: warning,
                            }}
                          >
                            Existe
                          </span>
                        )}
                      </td>

                      <td className="py-1 px-2 text-right" style={{ color: text, fontWeight: 600 }}>
                        {currency(r.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Conflictos */}
        <div className="space-y-1">
          <h4 className="font-semibold text-sm" style={{ color: text }}>
            Conflictos detectados
          </h4>

          {conflicts.length === 0 ? (
            <div className="text-sm" style={{ color: muted }}>
              No hay conflictos. Se crearán nuevos presupuestos.
            </div>
          ) : (
            <div className="text-sm space-y-1" style={{ color: "color-mix(in srgb, var(--text) 85%, transparent)" }}>
              <p>
                Ya existen presupuestos para algunos <em>mes–categoría</em>. Por
                defecto solo se seleccionan los que no tienen presupuesto; puedes
                marcar también los que tienen presupuesto para reemplazarlos.
              </p>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <span style={{ color: text, fontWeight: 700 }}>{c.month}</span>{" "}
                    —{" "}
                    <span style={{ color: text }}>
                      {c.category_name || c.category_id}
                    </span>
                    :{" "}
                    <span style={{ color: muted }}>
                      actual {currency(c.current_amount)} → nuevo{" "}
                      {currency(c.new_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs" style={{ color: muted }}>
            * No se importarán meses anteriores al actual.
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="ff-btn ff-btn-outline">
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !hasItems || selectedKeys.length === 0}
              className="ff-btn ff-btn-primary"
              style={
                loading || !hasItems || selectedKeys.length === 0
                  ? { opacity: 0.55, cursor: "not-allowed", boxShadow: "none" }
                  : undefined
              }
            >
              Importar seleccionados
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
