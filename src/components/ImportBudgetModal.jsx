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
  // Sin loop: no dependemos de conflictMap y solo seteamos si realmente cambia.
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
    // ⚠️ deps: usamos arrays base (items/conflicts) para evitar dependencia "conflictMap" inestable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, conflicts]);

  const allChecked =
    allKeys.length > 0 && selectedKeys.length === allKeys.length;
  const someChecked =
    selectedKeys.length > 0 && selectedKeys.length < allKeys.length;

  const toggleAll = () => {
    if (allChecked) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(allKeys);
    }
  };

  const toggleOne = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleConfirm = () => {
    onConfirm({ selectedKeys });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar a presupuesto"
      size="xl"
    >
      <div className="space-y-4 text-slate-200">
        {/* Descripción */}
        <div className="text-sm text-slate-300">
          Selecciona qué rango importar desde el escenario.
          <br />
          <strong className="text-slate-100">Ingresos no se importan</strong>;
          solo gastos por categoría.
        </div>

        {/* Selector de alcance */}
        <div className="flex flex-wrap gap-2">
          <button
            className={`
              px-3 py-1.5 rounded-full text-xs font-semibold
              border transition-colors
              ${
                scope === "current"
                  ? "bg-slate-900 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  : "bg-slate-900/40 border-slate-700 text-slate-300 hover:bg-slate-900/70"
              }
            `}
            onClick={() => setScope("current")}
            disabled={loading}
            type="button"
          >
            Mes actual
          </button>

          <button
            className={`
              px-3 py-1.5 rounded-full text-xs font-semibold
              border transition-colors
              ${
                scope === "all"
                  ? "bg-slate-900 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  : "bg-slate-900/40 border-slate-700 text-slate-300 hover:bg-slate-900/70"
              }
            `}
            onClick={() => setScope("all")}
            disabled={loading}
            type="button"
          >
            Todo el escenario (hasta 31 dic)
          </button>
        </div>

        {/* Rango calculado */}
        <div className="text-xs text-slate-400">
          Rango efectivo:{" "}
          <span className="text-slate-200">{preview?.from || "—"}</span> →{" "}
          <span className="text-slate-200">{preview?.to || "—"}</span>
        </div>

        {/* Resumen rápido */}
        <div
          className="
            text-xs sm:text-sm text-slate-200
            bg-slate-900/60 border border-slate-700
            rounded-xl px-3 py-2
            flex flex-wrap gap-3
          "
        >
          <span>
            Detectados: <span className="font-semibold">{items.length}</span>
          </span>
          <span>
            Con budget existente:{" "}
            <span className="font-semibold">{conflicts.length}</span>
          </span>
          <span>
            Seleccionados:{" "}
            <span className="font-semibold text-emerald-400">
              {selectedKeys.length}
            </span>
          </span>
        </div>

        {/* Tabla de importación con checkboxes */}
        <div className="border border-slate-800 rounded-lg p-2 bg-slate-950/40 max-h-60 overflow-auto">
          {loading && <div className="text-sm text-slate-400">Cargando…</div>}

          {!loading && !hasItems && (
            <div className="text-sm text-slate-400 italic">
              No hay nada para importar con las reglas y fechas actuales.
            </div>
          )}

          {!loading && hasItems && (
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left bg-slate-900/80 border-b border-slate-800">
                  <th className="py-1 px-2 w-8">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someChecked;
                      }}
                      onChange={toggleAll}
                      className="accent-emerald-400"
                    />
                  </th>
                  <th className="py-1 px-2 text-slate-300">Mes</th>
                  <th className="py-1 px-2 text-slate-300">Categoría</th>
                  <th className="py-1 px-2 text-right text-slate-300">Monto</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => {
                  const key = `${r.month}::${r.category_id}`;
                  const checked = selectedKeys.includes(key);
                  const hasConflict = conflictMap.has(key);

                  return (
                    <tr
                      key={key}
                      className={
                        i % 2 === 0
                          ? "border-t border-slate-800 bg-slate-950/40"
                          : "border-t border-slate-800 bg-slate-900/50"
                      }
                    >
                      <td className="py-1 px-2 align-middle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(key)}
                          className="accent-emerald-400"
                        />
                      </td>
                      <td className="py-1 px-2 text-slate-200">{r.month}</td>
                      <td className="py-1 px-2 text-slate-200">
                        {r.category_name || r.category_id}
                        {hasConflict && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-300 bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                            Existe
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right text-slate-100">
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
          <h4 className="font-semibold text-slate-200 text-sm">
            Conflictos detectados
          </h4>

          {conflicts.length === 0 ? (
            <div className="text-sm text-slate-400">
              No hay conflictos. Se crearán nuevos presupuestos.
            </div>
          ) : (
            <div className="text-sm text-slate-300 space-y-1">
              <p>
                Ya existen presupuestos para algunos <em>mes–categoría</em>. Por
                defecto solo se seleccionan los que no tienen presupuesto; puedes
                marcar también los que tienen presupuesto para reemplazarlos.
              </p>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <span className="text-slate-100">{c.month}</span> —{" "}
                    <span className="text-slate-200">
                      {c.category_name || c.category_id}
                    </span>
                    :{" "}
                    <span className="text-slate-400">
                      actual {currency(c.current_amount)} → nuevo{" "}
                      {currency(c.new_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Botones finales */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            * No se importarán meses anteriores al actual.
          </div>

          <div className="flex gap-2">
            <button
              className="
                px-3 py-2 rounded-lg text-sm font-semibold
                border border-slate-600
                bg-slate-900 text-slate-300
                hover:bg-slate-800 hover:border-slate-500
                transition-all
              "
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>

            <button
              className={`
                px-3 py-2 rounded-lg text-sm font-semibold
                ${
                  loading || !hasItems || selectedKeys.length === 0
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.6)] hover:brightness-110 active:scale-95"
                }
                transition-all
              `}
              onClick={handleConfirm}
              disabled={loading || !hasItems || selectedKeys.length === 0}
              type="button"
            >
              Importar seleccionados
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
