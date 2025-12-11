import { useEffect, useState } from "react";
import axios from "axios";

function UnusualExpensesTable({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/unusual-expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) =>
        console.error("Error cargando gastos atípicos:", err)
      );
  }, [token]);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(v || 0);

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-100">
          Gastos atípicos (outliers)
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Transacciones del mes actual muy por encima de su comportamiento
          histórico por categoría.
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No se detectaron gastos atípicos este mes (o no hay suficiente
          histórico).
        </p>
      ) : (
        <div className="max-h-80 overflow-auto border border-slate-800 rounded-xl">
          <table className="w-full text-sm text-slate-200">
            <thead className="bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-slate-400 uppercase tracking-wide">
                  Fecha
                </th>
                <th className="px-3 py-2 text-left text-xs text-slate-400 uppercase tracking-wide">
                  Categoría
                </th>
                <th className="px-3 py-2 text-left text-xs text-slate-400 uppercase tracking-wide">
                  Descripción
                </th>
                <th className="px-3 py-2 text-right text-xs text-slate-400 uppercase tracking-wide">
                  Monto
                </th>
                <th className="px-3 py-2 text-right text-xs text-slate-400 uppercase tracking-wide">
                  z-score
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((tx, idx) => (
                <tr
                  key={tx.id}
                  className={
                    idx % 2 === 0
                      ? "bg-slate-950/40 border-t border-slate-800"
                      : "bg-slate-900/60 border-t border-slate-800"
                  }
                >
                  <td className="px-3 py-1.5 text-xs text-slate-300">
                    {tx.date}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-200">
                    {tx.category}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-300 max-w-[240px] truncate">
                    {tx.description || <span className="italic">—</span>}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-right text-rose-300">
                    {formatCurrency(tx.amount)}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-xs text-right font-semibold ${
                      tx.z_score >= 3
                        ? "text-rose-400"
                        : tx.z_score >= 2.5
                        ? "text-amber-300"
                        : "text-slate-200"
                    }`}
                  >
                    {tx.z_score.toFixed(2)}
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

export default UnusualExpensesTable;
