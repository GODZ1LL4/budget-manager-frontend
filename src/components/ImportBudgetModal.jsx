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
  const hasItems = (preview?.items || []).length > 0;
  const conflicts = preview?.conflicts || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar a presupuesto"
    >
      <div className="space-y-3">
        <div className="text-sm text-gray-600">
          Selecciona qué rango importar desde el escenario. <br />
          <strong>Ingresos no se importan</strong>; solo gastos por categoría.
        </div>

        <div className="flex gap-2">
          <button
            className={`px-3 py-1 rounded border ${scope === "current" ? "bg-indigo-600 text-white" : "bg-white"}`}
            onClick={() => setScope("current")}
            disabled={loading}
          >
            Mes actual
          </button>
          <button
            className={`px-3 py-1 rounded border ${scope === "all" ? "bg-indigo-600 text-white" : "bg-white"}`}
            onClick={() => setScope("all")}
            disabled={loading}
          >
            Todo el escenario (hasta 31 dic)
          </button>
        </div>

        <div className="text-xs text-gray-500">
          Rango efectivo: {preview?.from} → {preview?.to}
        </div>

        {/* Resumen de lo que se va a importar */}
        <div className="border rounded p-2 max-h-60 overflow-auto">
          {loading && <div className="text-sm text-gray-500">Cargando…</div>}

          {!loading && !hasItems && (
            <div className="text-sm text-gray-500 italic">
              No hay nada para importar con las reglas y fechas actuales.
            </div>
          )}

          {!loading && hasItems && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-1">Mes</th>
                  <th className="py-1">Categoría</th>
                  <th className="py-1 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1">{r.month}</td>
                    <td className="py-1">{r.category_name || r.category_id}</td>
                    <td className="py-1 text-right">{currency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Conflictos */}
        <div className="mt-2">
          <h4 className="font-semibold text-gray-800 text-sm">Conflictos detectados</h4>
          {(!conflicts || conflicts.length === 0) ? (
            <div className="text-sm text-gray-500">
              No hay conflictos. Se crearán nuevos presupuestos.
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              Ya existen presupuestos para algunos <em>mes–categoría</em>. Elige qué hacer:
              <ul className="list-disc ml-5 mt-2">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <span className="text-gray-800">{c.month}</span> — {c.category_name || c.category_id}:{" "}
                    actual {currency(c.current_amount)} → nuevo {currency(c.new_amount)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Acción */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-500">
            * No se importarán meses anteriores al actual.
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded bg-gray-200" onClick={onClose}>
              Cancelar
            </button>

            {/* Si hay conflictos, mostramos dos botones */}
            {conflicts.length > 0 ? (
              <>
                <button
                  className="px-3 py-2 rounded border"
                  onClick={() => onConfirm({ strategy: "skip" })}
                  disabled={loading || !hasItems}
                  title="No toques los existentes; crea solo los nuevos"
                >
                  Omitir existentes
                </button>
                <button
                  className="px-3 py-2 rounded bg-indigo-600 text-white"
                  onClick={() => onConfirm({ strategy: "replace" })}
                  disabled={loading || !hasItems}
                  title="Reemplaza montos de los existentes con los nuevos"
                >
                  Reemplazar existentes
                </button>
              </>
            ) : (
              <button
                className="px-3 py-2 rounded bg-indigo-600 text-white"
                onClick={() => onConfirm({ strategy: "skip" })}
                disabled={loading || !hasItems}
              >
                Importar
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
