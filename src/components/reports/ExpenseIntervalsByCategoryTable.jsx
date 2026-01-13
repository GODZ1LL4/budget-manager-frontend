// src/components/reports/ExpenseIntervalsByCategoryTable.jsx
import { useEffect, useState } from "react";
import axios from "axios";

function formatCurrencyDOP(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return dateStr;
  // dd/mm/yyyy
  return `${d}/${m}/${y}`;
}

function ExpenseIntervalsByCategoryTable({ token }) {
  const [data, setData] = useState([]);
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    axios
      .get(`${api}/analytics/expense-intervals-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { months },
      })
      .then((res) => {
        setData(res.data?.data || []);
      })
      .catch((err) => {
        console.error("Error cargando intervalos de gasto por categoría:", err);
        setError(
          err.response?.data?.error ||
            "No se pudieron cargar los intervalos de gasto."
        );
      })
      .finally(() => setLoading(false));
  }, [token, months, api]);

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-4
      "
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            Intervalo entre gastos por categoría
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Analiza cada cuánto tiempo vuelves a gastar en cada categoría.
            Útil para identificar compras frecuentes, hábitos y posibles
            compras impulsivas.
          </p>
        </div>

        {/* Filtro de meses */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Período analizado:</span>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 12)}
            className="
              bg-slate-900 border border-slate-700 rounded-lg
              px-2 py-1 text-sm text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70
            "
          >
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
            <option value={24}>Últimos 24 meses</option>
          </select>
        </div>
      </div>

      {/* Estados */}
      {loading && (
        <p className="text-sm text-slate-400 italic">
          Calculando intervalos de gasto…
        </p>
      )}
      {error && (
        <p className="text-sm text-rose-400">
          {error || "Ocurrió un error al cargar los datos."}
        </p>
      )}
      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-slate-500 italic">
          No hay datos suficientes para calcular intervalos de gasto.
        </p>
      )}

      {/* Tabla */}
      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
          <table className="min-w-full text-sm text-slate-100">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Categoría
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  # Transacciones
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Intervalo promedio (días)
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Intervalo mediano (días)
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Mínimo (días)
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Máximo (días)
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Total gastado
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Primer registro
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Último registro
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr
                  key={`${row.category_id || "cat"}-${idx}`}
                  className={
                    idx % 2 === 0
                      ? "bg-slate-950/60"
                      : "bg-slate-900/70 border-t border-slate-800/60"
                  }
                >
                  <td className="px-3 py-2 align-top text-slate-100">
                    {row.category_name || "Sin categoría"}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-slate-100">
                    {row.transactions_count}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-slate-100">
                    {row.avg_interval_days}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-slate-100">
                    {row.median_interval_days}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-slate-100">
                    {row.min_interval_days}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-slate-100">
                    {row.max_interval_days}
                  </td>
                  <td className="px-3 py-2 align-top text-right text-emerald-300 font-semibold">
                    {formatCurrencyDOP(row.total_spent)}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-slate-300">
                    {formatDate(row.first_date)}
                  </td>
                  <td className="px-3 py-2 align-top text-center text-slate-300">
                    {formatDate(row.last_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ExpenseIntervalsByCategoryTable;
