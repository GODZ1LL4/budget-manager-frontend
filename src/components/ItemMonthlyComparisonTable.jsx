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
    <div className="bg-white p-4 rounded shadow overflow-x-auto">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-md font-semibold text-gray-700">
          Comparativo mensual por artículo
        </h3>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Mes 1:</span>
            <input
              type="number"
              value={year1}
              onChange={handleYear1Change}
              className="border border-gray-300 rounded px-2 py-1 w-20"
              min="2000"
            />
            <input
              type="number"
              value={month1}
              onChange={handleMonth1Change}
              className="border border-gray-300 rounded px-2 py-1 w-16"
              min="1"
              max="12"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-600">Mes 2:</span>
            <input
              type="number"
              value={year2}
              onChange={handleYear2Change}
              className="border border-gray-300 rounded px-2 py-1 w-20"
              min="2000"
            />
            <input
              type="number"
              value={month2}
              onChange={handleMonth2Change}
              className="border border-gray-300 rounded px-2 py-1 w-16"
              min="1"
              max="12"
            />
          </div>
        </div>
      </div>

      {/* Meta de totales */}
      {meta && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3">
          <span>
            Mes 1:{" "}
            <strong>{monthLabel(meta.month1)}</strong> — Total gasto:{" "}
            <strong>{formatCurrency(meta.month1_total_amount)}</strong>
          </span>
          <span>
            Mes 2:{" "}
            <strong>{monthLabel(meta.month2)}</strong> — Total gasto:{" "}
            <strong>{formatCurrency(meta.month2_total_amount)}</strong>
          </span>
        </div>
      )}

      {/* Tabla / estados */}
      {loading ? (
        <p className="text-sm text-gray-600">Cargando comparativo...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          No hay datos de gastos para los meses seleccionados.
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="px-3 py-2 text-left">Artículo</th>
                <th className="px-3 py-2 text-right">
                  Cant. Mes 1 ({monthLabel(meta?.month1)})
                </th>
                <th className="px-3 py-2 text-right">
                  Monto Mes 1 ({monthLabel(meta?.month1)})
                </th>
                <th className="px-3 py-2 text-right">
                  Cant. Mes 2 ({monthLabel(meta?.month2)})
                </th>
                <th className="px-3 py-2 text-right">
                  Monto Mes 2 ({monthLabel(meta?.month2)})
                </th>
                <th className="px-3 py-2 text-right">
                  Dif. monto (Mes2 − Mes1)
                </th>
                <th className="px-3 py-2 text-right">
                  Dif. cantidad (Mes2 − Mes1)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diffAmount = Number(row.diff_amount || 0);
                const diffQty = Number(row.diff_qty || 0);

                const isUpAmount = diffAmount > 0;
                const diffAmountColor = isUpAmount
                  ? "text-red-600"
                  : diffAmount < 0
                  ? "text-green-600"
                  : "text-gray-700";

                const qtyDiffColor =
                  diffQty > 0
                    ? "text-red-600"
                    : diffQty < 0
                    ? "text-green-600"
                    : "text-gray-700";

                return (
                  <tr
                    key={row.item_id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.item_name}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatQty(row.month1_qty)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(row.month1_amount)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatQty(row.month2_qty)}
                    </td>
                    <td className="px-3 py-2 text-right">
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
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-2 text-left">TOTAL</td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(meta.month1_total_amount)}
                  </td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(meta.month2_total_amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(
                      Number(meta.month2_total_amount || 0) -
                        Number(meta.month1_total_amount || 0)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        La diferencia de monto y de cantidad se calculan como Mes 2 − Mes 1.
        Los montos incluyen ITBIS según la configuración del artículo. Usa los
        filtros de meses para enfocar tu análisis.
      </p>
    </div>
  );
}

export default ItemMonthlyComparisonTable;
