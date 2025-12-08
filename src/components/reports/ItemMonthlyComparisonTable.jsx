// src/components/ItemMonthlyComparisonTable.jsx
import { useEffect, useState } from "react";
import axios from "axios";

function ItemMonthlyComparisonTable({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const today = new Date();

  // Mes 2: actual
  const defaultYear2 = today.getFullYear();
  const defaultMonth2 = today.getMonth() + 1; // 1-12

  // Mes 1: anterior
  let defaultYear1 = defaultYear2;
  let defaultMonth1 = defaultMonth2 - 1;
  if (defaultMonth1 < 1) {
    defaultMonth1 = 12;
    defaultYear1 = defaultYear2 - 1;
  }

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const [year1, setYear1] = useState(defaultYear1);
  const [month1, setMonth1] = useState(defaultMonth1);
  const [year2, setYear2] = useState(defaultYear2);
  const [month2, setMonth2] = useState(defaultMonth2);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `${api}/analytics/item-monthly-comparison?year1=${year1}&month1=${month1}&year2=${year2}&month2=${month2}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setRows(res.data.data || []);
        setMeta(res.data.meta || null);
      } catch (err) {
        console.error("Error al cargar comparativo por artículo:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, api, year1, month1, year2, month2]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(Number(value || 0));

  const formatQty = (value) => Number(value || 0).toFixed(2);

  const monthLabel = (yyyyMm) => {
    if (!yyyyMm) return "—";
    const [y, m] = yyyyMm.split("-");
    return `${m}/${y}`;
  };

  const handleYear1Change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setYear1(val);
  };
  const handleMonth1Change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 12) setMonth1(val);
  };
  const handleYear2Change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) setYear2(val);
  };
  const handleMonth2Change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 12) setMonth2(val);
  };

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
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg md:text-xl font-semibold text-slate-100">
            Comparativo mensual por artículo
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Compara cantidades y montos por artículo entre dos meses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Mes 1:</span>
            <input
              type="number"
              value={year1}
              onChange={handleYear1Change}
              className="
                w-20 rounded-lg px-2 py-1
                bg-slate-900 border border-slate-700
                text-slate-100 text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              "
              min="2000"
            />
            <input
              type="number"
              value={month1}
              onChange={handleMonth1Change}
              className="
                w-16 rounded-lg px-2 py-1
                bg-slate-900 border border-slate-700
                text-slate-100 text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              "
              min="1"
              max="12"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Mes 2:</span>
            <input
              type="number"
              value={year2}
              onChange={handleYear2Change}
              className="
                w-20 rounded-lg px-2 py-1
                bg-slate-900 border border-slate-700
                text-slate-100 text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              "
              min="2000"
            />
            <input
              type="number"
              value={month2}
              onChange={handleMonth2Change}
              className="
                w-16 rounded-lg px-2 py-1
                bg-slate-900 border border-slate-700
                text-slate-100 text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              "
              min="1"
              max="12"
            />
          </div>
        </div>
      </div>

      {/* Meta de totales */}
      {meta && (
        <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-slate-300">
          <span>
            <span className="text-slate-300">Mes 1:</span>{" "}
            <strong className="text-slate-100">
              {monthLabel(meta.month1)}
            </strong>{" "}
            <span className="text-slate-300">— Total gasto:</span>{" "}
            <strong className="text-emerald-300">
              {formatCurrency(meta.month1_total_amount)}
            </strong>
          </span>
          <span>
            <span className="text-slate-300">Mes 2:</span>{" "}
            <strong className="text-slate-100">
              {monthLabel(meta.month2)}
            </strong>{" "}
            <span className="text-slate-300">— Total gasto:</span>{" "}
            <strong className="text-emerald-300">
              {formatCurrency(meta.month2_total_amount)}
            </strong>
          </span>
        </div>
      )}

      {/* Tabla / estados */}
      {loading ? (
        <p className="text-sm text-slate-400">Cargando comparativo...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">
          No hay datos de gastos para los meses seleccionados.
        </p>
      ) : (
        <div
          className="
            overflow-x-auto max-h-96 overflow-y-auto
            rounded-xl
            border border-slate-800
            bg-slate-950/60
          "
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-900/80 text-slate-300">
                <th className="px-3 py-2 text-left font-medium">Artículo</th>
                <th className="px-3 py-2 text-right font-medium">
                  Cant. Mes 1 ({monthLabel(meta?.month1)})
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Monto Mes 1 ({monthLabel(meta?.month1)})
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Cant. Mes 2 ({monthLabel(meta?.month2)})
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Monto Mes 2 ({monthLabel(meta?.month2)})
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Dif. monto (Mes 2 − Mes 1)
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Dif. cantidad (Mes 2 − Mes 1)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diffAmount = Number(row.diff_amount || 0);
                const diffQty = Number(row.diff_qty || 0);

                const isUpAmount = diffAmount > 0;
                const diffAmountColor = isUpAmount
                  ? "text-rose-400"
                  : diffAmount < 0
                  ? "text-emerald-400"
                  : "text-slate-300";

                const qtyDiffColor =
                  diffQty > 0
                    ? "text-rose-400"
                    : diffQty < 0
                    ? "text-emerald-400"
                    : "text-slate-300";

                return (
                  <tr
                    key={row.item_id}
                    className="
                      border-b border-slate-800 last:border-0
                      hover:bg-slate-900/60 transition-colors
                    "
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-slate-200">
                      {row.item_name}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {formatQty(row.month1_qty)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {formatCurrency(row.month1_amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {formatQty(row.month2_qty)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200">
                      {formatCurrency(row.month2_amount)}
                    </td>
                    <td className={`px-3 py-2 text-right ${diffAmountColor}`}>
                      {formatCurrency(diffAmount)}
                    </td>
                    <td className={`px-3 py-2 text-right ${qtyDiffColor}`}>
                      {formatQty(diffQty)}
                    </td>
                  </tr>
                );
              })}

              {meta && (
                <tr className="bg-slate-900/80 font-semibold">
                  <td className="px-3 py-2 text-left text-slate-100">
                    TOTAL
                  </td>
                  <td className="px-3 py-2 text-right text-slate-100">—</td>
                  <td className="px-3 py-2 text-right text-slate-100">
                    {formatCurrency(meta.month1_total_amount)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-100">—</td>
                  <td className="px-3 py-2 text-right text-slate-100">
                    {formatCurrency(meta.month2_total_amount)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-100">
                    {formatCurrency(
                      Number(meta.month2_total_amount || 0) -
                        Number(meta.month1_total_amount || 0)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-100">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-300 mt-1">
        La diferencia de monto y de cantidad se calculan como Mes 2 − Mes 1.
        Los montos incluyen ITBIS según la configuración del artículo.
      </p>
    </div>
  );
}

export default ItemMonthlyComparisonTable;
