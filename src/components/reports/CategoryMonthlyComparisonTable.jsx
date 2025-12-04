// src/components/CategoryMonthlyComparisonTable.jsx
import { useEffect, useState } from "react";
import axios from "axios";

function CategoryMonthlyComparisonTable({ token }) {
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
          `${api}/analytics/category-monthly-comparison?year1=${year1}&month1=${month1}&year2=${year2}&month2=${month2}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setRows(res.data.data || []);
        setMeta(res.data.meta || null);
      } catch (err) {
        console.error("Error al cargar comparativo por categoría:", err);
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
    }).format(value || 0);

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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-md font-semibold text-gray-700">
          Comparativo mensual por categoría
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

      {meta && (
        <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3">
          <span>
            Mes 1:{" "}
            <strong>{monthLabel(meta.month1)}</strong> — Total:{" "}
            <strong>{formatCurrency(meta.month1_total)}</strong>
          </span>
          <span>
            Mes 2:{" "}
            <strong>{monthLabel(meta.month2)}</strong> — Total:{" "}
            <strong>{formatCurrency(meta.month2_total)}</strong>
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Cargando comparativo...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          No hay datos de gastos para los meses seleccionados.
        </p>
      ) : (
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-right">
                Mes 1 ({monthLabel(meta?.month1)})
              </th>
              <th className="px-3 py-2 text-right">
                Mes 2 ({monthLabel(meta?.month2)})
              </th>
              <th className="px-3 py-2 text-right">Diferencia (Mes2 − Mes1)</th>
              <th className="px-3 py-2 text-right">% cambio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isUp = row.diff > 0;
              const diffColor = isUp ? "text-red-600" : "text-green-600";

              return (
                <tr
                  key={row.category_id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.category_name}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(row.month1_total)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrency(row.month2_total)}
                  </td>
                  <td className={`px-3 py-2 text-right ${diffColor}`}>
                    {formatCurrency(row.diff)}
                  </td>
                  <td className={`px-3 py-2 text-right ${diffColor}`}>
                    {row.diff_percent.toFixed(2)}%
                  </td>
                </tr>
              );
            })}

            {/* Fila de totales generales */}
            {meta && (
              <tr className="bg-gray-50 font-semibold">
                <td className="px-3 py-2 text-left">TOTAL</td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(meta.month1_total)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(meta.month2_total)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatCurrency(meta.month2_total - meta.month1_total)}
                </td>
                <td className="px-3 py-2 text-right">
                  {(() => {
                    const m1 = meta.month1_total || 0;
                    const m2 = meta.month2_total || 0;
                    let p = 0;
                    if (m1 === 0 && m2 > 0) p = 100;
                    else if (m1 !== 0) p = ((m2 - m1) / m1) * 100;
                    return `${p.toFixed(2)}%`;
                  })()}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <p className="text-xs text-gray-500 mt-2">
        La diferencia y el % cambio se calculan como: Mes 2 − Mes 1.
      </p>
    </div>
  );
}

export default CategoryMonthlyComparisonTable;
